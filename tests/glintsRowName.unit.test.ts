import os from "os";
import path from "path";
import { Glints, GlintsConfigJson } from "../src/glints";

// The applicant row's name cell carries an age tag after the name. On an
// English-rendered dashboard it reads "<age> yo"; on an Indonesian one it
// reads "<age> tahun" (the dashboard language is a per-account server
// setting). extractName only knew "yo", so the Indonesian rows kept the tag
// ("Ratna Anjani 32 tahun"), never matched the application-detail API's
// applicant name, and armApplicationDetailCapture discarded the one payload
// carrying the applicant's email, phone and resume key — observed live on
// 2026-09-13 for every applicant of the run.

function makeScraper(): Glints {
  const config: GlintsConfigJson = {
    headless: true,
    cookies: [],
    local_storage: [],
    limit: 0,
    api_destination: "http://127.0.0.1/unused",
    timeout: 1000,
    slowmo: 0,
    db_path: path.relative(path.join(process.cwd(), "src"), path.join(os.tmpdir(), "glints-row-name.db")),
  };
  return new Glints(config);
}

/** A row whose third cell (the name cell) renders `nameCellText`. */
function makeRow(nameCellText: string) {
  const cells = {
    nth: jest.fn().mockImplementation((index: number) => ({
      innerText: jest.fn().mockResolvedValue(index === 2 ? nameCellText : ""),
    })),
  };
  return { locator: jest.fn().mockReturnValue(cells) };
}

describe("Glints extractName", () => {
  const scraper = makeScraper();

  it.each([
    ["Ratna Anjani 32 tahun · Jakarta", "Ratna Anjani"],
    ["Adella Titis Pradita\n22 tahun", "Adella Titis Pradita"],
    ["Dania Rahmawati Alan Foronika 26 thn", "Dania Rahmawati Alan Foronika"],
    ["Budi Santoso 29 yo · Bandung", "Budi Santoso"],
    ["Siti Aminah 31 years old", "Siti Aminah"],
  ])("strips the age tag from %j", async (cellText, expected) => {
    await expect(scraper.extractName(makeRow(cellText))).resolves.toBe(expected);
  });

  it("falls back to the text before the first separator when no age is shown", async () => {
    await expect(scraper.extractName(makeRow("Rina Kartika · Willing to relocate"))).resolves.toBe("Rina Kartika");
  });

  it("does not treat a digit inside the name itself as an age tag", async () => {
    await expect(scraper.extractName(makeRow("Andi 2 Putra · Surabaya"))).resolves.toBe("Andi 2 Putra");
  });
});
