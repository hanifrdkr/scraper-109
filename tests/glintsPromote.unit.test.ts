import os from "os";
import path from "path";
import { Glints, GlintsConfigJson } from "../src/glints";

// Glints serves an applicant's email, phone and resume only once the
// application leaves "Baru". The operator asked (2026-09-13) for a
// human-triggered scrapview action that moves NEW applicants to Terhubung via
// each row's three-dot menu and then scrapes them. Moves are visible in the
// employer's pipeline and cannot be undone by the scraper, so the flow may
// only ever click the exact "Pindahkan ke Terhubung" item, must respect its
// budget, and must stop — clicking nothing else — when that item is absent.

function makeConfig(): GlintsConfigJson {
  return {
    headless: true,
    cookies: [],
    local_storage: [],
    limit: 0,
    api_destination: "http://127.0.0.1/unused",
    timeout: 3000,
    slowmo: 0,
    db_path: path.relative(path.join(process.cwd(), "src"), path.join(os.tmpdir(), "glints-promote.db")),
  };
}

describe("Glints.isTerhubungMoveLabel", () => {
  it.each([["Pindahkan ke Terhubung"], ["  pindahkan ke terhubung "], ["Move to Connected"]])(
    "accepts %j",
    (label) => {
      expect(Glints.isTerhubungMoveLabel(label)).toBe(true);
    },
  );

  it.each([
    ["Pindahkan ke Tidak Sesuai"],
    ["Pindahkan ke Wawancara"],
    ["Terhubung"],
    ["Tolak"],
    ["Move to Rejected"],
    ["Pindahkan ke Terhubung sekarang"],
    [""],
  ])("rejects %j", (label) => {
    expect(Glints.isTerhubungMoveLabel(label)).toBe(false);
  });
});

describe("Glints.enablePromoteMode", () => {
  it("records the vacancy and a whole, non-negative budget", () => {
    const scraper = new Glints(makeConfig());
    scraper.enablePromoteMode(" ebf41bfc-68e4-49f8-b6f9-894ba41a4e7a ", 3.7);
    expect((scraper as unknown as { promoteMode: unknown }).promoteMode).toEqual({
      jid: "ebf41bfc-68e4-49f8-b6f9-894ba41a4e7a",
      max: 3,
    });
    scraper.enablePromoteMode("", -2);
    expect((scraper as unknown as { promoteMode: unknown }).promoteMode).toEqual({ jid: null, max: 0 });
    expect(scraper.getPromotedCount()).toBe(0);
  });
});

/**
 * A NEW-stage list: `newApplicants` rows, each with a trailing menu button
 * whose menu offers `menuLabels`. Clicking the Terhubung item removes the
 * first row, like the dashboard does. Every click is recorded.
 */
function fakeNewList(newApplicants: number, menuLabels: string[]) {
  const state = { rows: newApplicants, menuOpen: false, clicks: [] as string[], gotos: [] as string[] };

  const menuItem = (matcher: RegExp) => ({
    first: () => {
      const label = menuLabels.find((l) => matcher.test(l));
      return {
        count: async () => (state.menuOpen && label ? 1 : 0),
        isVisible: async () => state.menuOpen && Boolean(label),
        click: async () => {
          if (!label) throw new Error("click on missing menu item");
          state.clicks.push(label);
          state.menuOpen = false;
          if (Glints.isTerhubungMoveLabel(label)) state.rows = Math.max(0, state.rows - 1);
        },
      };
    },
  });

  const page = {
    goto: async (url: string) => {
      state.gotos.push(url);
    },
    waitForTimeout: async () => undefined,
    keyboard: {
      press: async (key: string) => {
        state.clicks.push(`key:${key}`);
        state.menuOpen = false;
      },
    },
    evaluate: async () => menuLabels,
    getByTestId: () => ({ last: () => ({ isVisible: async () => false }) }),
    getByRole: (_role: string, options: { name: RegExp }) => menuItem(options.name),
    getByText: (matcher: RegExp) => menuItem(matcher),
    locator: (selector: string) => {
      if (selector === '[data-testid="modal-close-btn"]') return { count: async () => 0 };
      if (selector.includes("EmptySearchResultWrapper")) return { count: async () => (state.rows === 0 ? 1 : 0) };
      return {
        count: async () => state.rows,
        first: () => ({
          locator: () => ({
            last: () => ({
              count: async () => (state.rows > 0 ? 1 : 0),
              click: async () => {
                state.clicks.push("row-menu");
                state.menuOpen = true;
              },
            }),
          }),
        }),
      };
    },
  };
  return { page, state };
}

describe("Glints.promoteNewApplicants", () => {
  const vacancyUrl = new URL(
    "https://employers.glints.id/manage-candidates?jid=ebf41bfc-68e4-49f8-b6f9-894ba41a4e7a&source=dashboard_job_card",
  );

  beforeEach(() => {
    jest.spyOn(console, "info").mockImplementation(() => undefined);
    jest.spyOn(console, "warn").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("opens the vacancy's NEW list and moves exactly its budget through each row's menu", async () => {
    const scraper = new Glints(makeConfig());
    const { page, state } = fakeNewList(5, ["Lihat Profil", "Pindahkan ke Terhubung", "Pindahkan ke Tidak Sesuai"]);

    await expect(scraper.promoteNewApplicants(page, vacancyUrl, 2)).resolves.toBe(2);

    expect(new URL(state.gotos[0]).searchParams.get("status")).toBe("NEW");
    expect(state.clicks).toEqual(["row-menu", "Pindahkan ke Terhubung", "row-menu", "Pindahkan ke Terhubung"]);
    expect(state.rows).toBe(3);
    expect(scraper.getPromotedCount()).toBe(2);
  });

  it("stops when the NEW list runs out before the budget", async () => {
    const scraper = new Glints(makeConfig());
    const { page, state } = fakeNewList(1, ["Pindahkan ke Terhubung"]);

    await expect(scraper.promoteNewApplicants(page, vacancyUrl, 5)).resolves.toBe(1);
    expect(state.clicks.filter((c) => c === "Pindahkan ke Terhubung")).toHaveLength(1);
  });

  it("clicks no stage action at all when the row menu has no exact Terhubung item", async () => {
    const scraper = new Glints(makeConfig());
    const { page, state } = fakeNewList(3, ["Lihat Profil", "Pindahkan ke Tidak Sesuai", "Pindahkan ke Wawancara"]);

    await expect(scraper.promoteNewApplicants(page, vacancyUrl, 3)).resolves.toBe(0);

    expect(state.clicks).toEqual(["row-menu", "key:Escape"]);
    expect(state.rows).toBe(3);
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining("Options seen"));
  });

  it("does nothing with a zero budget", async () => {
    const scraper = new Glints(makeConfig());
    const { page, state } = fakeNewList(3, ["Pindahkan ke Terhubung"]);

    await expect(scraper.promoteNewApplicants(page, vacancyUrl, 0)).resolves.toBe(0);
    expect(state.gotos).toEqual([]);
    expect(state.clicks).toEqual([]);
  });
});
