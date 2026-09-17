/**
 * Phase 3 closure fix F2 — signed direct-to-Cloudinary upload.
 * Behavioural: purpose policy checks and the signer (verified against the
 * official SDK helper with a throwaway secret). Static: route and page wiring.
 *
 * Claims under test are deliberately scoped: public_id + overwrite=false
 * prevents storing/replacing another asset under that id within the same
 * Cloudinary resource_type namespace; the signed upload_preset carries the
 * provider-side format/size controls; resource_type is not signed; the
 * Cloudinary signature itself is not one-time.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { v2 as cloudinary } from "cloudinary";
import {
  UPLOAD_PURPOSES,
  checkFileForPurpose,
  cloudinaryUploadUrl,
  isUploadPurpose,
} from "../../src/lib/security/upload-purpose.ts";
import {
  SIGNATURE_ALGORITHM,
  SIGNATURE_VERSION,
  cloudinaryStringToSign,
  privateDownloadLink,
  signUploadForPurpose,
  storageIdOf,
  uploadReferenceProof,
  verifyUploadReference,
} from "../../src/lib/security/cloudinary-sign.ts";

const SRC = join(import.meta.dirname, "..", "..", "src");
const raw = (rel: string) => readFileSync(join(SRC, rel), "utf8");
const code = (rel: string) => raw(rel).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

const ROUTE = "app/api/cloudinary/sign-upload/route.ts";
const PAGE = "lib/security/signed-upload-client.ts";
const FORM = "components/academy/workspace/teacher/application-form.tsx";
const SIGNER = "lib/security/cloudinary-sign.ts";
const POLICY = "lib/security/upload-purpose.ts";
const SECRET = "unit-test-cloudinary-secret-not-real";
const CV_PRESET = "test_signed_cv_preset";
const VIDEO_PRESET = "test_signed_video_preset";
const FIXED_ID = "0f6d2b1e-8a4c-4f5e-9b7d-3c2a1e0f9d8b";
const fixedId = () => FIXED_ID;
const NOW = 1_757_800_000_000;

const f = (name: string, type: string, size: number) => ({ name, type, size });

describe("purpose policy", () => {
  test("only the two teacher purposes exist", () => {
    assert.deepEqual(Object.keys(UPLOAD_PURPOSES).sort(), ["teacher_cv", "teacher_intro_video"]);
    assert.equal(isUploadPurpose("teacher_cv"), true);
    assert.equal(isUploadPurpose("teacher_intro_video"), true);
    for (const bad of ["", "avatar", "TEACHER_CV", "teacher_cv ", null, undefined, 1, {}, ["teacher_cv"]]) {
      assert.equal(isUploadPurpose(bad), false);
    }
  });

  test("CV pre-check: PDF up to 10 MB, wrong type or extension rejected, over max rejected", () => {
    const MAX = 10 * 1024 * 1024;
    assert.equal(UPLOAD_PURPOSES.teacher_cv.maxBytes, MAX);
    assert.deepEqual(checkFileForPurpose(f("cv.pdf", "application/pdf", MAX), "teacher_cv"), { ok: true });
    assert.deepEqual(checkFileForPurpose(f("CV.PDF", "APPLICATION/PDF", 1), "teacher_cv"), { ok: true });
    assert.deepEqual(checkFileForPurpose(f("cv.pdf", "application/pdf", MAX + 1), "teacher_cv"), { ok: false, reason: "size" });
    assert.deepEqual(checkFileForPurpose(f("cv.pdf", "application/pdf", 0), "teacher_cv"), { ok: false, reason: "empty" });
    assert.deepEqual(checkFileForPurpose(f("cv.pdf", "text/html", 10), "teacher_cv"), { ok: false, reason: "type" });
    assert.deepEqual(checkFileForPurpose(f("cv.html", "application/pdf", 10), "teacher_cv"), { ok: false, reason: "type" }, "extension must agree");
    assert.deepEqual(checkFileForPurpose(f("cv.mp4", "video/mp4", 10), "teacher_cv"), { ok: false, reason: "type" }, "video is not a CV");
    assert.equal(UPLOAD_PURPOSES.teacher_cv.resourceType, "raw");
    assert.equal(UPLOAD_PURPOSES.teacher_cv.folder, "teacher-signup/cv");
    assert.equal(UPLOAD_PURPOSES.teacher_cv.allowedFormats, "pdf");
    assert.equal(UPLOAD_PURPOSES.teacher_cv.publicIdSuffix, ".pdf");
  });

  test("video pre-check: mp4/quicktime/webm up to 50 MB, others rejected, over max rejected", () => {
    const MAX = 50 * 1024 * 1024;
    assert.equal(UPLOAD_PURPOSES.teacher_intro_video.maxBytes, MAX);
    for (const [name, type] of [["a.mp4", "video/mp4"], ["a.mov", "video/quicktime"], ["a.webm", "video/webm"]]) {
      assert.deepEqual(checkFileForPurpose(f(name, type, MAX), "teacher_intro_video"), { ok: true }, `${type} accepted`);
    }
    assert.deepEqual(checkFileForPurpose(f("a.mp4", "video/mp4", MAX + 1), "teacher_intro_video"), { ok: false, reason: "size" });
    for (const [name, type] of [["a.avi", "video/x-msvideo"], ["a.mkv", "video/x-matroska"], ["a.pdf", "application/pdf"], ["a.html", "text/html"], ["a.mp4", "application/octet-stream"], ["a.exe", "video/mp4"]]) {
      assert.deepEqual(checkFileForPurpose(f(name, type, 10), "teacher_intro_video"), { ok: false, reason: "type" }, `${name}/${type} rejected`);
    }
    assert.equal(UPLOAD_PURPOSES.teacher_intro_video.resourceType, "video");
    assert.equal(UPLOAD_PURPOSES.teacher_intro_video.folder, "teacher-signup/videos");
    assert.equal(UPLOAD_PURPOSES.teacher_intro_video.allowedFormats, "mp4,mov,webm");
    assert.equal(UPLOAD_PURPOSES.teacher_intro_video.publicIdSuffix, "");
  });

  test("upload URL targets the purpose's resource type, never auto", () => {
    assert.equal(cloudinaryUploadUrl("demo", "teacher_cv"), "https://api.cloudinary.com/v1_1/demo/raw/upload");
    assert.equal(cloudinaryUploadUrl("demo", "teacher_intro_video"), "https://api.cloudinary.com/v1_1/demo/video/upload");
    assert.equal(cloudinaryUploadUrl("a/b", "teacher_cv").includes("/a/b/"), false, "cloud name is encoded");
  });

  test("policy module is dependency-free and carries no credentials or preset names", () => {
    const src = code(POLICY);
    assert.equal(/^import /m.test(src), false);
    assert.equal(/process\.env|secret|api_key|apiKey|upload_preset|PRESET/i.test(src), false);
  });
});

describe("signer", () => {
  test("signs exactly timestamp + folder + allowed_formats + public_id + overwrite + upload_preset + type (SHA-256 v2), matching the SDK and a hand computation", () => {
    const signed = signUploadForPurpose("teacher_cv", SECRET, CV_PRESET, NOW, { randomId: fixedId });
    assert.deepEqual(Object.keys(signed.params).sort(), ["allowed_formats", "folder", "overwrite", "public_id", "timestamp", "type", "upload_preset"]);
    assert.equal(signed.params.type, "authenticated", "application documents are never publicly deliverable");
    assert.equal(signed.params.timestamp, Math.floor(NOW / 1000));
    assert.equal(signed.params.folder, "teacher-signup/cv");
    assert.equal(signed.params.allowed_formats, "pdf");
    assert.equal(signed.params.public_id, `${FIXED_ID}.pdf`, "raw assets carry the extension in the public id");
    assert.equal(signed.params.overwrite, "false");
    assert.equal(signed.params.upload_preset, CV_PRESET);
    assert.equal(signed.resourceType, "raw");
    // Protocol oracle: sorted key=value joined by &, then the secret, SHA-256 hex.
    const toSign = `allowed_formats=pdf&folder=teacher-signup/cv&overwrite=false&public_id=${FIXED_ID}.pdf&timestamp=${signed.params.timestamp}&type=authenticated&upload_preset=${CV_PRESET}`;
    assert.equal(cloudinaryStringToSign(signed.params), toSign);
    assert.equal(signed.signature, createHash("sha256").update(toSign + SECRET).digest("hex"));
    // Official SDK oracle (configured for SHA-256, signature version 2 is its default).
    (cloudinary.config as (c: Record<string, unknown>) => unknown)({ signature_algorithm: "sha256", signature_version: 2 });
    assert.equal(signed.signature, cloudinary.utils.api_sign_request(signed.params, SECRET));
    // And the SDK agrees on the string-to-sign for a value containing '&' (v2 escaping).
    const tricky = { folder: "a&b", timestamp: 1 };
    assert.equal(
      createHash("sha256").update(cloudinaryStringToSign(tricky) + SECRET).digest("hex"),
      cloudinary.utils.api_sign_request(tricky, SECRET)
    );
    assert.equal(SIGNATURE_ALGORITHM, "sha256");
    assert.equal(SIGNATURE_VERSION, 2);
    assert.match(signed.signature, /^[0-9a-f]{64}$/);
  });

  test("video purpose signs its own folder, formats, extension-less public id and preset; secret never appears in the result", () => {
    const signed = signUploadForPurpose("teacher_intro_video", SECRET, VIDEO_PRESET, NOW, { randomId: fixedId });
    assert.equal(signed.params.folder, "teacher-signup/videos");
    assert.equal(signed.params.allowed_formats, "mp4,mov,webm");
    assert.equal(signed.params.public_id, FIXED_ID, "video public ids carry no extension");
    assert.equal(signed.params.overwrite, "false");
    assert.equal(signed.params.upload_preset, VIDEO_PRESET);
    assert.equal(signed.resourceType, "video");
    assert.equal(JSON.stringify(signed).includes(SECRET), false);
  });

  test("different secrets, timestamps or presets change the signature; missing secret or preset fails closed", () => {
    const a = signUploadForPurpose("teacher_cv", SECRET, CV_PRESET, NOW, { randomId: fixedId });
    const b = signUploadForPurpose("teacher_cv", SECRET + "x", CV_PRESET, NOW, { randomId: fixedId });
    const c = signUploadForPurpose("teacher_cv", SECRET, CV_PRESET, NOW + 1000, { randomId: fixedId });
    const d = signUploadForPurpose("teacher_cv", SECRET, "another_preset", NOW, { randomId: fixedId });
    assert.notEqual(a.signature, b.signature);
    assert.notEqual(a.signature, c.signature);
    assert.notEqual(a.signature, d.signature, "the preset is part of the signature");
    assert.throws(() => signUploadForPurpose("teacher_cv", "", CV_PRESET, NOW));
    assert.throws(() => signUploadForPurpose("teacher_cv", SECRET, "", NOW), "empty preset fails closed");
    for (const bad of ["has space", "a/b", "x".repeat(101), "p&q"]) {
      assert.throws(() => signUploadForPurpose("teacher_cv", SECRET, bad, NOW), `malformed preset ${JSON.stringify(bad)} rejected`);
    }
  });

  test("signer accepts only a purpose plus server config: no caller-supplied params reach the signed set", () => {
    const src = code(SIGNER);
    assert.ok(src.includes("signUploadForPurpose(") && src.includes("purpose: UploadPurpose") && src.includes("uploadPreset: string"));
    assert.equal(/paramsToSign|params_to_sign|\.\.\.(params|extra|options|deps)/.test(src), false, "no pass-through of arbitrary params");
    assert.ok(src.includes("createHash(SIGNATURE_ALGORITHM)") && src.includes("cloudinaryStringToSign(params) + apiSecret"), "signature is SHA-256 over the protocol string plus the secret");
    assert.equal(/^import /m.test(src.replace(/import \{[^}]*\} from "node:crypto";|import \{[^}]*\} from "\.\/upload-purpose(\.ts)?";/g, "")), false, "signer depends only on node:crypto and the purpose policy");
    for (const forbidden of ["eager", "tags", "context", "notification_url", "access_control", "transformation"]) {
      assert.equal(src.includes(forbidden), false, `${forbidden} is never signed`);
    }
    assert.ok(src.includes("upload_preset: uploadPreset"), "preset is signed from the server-supplied argument");
    assert.equal(/process\.env/.test(src), false, "signer reads no environment; the route supplies checked config");
  });
});

describe("replay resistance within a resource-type namespace", () => {
  test("every authorisation carries a fresh CSPRNG public id; two calls at the same timestamp differ", () => {
    const a = signUploadForPurpose("teacher_cv", SECRET, CV_PRESET, NOW);
    const b = signUploadForPurpose("teacher_cv", SECRET, CV_PRESET, NOW);
    assert.match(a.params.public_id, /^[0-9a-f-]{36}\.pdf$/);
    assert.match(b.params.public_id, /^[0-9a-f-]{36}\.pdf$/);
    assert.notEqual(a.params.public_id, b.params.public_id);
    assert.notEqual(a.signature, b.signature, "same timestamp, different signed set");
    const ids = new Set<string>();
    for (let i = 0; i < 200; i++) ids.add(signUploadForPurpose("teacher_intro_video", SECRET, VIDEO_PRESET, NOW).params.public_id);
    assert.equal(ids.size, 200);
  });

  test("public id is opaque: derived from nothing but the generator, and the generator must yield a uuid", () => {
    const signed = signUploadForPurpose("teacher_cv", SECRET, CV_PRESET, NOW, { randomId: fixedId });
    assert.equal(signed.params.public_id, `${FIXED_ID}.pdf`);
    for (const bad of ["cv.pdf", "../x", "teacher@example.com", "uid123", "", "0f6d2b1e"]) {
      assert.throws(() => signUploadForPurpose("teacher_cv", SECRET, CV_PRESET, 1, { randomId: () => bad }), `generator output ${JSON.stringify(bad)} rejected`);
    }
  });

  test("public_id, overwrite=false and upload_preset are inside the signed string, so the browser cannot alter them", () => {
    const signed = signUploadForPurpose("teacher_cv", SECRET, CV_PRESET, NOW, { randomId: fixedId });
    const s = cloudinaryStringToSign(signed.params);
    assert.ok(s.includes(`public_id=${FIXED_ID}.pdf`));
    assert.ok(s.includes("overwrite=false"));
    assert.ok(s.includes(`upload_preset=${CV_PRESET}`));
    const tampered = (patch: Partial<Record<keyof typeof signed.params, string>>) =>
      createHash("sha256").update(cloudinaryStringToSign({ ...signed.params, ...patch }) + SECRET).digest("hex");
    assert.notEqual(tampered({ overwrite: "true" }), signed.signature);
    assert.notEqual(tampered({ public_id: "attacker-chosen.pdf" }), signed.signature);
    assert.notEqual(tampered({ upload_preset: "Ruh-Ul-Qudus" }), signed.signature, "the old or any other preset cannot be substituted");
    assert.notEqual(tampered({ allowed_formats: "exe" }), signed.signature);
  });

  test("resource_type is not in the signed string (per protocol); the namespace scope is documented, not overclaimed", () => {
    const signed = signUploadForPurpose("teacher_cv", SECRET, CV_PRESET, NOW, { randomId: fixedId });
    assert.equal(cloudinaryStringToSign(signed.params).includes("resource_type"), false);
    assert.equal("resource_type" in signed.params, false);
    const docs = raw(SIGNER) + raw(ROUTE);
    assert.ok(/resource_type.*(NOT|not) (part of|in) the signed/i.test(docs.replace(/\n \*|\n\/\//g, " ")), "docs state resource_type is unsigned");
    assert.equal(/(globally|across all resource types|exactly one asset)/i.test(docs), false, "no global one-asset claim");
  });

  test("the signing API accepts no caller-supplied public id, overwrite or preset choice", () => {
    const src = code(SIGNER);
    assert.ok(src.includes("randomId?: () => string"), "only the id GENERATOR is injectable (tests), never an id value");
    assert.ok(src.includes("(deps.randomId ?? randomUUID)()"), "production path is randomUUID");
    assert.ok(src.includes('overwrite: "false"'), "overwrite is a server constant");
    assert.equal(/\bpublicId\b|public_id\s*:\s*(deps|options|params)\./.test(src), false, "no public id parameter");
    assert.equal(/overwrite\s*:\s*(deps|options|params)\./.test(src), false, "no overwrite parameter");
  });
});

describe("private application documents", () => {
  const REFERENCE_SECRET = "unit-test-reference-secret-not-real";

  test("the server-issued reference proves the storage id and purpose; anything else is refused", () => {
    const signed = signUploadForPurpose("teacher_cv", SECRET, CV_PRESET, NOW, { randomId: fixedId });
    const storageId = storageIdOf(signed);
    assert.equal(storageId, `teacher-signup/cv/${FIXED_ID}.pdf`);
    const proof = uploadReferenceProof("teacher_cv", storageId, REFERENCE_SECRET);
    assert.equal(verifyUploadReference("teacher_cv", { storageId, proof }, REFERENCE_SECRET), storageId);
    const otherId = `teacher-signup/cv/1f6d2b1e-8a4c-4f5e-9b7d-3c2a1e0f9d8b.pdf`;
    for (const reference of [
      { storageId: otherId, proof },
      { storageId, proof: uploadReferenceProof("teacher_cv", storageId, REFERENCE_SECRET + "x") },
      { storageId, proof: proof.slice(0, 63) },
      { storageId, proof: proof.toUpperCase() },
      { storageId: `https://res.cloudinary.com/x/raw/upload/${storageId}`, proof },
      { storageId },
      storageId,
      null,
    ]) {
      assert.equal(verifyUploadReference("teacher_cv", reference, REFERENCE_SECRET), null, JSON.stringify(reference));
    }
    assert.equal(verifyUploadReference("teacher_intro_video", { storageId, proof }, REFERENCE_SECRET), null, "a CV proof is not a video proof");
    assert.throws(() => uploadReferenceProof("teacher_cv", storageId, ""), "no secret, no proof");
  });

  test("download links are short-lived, signed over id, type and expiry, and equal the SDK's private_download_url", () => {
    const config = { cloudName: "demo-cloud", apiKey: "123456789012345", apiSecret: SECRET };
    const storageId = `teacher-signup/cv/${FIXED_ID}.pdf`;
    const link = privateDownloadLink(config, "teacher_cv", storageId, NOW, 300);
    const url = new URL(link.url);
    assert.equal(`${url.origin}${url.pathname}`, "https://api.cloudinary.com/v1_1/demo-cloud/raw/download");
    assert.equal(url.searchParams.get("type"), "authenticated");
    assert.equal(Number(url.searchParams.get("expires_at")) - Number(url.searchParams.get("timestamp")), 300);
    assert.equal(link.expiresAt, new Date((Math.floor(NOW / 1000) + 300) * 1000).toISOString());
    assert.equal(url.searchParams.has("api_secret"), false);
    assert.equal(link.url.includes(SECRET), false, "the secret never appears in a link");
    (cloudinary.config as (c: Record<string, unknown>) => unknown)({ signature_algorithm: "sha256", signature_version: 2 });
    // The SDK's type definitions omit options its implementation reads (timestamp, credentials, algorithm).
    const sdkDownloadUrl = cloudinary.utils.private_download_url as unknown as (id: string, format: string, options: Record<string, unknown>) => string;
    const sdk = new URL(
      sdkDownloadUrl(storageId, "", {
        resource_type: "raw",
        type: "authenticated",
        expires_at: Math.floor(NOW / 1000) + 300,
        timestamp: Math.floor(NOW / 1000),
        cloud_name: "demo-cloud",
        api_key: config.apiKey,
        api_secret: SECRET,
        signature_algorithm: "sha256",
      }),
    );
    assert.equal(`${sdk.origin}${sdk.pathname}`, `${url.origin}${url.pathname}`);
    assert.deepEqual(Object.fromEntries([...url.searchParams].sort()), Object.fromEntries([...sdk.searchParams].sort()), "same parameters and signature as the SDK");
    assert.throws(() => privateDownloadLink(config, "teacher_intro_video", storageId, NOW), "a CV id is not a video");
    assert.throws(() => privateDownloadLink({ ...config, apiSecret: "" }, "teacher_cv", storageId, NOW));
    assert.throws(() => privateDownloadLink(config, "teacher_cv", storageId, NOW, 86400), "links never live long");
  });

  test("the sign route hands out the reference and fails closed without its secret", () => {
    const src = code(ROUTE);
    assert.ok(src.includes("const referenceSecret = process.env.INTERNAL_API_SECRET;") && src.includes("if (!referenceSecret)"));
    assert.ok(src.includes("reference: { storageId, proof: uploadReferenceProof(purpose, storageId, referenceSecret) }"));
    assert.ok(src.includes("deliveryType: signed.params.type"));
    assert.ok(src.indexOf("if (!referenceSecret)") < src.indexOf("signUploadForPurpose(purpose"), "no signature is issued without the proof secret");
  });
});

describe("sign-upload route wiring", () => {
  const src = code(ROUTE);
  test("limiter, purpose-only body, five required config values, fail-closed, server-selected preset, no secret in the response", () => {
    assert.ok(src.includes("withApi(async"));
    assert.ok(src.includes("checkRateLimit(`cloudinary-sign:${clientKey(req)}`, CLIENT_LIMIT)"));
    assert.ok(src.includes("CLIENT_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 }"));
    assert.ok(src.indexOf("checkRateLimit(") < src.indexOf("req.json()"), "limiter before body parse");
    assert.ok(src.includes("isUploadPurpose(purpose)") && src.includes("status: 400"));
    for (const v of ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET", "CLOUDINARY_TEACHER_CV_PRESET", "CLOUDINARY_TEACHER_VIDEO_PRESET"]) {
      assert.ok(src.includes(`process.env.${v}`), `${v} is read`);
    }
    assert.ok(src.includes("if (!cloudName || !apiKey || !apiSecret || !uploadPreset)") && src.includes("status: 503"), "any missing config fails closed with one generic 503");
    assert.ok(src.includes('case "teacher_cv":') && src.includes("process.env.CLOUDINARY_TEACHER_CV_PRESET"), "cv purpose maps to the cv preset");
    assert.ok(src.includes('case "teacher_intro_video":') && src.includes("process.env.CLOUDINARY_TEACHER_VIDEO_PRESET"), "video purpose maps to the video preset");
    assert.ok(src.includes("const uploadPreset = presetFor(purpose)"), "preset chosen from the purpose only");
    assert.ok(src.includes("signUploadForPurpose(purpose, apiSecret, uploadPreset)"));
    const start = src.indexOf("cloudName,");
    const end = src.indexOf("signature: signed.signature");
    assert.ok(start > 0 && end > start, "success response body located");
    const response = src.slice(start, end);
    assert.equal(/apiSecret|process\.env/.test(response), false, "response never carries the secret or env");
    assert.ok(response.includes("publicId: signed.params.public_id") && response.includes("overwrite: signed.params.overwrite") && response.includes("uploadPreset: signed.params.upload_preset"));
    assert.equal((src.match(/apiSecret/g) ?? []).length, 3, "secret read once, checked once, passed to the signer once");
    assert.ok(src.includes("const { purpose } = body as Record<string, unknown>"), "body yields the purpose and nothing else");
    for (const forbidden of ["body.folder", "body.resource_type", "body.resourceType", "body.public_id", "body.publicId", "body.overwrite", "body.upload_preset", "body.uploadPreset", "body.preset", "body.allowed_formats", "body.allowedFormats", "body.timestamp", "body.paramsToSign", "body.params", "body.eager", "body.tags"]) {
      assert.equal(src.includes(forbidden), false, `${forbidden} must not be read from the client`);
    }
    assert.equal(/const \{[^}]*\b(folder|resource_type|resourceType|public_id|publicId|overwrite|upload_preset|uploadPreset|preset|allowed_formats|allowedFormats|timestamp|paramsToSign|params)\b[^}]*\} = body/.test(src), false);
    assert.equal(src.includes("error.message"), false);
    assert.equal(/console\.(log|error|warn)\([^)]*(apiSecret|signature|apiKey|uploadPreset)/.test(src), false);
    assert.equal(src.includes("NEXT_PUBLIC_CLOUDINARY"), false);
    assert.equal(/["']Ruh-Ul-Qudus["']/.test(src), false, "no preset name is hard-coded");
  });
});

describe("teacher signup page wiring", () => {
  const src = code(PAGE);
  test("signed direct upload replaces the unsigned preset; client forwards server values verbatim; secret never in client code", () => {
    assert.equal(/["']Ruh-Ul-Qudus["']/.test(src), false, "old unsigned preset name removed");
    assert.equal(/unsigned/i.test(src), false);
    assert.equal(src.includes("flpsabx6"), false, "hard-coded cloud name removed");
    assert.equal(/\/auto\/upload/.test(src), false, "auto resource type removed");
    assert.equal(/CLOUDINARY_API_SECRET|api_secret|apiSecret|CLOUDINARY_TEACHER/.test(src), false);
    assert.ok(src.includes('fetch("/api/cloudinary/sign-upload"'), "asks the server for a signature");
    assert.ok(src.includes('JSON.stringify({ purpose })'), "sends only the purpose");
    assert.ok(src.includes("cloudinaryUploadUrl(auth.cloudName, purpose)"), "uploads directly to Cloudinary");
    for (const field of ['"timestamp"', '"folder"', '"allowed_formats"', '"public_id"', '"overwrite"', '"upload_preset"', '"type"', '"api_key"', '"signature"', '"file"']) {
      assert.ok(src.includes(`formData.append(${field}`), `client sends ${field}`);
    }
    assert.equal((src.match(/formData\.append\(/g) ?? []).length, 10, "exactly the signed params + api_key + signature + file");
    assert.ok(src.includes('formData.append("public_id", auth.publicId)'), "client forwards the server-issued public id verbatim");
    assert.ok(src.includes('formData.append("overwrite", "false")'), "client sends the literal signed overwrite=false");
    assert.ok(src.includes('formData.append("upload_preset", auth.uploadPreset)'), "client forwards the server-selected preset verbatim");
    assert.ok(src.includes('formData.append("type", auth.deliveryType)'), "client forwards the server-selected private delivery type");
    assert.equal(/append\("overwrite", *(auth|"true")/.test(src), false, "overwrite cannot be anything but the literal false");
    assert.equal(/append\("upload_preset", *"/.test(src), false, "client never supplies a preset literal");
    assert.equal(/append\("type", *"/.test(src), false, "client never supplies a delivery type literal");
    assert.equal(/randomUUID|crypto\.|public_id", *(file|name|`)/.test(src), false, "client never generates or derives a public id");
    assert.ok(src.indexOf("checkFileForPurpose(file, purpose)") < src.indexOf('fetch("/api/cloudinary/sign-upload"'), "local pre-check before signature request");
    assert.equal(src.includes("uploadToCloudinary"), false, "old helper removed");
    assert.equal(src.includes("secure_url"), false, "no delivery link is kept: documents are private");
    assert.ok(src.includes("uploaded?.public_id !== auth.reference?.storageId"), "the stored asset must be the one the server signed for");
    assert.ok(src.includes("return { storageId: auth.reference.storageId, proof: auth.reference.proof };"), "only the server-issued reference is returned");
    const form = code(FORM);
    assert.ok(form.includes('uploadSigned(cv, "teacher_cv")') && form.includes('uploadSigned(video, "teacher_intro_video")'), "the application form uploads through the signed client");
    assert.equal(/cloudinary\.com|formData/.test(form), false, "the form never talks to Cloudinary itself");
  });
});

describe("repository scan", () => {
  test("no unsigned Cloudinary upload or hard-coded preset/cloud name remains in tracked application code", () => {
    // "Ruh-Ul-Qudus" is also the academy's display name in UI strings, so the
    // scan targets preset LITERALS (upload_preset assigned a string) plus the
    // unsigned endpoint and the old hard-coded cloud name.
    // git grep exits 1 when nothing matches, which is the desired outcome here.
    // execFileSync: no shell, so the pattern needs no platform-specific quoting.
    const pattern = `/auto/upload|flpsabx6|upload_preset["']?[[:space:]]*[,:=][[:space:]]*["']`;
    let out = "";
    try {
      out = execFileSync("git", ["grep", "-lE", pattern, "--", "src"], { cwd: join(SRC, ".."), encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch (e) {
      if ((e as { status?: number }).status !== 1) throw e;
    }
    const files = out ? out.split(/\r?\n/) : [];
    assert.deepEqual(files, [], `unsigned upload references remain in: ${files.join(", ")}`);
  });
});
