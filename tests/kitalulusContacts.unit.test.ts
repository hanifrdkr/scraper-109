import { KitaLulus, KitaLulusConfigJson, isEmailShaped, isPhoneShaped } from "../src/kitalulus";

// The live applicant panel (verified 2026-09-13) has no WhatsApp test-id: it
// renders the email AND the phone under one shared `lbApplicantEmailText`
// test-id. Reading the old dedicated selector left every scraped row with an
// empty phone (0 of 200 in production), so both extractors now pick the
// match by shape. These cases pin that, including a reordered panel.

const EMAIL_SELECTOR = '[data-test-id="lbApplicantEmailText"]';
const WHATSAPP_SELECTOR = '[data-test-id="lbApplicantWhatsappNomor"]';

function makeScraper(): KitaLulus {
  const config: KitaLulusConfigJson = {
    headless: true,
    limit: 0,
    base_url: "",
    email: "",
    password: "",
    api_destination: "http://127.0.0.1/unused",
    timeout: 1000,
    slowmo: 0,
    db_path: "../db/unused-kitalulus-contacts.db",
  };
  return new KitaLulus(config);
}

/** A page whose shared contact test-id renders `sharedTexts` in order. */
function makePanel(sharedTexts: string[], whatsappText: string | null = null) {
  const shared = {
    count: jest.fn().mockResolvedValue(sharedTexts.length),
    nth: jest.fn().mockImplementation((i: number) => ({
      textContent: jest.fn().mockResolvedValue(sharedTexts[i]),
    })),
  };
  const whatsapp = {
    count: jest.fn().mockResolvedValue(whatsappText === null ? 0 : 1),
    textContent: jest.fn().mockResolvedValue(whatsappText),
  };
  return {
    locator: jest.fn().mockImplementation((selector: string) => {
      if (selector === EMAIL_SELECTOR) return shared;
      if (selector === WHATSAPP_SELECTOR) return whatsapp;
      return { count: jest.fn().mockResolvedValue(0) };
    }),
  };
}

describe("contact shape helpers", () => {
  it.each([
    ["081234567890", true],
    ["+62 812-3456-7890", true],
    ["(021) 555 1234", true],
    ["1234567", false], // too short to be a phone
    ["a1b2c3@example.com", false],
    ["", false],
  ])("isPhoneShaped(%j) is %s", (text, expected) => {
    expect(isPhoneShaped(text)).toBe(expected);
  });

  it.each([
    ["someone@kitalulus.example.co.id", true],
    [" padded@example.com ", true],
    ["081234567890", false],
    ["no-at-sign.example.com", false],
    ["two@@example.com", false],
  ])("isEmailShaped(%j) is %s", (text, expected) => {
    expect(isEmailShaped(text)).toBe(expected);
  });
});

describe("KitaLulus contact extraction from the shared test-id", () => {
  const scraper = makeScraper();
  beforeAll(() => jest.spyOn(console, "info").mockImplementation(() => undefined));
  afterAll(() => jest.restoreAllMocks());

  it("reads the phone from the second shared match when no WhatsApp test-id exists", async () => {
    const page = makePanel(["someone@example.com", "081234567890"]);

    await expect(scraper.extractWA(page)).resolves.toEqual({ type: "WhatsApp", contact_number: "081234567890" });
    await expect(scraper.extractEmail(page)).resolves.toBe("someone@example.com");
  });

  it("still separates them when the panel renders the phone first", async () => {
    const page = makePanel(["081234567890", "someone@example.com"]);

    await expect(scraper.extractWA(page)).resolves.toEqual({ type: "WhatsApp", contact_number: "081234567890" });
    await expect(scraper.extractEmail(page)).resolves.toBe("someone@example.com");
  });

  it("prefers a populated dedicated WhatsApp test-id when a panel still renders one", async () => {
    const page = makePanel(["someone@example.com"], " 089876543210 ");

    await expect(scraper.extractWA(page)).resolves.toEqual({ type: "WhatsApp", contact_number: "089876543210" });
  });

  it("returns empty contacts rather than cross-filling when only one kind is shown", async () => {
    const emailOnly = makePanel(["someone@example.com"]);
    const phoneOnly = makePanel(["081234567890"]);

    await expect(scraper.extractWA(emailOnly)).resolves.toEqual({ type: "", contact_number: "" });
    await expect(scraper.extractEmail(phoneOnly)).resolves.toBe("");
  });
});
