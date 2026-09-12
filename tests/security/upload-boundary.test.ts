/**
 * Phase 3 batch 2 — upload and file-serving boundary.
 * Behavioural tests run against the pure policy module with temp
 * directories; static tests pin the wiring in the two routes and the lib.
 */
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  ALLOWED_TYPES,
  ALLOWED_UPLOAD_FOLDERS,
  MAX_UPLOAD_BYTES,
  buildStoredFileName,
  isAllowedFolder,
  isSafeSegment,
  resolveWithinRoot,
  servePolicyFor,
  validateUpload,
} from "../../src/lib/security/upload-policy.ts";

const SRC = path.join(import.meta.dirname, "..", "..", "src");
const code = (rel: string) =>
  readFileSync(path.join(SRC, rel), "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

// ---------------------------------------------------------------------------
// Folder allowlist
// ---------------------------------------------------------------------------
describe("folder allowlist", () => {
  test("only literal members are accepted", () => {
    for (const f of ALLOWED_UPLOAD_FOLDERS) assert.equal(isAllowedFolder(f), true);
    assert.equal(isAllowedFolder("general"), true);
  });

  test("unknown, traversal, absolute, encoded and mixed-separator folders are rejected", () => {
    for (const bad of [
      "unknown", "General", " general", "general/",
      "../public", "..", ".", "general/../../public", "general/..",
      "/etc", "/tmp/x", "C:\\Windows", "..\\..\\public", "general\\..\\..",
      "%2e%2e%2fpublic", "..%2fpublic", "general%00", "general\0",
      "", null, undefined, 5, {}, ["general"],
    ]) {
      assert.equal(isAllowedFolder(bad), false, `should reject ${String(bad)}`);
    }
  });
});

// ---------------------------------------------------------------------------
// Segment and containment
// ---------------------------------------------------------------------------
describe("isSafeSegment", () => {
  test("accepts uids and uuid file names, rejects anything that could traverse", () => {
    assert.equal(isSafeSegment("Abc123_-"), true);
    assert.equal(isSafeSegment("3f2a9c1e-1111-4222-8333-444455556666.mp4"), true);
    for (const bad of ["..", ".", ".hidden", "a/b", "a\\b", "a\0b", "", "a b", "a?b", "%2e%2e", "x".repeat(129), 5, null]) {
      assert.equal(isSafeSegment(bad), false, `should reject ${String(bad)}`);
    }
  });
});

describe("resolveWithinRoot", () => {
  let base: string;
  let root: string;
  before(() => {
    base = mkdtempSync(path.join(tmpdir(), "p3b2-"));
    root = path.join(base, "uploads");
    mkdirSync(path.join(root, "general", "uid1"), { recursive: true });
    mkdirSync(path.join(base, "uploads-sibling"), { recursive: true });
    writeFileSync(path.join(base, "uploads-sibling", "secret.txt"), "x");
    writeFileSync(path.join(base, "outside.txt"), "x");
  });
  after(() => rmSync(base, { recursive: true, force: true }));

  test("a valid nested path stays inside the root", () => {
    const p = resolveWithinRoot(root, ["general", "uid1", "file.pdf"]);
    assert.ok(p && p.startsWith(path.resolve(root) + path.sep));
  });

  test("../ and nested traversal are rejected", () => {
    assert.equal(resolveWithinRoot(root, ["..", "outside.txt"]), null);
    assert.equal(resolveWithinRoot(root, ["general", "..", "..", "outside.txt"]), null);
    assert.equal(resolveWithinRoot(root, ["general/../../outside.txt"]), null);
  });

  test("absolute POSIX and Windows paths and mixed separators are rejected", () => {
    assert.equal(resolveWithinRoot(root, ["/etc/passwd"]), null);
    assert.equal(resolveWithinRoot(root, ["C:\\Windows\\win.ini"]), null);
    assert.equal(resolveWithinRoot(root, ["general\\..\\..\\outside.txt"]), null);
    assert.equal(resolveWithinRoot(root, ["general", "uid1\\..\\..\\..\\outside.txt"]), null);
  });

  test("encoded traversal is rejected even if decoded upstream", () => {
    assert.equal(resolveWithinRoot(root, ["%2e%2e", "outside.txt"]), null);
    assert.equal(resolveWithinRoot(root, [decodeURIComponent("%2e%2e"), "outside.txt"]), null);
  });

  test("sibling-prefix directory (uploads-sibling) does not pass containment", () => {
    assert.equal(resolveWithinRoot(root, ["..", "uploads-sibling", "secret.txt"]), null);
    // Even a hand-built candidate that merely string-prefixes the root is refused.
    const sibling = path.join(base, "uploads-sibling", "secret.txt");
    assert.ok(sibling.startsWith(path.resolve(root)), "test precondition: raw prefix would have matched");
    assert.equal(resolveWithinRoot(root, [path.relative(root, sibling)]), null);
  });

  test("the root itself, empty input and non-array input are rejected", () => {
    assert.equal(resolveWithinRoot(root, []), null);
    assert.equal(resolveWithinRoot(root, ["."]), null);
    assert.equal(resolveWithinRoot(root, "general" as unknown as string[]), null);
    assert.equal(existsSync(path.join(base, "outside.txt")), true, "fixture intact");
  });
});

// ---------------------------------------------------------------------------
// File type / size policy
// ---------------------------------------------------------------------------
describe("validateUpload", () => {
  const ok = (name: string, type: string, size = 10) => validateUpload({ name, type, size });

  test("allowlisted extension with matching MIME is accepted", () => {
    assert.deepEqual(ok("photo.JPG", "image/jpeg"), { ok: true, ext: ".jpg", mime: "image/jpeg" });
    assert.equal(ok("doc.pdf", "application/pdf").ok, true);
    assert.equal(ok("clip.mp4", "video/mp4").ok, true);
    assert.equal(ok("clip.mp4", "video/mp4; codecs=avc1").ok, true);
  });

  test("dangerous and unknown extensions are rejected (415)", () => {
    for (const [name, type] of [
      ["page.html", "text/html"], ["page.htm", "text/html"], ["img.svg", "image/svg+xml"],
      ["run.js", "text/javascript"], ["run.mjs", "text/javascript"], ["shell.php", "application/x-httpd-php"],
      ["app.exe", "application/x-msdownload"], ["x.sh", "application/x-sh"], ["x.bat", "text/plain"],
      ["noext", "application/pdf"], ["x.json", "application/json"], ["x.xml", "text/xml"],
      ["trick.pdf.html", "text/html"],
    ]) {
      const r = ok(name, type);
      assert.equal(r.ok, false, `${name} must be rejected`);
      if (!r.ok) assert.equal(r.status, 415);
    }
  });

  test("MIME mismatch with an allowed extension is rejected", () => {
    for (const [name, type] of [
      ["img.png", "text/html"], ["img.png", "image/svg+xml"], ["clip.mp4", "application/octet-stream"],
      ["doc.pdf", "image/png"], ["img.jpg", ""], ["img.gif", "image/gif+xml"],
    ]) {
      const r = ok(name, type);
      assert.equal(r.ok, false, `${name}/${type} must be rejected`);
    }
  });

  test("size over the cap is rejected (413); empty or malformed size is rejected (400)", () => {
    const big = validateUpload({ name: "clip.mp4", type: "video/mp4", size: MAX_UPLOAD_BYTES + 1 });
    assert.equal(big.ok, false); if (!big.ok) assert.equal(big.status, 413);
    const atCap = validateUpload({ name: "clip.mp4", type: "video/mp4", size: MAX_UPLOAD_BYTES });
    assert.equal(atCap.ok, true);
    for (const size of [0, -1, Number.NaN, "10", undefined]) {
      const r = validateUpload({ name: "doc.pdf", type: "application/pdf", size });
      assert.equal(r.ok, false); if (!r.ok) assert.equal(r.status, 400);
    }
  });

  test("no dangerous type is allowlisted", () => {
    const mimes = Object.values(ALLOWED_TYPES).flatMap((r) => r.mimes);
    for (const m of mimes) assert.doesNotMatch(m, /text\/html|svg|javascript|ecmascript|text\/xml|application\/xml|xhtml|x-sh\b|php|msdownload|octet-stream/);
    for (const ext of Object.keys(ALLOWED_TYPES)) assert.doesNotMatch(ext, /htm|svg|js|php|exe|sh|bat|cmd|xml/);
  });
});

describe("buildStoredFileName", () => {
  test("uses the uuid and the allowlisted extension only, never the client name", () => {
    const uuid = "3f2a9c1e-1111-4222-8333-444455556666";
    assert.equal(buildStoredFileName(uuid, ".pdf"), `${uuid}.pdf`);
    assert.throws(() => buildStoredFileName("../evil", ".pdf"));
    assert.throws(() => buildStoredFileName(uuid, ".html"));
    assert.throws(() => buildStoredFileName(uuid, ".pdf.html"));
  });
});

// ---------------------------------------------------------------------------
// Serving policy
// ---------------------------------------------------------------------------
describe("servePolicyFor", () => {
  test("images, PDF and MP4/MOV are inline; documents and other video are attachments", () => {
    assert.deepEqual(servePolicyFor("/x/a.png"), { contentType: "image/png", disposition: "inline" });
    assert.deepEqual(servePolicyFor("/x/a.pdf"), { contentType: "application/pdf", disposition: "inline" });
    assert.deepEqual(servePolicyFor("/x/a.mp4"), { contentType: "video/mp4", disposition: "inline" });
    assert.deepEqual(servePolicyFor("/x/a.docx"), {
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      disposition: "attachment",
    });
    assert.equal(servePolicyFor("/x/a.mkv")?.disposition, "attachment");
  });

  test("HTML, SVG, scripts and unknown types are never served", () => {
    for (const f of ["a.html", "a.htm", "a.svg", "a.js", "a.mjs", "a.php", "a.exe", "a.txt", "a", "a.PDF.html"]) {
      assert.equal(servePolicyFor(`/x/${f}`), null, `${f} must not be served`);
    }
    for (const rule of Object.values(ALLOWED_TYPES)) {
      assert.notEqual(rule.mimes[0], "text/html");
      assert.notEqual(rule.mimes[0], "image/svg+xml");
    }
  });
});

// ---------------------------------------------------------------------------
// Route wiring (static)
// ---------------------------------------------------------------------------
describe("POST /api/upload wiring", () => {
  const src = code("app/api/upload/route.ts");

  test("central auth, single handler, no legacy helper, no client identity", () => {
    assert.equal((src.match(/^export const POST = withApi/gm) ?? []).length, 1);
    assert.equal((src.match(/^export (async )?function POST/gm) ?? []).length, 0);
    assert.ok(src.includes("await requireAuth(req)"));
    for (const needle of ["verifyIdToken", "x-user-id", "x-user-role", "body.uid", "body.userId", "formData.get('uid')", "formData.get('userId')"]) {
      assert.equal(src.includes(needle), false, `unexpected ${needle}`);
    }
  });

  test("folder is validated before any path construction; client filename never reaches the path", () => {
    const folderCheck = src.indexOf("isAllowedFolder(folderInput)");
    const firstPath = src.indexOf("resolveWithinRoot(UPLOAD_ROOT");
    assert.ok(folderCheck > 0 && firstPath > folderCheck, "allowlist check must precede path construction");
    assert.equal(/path\.join\([^)]*folder/.test(src), false, "raw folder must not be joined");
    assert.equal(src.includes("path.extname(file.name)"), false, "client extension must not be used directly");
    assert.equal(src.includes("file.name"), false, "client filename must not reach the stored path");
    assert.ok(src.includes("buildStoredFileName(uuidv4(), check.ext)"));
    assert.ok(src.includes("validateUpload(file)"));
    assert.ok(src.includes("{ flag: 'wx' }"), "never overwrite an existing file");
    assert.equal(src.includes("error.message"), false);
  });
});

describe("GET /api/uploads/[...path] wiring", () => {
  const src = code("app/api/uploads/[...path]/route.ts");

  test("containment via resolveWithinRoot, nosniff, disposition, no raw prefix check, no html/svg", () => {
    assert.ok(src.includes("resolveWithinRoot(UPLOAD_ROOT, pathSegments"));
    assert.equal(src.includes("startsWith(UPLOAD_ROOT)"), false, "raw prefix check must be gone");
    assert.equal(src.includes("path.join(UPLOAD_ROOT, ...pathSegments)"), false);
    assert.ok(src.includes('"X-Content-Type-Options": "nosniff"'));
    assert.ok(src.includes('"Content-Disposition"'));
    assert.ok(src.includes("servePolicyFor(filePath)"));
    assert.equal(/text\/html|image\/svg\+xml|javascript/.test(src), false);
    assert.equal(src.includes("error.message"), false);
    const policy = src.indexOf("servePolicyFor(filePath)");
    assert.ok(policy > 0 && policy < src.indexOf("await readFile(filePath)"), "policy check before reading the file");
  });
});

describe("src/lib/upload-file.ts applies the same policy", () => {
  const src = code("lib/upload-file.ts");
  test("folder allowlist, validation, uuid name and containment are enforced", () => {
    assert.ok(src.includes("isAllowedFolder(folder)"));
    assert.ok(src.includes("validateUpload(file)"));
    assert.ok(src.includes("buildStoredFileName(uuidv4(), check.ext)"));
    assert.ok(src.includes("resolveWithinRoot(UPLOAD_ROOT, [folder, uid, uniqueName])"));
    assert.equal(/path\.join\(UPLOAD_ROOT, folder/.test(src), false);
    assert.equal(src.includes("path.extname(file.name)"), false);
  });
});
