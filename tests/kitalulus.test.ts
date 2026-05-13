import { KitaLulus, KitaLulusConfigJson } from "../src/kitalulus";
import path from "path";
import fs from "fs";

describe("KitaLulus Test", () => {
  let kitaLulus: KitaLulus;

  beforeEach(() => {
    const kitaLulusConfig = path.join(__dirname, "../", "kitalulus.json");
    const kitaLulusData = fs.readFileSync(kitaLulusConfig, "utf-8");
    const kitaLulusJson = JSON.parse(kitaLulusData) as KitaLulusConfigJson;
    kitaLulus = new KitaLulus(kitaLulusJson);
  });

  describe("cleanseAppliedDate", () => {
    it('should remove "Melamar pada" from the text', async () => {
      const input = "Melamar pada 2022-01-01";
      const expectedOutput = "2022-01-01";

      const result = await kitaLulus.cleanseAppliedDate(input);

      expect(result).toEqual(expectedOutput);
    });

    it("should return an empty string if the input is null", async () => {
      const input = null;
      const expectedOutput = "";

      const result = await kitaLulus.cleanseAppliedDate(input);

      expect(result).toEqual(expectedOutput);
    });
  });

  describe("cleanText", () => {
    it("should remove whitespace and special characters and split the text by hyphen", async () => {
      const input = "HelloWorld ";
      const expectedOutput = "HelloWorld";

      const result = await kitaLulus.cleanText(input);

      expect(result).toEqual(expectedOutput);
    });
  });

  describe("translateGender", () => {
    it("should remove whitespace and special characters and split the text by hyphen", async () => {
      const input = "Perempuan";
      const expectedOutput = "FEMALE";

      const result = await kitaLulus.translateGender(input);

      expect(result).toEqual(expectedOutput);
    });

    it("should remove whitespace and special characters and split the text by hyphen", async () => {
      const input = "Laki-Laki";
      const expectedOutput = "MALE";

      const result = await kitaLulus.translateGender(input);

      expect(result).toEqual(expectedOutput);
    });

    it("should remove whitespace and special characters and split the text by hyphen", async () => {
      const input = "LakiLaki ";
      const expectedOutput = "";

      const result = await kitaLulus.translateGender(input);

      expect(result).toEqual(expectedOutput);
    });
  });

  describe("fetchAndStoreImage", () => {
    it("should download and store the image from the given URL", async () => {
      const imageUrl = "https://imagedelivery.net/zmT1bHITMC1AralJOt9_Vg/dc2e1aff-8f57-473d-24ba-cc612a60f000/public";
      const path = await kitaLulus.fetchAndStore(imageUrl);
      console.log(path);
    }, 1000000);
    it("should download and store the pdf from the given URL", async () => {
      const imageUrl = "https://pii.or.id/uploads/dummies.pdf";
      const path = await kitaLulus.fetchAndStore(imageUrl);
      console.log(path);
    }, 1000000);
  });

  describe("splitText", () => {
    it("should split the text by hyphen", async () => {
      const text = "Hello-World-Test";
      const result = await kitaLulus.splitText(text, "-");
      expect(result).toEqual(["Hello", "World", "Test"]);
    });

    it("should return an empty array if the text does not contain hyphen", async () => {
      const text = "HelloWorldTest";
      const expectedOutput = ["HelloWorldTest"];
      const result = await kitaLulus.splitText(text, "-");
      expect(result).toEqual(expectedOutput);
    });

    it("should return an empty array if the text does not contain hyphen", async () => {
      const text = "November 2022 - Agustus 2023";
      const expectedOutput = ["November 2022", "Agustus 2023"];
      const result = await kitaLulus.splitText(text, "-");
      expect(result).toEqual(expectedOutput);
    });
  });
});
