"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const kitalulus_1 = require("./kitalulus");
const kitalulus_v2_1 = require("./kitalulus-v2");
const jooble_1 = require("./jooble");
const seek_1 = require("./seek");
const glints_1 = require("./glints");
const pintarnya_1 = require("./pintarnya");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const args = process.argv.slice(2);
const kitaLulusConfig = path_1.default.join(__dirname, "../", "kitalulus.json");
const kitaLulusData = fs_1.default.readFileSync(kitaLulusConfig, "utf-8");
const kitaLulusJson = JSON.parse(kitaLulusData);
const KL = new kitalulus_1.KitaLulus(kitaLulusJson);
const kitaLulusConfigV2 = path_1.default.join(__dirname, "../", "kitalulus-v2.json");
const kitaLulusDataV2 = fs_1.default.readFileSync(kitaLulusConfigV2, "utf-8");
const kitaLulusJsonV2 = JSON.parse(kitaLulusDataV2);
const KLV2 = new kitalulus_v2_1.KitaLulusV2(kitaLulusJsonV2);
const joobleConfig = path_1.default.join(__dirname, "../", "jooble.json");
const joobleData = fs_1.default.readFileSync(joobleConfig, "utf-8");
const joobleJson = JSON.parse(joobleData);
const JL = new jooble_1.Jooble(joobleJson);
const seekConfig = path_1.default.join(__dirname, "../", "seek.json");
const seekData = fs_1.default.readFileSync(seekConfig, "utf-8");
const seekJson = JSON.parse(seekData);
const SK = new seek_1.Seek(seekJson);
const glintsConfig = path_1.default.join(__dirname, "../", "glints.json");
const glintsData = fs_1.default.readFileSync(glintsConfig, "utf-8");
const glintsJson = JSON.parse(glintsData);
const GT = new glints_1.Glints(glintsJson);
const pintarnyaConfig = path_1.default.join(__dirname, "../", "pintarnya.json");
const pintarnyaData = fs_1.default.readFileSync(pintarnyaConfig, "utf-8");
const pintarnyaJson = JSON.parse(pintarnyaData);
const PT = new pintarnya_1.Pintarnya(pintarnyaJson);
const command = args[0];
switch (command) {
    case "kitalulus":
        console.log("Will run kitalulus scraper");
        KL.Scrape();
        break;
    case "kitalulus-v2-vacancies":
        console.log("Will run kitalulus v2 vacancy");
        KLV2.ScrapeVacancy();
        break;
    case "kitalulus-v2-applicants":
        console.log("Will run kitalulus v2 applicants");
        KLV2.ScrapeApplicant();
        break;
    case "kitalulus-v2-process-applicants":
        console.log("Will run kitalulus v2 process applicants");
        KLV2.ProcessApplicant();
        break;
    case "jooble":
        console.log("Will run jooble scraper");
        JL.Scrape();
        break;
    case "seek":
        console.log("Will run seek scraper");
        SK.Scrape();
        break;
    case "glints":
        console.log("Will run glints scraper");
        GT.Scrape();
        break;
    case "pintarnya":
        console.log("Will run pintarnya scraper");
        PT.Scrape();
        break;
    default:
        console.log("Will run all scrapers");
        break;
}
