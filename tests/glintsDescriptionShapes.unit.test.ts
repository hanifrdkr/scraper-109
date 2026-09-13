import { descriptionKeyPaths } from "../src/glints";

// Glints vacancy descriptions have no DOM source (no edit link on the job
// list) and the public job page is firewalled, so the run logs which of the
// dashboard's own API responses carry description-like keys. The walker must
// report shapes only — key paths and value lengths, never the text.

describe("descriptionKeyPaths", () => {
  it("reports nested description keys with their value lengths, not their values", () => {
    const payload = {
      data: {
        job: {
          id: "ebf41bfc-68e4-49f8-b6f9-894ba41a4e7a",
          title: "Contact Center Agent",
          descriptionJsonString: "x".repeat(420),
          shortDescription: "Kualifikasi: minimal SMA",
        },
      },
    };

    const paths = descriptionKeyPaths(payload);

    expect(paths).toEqual([
      { path: "data.job.descriptionJsonString", length: 420 },
      { path: "data.job.shortDescription", length: 24 },
    ]);
    expect(JSON.stringify(paths)).not.toContain("Kualifikasi");
  });

  it("walks arrays through their first element and marks them", () => {
    const payload = {
      data: [
        { id: 1, description: "first job text" },
        { id: 2, description: "second job text that is longer" },
      ],
    };

    expect(descriptionKeyPaths(payload)).toEqual([{ path: "data[].description", length: 14 }]);
  });

  it("measures object-valued description fields by their serialized size", () => {
    const blocks = { blocks: [{ text: "Tanggung jawab" }] };
    expect(descriptionKeyPaths({ job: { description: blocks } })).toEqual([
      { path: "job.description", length: JSON.stringify(blocks).length },
    ]);
  });

  it.each([
    ["no description keys", { data: { title: "Driver", location: "Bengkulu" } }],
    ["empty or null description values", { a: { description: "" }, b: { descriptionJson: null } }],
    ["a scalar payload", "plain text"],
    ["null", null],
  ])("returns nothing for %s", (_label, payload) => {
    expect(descriptionKeyPaths(payload)).toEqual([]);
  });

  it("stops at the depth limit instead of walking arbitrarily deep payloads", () => {
    let deep: Record<string, unknown> = { description: "bottom" };
    for (let i = 0; i < 20; i++) deep = { next: deep };
    expect(descriptionKeyPaths(deep)).toEqual([]);
  });
});
