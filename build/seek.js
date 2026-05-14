"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Seek = void 0;
const playwright_1 = __importDefault(require("playwright"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const axios_1 = __importDefault(require("axios"));
const form_data_1 = __importDefault(require("form-data"));
const sqlite3_1 = __importDefault(require("sqlite3"));
class Seek {
    /**
     * Represents a Seek object.
     * @constructor
     * @param {SeekConfigJson} config - The configuration object for Seek.
     */
    constructor(config) {
        this.HEADLESS = true;
        this.LIMIT = 0;
        this.COOKIES = [];
        this.LOCALSTORAGE = [];
        this.APIDESTINATION = "";
        this.DB_PATH = "";
        this.HEADLESS = config.headless;
        this.LIMIT = config.limit;
        this.COOKIES = config.cookies;
        this.LOCALSTORAGE = config.local_storage;
        this.APIDESTINATION = config.api_destination;
        this.DB_PATH = path_1.default.join(__dirname, config.db_path);
        this.DB = new sqlite3_1.default.Database(this.DB_PATH);
        console.info("CONFIG SEEK LOADED");
    }
    createDatabaseConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!fs_1.default.existsSync(this.DB_PATH)) {
                fs_1.default.mkdirSync(path_1.default.dirname(this.DB_PATH), { recursive: true });
                fs_1.default.writeFileSync(this.DB_PATH, "");
            }
            return new Promise((resolve, reject) => {
                this.DB = new sqlite3_1.default.Database(this.DB_PATH, (err) => {
                    if (err) {
                        reject(err);
                    }
                    else {
                        resolve(this.DB);
                    }
                });
            });
        });
    }
    createApplicantsTable() {
        return __awaiter(this, void 0, void 0, function* () {
            const query = `CREATE TABLE IF NOT EXISTS applicants (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL, data TEXT NOT NULL)`;
            return new Promise((resolve, reject) => {
                this.DB.run(query, (err) => { err ? reject(err) : resolve(); });
            });
        });
    }
    isTableExist(tableName) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`;
            return new Promise((resolve, reject) => {
                this.DB.get(query, (err, row) => { err ? reject(err) : resolve(row !== undefined); });
            });
        });
    }
    createRequiredTables() {
        return __awaiter(this, void 0, void 0, function* () {
            const exists = yield this.isTableExist("applicants");
            if (!exists)
                yield this.createApplicantsTable();
        });
    }
    getApplicantByEmail(email) {
        return __awaiter(this, void 0, void 0, function* () {
            const query = `SELECT * FROM applicants WHERE email = '${email}'`;
            return new Promise((resolve, reject) => {
                this.DB.get(query, (err, row) => { err ? reject(err) : resolve(row); });
            });
        });
    }
    insertApplicant(data) {
        return __awaiter(this, void 0, void 0, function* () {
            const json = JSON.stringify(data).replace(/'/g, "''");
            const query = `INSERT INTO applicants (email, data) VALUES ('${data.email}', '${json}')`;
            return new Promise((resolve, reject) => {
                this.DB.run(query, (err) => { err ? reject(err) : resolve(); });
            });
        });
    }
    /**
     * Sends a request with the provided applicant data.
     * @param param - The applicant data.
     * @returns A Promise that resolves when the request is sent successfully.
     */
    sendRequest(param) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const bodyFormData = new form_data_1.default();
                bodyFormData.append("channel", param.portal);
                bodyFormData.append("type", param.type);
                bodyFormData.append("applied_for", param.applied_for);
                bodyFormData.append("applied_date", param.applied_date);
                bodyFormData.append("email", param.email);
                bodyFormData.append("fullname", param.name);
                bodyFormData.append("contact", param.phone);
                bodyFormData.append("cv", fs_1.default.createReadStream(param.cv));
                yield (0, axios_1.default)({
                    method: "post",
                    url: this.APIDESTINATION,
                    data: bodyFormData,
                    headers: { "Content-Type": "multipart/form-data" },
                });
                console.info("Success sending param", param);
            }
            catch (error) {
                console.info("Error sending param", param);
                console.error("Error sending request with response:", error.response.data);
            }
            yield this.insertApplicant(param);
        });
    }
    ExtractListVacancyPage(page) {
        return __awaiter(this, void 0, void 0, function* () {
            const lv = page.locator(`.pcewoe2`);
            const listVacancyPage = [];
            for (let i = 0; i < (yield lv.count()); i++) {
                const element = lv.nth(i);
                const ee = element.locator('.pcewoe6 ._1k0awaof');
                const link = yield ee.getAttribute('href');
                const aa = ee.locator('.bifvf40');
                const title = yield aa.textContent();
                listVacancyPage.push({ title: String(title), link: "this.BASE_URL" + link });
            }
            return listVacancyPage;
        });
    }
    /**
     * Checks for the presence of a lazy-loaded element on the page.
     *
     * @param page - The page object representing the web page.
     * @param locator - The locator string used to identify the element.
     * @returns A promise that resolves once the element is found or the timeout is reached.
     */
    checkLazyLoadedElement(page, locator) {
        return __awaiter(this, void 0, void 0, function* () {
            let elementFound = false;
            let startTime = Date.now();
            const timeout = 20000;
            while (!elementFound && Date.now() - startTime < timeout) {
                console.info("Checking for lazy-loaded element: %s", locator);
                const element = page.locator(locator);
                elementFound = (yield element.count()) > 0;
                yield page.waitForTimeout(1000);
            }
            if (elementFound) {
                console.info("Lazy-loaded element: %s found!", locator);
            }
            else {
                console.info("Element: %s not found within timeout!", locator);
            }
        });
    }
    /**
     * Scrapes data from the Jooble website.
     * @returns A Promise that resolves when the scraping is complete.
     */
    Scrape() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.createDatabaseConnection();
            yield this.createRequiredTables();
            const browser = yield playwright_1.default.chromium.launch({
                headless: this.HEADLESS,
                slowMo: 5000,
            });
            const page = yield browser.newPage();
            yield page.goto("https://id.employer.seek.com", { timeout: 600000 });
            const context = yield browser.newContext();
            yield context.addCookies(this.COOKIES);
            yield page.evaluate((localStorageData) => {
                for (const i of localStorageData) {
                    localStorage.setItem(i.key, i.value);
                }
            }, this.LOCALSTORAGE);
            yield page.goto("https://id.employer.seek.com/candidates", { timeout: 600000 });
            yield page.waitForTimeout(600000000);
            yield browser.close();
            console.log("DONE");
            process.exit();
        });
    }
}
exports.Seek = Seek;
