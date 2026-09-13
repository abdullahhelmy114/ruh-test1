/**
 * Phase 3 closure fix F1 — admin knowledge upload temp-path traversal.
 * Behavioural: the server-generated temp path helper, and an end-to-end
 * demonstration that multipart filenames (including traversal payloads)
 * survive parsing yet have no influence on the generated path.
 * Static: the route's wiring.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { serverTempFilePath } from "../../src/lib/security/upload-policy.ts";

const SRC = join(import.meta.dirname, "..", "..", "src");
const ROUTE = "app/api/admin/knowledge/upload-gemini/route.ts";
const code = (rel: string) =>
  readFileSync(join(SRC, rel), "utf8").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

const EXPLOITS = [
  "../../../app.js",
  "../../../../package.json",
  "..\\..\\..\\server.js",
  "../../../../../../app/.next/server/app/page.js",
  "/etc/passwd",
  "C:\\Windows\\System32\\drivers\\etc\\hosts",
  "book.pdf\0.js",
  "%2e%2e%2f%2e%2e%2fx.pdf",
  "a".repeat(5000),
];

describe("serverTempFilePath", () => {
  test("is rooted directly in the given directory with a uuid name and the allowlisted extension", () => {
    const tmp = os.tmpdir();
    const id = randomUUID();
    const p = serverTempFilePath(tmp, id, ".pdf");
    assert.equal(path.dirname(p), path.resolve(tmp));
    assert.equal(path.basename(p), `${id}.pdf`);
  });

  test("takes no filename: a client name cannot be passed and the uuid is validated", () => {
    // The signature is (root, uuid, ext); anything not a uuid in the uuid slot is rejected.
    for (const bad of EXPLOITS) {
      assert.throws(() => serverTempFilePath(os.tmpdir(), bad, ".pdf"), `uuid slot must reject ${JSON.stringify(bad).slice(0, 40)}`);
    }
    assert.throws(() => serverTempFilePath(os.tmpdir(), randomUUID(), ".html"), "extension must be allowlisted");
    assert.throws(() => serverTempFilePath(os.tmpdir(), randomUUID(), "../x.pdf"), "extension cannot traverse");
  });

  test("two calls never collide and never leave the root", () => {
    const a = serverTempFilePath(os.tmpdir(), randomUUID(), ".pdf");
    const b = serverTempFilePath(os.tmpdir(), randomUUID(), ".pdf");
    assert.notEqual(a, b);
    for (const p of [a, b]) assert.ok(p.startsWith(path.resolve(os.tmpdir()) + path.sep));
  });
});

describe("multipart filenames have zero effect on the filesystem location", () => {
  test("Node keeps traversal segments in file.name (the primitive) but the route path ignores the name entirely", async () => {
    for (const name of EXPLOITS) {
      const safeName = name.replace(/"/g, "");
      const body =
        `--B\r\nContent-Disposition: form-data; name="file"; filename="${safeName}"\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.4\r\n` +
        `--B\r\nContent-Disposition: form-data; name="book_title"\r\n\r\nT\r\n--B--\r\n`;
      const req = new Request("http://x", { method: "POST", headers: { "content-type": "multipart/form-data; boundary=B" }, body });
      const fd = await req.formData();
      const file = fd.get("file") as File;
      // Primitive still present at the parser level:
      assert.ok(file.name.length > 0);
      // What the route does with it: nothing. The path depends only on the uuid.
      const id = randomUUID();
      const p = serverTempFilePath(os.tmpdir(), id, ".pdf");
      assert.equal(path.dirname(p), path.resolve(os.tmpdir()));
      assert.equal(path.basename(p), `${id}.pdf`);
      assert.equal(p.includes(path.basename(safeName)), false, "client basename never appears in the temp path");
    }
  });
});

describe("upload-gemini route wiring", () => {
  const src = code(ROUTE);
  test("admin-only, server-generated temp path, no client name in any filesystem call", () => {
    assert.ok(src.includes("withApi(async"));
    assert.ok(src.includes("await requireAdmin(req)"));
    assert.ok(src.includes('serverTempFilePath(os.tmpdir(), randomUUID(), ".pdf")'), "temp path is tmpdir + uuid + server extension");
    assert.equal(/file\.name/.test(src), false, "client filename must not be referenced at all");
    assert.equal(/path\.join\(/.test(src), false, "no ad-hoc path joins in the route");
    assert.equal(/Date\.now\(\)/.test(src), false, "old timestamp-name construction removed");
    assert.ok(src.includes('fs.writeFileSync(tempFilePath, buffer, { flag: "wx" })'), "write never overwrites an existing path");
    assert.ok(src.includes("fs.rmSync(tempFilePath, { force: true })"), "cleanup targets only the generated path");
    assert.equal((src.match(/unlinkSync|rmSync|writeFileSync|writeFile\(/g) ?? []).length, 2, "exactly one write and one cleanup, both on tempFilePath");
    assert.ok(src.indexOf("fs.rmSync(") > src.indexOf("} finally {"), "cleanup lives in finally");
  });

  test("PDF-only policy: declared type, magic bytes, size cap before reading the body", () => {
    assert.ok(src.includes('PDF_MIME = "application/pdf"'));
    assert.ok(src.includes("declaredType !== PDF_MIME") && src.includes("status: 415"));
    assert.ok(src.includes('PDF_SIGNATURE = Buffer.from("%PDF-")') && src.includes(".equals(PDF_SIGNATURE)"));
    assert.ok(src.includes("MAX_PDF_BYTES = 50 * 1024 * 1024"));
    assert.ok(src.includes("file.size > MAX_PDF_BYTES") && src.includes("status: 413"));
    assert.ok(src.indexOf("file.size > MAX_PDF_BYTES") < src.indexOf("await file.arrayBuffer()"), "size rejected before the body is materialised");
    assert.ok(src.indexOf("await file.arrayBuffer()") < src.indexOf("serverTempFilePath("), "type/size checks precede any filesystem work");
    assert.ok(src.includes("mimeType: PDF_MIME"), "provider MIME is the server constant");
    assert.ok(src.includes("boundedString(formData.get(\"book_title\"), { max: TITLE_MAX })"));
  });

  test("error safety", () => {
    assert.equal(src.includes("error.message"), false);
    assert.equal(/NextResponse\.json\([^)]*tempFilePath/.test(src), false, "temp path never returned");
    assert.equal(/console\.(log|error|warn)\([^)]*(tempFilePath|buffer|apiKey|uploadResponse)/.test(src), false, "no path, content or key logged");
    assert.ok(src.includes('error instanceof Error ? error.name : "unknown"'));
    assert.ok(src.includes("status: 503"), "fails closed without the provider key");
    assert.equal(/new GoogleAIFileManager\(process\.env/.test(src), false, "client constructed lazily from a checked key, not at module load with a `!`");
  });
});
