import os from "os";
import path from "path";
import { Glints, GlintsConfigJson } from "../src/glints";

// `limit: 0` means unlimited for every portal. Glints' loops compared
// `COLLECTED == LIMIT` directly, so with 0 a live run stopped before its first
// vacancy ("Found 5 vacancy link(s)" then DONE, 2026-09-13), and pagination
// (`COLLECTED < LIMIT`) never passed page one. Every loop now asks
// limitReached() instead.

function scraperWithLimit(limit: number): Glints {
  const config: GlintsConfigJson = {
    headless: true,
    cookies: [],
    local_storage: [],
    limit,
    api_destination: "http://127.0.0.1/unused",
    timeout: 1000,
    slowmo: 0,
    db_path: path.relative(path.join(process.cwd(), "src"), path.join(os.tmpdir(), "glints-limit.db")),
  };
  return new Glints(config);
}

function setCollected(scraper: Glints, collected: number): void {
  (scraper as unknown as { COLLECTED: number }).COLLECTED = collected;
}

describe("Glints.limitReached", () => {
  it("never reports a limit when limit is 0 (unlimited)", () => {
    const scraper = scraperWithLimit(0);
    for (const collected of [0, 1, 50, 10_000]) {
      setCollected(scraper, collected);
      expect(scraper.limitReached()).toBe(false);
    }
  });

  it("reports the limit once a positive limit is met or passed", () => {
    const scraper = scraperWithLimit(2);
    setCollected(scraper, 0);
    expect(scraper.limitReached()).toBe(false);
    setCollected(scraper, 1);
    expect(scraper.limitReached()).toBe(false);
    setCollected(scraper, 2);
    expect(scraper.limitReached()).toBe(true);
    setCollected(scraper, 3);
    expect(scraper.limitReached()).toBe(true);
  });
});
