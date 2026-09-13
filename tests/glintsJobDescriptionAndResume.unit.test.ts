import fs from "fs";
import os from "os";
import path from "path";
import {
  Glints,
  GlintsConfigJson,
  glintsDescriptionText,
  parseGlintsApplicationDetail,
} from "../src/glints";

// Two findings from the live run of 2026-09-13:
//  - The application-detail payload the scraper already captures on every
//    modal open carries the job's own description at
//    data.links.job.descriptionRaw — the only readable description source
//    (no edit link on the job list; the public job page is firewalled).
//  - GET /api/s3/download answers with the resume file itself ("%PDF-1.4…"),
//    not JSON { url }, so response.json() threw for every applicant.

function makeConfig(): GlintsConfigJson {
  return {
    headless: true,
    cookies: [],
    local_storage: [],
    limit: 0,
    api_destination: "http://127.0.0.1/unused",
    timeout: 3000,
    slowmo: 0,
    db_path: path.relative(path.join(process.cwd(), "src"), path.join(os.tmpdir(), "glints-jd-resume.db")),
  };
}

describe("glintsDescriptionText", () => {
  it("joins Draft.js blocks from a JSON string", () => {
    const raw = JSON.stringify({
      blocks: [{ text: "Tanggung Jawab:" }, { text: "- Menjawab panggilan pelanggan" }, { text: "" }, { text: "Kualifikasi: SMA" }],
      entityMap: {},
    });
    expect(glintsDescriptionText(raw)).toBe("Tanggung Jawab:\n- Menjawab panggilan pelanggan\n\nKualifikasi: SMA");
  });

  it("accepts Draft.js content already parsed into an object", () => {
    expect(glintsDescriptionText({ blocks: [{ text: "Satu" }, { text: "Dua" }] })).toBe("Satu\nDua");
  });

  it("turns HTML into text with line breaks and decoded entities", () => {
    expect(glintsDescriptionText("<p>Gaji &amp; Tunjangan</p><ul><li>BPJS</li><li>Bonus</li></ul>Lokasi:<br/>Jakarta")).toBe(
      "Gaji & Tunjangan\nBPJS\nBonus\nLokasi:\nJakarta",
    );
  });

  it("keeps plain text as-is, trimmed", () => {
    expect(glintsDescriptionText("  Dicari Contact Center Agent  ")).toBe("Dicari Contact Center Agent");
  });

  it("treats a brace-led non-JSON string as plain text", () => {
    expect(glintsDescriptionText("{Urgent} Contact Center")).toBe("{Urgent} Contact Center");
  });

  it.each([[""], ["   "], [null], [undefined], [42], [{ notBlocks: true }]])("returns empty for %j", (raw) => {
    expect(glintsDescriptionText(raw)).toBe("");
  });
});

describe("parseGlintsApplicationDetail job description", () => {
  const base = {
    ApplicantId: "00000000-1111-4222-8333-444444444444",
    resume: "",
    Applicant: { id: "00000000-1111-4222-8333-444444444444", firstName: "Fixtura", lastName: "Sintetis" },
  };

  it("reads the job's description from links.job.descriptionRaw", () => {
    const detail = parseGlintsApplicationDetail({
      data: {
        ...base,
        links: {
          job: {
            descriptionRaw: JSON.stringify({ blocks: [{ text: "Kualifikasi: minimal SMA" }] }),
            Company: { descriptionRaw: "Tentang perusahaan — not the job" },
          },
        },
      },
    });
    expect(detail?.jobDescription).toBe("Kualifikasi: minimal SMA");
  });

  it("leaves the job description empty when the payload has no job link", () => {
    expect(parseGlintsApplicationDetail({ data: base })?.jobDescription).toBe("");
  });
});

describe("Glints.fetchResumeViaApi storing the file the endpoint returns", () => {
  const written: string[] = [];

  beforeEach(() => {
    jest.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    for (const file of written.splice(0)) fs.rmSync(file, { force: true });
  });

  function pageReturning(contentType: string, bytes: Buffer) {
    return {
      request: {
        get: async () => ({
          ok: () => true,
          status: () => 200,
          headers: () => ({ "content-type": contentType }),
          body: async () => bytes,
          json: async () => {
            throw new SyntaxError("Unexpected token '%', \"%PDF-1.4\" is not valid JSON");
          },
        }),
      },
    };
  }

  it("stores PDF bytes directly instead of expecting a JSON signed URL", async () => {
    const scraper = new Glints(makeConfig());
    const fetchAndStore = jest.spyOn(scraper, "fetchAndStore");
    const pdf = Buffer.from("%PDF-1.4\n% synthetic resume\n");

    const stored = await scraper.fetchResumeViaApi(pageReturning("application/pdf", pdf), "resume-key.pdf", "Ada - Telesales");
    written.push(stored);

    expect(stored).toMatch(/\.pdf$/);
    expect(fs.readFileSync(stored).equals(pdf)).toBe(true);
    expect(fetchAndStore).not.toHaveBeenCalled();
  });

  it("recognises a PDF by its signature even when served as octet-stream", async () => {
    const scraper = new Glints(makeConfig());
    const pdf = Buffer.from("%PDF-1.7\n");

    const stored = await scraper.fetchResumeViaApi(pageReturning("application/octet-stream", pdf), "k", "Ada");
    written.push(stored);

    expect(stored).toMatch(/\.pdf$/);
  });

  it("keeps a Word resume's extension", async () => {
    const scraper = new Glints(makeConfig());
    const docx = Buffer.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00]);

    const stored = await scraper.fetchResumeViaApi(
      pageReturning("application/vnd.openxmlformats-officedocument.wordprocessingml.document", docx),
      "k",
      "Ada",
    );
    written.push(stored);

    expect(stored).toMatch(/\.docx$/);
    expect(fs.readFileSync(stored).equals(docx)).toBe(true);
  });

  it("still follows a JSON { url } answer through fetchAndStore", async () => {
    const scraper = new Glints(makeConfig());
    jest.spyOn(scraper, "fetchAndStore").mockResolvedValue("/tmp/stored/cv.pdf");
    const json = Buffer.from(JSON.stringify({ url: "https://assets.glints.com/resume/abc.pdf?sig=1" }));

    await expect(scraper.fetchResumeViaApi(pageReturning("application/json", json), "k", "Ada")).resolves.toBe(
      "/tmp/stored/cv.pdf",
    );
  });
});
