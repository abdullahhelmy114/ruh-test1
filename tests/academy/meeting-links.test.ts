/**
 * A class's live meeting link is shown to every learner of the class group,
 * so it must be a participant (join) link. The launch work on live classes
 * (2026-09-19) found nothing stopping an administrator from pasting a Zoom
 * host link (/s/<id>, usually with a zak= host token), which would let any
 * learner start the meeting as its host.
 */
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { DomainError } from "../../src/lib/academy/domain/errors.ts";
import { parseMeetingUrl } from "../../src/lib/academy/structure/delivery.ts";

describe("live class links", () => {
  test("a session link can never be a host (start) link", () => {
    assert.equal(parseMeetingUrl("https://us02web.zoom.us/j/123456789?pwd=abc"), "https://us02web.zoom.us/j/123456789?pwd=abc");
    assert.equal(parseMeetingUrl("https://meet.jit.si/room"), "https://meet.jit.si/room");
    for (const host of ["https://us02web.zoom.us/s/123456789?zak=token", "https://zoom.us/s/123456789", "https://example.com/meet?zak=abc"]) {
      assert.throws(() => parseMeetingUrl(host), (e: unknown) => e instanceof DomainError && e.code === "VALIDATION", host);
    }
    assert.equal(parseMeetingUrl(""), null);
  });
});
