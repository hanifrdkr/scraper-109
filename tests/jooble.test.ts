import { Jooble, JoobleConfigJson } from "../src/jooble";
import fs from "fs";
import path from "path";

describe("Jooble Test", () => {
  let jooble: Jooble;

  beforeEach(() => {
    const joobleConfig = path.join(__dirname, "../", "jooble.json");
    const joobleData = fs.readFileSync(joobleConfig, "utf-8");
    const joobleJson = JSON.parse(joobleData) as JoobleConfigJson;
    jooble = new Jooble(joobleJson);
  });

  describe("ConvertAppliedAt", () => {
    it('should convert a date string to the format "YYYY-MM-DD"', async () => {
      const dateString = "2024-05-24T05:32:54";
      const expectedOutput = "2024-05-24";

      const result = await jooble.ConvertAppliedAt(dateString);

      expect(result).toEqual(expectedOutput);
    });

    it('should convert a date string to the format "" with empty string', async () => {
      const dateString = "";
      const expectedOutput = "";

      const result = await jooble.ConvertAppliedAt(dateString);

      expect(result).toEqual(expectedOutput);
    });
  });
});
