import os from "os";
import path from "path";
import { Glints, GlintsConfigJson, replayableGlintsHeaders } from "../src/glints";

// Every Glints resume download returned 401 on 2026-09-13: the replay went
// through page.request, which shares the session cookies but not the headers
// the dashboard's own XHRs attach, and Glints' API authenticates with a header
// token. The dashboard's application-detail request (fired on modal open)
// carries those headers, so they are captured there and replayed on the
// download — never logged.

function makeConfig(): GlintsConfigJson {
  return {
    headless: true,
    cookies: [],
    local_storage: [],
    limit: 0,
    api_destination: "http://127.0.0.1/unused",
    timeout: 3000,
    slowmo: 0,
    db_path: path.relative(path.join(process.cwd(), "src"), path.join(os.tmpdir(), "glints-header-replay.db")),
  };
}

describe("replayableGlintsHeaders", () => {
  it("keeps authorization and the app's own x- headers, lowercased", () => {
    expect(
      replayableGlintsHeaders({
        Authorization: "Bearer session-token",
        "X-Glints-Company-Id": "company-1",
        "x-requested-with": "XMLHttpRequest",
      }),
    ).toEqual({
      authorization: "Bearer session-token",
      "x-glints-company-id": "company-1",
      "x-requested-with": "XMLHttpRequest",
    });
  });

  it("drops transport, browser-managed and forwarding headers", () => {
    expect(
      replayableGlintsHeaders({
        cookie: "session=1",
        host: "employers.glints.id",
        "content-type": "application/json",
        "accept-encoding": "gzip",
        "sec-fetch-mode": "cors",
        "x-forwarded-for": "10.0.0.1",
        referer: "https://employers.glints.id/",
      }),
    ).toEqual({});
  });

  it("ignores empty values and a missing header map", () => {
    expect(replayableGlintsHeaders({ authorization: "" })).toEqual({});
    expect(replayableGlintsHeaders(undefined as unknown as Record<string, string>)).toEqual({});
  });
});

describe("Glints resume download replays the dashboard's API headers", () => {
  beforeEach(() => {
    jest.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /** A dashboard application-detail response whose request carried `headers`. */
  function pageFiringDetail(headers: Record<string, string>) {
    return {
      waitForResponse: async () => ({
        url: () => "https://employers.glints.id/api/jobs/job-1/applications/app-1",
        status: () => 200,
        request: () => ({ allHeaders: async () => headers }),
        // Headers are captured before the payload is parsed, so a payload
        // the parser rejects still leaves them remembered.
        json: async () => ({}),
      }),
    };
  }

  function downloadPage(respond: () => { ok: () => boolean; status: () => number; json: () => Promise<unknown> }) {
    const seen: Array<{ url: string; options: any }> = [];
    return {
      seen,
      request: {
        get: async (url: string, options: any) => {
          seen.push({ url, options });
          return respond();
        },
      },
    };
  }

  it("sends the captured authorization and x- headers, and no cookie header, on the download", async () => {
    const scraper = new Glints(makeConfig());
    await scraper.armApplicationDetailCapture(
      pageFiringDetail({
        authorization: "Bearer session-token",
        "x-glints-company-id": "company-1",
        cookie: "session=1",
        "content-type": "application/json",
      }),
      "Fixtura Sintetis",
    );
    jest.spyOn(scraper, "fetchAndStore").mockResolvedValue("/tmp/stored/cv.pdf");
    const page = downloadPage(() => ({
      ok: () => true,
      status: () => 200,
      json: async () => ({ url: "https://assets.glints.com/resume/abc.pdf?sig=1" }),
    }));

    await expect(scraper.fetchResumeViaApi(page, "abc.pdf", "Ada - Telesales")).resolves.toBe("/tmp/stored/cv.pdf");

    expect(page.seen[0].options.headers).toEqual({
      authorization: "Bearer session-token",
      "x-glints-company-id": "company-1",
    });
  });

  it("names the replayed header names on a refused download, never their values", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const scraper = new Glints(makeConfig());
    await scraper.armApplicationDetailCapture(
      pageFiringDetail({ authorization: "Bearer session-token", "x-glints-company-id": "company-1" }),
      "Fixtura Sintetis",
    );
    const page = downloadPage(() => ({ ok: () => false, status: () => 401, json: async () => ({}) }));

    await expect(scraper.fetchResumeViaApi(page, "abc.pdf", "Ada")).resolves.toBe("");

    const message = String(warn.mock.calls[0]?.[0] ?? "");
    expect(message).toContain("status 401");
    expect(message).toContain("authorization,x-glints-company-id");
    expect(message).not.toContain("session-token");
    expect(message).not.toContain("company-1");
  });

  it("says no headers were captured when no dashboard request has been seen yet", async () => {
    const warn = jest.spyOn(console, "warn").mockImplementation(() => undefined);
    const scraper = new Glints(makeConfig());
    const page = downloadPage(() => ({ ok: () => false, status: () => 401, json: async () => ({}) }));

    await expect(scraper.fetchResumeViaApi(page, "abc.pdf", "Ada")).resolves.toBe("");

    expect(page.seen[0].options.headers).toEqual({});
    expect(String(warn.mock.calls[0]?.[0] ?? "")).toContain("none captured");
  });
});
