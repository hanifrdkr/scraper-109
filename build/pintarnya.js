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
exports.Pintarnya = void 0;
const axios_1 = __importDefault(require("axios"));
const playwright_1 = __importDefault(require("playwright"));
const sqlite3_1 = __importDefault(require("sqlite3"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const INDONESIAN_MONTHS = [
    "Januari",
    "Februari",
    "Maret",
    "April",
    "Mei",
    "Juni",
    "Juli",
    "Agustus",
    "September",
    "Oktober",
    "November",
    "Desember",
];
class Pintarnya {
    constructor(config) {
        this.HEADLESS = true;
        this.EMAIL = "";
        this.PASSWORD = "";
        this.LIMIT = 0;
        this.API_DESTINATION = "";
        this.JOB_VACANCIES = [];
        this.DB_PATH = "";
        this.DELAY = 0;
        this.DELAY_AFTER = 0;
        this.TIMEOUT = 30000;
        this.MAX_RETRY = 3;
        this.COLLECTED_APPLICANT = 0;
        this.FAILED_COLLECTED_APPLICANT = [];
        this.SKIPPED_APPLICANT_BY_DATABASE = 0;
        this.CHANNEL = "pintarnya";
        this.TYPE = "applicant";
        this.BASE_URL = "https://pintarnya.com";
        this.SIGN_IN_URL = "https://pintarnya.com/perusahaan";
        this.JOB_VACANCY_URL = "https://pintarnya.com/perusahaan/jobs";
        this.SIGN_IN_EMAIL_SELECTOR = 'input[type="email"]';
        this.SIGN_IN_PASSWORD_SELECTOR = 'input[type="password"]';
        this.SIGN_IN_SUBMIT_SELECTOR = 'button[type="submit"]';
        this.JOB_LIST_CONTAINER_SELECTOR = 'section[id="telo"]';
        this.JOB_TITLE_LIST_SELECTOR = '.css-dhzpu0';
        this.HEADLESS = config.headless;
        console.info("Loaded headless %s", this.HEADLESS);
        this.EMAIL = config.email;
        console.info("Loaded email %s", this.EMAIL);
        this.PASSWORD = config.password;
        console.info("Loaded password %s", this.PASSWORD);
        this.LIMIT = config.limit;
        console.info("Loaded limit %O", this.LIMIT);
        console.info("Loaded API destination %s", config.api_destination);
        this.API_DESTINATION = config.api_destination;
        console.info("Loaded vacancies %O", config.job_vacancies);
        this.JOB_VACANCIES = config.job_vacancies;
        console.info("Loaded delay %s", config.delay);
        this.DELAY = config.delay;
        console.info("Loaded delay after %s", config.delay_after);
        this.DELAY_AFTER = config.delay_after;
        console.info("Loaded db path %s", config.db_path);
        this.DB_PATH = path_1.default.join(__dirname, config.db_path);
        this.TIMEOUT = config.timeout;
        this.MAX_RETRY = config.max_retry;
        this.DB = new sqlite3_1.default.Database(this.DB_PATH);
    }
    getBrowserFallbackExecutablePath() {
        const candidates = [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/opt/homebrew/bin/chromium",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
        ];
        for (const candidate of candidates) {
            if (fs_1.default.existsSync(candidate)) {
                return candidate;
            }
        }
        return null;
    }
    launchBrowser() {
        return __awaiter(this, void 0, void 0, function* () {
            const launchOptions = {
                headless: this.HEADLESS,
            };
            try {
                return yield playwright_1.default.chromium.launch(launchOptions);
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                if (!message.includes("Executable doesn't exist")) {
                    throw error;
                }
                const fallbackExecutablePath = this.getBrowserFallbackExecutablePath();
                if (!fallbackExecutablePath) {
                    throw error;
                }
                console.info(`[LOGIN] Playwright bundled Chromium missing. Falling back to local browser: ${fallbackExecutablePath}`);
                return yield playwright_1.default.chromium.launch(Object.assign(Object.assign({}, launchOptions), { executablePath: fallbackExecutablePath }));
            }
        });
    }
    /**
     * Scrapes data from the Pintarnya website.
     * @returns {Promise<void>} A promise that resolves when the scraping is complete.
     */
    // https://image.moengage.com
    Scrape() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e;
            console.info("Establishing database connection...");
            this.DB = yield this.createDatabaseConnection();
            console.info("Creating required tables...");
            yield this.createRequiredTables();
            console.info("[LOGIN] Launching browser...");
            const browser = yield this.launchBrowser();
            const page = yield browser.newPage();
            page.setDefaultTimeout(this.TIMEOUT);
            const blacklist = ["clarity.ms", "moengage.com"];
            yield page.route("**/*", (route) => {
                if (blacklist.some((url) => route.request().url().includes(url))) {
                    route.abort();
                }
                else {
                    route.continue();
                }
            });
            console.info(`[LOGIN] Navigating to ${this.SIGN_IN_URL}...`);
            yield page.goto(this.SIGN_IN_URL);
            yield page.waitForLoadState("load");
            console.info("[LOGIN] Waiting for submit button to appear...");
            yield this.checkLazyLoadedElement(page, page.locator(this.SIGN_IN_SUBMIT_SELECTOR));
            console.info("[LOGIN] Filling credentials...");
            yield page.locator(this.SIGN_IN_EMAIL_SELECTOR).fill((_a = this.EMAIL) !== null && _a !== void 0 ? _a : "-");
            yield page.locator(this.SIGN_IN_PASSWORD_SELECTOR).fill((_b = this.PASSWORD) !== null && _b !== void 0 ? _b : "-");
            yield page.locator(this.SIGN_IN_SUBMIT_SELECTOR).click();
            console.info("[LOGIN] Submitted. Waiting for redirect to job vacancy page...");
            yield this.waitForEmployerLandingPage(page);
            yield page.waitForLoadState("load");
            console.info("[LOGIN] Login successful.");
            if (yield this.isCandidateListPage(page)) {
                console.info("[NAV] Session already opened the Kandidat page. Staying on the current page.");
                const applicantCount = yield this.extractCurrentCandidatePageApplicantCount(page);
                yield this.processCurrentCandidatePage(page, applicantCount);
                console.info("[DONE] Finished scraping the current Kandidat page.");
                process.exit(0);
            }
            console.info("[VACANCY] Closing modals and fetching job list...");
            yield this.errorCatcher(page);
            if (yield this.isCandidateListPage(page)) {
                console.info("[NAV] Kandidat page detected after login cleanup. Skipping Lowongan scrolling.");
                const applicantCount = yield this.extractCurrentCandidatePageApplicantCount(page);
                yield this.processCurrentCandidatePage(page, applicantCount);
                console.info("[DONE] Finished scraping the current Kandidat page.");
                process.exit(0);
            }
            console.info("[VACANCY] Scrolling to load all job vacancies...");
            const jobVacancyListContainer = yield this.fetchingAllJobList(page);
            console.info("[VACANCY] Selecting job vacancy buttons...");
            yield this.errorCatcher(page);
            const jobVacancyButton = yield jobVacancyListContainer.locator("div#kandidat-btn").all();
            let jobVacancyList = [];
            if (this.JOB_VACANCIES.length > 0) {
                console.info(`[VACANCY] Using ${this.JOB_VACANCIES.length} job(s) from config.`);
                jobVacancyList = this.JOB_VACANCIES;
            }
            else {
                jobVacancyList = yield this.extractJobVacancy(jobVacancyButton);
                console.info(`[VACANCY] Extracted ${jobVacancyList.length} job(s) from page.`);
            }
            /**
             * Open all the jobVacancy detail.
             */
            for (const jobVacancy of jobVacancyList) {
                console.info("=======================================================");
                console.info(`[VACANCY] Processing: "${jobVacancy.position}" @ ${jobVacancy.location}`);
                let jobVacancyWrapper = null;
                /**
                 * Select the element by title
                 */
                yield this.errorCatcher(page);
                const jobVacancyHeadings = yield jobVacancyListContainer.getByRole("heading", {
                    name: jobVacancy.position,
                }).all();
                /**
                 * Find the jobVacancy with the same location
                 * and click the detail button.
                 * Handle if there are multiple jobVacancy with the same position.
                 */
                console.info(`There are ${jobVacancyHeadings.length} jobVacancy with position ${jobVacancy.position}`);
                for (const jobVacancyHeading of jobVacancyHeadings) {
                    const isJobVacancyLocationSame = yield jobVacancyHeading
                        .locator('..')
                        .locator('..')
                        .getByText(jobVacancy.location)
                        .isVisible();
                    /**
                     * Set the wrapper element
                     */
                    if (isJobVacancyLocationSame) {
                        jobVacancyWrapper = jobVacancyHeading.locator('..').locator('..');
                        break;
                    }
                }
                if (jobVacancyWrapper === null) {
                    console.info(`[VACANCY] Not found on page: "${jobVacancy.position}" @ ${jobVacancy.location}. Skipping.`);
                    throw new Error(`JobVacancy with position ${jobVacancy.position} and location ${jobVacancy.location} not found`);
                }
                /**
                 * Applicant counts
                 */
                yield this.errorCatcher(page);
                const jobVacancyDetailButton = jobVacancyWrapper.locator("div#kandidat-btn");
                /**
                 * Get the applicant count
                 * @example 31Kandidat2 belum dicek
                 * @returns 31
                 */
                const applicantCount = yield jobVacancyDetailButton.textContent().then((text) => {
                    if (text === null)
                        return 0;
                    return parseInt(text.split("Kandidat")[0].trim());
                });
                console.log({ applicantCount });
                console.info(`[VACANCY] Opening candidates page (${applicantCount} total applicants)...`);
                yield this.errorCatcher(page);
                yield jobVacancyDetailButton.click();
                console.info("[VACANCY] Waiting for candidate page markers...");
                yield this.waitCandidatePageReady(page);
                let nthCard = 0;
                let isScrappingCard = true;
                try {
                    yield this.errorCatcher(page);
                    isScrappingCard = yield this.ensureCandidateCardsReady(page);
                    if (!isScrappingCard) {
                        console.info("[VACANCY] Kandidat page loaded, but no candidate cards are visible.");
                    }
                }
                catch (error) {
                    isScrappingCard = false;
                }
                /**
                 * Applied for id
                 *
                 * @example https://pintarnya.com/perusahaan/candidates?job=283020
                 * @returns 283020
                 */
                const pageUrl = page.url();
                const appliedForId = pageUrl.split("job=")[1];
                console.log({ appliedForId });
                /**
                 * Sync the jobVacancy data with the database.
                 * If the jobVacancy is not found in the database, insert it.
                 * If the jobVacancy is found in the database, check if the data is the same.
                 * If the data is the same, move to the next job.
                 * If the data is different, update the jobVacancy data.
                 */
                const jobVacancyInDatabase = yield this.getVacancyByPintarnyaJobId(appliedForId);
                const applicantsOfJobVacancyInDatabase = yield this.countApplicantByPintarnyaJobId(appliedForId);
                console.log({ applicantsOfJobVacancyInDatabase });
                if (jobVacancyInDatabase === undefined && appliedForId !== undefined) {
                    console.info(`[DB] New vacancy, inserting into local DB: "${jobVacancy.position}" (id: ${appliedForId})`);
                    yield this.insertJobVacancy(jobVacancy.position, jobVacancy.location, appliedForId, applicantCount);
                }
                else {
                    console.info(`[DB] Vacancy already in DB. DB applicants: ${jobVacancyInDatabase.applicants}, page applicants: ${applicantCount}, scraped: ${applicantsOfJobVacancyInDatabase}`);
                    if (jobVacancy.position === jobVacancyInDatabase.position &&
                        jobVacancy.location === jobVacancyInDatabase.location &&
                        appliedForId === jobVacancyInDatabase.pintarnya_job_id &&
                        applicantCount === jobVacancyInDatabase.applicants &&
                        jobVacancyInDatabase.applicants === applicantsOfJobVacancyInDatabase) {
                        console.info("[SKIP] No new applicants since last run. Moving to next vacancy.");
                        isScrappingCard = false;
                    }
                    else {
                        console.info("[VACANCY] Applicant count changed, re-scraping...");
                    }
                }
                /**
                 * Scraping candidate card.
                 */
                while (isScrappingCard) {
                    console.log("COLLECTED_APPLICANT: ", this.COLLECTED_APPLICANT);
                    /**
                     * Check if the limit is reached.
                     * If the limit is reached, exit the loop.
                     * Otherwise, continue scraping the next card.
                     * The limit is set to 0 by default.
                     * If the limit is set to 0, it will scrape all the cards.
                     *
                     */
                    if (this.LIMIT > 0 && this.COLLECTED_APPLICANT >= this.LIMIT) {
                        isScrappingCard = false;
                        console.info("Scrape limit reached. Exiting...");
                        process.exit(0);
                    }
                    /**
                     * Check if the delay is reached.
                     * If the delay is reached, wait for the delay time.
                     * Otherwise, continue scraping the next card.
                     * The delay is set to 0 by default.
                     * If the delay is set to 0, it will not wait.
                     * The delay_after is set to 0 by default.
                     * If the delay_after is set to 0, it will not wait.
                     * The delay_after is used to delay the scraping process after a certain number of collected applicants.
                     * The delay_after works also on every multiple of the delay_after.
                     */
                    if (this.DELAY > 0 &&
                        this.COLLECTED_APPLICANT > 0 &&
                        this.COLLECTED_APPLICANT % this.DELAY_AFTER === 0) {
                        console.info("Delaying the scraping process...", new Date());
                        yield page.waitForTimeout(this.DELAY);
                        console.info("Resuming the scraping process...", new Date());
                    }
                    try {
                        console.info("-------------------------------------------------------");
                        console.info(`[CANDIDATE] Scraping card #${nthCard + 1}...`);
                        const cardSelector = `div[id="candidate-card-${nthCard + 1}"]`;
                        yield this.errorCatcher(page);
                        const card = page.locator(cardSelector);
                        if (!(yield card.isVisible())) {
                            isScrappingCard = false;
                            console.log("Element with id candidate-card-%d is not found", nthCard + 1);
                            console.log("Move to the next job...");
                            break;
                        }
                        /**
                         * Click the {nthCard} candidate card.
                         * This will show the candidate detail on the right side of the page.
                         */
                        console.log("Clicking candidate card...");
                        yield this.errorCatcher(page);
                        yield card.click();
                        yield page.waitForLoadState();
                        /**
                         * Wait for the candidate detail to be attached to the DOM.
                         */
                        const candidateCardDetail = page.locator("div#candidate-detail");
                        yield this.checkLazyLoadedElement(page, candidateCardDetail);
                        console.log("Getting candidate details...");
                        /**
                         * Get the candidate name.
                         */
                        yield this.errorCatcher(page);
                        const candidateName = yield card
                            .locator("h3")
                            .textContent();
                        console.log("Candidate name:", candidateName);
                        if (candidateName === null) {
                            console.log("Candidate name is null. Skipping...");
                            nthCard++;
                            continue;
                        }
                        /**
                         * Wait the detail section load the proper data.
                         */
                        yield candidateCardDetail.getByText(candidateName, { exact: true }).isVisible();
                        yield page.waitForLoadState();
                        yield page.waitForTimeout(10000);
                        /**
                         * Get the candidate age and location.
                        */
                        yield this.errorCatcher(page);
                        const candidateAgeAndLocation = yield candidateCardDetail
                            .locator("div.justify-start")
                            .nth(0)
                            .textContent();
                        const candidateAge = (_c = candidateAgeAndLocation === null || candidateAgeAndLocation === void 0 ? void 0 : candidateAgeAndLocation.split("•")[0]) === null || _c === void 0 ? void 0 : _c.trim();
                        console.log("Candidate age:", candidateAge);
                        const candidateLocation = (_d = candidateAgeAndLocation === null || candidateAgeAndLocation === void 0 ? void 0 : candidateAgeAndLocation.split("•")[1]) === null || _d === void 0 ? void 0 : _d.trim();
                        console.log("Candidate location:", candidateLocation);
                        /**
                         * Get the candidate applied job and date.
                         */
                        yield this.errorCatcher(page);
                        const candidateAppliedJobAndDate = yield candidateCardDetail
                            .locator("div.mt-4")
                            .textContent();
                        console.log("Candidate applied job and date:", candidateAppliedJobAndDate);
                        const appliedFor = candidateAppliedJobAndDate === null || candidateAppliedJobAndDate === void 0 ? void 0 : candidateAppliedJobAndDate.split("pada")[0].replace("Melamar", "").trim();
                        console.log("Applied job:", appliedFor);
                        const appliedDate = candidateAppliedJobAndDate === null || candidateAppliedJobAndDate === void 0 ? void 0 : candidateAppliedJobAndDate.split("pada")[1].trim();
                        console.log("Applied date:", appliedDate);
                        /**
                         * Get the candidate email.
                         */
                        yield this.errorCatcher(page);
                        const candidateEmail = yield candidateCardDetail
                            .locator("div.justify-start")
                            .nth(1)
                            .locator("button")
                            .nth(0)
                            .locator("p")
                            .textContent();
                        console.log("Candidate email:", candidateEmail);
                        /**
                         * Check is candidate data already exist in the database
                         * If exist, skip the data
                         * If not exist, insert the data
                         */
                        console.info(`[CANDIDATE] Name: ${candidateName}, Email: ${candidateEmail || "(none)"}`);
                        const applicantInDatabase = yield this.getApplicantByEmail(candidateEmail || "");
                        if (applicantInDatabase !== undefined &&
                            applicantInDatabase.email === candidateEmail &&
                            applicantInDatabase.applied_for_id === appliedForId) {
                            console.info("[SKIP] Already in local DB, skipping.");
                            this.SKIPPED_APPLICANT_BY_DATABASE++;
                            nthCard++;
                            continue;
                        }
                        console.info("[PHONE] Clicking phone reveal button...");
                        yield this.errorCatcher(page);
                        const candidatePhoneButton = candidateCardDetail
                            .locator("div.justify-start")
                            .nth(1)
                            .locator("button")
                            .nth(1);
                        yield candidatePhoneButton.click();
                        console.info("[PHONE] Waiting for 'Kontak Kandidat' modal...");
                        const candidatePhoneModal = page
                            .locator("div")
                            .filter({ hasText: /^Kontak Kandidat$/ });
                        yield this.checkLazyLoadedElement(page, candidatePhoneModal);
                        yield candidatePhoneModal.waitFor({ state: "attached" });
                        const candidatePhone = yield candidatePhoneModal
                            .locator("..")
                            .locator("p")
                            .nth(2)
                            .textContent();
                        console.info(`[PHONE] Phone: ${candidatePhone || "(none)"}`);
                        yield this.errorCatcher(page);
                        yield candidatePhoneModal.locator("img").click();
                        /**
                         * Get the candidate latest salary.
                         */
                        const latestSalaryLabel = candidateCardDetail.getByText("Gaji terakhir");
                        yield this.errorCatcher(page);
                        latestSalaryLabel.scrollIntoViewIfNeeded();
                        const latestSalary = yield latestSalaryLabel
                            .locator("..")
                            .locator("div")
                            .nth(1)
                            .textContent();
                        console.log("Latest salary:", latestSalary);
                        /**
                         * Get the candidate experience.
                         */
                        const experienceLabel = candidateCardDetail.getByRole("heading", {
                            name: "Pengalaman Kerja",
                        });
                        let experiences = [];
                        if (yield experienceLabel.isVisible()) {
                            yield this.errorCatcher(page);
                            experienceLabel.scrollIntoViewIfNeeded();
                            const experienceWrapper = experienceLabel.locator("..").locator("..");
                            const anyUlInsideExperienceWrapper = experienceWrapper
                                .locator("ul")
                                .all();
                            for (const experience of yield anyUlInsideExperienceWrapper) {
                                const experienceDetail = experience.locator("ul");
                                if ((yield experienceDetail.count()) > 0) {
                                    const company = yield experience.locator("li").nth(0).textContent();
                                    console.log("Company:", company);
                                    const position = yield experienceDetail
                                        .locator(".fw-600")
                                        .first()
                                        .textContent();
                                    console.log("Position:", position);
                                    const longEmployment = yield experienceDetail
                                        .locator(".fw-500")
                                        .nth(0)
                                        .textContent();
                                    console.log("Long employment:", longEmployment);
                                    const description = yield experienceDetail
                                        .locator(".fw-500")
                                        .nth(1)
                                        .locator("div")
                                        .nth(0)
                                        .textContent();
                                    console.log("Description:", description);
                                    const [periodFrom, periodTo] = this.extractEmploymentPeriod(longEmployment !== null && longEmployment !== void 0 ? longEmployment : "-");
                                    experiences.push({
                                        position: position !== null && position !== void 0 ? position : "-",
                                        organization: company !== null && company !== void 0 ? company : "-",
                                        job_desc: this.cleanString(description !== null && description !== void 0 ? description : "") || "-",
                                        period_from: periodFrom !== null && periodFrom !== void 0 ? periodFrom : "0",
                                        period_to: periodTo !== null && periodTo !== void 0 ? periodTo : "0",
                                    });
                                }
                            }
                        }
                        /**
                         * Get the candidate education.
                         */
                        const educationLabel = candidateCardDetail.getByRole("heading", {
                            name: "Pendidikan",
                        });
                        yield this.errorCatcher(page);
                        yield educationLabel.scrollIntoViewIfNeeded();
                        const educationWrapper = educationLabel.locator("..");
                        const education = yield educationWrapper.locator("p").allTextContents();
                        console.log("Education:", education);
                        /**
                         * Get the candidate skills.
                         */
                        const skillsLabel = candidateCardDetail.getByRole("heading", {
                            name: /Keahlian/,
                        });
                        let skills = [];
                        if (yield skillsLabel.isVisible()) {
                            yield this.errorCatcher(page);
                            yield skillsLabel.scrollIntoViewIfNeeded();
                            const skillsWrapper = skillsLabel.locator("..");
                            const skillBadges = yield skillsWrapper
                                .locator("div")
                                .filter({
                                hasNotText: "Keahlian terverifikasi oleh Pintarnya",
                            })
                                .allTextContents();
                            console.log("Skills:", skillBadges.slice(3));
                            // push all data from index 3 to the end of the array
                            skills.push(...skillBadges.slice(3));
                        }
                        /**
                         * Get the candidate photo
                         */
                        console.log("Checking photo...");
                        yield this.errorCatcher(page);
                        const photo = yield candidateCardDetail
                            .getByAltText("photo profile")
                            .getAttribute("src");
                        const photoUrl = this.BASE_URL + photo;
                        const photoFile = photo ? yield this.urlToFile(photoUrl, `${candidateName}.webp`) : null;
                        console.log("Photo:", photo);
                        console.info("[CV] Checking for CV...");
                        yield this.errorCatcher(page);
                        const downloadCVPromise = page.waitForEvent("download");
                        const cvTabButton = candidateCardDetail.getByText("CV").first();
                        yield cvTabButton.click();
                        let downloadCVButton = candidateCardDetail.getByRole("button", {
                            name: "Download CV",
                        });
                        if (!(yield downloadCVButton.isVisible())) {
                            downloadCVButton = candidateCardDetail.getByRole("button", {
                                name: "Download Profil",
                            });
                        }
                        let cvUrl = "-";
                        if (yield downloadCVButton.isVisible()) {
                            yield this.errorCatcher(page);
                            yield downloadCVButton.click();
                            const downloadCV = yield downloadCVPromise;
                            cvUrl = downloadCV.url().replace("blob:", "");
                            console.log("Download CV:", downloadCV.url());
                        }
                        const cvFile = yield this.urlToFile(cvUrl, `${candidateName}.pdf`);
                        /**
                         * Get education level
                         */
                        const qualificationButton = candidateCardDetail.getByText("Hasil Kualifikasi").first();
                        yield this.errorCatcher(page);
                        yield qualificationButton.click();
                        yield page.waitForLoadState();
                        const educationQualificationLabel = candidateCardDetail.locator(".fw-600").filter({ hasText: "Pendidikan" }).first();
                        const educationQualificationWrapper = educationQualificationLabel.locator("..");
                        const educationLevel = (_e = yield educationQualificationWrapper.locator("p.fw-600").first().textContent()) !== null && _e !== void 0 ? _e : "-";
                        console.log("Education Level:", educationLevel);
                        /**
                         * Get the candidate gender
                         */
                        const genderLabel = candidateCardDetail.locator(".fw-600").filter({ hasText: "Jenis Kelamin" }).first();
                        const genderWrapper = genderLabel.locator("..");
                        const gender = yield genderWrapper.locator("p.fw-600").first().textContent();
                        console.log("Gender: ", gender);
                        const applicant = {
                            channel: this.CHANNEL,
                            type: this.TYPE,
                            applied_for: appliedFor !== null && appliedFor !== void 0 ? appliedFor : "",
                            applied_for_id: appliedForId !== null && appliedForId !== void 0 ? appliedForId : "",
                            applied_date: appliedDate ? this.parseStringDate(appliedDate) : "",
                            email: candidateEmail !== null && candidateEmail !== void 0 ? candidateEmail : "",
                            fullname: candidateName !== null && candidateName !== void 0 ? candidateName : "",
                            nickname: "",
                            photo: photoFile,
                            date_of_birth: "",
                            age: parseInt(candidateAge !== null && candidateAge !== void 0 ? candidateAge : "0"),
                            contact: {
                                type: "phone",
                                contact_number: candidatePhone !== null && candidatePhone !== void 0 ? candidatePhone : "",
                            },
                            summary: "",
                            latest_salary: this.cleanSalary(latestSalary !== null && latestSalary !== void 0 ? latestSalary : "0"),
                            salary_expectation: 0,
                            work_experiences: experiences,
                            educations: [this.extractEducationData(education, educationLevel)],
                            skills: this.cleanSkills(skills),
                            location: candidateLocation !== null && candidateLocation !== void 0 ? candidateLocation : "",
                            reference_links: [],
                            cv: cvFile,
                            gender: gender ? this.cleanGender(gender) : "",
                        };
                        console.log("Applicant:", applicant);
                        /**
                         * Send the applicant data to the API.
                         */
                        yield this.sendRequest(applicant);
                    }
                    catch (error) {
                        console.log(error);
                    }
                    nthCard++;
                    console.info("-------------------------------------------------------");
                }
                if (jobVacancyList.lastIndexOf(jobVacancy) === jobVacancyList.length - 1) {
                    console.info("All jobVacancies have been processed. Exiting...");
                    console.info("Total applicants collected: ", this.COLLECTED_APPLICANT);
                    console.info("Total skipped applicants by database: ", this.SKIPPED_APPLICANT_BY_DATABASE);
                    console.info("Total failed collected applicants: ", this.FAILED_COLLECTED_APPLICANT.length);
                    console.info("Failed collected applicants: ", this.FAILED_COLLECTED_APPLICANT);
                    process.exit(0);
                }
                console.info("=======================================================");
                yield page.goto(this.JOB_VACANCY_URL);
                yield page.waitForLoadState();
                yield this.waitPageFromURL(page, this.JOB_VACANCY_URL);
                yield this.fetchingAllJobList(page);
            }
        });
    }
    /**
     * Selects the active jobVacancy list.
     * @param {playwright.Page} page The page object.
     * @returns {Promise<void>} A promise that resolves when the active jobVacancy list is selected.
     */
    selectActiveJobList(page) {
        return __awaiter(this, void 0, void 0, function* () {
            console.info("Filtering the jobVacancy list by active status...");
            const checkboxElement = page.locator('aside').locator('input#aktif').locator('..');
            yield this.checkLazyLoadedElement(page, checkboxElement);
            yield checkboxElement.check();
            yield page.waitForLoadState();
            yield page.waitForTimeout(10000);
        });
    }
    /**
     * Scrolls until the text "Semua lowongan kerja sudah di tampilkan" is visible.
     * @param {playwright.Page} page The page object.
     * @returns {Promise<void>} A promise that resolves when the scrolling is complete.
     */
    scrollToFetchAllJobList(page) {
        return __awaiter(this, void 0, void 0, function* () {
            const NO_VACANCY_TEXT = "Belum ada lowongan kerja";
            const MAX_SCROLL_COUNT = 250;
            console.info('[VACANCY] Scrolling until "Semua lowongan kerja sudah di tampilkan" is visible...');
            let scrollCount = 0;
            while (!(yield page.getByText("Semua lowongan kerja sudah di tampilkan").isVisible())) {
                yield this.errorCatcher(page);
                if (yield this.isCandidateListPage(page)) {
                    console.info("[NAV] Kandidat page detected during vacancy scroll. Stopping vacancy flow.");
                    return;
                }
                if (yield page.getByText(NO_VACANCY_TEXT).isVisible()) {
                    console.info("[VACANCY] No vacancies found. Exiting.");
                    process.exit(0);
                }
                scrollCount++;
                if (scrollCount >= MAX_SCROLL_COUNT) {
                    console.info(`[VACANCY] Scroll guard hit at ${scrollCount}. Stopping vacancy scroll.`);
                    return;
                }
                if (scrollCount % 5 === 0) {
                    console.info(`[VACANCY] Still scrolling to load all vacancies... (scroll ${scrollCount})`);
                }
                yield page.evaluate(() => {
                    window.scrollBy(0, window.innerHeight);
                });
            }
            console.info(`[VACANCY] All vacancies loaded after ${scrollCount} scrolls.`);
        });
    }
    /**
     * Fetches all the jobVacancy list.
     * @param {playwright.Page} page The page object.
     * @returns {Promise<playwright.Locator>} A promise that resolves when the jobVacancy list is fetched.
     */
    fetchingAllJobList(page) {
        return __awaiter(this, void 0, void 0, function* () {
            /**
             * Wait for the jobVacancy list container to be attached to the DOM.
             */
            console.info('Get section with id="telo"');
            const jobVacancyListContainer = page.locator(this.JOB_LIST_CONTAINER_SELECTOR);
            if (yield this.isCandidateListPage(page)) {
                console.info("[NAV] Already on Kandidat page inside fetchingAllJobList().");
                return jobVacancyListContainer;
            }
            /**
             * Filter the jobVacancy list by active status.
             */
            yield this.selectActiveJobList(page);
            if (yield this.isCandidateListPage(page)) {
                console.info("[NAV] Kandidat page detected after filter step.");
                return jobVacancyListContainer;
            }
            /**
             * Scroll until the text "Semua lowongan kerja sudah di tampilkan" is visible.
             */
            yield this.scrollToFetchAllJobList(page);
            return jobVacancyListContainer;
        });
    }
    /**
     * Closes annoying popups.
     * @param {playwright.Page} page The page object.
     * @returns {Promise<void>} A promise that resolves when the annoying popups are closed.
     */
    closeAnnoyingPopups(page) {
        return __awaiter(this, void 0, void 0, function* () {
            // try {
            //   /**
            //    * Remove the moengage modal iframe if it exists.
            //    */
            //   const modalIframe = page.locator('iframe[id^="moe"]');
            //   const modalIframeCount = await modalIframe.count();
            //   if (modalIframeCount > 0) {
            //     console.info(`Found ${modalIframeCount} moengage modal iframe(s). Removing...`);
            //     const allModalIframe = await modalIframe.all();
            //     for (const _ of allModalIframe) {
            //       try {
            //         await page
            //         .frameLocator('iframe[id^="moe"]')
            //         .first()
            //         .getByLabel("Close")
            //         .click();
            //       } catch (error) {
            //         console.log("no Frame")
            //       }
            //     }
            //   }
            // } catch (error) {
            //   console.log("error", error)
            // }
            try {
                /**
                 * Remove widgets if it exists.
                 */
                const widgets = page.locator('.widget-visible');
                const widgetCount = yield widgets.count();
                if (widgetCount > 0) {
                    console.info(`Found ${widgetCount} widget(s). Removing...`);
                    const allWidgets = yield widgets.all();
                    for (const widgetEl of allWidgets) {
                        yield widgetEl.evaluate((el) => {
                            el.remove();
                        });
                    }
                }
            }
            catch (error) {
                console.log("error", error);
            }
        });
    }
    /**
     * Handles any error that might occur on the client side.
     */
    errorCatcher(page) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.handleClientSideError(page);
            yield this.closeAnnoyingPopups(page);
        });
    }
    /**
     * Extracts the jobVacancy list.
     * @param {playwright.Locator[]} containerLocator The container locator.
     * @returns {Promise<JobVacancy[]>} A promise that resolves with the jobVacancy list.
     */
    extractJobVacancy(containerLocator) {
        return __awaiter(this, void 0, void 0, function* () {
            const jobVacancyList = [];
            /**
             * Collect all the jobVacancy list.
             */
            for (const button of containerLocator) {
                const jobVacancyWrapper = button
                    .locator("..")
                    .locator("..")
                    .locator("..")
                    .locator("..")
                    .locator("..")
                    .locator("..");
                const jobVacancyTitle = yield jobVacancyWrapper.locator(this.JOB_TITLE_LIST_SELECTOR).textContent();
                const jobVacancyLocation = yield jobVacancyWrapper.locator(".text-grey-dust").first().textContent();
                jobVacancyList.push({
                    position: jobVacancyTitle !== null && jobVacancyTitle !== void 0 ? jobVacancyTitle : "-",
                    location: jobVacancyLocation !== null && jobVacancyLocation !== void 0 ? jobVacancyLocation : "-",
                });
            }
            return jobVacancyList;
        });
    }
    /**
     * Converts a URL to a File object.
     * @param {string} url The URL of the file.
     * @param {string} filename The filename of the file.
     * @returns {Promise<File>} A promise that resolves with the File object.
     */
    urlToFile(url_1, filename_1) {
        return __awaiter(this, arguments, void 0, function* (url, filename, retryCount = 0) {
            if (!url || url === "-") {
                return null;
            }
            try {
                const response = yield fetch(url);
                const blob = yield response.blob();
                return new File([blob], filename, {
                    type: blob.type,
                });
            }
            catch (error) {
                if (retryCount < this.MAX_RETRY) {
                    console.log("urlToFile failed, retrying...");
                    return this.urlToFile(url, filename, retryCount + 1);
                }
                console.error("urlToFile failed after retries:", error);
                return null;
            }
        });
    }
    /**
     * Cleans the salary string.
     * @param {string} salary The salary string.
     * @returns {number} The cleaned salary.
     * @example "Rp 5.000.000" => 5000000
     */
    cleanSalary(salary) {
        const salaryNumber = salary.replace(/\D/g, "");
        if (salaryNumber === "") {
            return 0;
        }
        return parseInt(salary.replace(/\D/g, ""));
    }
    /**
     * Extract employment period from the job description.
     * @param {string} jobDesc The job description.
     * @returns {string[]} The employment period.
     * @example "Jan 2022 - Jan 2023 • 1 tahun 1 bulan" => ["2022-01-01", "2023-01-01"]
     */
    extractEmploymentPeriod(jobDesc) {
        const period = jobDesc.split("•")[0].trim();
        var [start, end] = period.split(" - ");
        if (end.includes('Hingga saat ini')) {
            const date = new Date();
            end = date.toLocaleString('default', { month: 'long', year: 'numeric' });
        }
        return [
            this.parseMonthYearDate(start),
            this.parseMonthYearDate(end),
        ];
    }
    /**
     * Converts the date string to the ISO format.
     * @param {string} date The date string.
     * @returns {string} The ISO date string.
     * @example "Jan 2022" => "2022-01-01"
     */
    parseMonthYearDate(date) {
        const [month, year] = date.split(" ");
        const monthNumber = new Date(Date.parse(month + " 1, 2022")).getMonth() + 1;
        return `${year}-${monthNumber.toString().padStart(2, "0")}-01`;
    }
    /**
     * Cleans the skills array.
     * @param {string[]} skills The skills array.
     * @returns {string[]} The cleaned skills array.
     * @example ["JavaScript ", " HTML", " CSS "] => ["JavaScript", "HTML", "CSS"]
     */
    cleanSkills(skills) {
        return skills.map((skill) => skill.trim());
    }
    /**
     * Extract the education data.
     * @param {string[]} educations The educations array.
     * @param {string} educationLevel The education level.
     * @returns {Education} The education data.
     * @example ["University of Oxford", "University of Cambridge"] => { education: "Bachelor", institution: "University of Cambridge", period_start_year: "-", period_end_year: "-" }
     */
    extractEducationData(educations, educationLevel) {
        const latestEducation = educations[educations.length - 1];
        const cleanEducationLevel = this.cleanEducationLevel(educationLevel);
        return {
            education: cleanEducationLevel,
            institution: latestEducation,
            period_start_year: "0",
            period_end_year: "0",
        };
    }
    /**
     * Cleans the gender value and returns the corresponding string representation.
     * @param {string} gender - The gender value to be cleaned.
     * @returns {string} - The cleaned gender value.
     */
    cleanGender(gender) {
        return gender.toLowerCase() === "pria"
            ? "MALE"
            : "FEMALE";
    }
    /**
     * Parses a string date into a formatted date string.
     * @param {string} date - The string date to parse.
     * @returns {string} The formatted date string in the format "YYYY-MM-DD".
     * @example "24 Mei 2024" => "2024-05-24"
     */
    parseStringDate(date) {
        const [day, month, year] = date.split(" ");
        const monthNumber = INDONESIAN_MONTHS.indexOf(month) + 1;
        return `${year}-${monthNumber.toString().padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
    /**
     * Cleans the education level string.
     * @param {string} educationLevel - The education level string to be cleaned.
     * @returns {string} - The cleaned education level string.
     * @example "S1" => "S1"
     * @example "SMA/SMK" => "SMA"
     */
    cleanEducationLevel(educationLevel) {
        switch (educationLevel) {
            case "SD":
                return "SD";
            case "SMP":
                return "SMP";
            case "SMA":
                return "SMA";
            case "SMK":
                return "SMA";
            case "SMA/SMK":
                return "SMA";
            case "Diploma":
                return "D3";
            case "S1":
                return "S1";
            case "S2":
                return "S2";
            case "S3":
                return "S3";
            default:
                return "SMA";
        }
    }
    /**
     * Sends a request with the provided applicant data.
     * @param param - The applicant data.
     * @returns A Promise that resolves when the request is sent successfully.
     */
    sendRequest(param) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            if (param.contact.contact_number === "") {
                console.info(`[SKIP] "${param.fullname}" has no phone number. Not sending to API.`);
                return;
            }
            console.info(`[API] Sending "${param.fullname}" (${param.contact.contact_number}) to ${this.API_DESTINATION}...`);
            try {
                const bodyFormData = new FormData();
                bodyFormData.append("channel", param.channel);
                bodyFormData.append("type", param.type);
                bodyFormData.append("applied_for", param.applied_for);
                bodyFormData.append("applied_for_id", param.applied_for_id);
                bodyFormData.append("applied_date", param.applied_date);
                bodyFormData.append("email", param.email);
                bodyFormData.append("fullname", param.fullname);
                // bodyFormData.append("nickname", param.nickname);
                bodyFormData.append("photo", (_a = param.photo) !== null && _a !== void 0 ? _a : "");
                bodyFormData.append("date_of_birth", param.date_of_birth);
                bodyFormData.append("age", param.age.toString());
                bodyFormData.append("contact", JSON.stringify(param.contact));
                // bodyFormData.append("summary", param.summary);
                bodyFormData.append("latest_salary", param.latest_salary.toString());
                bodyFormData.append("salary_expectation", param.salary_expectation.toString());
                bodyFormData.append("work_experiences", JSON.stringify(param.work_experiences));
                bodyFormData.append("educations", JSON.stringify(param.educations));
                bodyFormData.append("skills", JSON.stringify(param.skills));
                bodyFormData.append("location", param.location);
                bodyFormData.append("cv", (_b = param.cv) !== null && _b !== void 0 ? _b : "");
                // bodyFormData.append("reference_links", JSON.stringify(param.reference_links));
                bodyFormData.append("gender", param.gender);
                yield (0, axios_1.default)({
                    method: "post",
                    url: this.API_DESTINATION,
                    data: bodyFormData,
                    headers: { "Content-Type": "multipart/form-data" },
                });
                console.info(`[API] Success: "${param.fullname}" sent.`);
            }
            catch (error) {
                const curl = `curl --location --globoff ${this.API_DESTINATION} --form 'channel=${param.channel}' --form 'type=${param.type}' --form 'applied_for=${param.applied_for}' --form 'applied_for_id=${param.applied_for_id}' --form 'applied_date=${param.applied_date}' --form 'email=${param.email}' --form 'fullname=${param.fullname}' --form 'nickname=${param.nickname}' --form 'photo=${param.photo}' --form 'date_of_birth=${param.date_of_birth}' --form 'age=${param.age}' --form 'contact=${JSON.stringify(param.contact)}' --form 'summary=${param.summary}' --form 'latest_salary=${param.latest_salary}' --form 'salary_expectation=${param.salary_expectation}' --form 'work_experiences=${JSON.stringify(param.work_experiences)}' --form 'educations=${JSON.stringify(param.educations)}' --form 'skills=${JSON.stringify(param.skills)}' --form 'location=${param.location}' --form 'cv=${param.cv}' --form 'reference_links=${JSON.stringify(param.reference_links)}'`;
                console.error(`[ERROR] API failed for "${param.fullname}". curl:`, curl);
                let errorResponse = null;
                if (typeof error.response === "undefined") {
                    errorResponse = error.response;
                    console.error("Error sending request with response:", error.response);
                }
                else {
                    errorResponse = error.response.data;
                    console.error("Error sending request with response:", error.response.data);
                }
                this.FAILED_COLLECTED_APPLICANT = [
                    ...this.FAILED_COLLECTED_APPLICANT,
                    {
                        data: param,
                        error: errorResponse
                    }
                ];
            }
            console.info("[DB] Inserting applicant into local DB...");
            yield this.insertApplicant(param.email, param.applied_for_id, param);
            this.COLLECTED_APPLICANT++;
            console.info(`[DB] Inserted. Total collected so far: ${this.COLLECTED_APPLICANT}`);
        });
    }
    /**
     * Clean the job description.
     * All characters except letters, numbers, spaces, commas, and periods, (, and ) will be removed.
     */
    cleanString(jobDesc) {
        return jobDesc.replace(/[^a-zA-Z0-9\s,.()]/g, " ");
    }
    waitCandidatePageReady(page_1) {
        return __awaiter(this, arguments, void 0, function* (page, retryCount = 0) {
            try {
                yield Promise.race([
                    page.waitForURL(/\/perusahaan\/candidates/, {
                        waitUntil: "domcontentloaded",
                        timeout: this.TIMEOUT,
                    }),
                    page.waitForSelector("#filter-container", {
                        timeout: this.TIMEOUT,
                    }),
                    page.getByText("Profil Kandidat", { exact: true }).waitFor({
                        state: "visible",
                        timeout: this.TIMEOUT,
                    }),
                    page.waitForSelector('div[id^="candidate-card-"]', {
                        timeout: this.TIMEOUT,
                    }),
                ]);
                console.info(`[NAV] Kandidat page ready at ${page.url()}`);
            }
            catch (error) {
                if (retryCount < this.MAX_RETRY) {
                    console.info(`[NAV] Kandidat page not ready yet. Retrying (${retryCount + 1}/${this.MAX_RETRY})...`);
                    yield this.errorCatcher(page);
                    yield page.waitForTimeout(1000);
                    yield this.waitCandidatePageReady(page, retryCount + 1);
                    return;
                }
                throw error;
            }
        });
    }
    waitForCandidateCards(page) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                yield page.waitForSelector('div[id^="candidate-card-"]', {
                    state: "visible",
                    timeout: this.TIMEOUT,
                });
                return true;
            }
            catch (_a) {
                return false;
            }
        });
    }
    ensureCandidateCardsReady(page) {
        return __awaiter(this, void 0, void 0, function* () {
            if (yield this.waitForCandidateCards(page)) {
                return true;
            }
            yield this.selectMelamarCandidateStatus(page);
            return yield this.waitForCandidateCards(page);
        });
    }
    selectMelamarCandidateStatus(page) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const filterContainer = page.locator("#filter-container");
                if ((yield filterContainer.count()) === 0) {
                    return;
                }
                const melamarCandidates = [
                    filterContainer.getByText(/^Melamar$/).first(),
                    page.getByText(/^Melamar$/).first(),
                ];
                for (const melamar of melamarCandidates) {
                    try {
                        if ((yield melamar.count()) === 0 || !(yield melamar.isVisible())) {
                            continue;
                        }
                        console.info("[NAV] Selecting Kandidat status: Melamar...");
                        yield melamar.click();
                        yield page.waitForTimeout(1500);
                        return;
                    }
                    catch (_a) {
                        // Try the next candidate locator.
                    }
                }
                console.info("[NAV] Melamar status control not found. Using current Kandidat filter.");
            }
            catch (error) {
                console.error("[WARN] Failed selecting Melamar status:", error);
            }
        });
    }
    waitForEmployerLandingPage(page) {
        return __awaiter(this, void 0, void 0, function* () {
            yield page.waitForURL(/\/perusahaan\/(jobs|candidates)/, {
                waitUntil: "load",
            });
            console.info(`[LOGIN] Landed on ${page.url()}`);
        });
    }
    isCandidateListPage(page) {
        return __awaiter(this, void 0, void 0, function* () {
            const currentUrl = page.url();
            if (currentUrl.includes("/perusahaan/candidates")) {
                return true;
            }
            if ((yield page.locator("#filter-container").count()) > 0) {
                return true;
            }
            if ((yield page.getByText("Profil Kandidat", { exact: true }).count()) > 0) {
                return true;
            }
            return false;
        });
    }
    extractCurrentCandidatePageApplicantCount(page) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c;
            try {
                const bodyText = (_a = yield page.locator("body").textContent()) !== null && _a !== void 0 ? _a : "";
                const match = bodyText.match(/Menampilkan\s+(\d+)\s+dari\s+(\d+)\s+Kandidat/i);
                if (!match) {
                    return 0;
                }
                return parseInt((_c = (_b = match[2]) !== null && _b !== void 0 ? _b : match[1]) !== null && _c !== void 0 ? _c : "0", 10);
            }
            catch (_d) {
                return 0;
            }
        });
    }
    processCurrentCandidatePage(page, applicantCount) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b, _c, _d, _e, _f;
            // Correct behavior note from the provided Kandidat page:
            // if Pintarnya lands directly on the vacancy Kandidat page, stay there and scrape
            // the visible candidate list + right-side profile preview instead of forcing Lowongan.
            let nthCard = 0;
            let isScrappingCard = true;
            try {
                yield this.errorCatcher(page);
                yield this.waitCandidatePageReady(page);
                isScrappingCard = yield this.ensureCandidateCardsReady(page);
            }
            catch (error) {
                isScrappingCard = false;
            }
            const pageUrl = page.url();
            const appliedForId = pageUrl.split("job=")[1];
            if (appliedForId) {
                const jobVacancyInDatabase = yield this.getVacancyByPintarnyaJobId(appliedForId);
                const applicantsOfJobVacancyInDatabase = yield this.countApplicantByPintarnyaJobId(appliedForId);
                if (jobVacancyInDatabase === undefined) {
                    yield this.insertJobVacancy("Pintarnya Kandidat Page", "", appliedForId, applicantCount);
                }
                else if (applicantCount === jobVacancyInDatabase.applicants &&
                    jobVacancyInDatabase.applicants === applicantsOfJobVacancyInDatabase) {
                    console.info("[SKIP] No new applicants on the current Kandidat page.");
                    isScrappingCard = false;
                }
            }
            while (isScrappingCard) {
                if (this.LIMIT > 0 && this.COLLECTED_APPLICANT >= this.LIMIT) {
                    console.info("Scrape limit reached. Exiting...");
                    process.exit(0);
                }
                try {
                    console.info("-------------------------------------------------------");
                    console.info(`[CANDIDATE] Scraping card #${nthCard + 1} from current Kandidat page...`);
                    const cardSelector = `div[id="candidate-card-${nthCard + 1}"]`;
                    yield this.errorCatcher(page);
                    const card = page.locator(cardSelector);
                    if (!(yield card.isVisible())) {
                        break;
                    }
                    yield card.click();
                    const candidateCardDetail = page.locator("div#candidate-detail");
                    yield this.checkLazyLoadedElement(page, candidateCardDetail);
                    const candidateName = yield card.locator("div").nth(0).textContent();
                    if (candidateName === null) {
                        throw new Error("Candidate name is null");
                    }
                    yield candidateCardDetail.getByText(candidateName, { exact: true }).isVisible();
                    const candidateAgeAndLocation = yield candidateCardDetail.locator(".text-grey-dust").first().textContent();
                    const candidateAge = (_a = candidateAgeAndLocation === null || candidateAgeAndLocation === void 0 ? void 0 : candidateAgeAndLocation.split("•")[0]) === null || _a === void 0 ? void 0 : _a.trim();
                    const candidateLocation = (_b = candidateAgeAndLocation === null || candidateAgeAndLocation === void 0 ? void 0 : candidateAgeAndLocation.split("•")[1]) === null || _b === void 0 ? void 0 : _b.trim();
                    const candidateAppliedJobAndDate = yield candidateCardDetail
                        .getByText("Melamar pada:")
                        .locator("..")
                        .textContent();
                    const appliedFor = (_e = (_d = (_c = candidateAppliedJobAndDate === null || candidateAppliedJobAndDate === void 0 ? void 0 : candidateAppliedJobAndDate.split("Melamar pada:")[0]) === null || _c === void 0 ? void 0 : _c.trim()) === null || _d === void 0 ? void 0 : _d.replace(/\d+/g, "")) === null || _e === void 0 ? void 0 : _e.trim();
                    const appliedDate = candidateAppliedJobAndDate === null || candidateAppliedJobAndDate === void 0 ? void 0 : candidateAppliedJobAndDate.split("pada")[1].trim();
                    const candidateEmail = yield candidateCardDetail
                        .locator(".cursor-pointer.text-grey-dust")
                        .nth(0)
                        .textContent();
                    const applicantInDatabase = yield this.getApplicantByEmail(candidateEmail || "");
                    if (applicantInDatabase !== undefined &&
                        applicantInDatabase.email === candidateEmail &&
                        applicantInDatabase.applied_for_id === appliedForId) {
                        console.info("[SKIP] Already in local DB, skipping.");
                        this.SKIPPED_APPLICANT_BY_DATABASE++;
                        nthCard++;
                        continue;
                    }
                    const candidatePhoneButton = candidateCardDetail
                        .locator("div.justify-start")
                        .locator("button")
                        .nth(1);
                    yield candidatePhoneButton.click();
                    const candidatePhoneModal = page
                        .locator("div")
                        .filter({ hasText: /^Kontak Kandidat$/ });
                    yield this.checkLazyLoadedElement(page, candidatePhoneModal);
                    yield candidatePhoneModal.waitFor({ state: "attached" });
                    const candidatePhone = yield candidatePhoneModal.locator("div").nth(2).textContent();
                    yield candidatePhoneModal.locator("img").click();
                    const latestSalaryLabel = candidateCardDetail.getByText("Gaji terakhir");
                    let latestSalary = "0";
                    if (yield latestSalaryLabel.isVisible()) {
                        latestSalary = (_f = yield latestSalaryLabel.locator("..").locator(".fw-600").textContent()) !== null && _f !== void 0 ? _f : "0";
                    }
                    const experienceLabel = candidateCardDetail.getByRole("heading", { name: "Pengalaman Kerja" });
                    let experiences = [];
                    if (yield experienceLabel.isVisible()) {
                        yield experienceLabel.scrollIntoViewIfNeeded();
                        const experienceWrapper = experienceLabel.locator("..").locator("..");
                        const anyUlInsideExperienceWrapper = experienceWrapper.locator("ul").all();
                        for (const experience of yield anyUlInsideExperienceWrapper) {
                            const experienceDetail = experience.locator("ul");
                            if ((yield experienceDetail.count()) > 0) {
                                const company = yield experience.locator("li").nth(0).textContent();
                                const position = yield experienceDetail.locator(".fw-600").first().textContent();
                                const longEmployment = yield experienceDetail.locator(".fw-500").nth(0).textContent();
                                const description = yield experienceDetail
                                    .locator(".fw-500")
                                    .nth(1)
                                    .locator("div")
                                    .nth(0)
                                    .textContent();
                                const [periodFrom, periodTo] = this.extractEmploymentPeriod(longEmployment !== null && longEmployment !== void 0 ? longEmployment : "-");
                                experiences.push({
                                    position: position !== null && position !== void 0 ? position : "-",
                                    organization: company !== null && company !== void 0 ? company : "-",
                                    job_desc: this.cleanString(description !== null && description !== void 0 ? description : "") || "-",
                                    period_from: periodFrom !== null && periodFrom !== void 0 ? periodFrom : "0",
                                    period_to: periodTo !== null && periodTo !== void 0 ? periodTo : "0",
                                });
                            }
                        }
                    }
                    const educationLabel = candidateCardDetail.getByRole("heading", { name: "Pendidikan" });
                    yield educationLabel.scrollIntoViewIfNeeded();
                    const educationWrapper = educationLabel.locator("..");
                    const education = yield educationWrapper.locator("p").allTextContents();
                    const skillsLabel = candidateCardDetail.getByRole("heading", { name: "Keahlian" });
                    let skills = [];
                    if (yield skillsLabel.isVisible()) {
                        yield skillsLabel.scrollIntoViewIfNeeded();
                        const skillsWrapper = skillsLabel.locator("..");
                        const skillBadges = yield skillsWrapper.locator(".text-grey-dust").allTextContents();
                        skills.push(...skillBadges.slice(3));
                    }
                    const photo = yield candidateCardDetail.getByAltText("photo profile").getAttribute("src");
                    const photoUrl = this.BASE_URL + photo;
                    const photoFile = photo ? yield this.urlToFile(photoUrl, `${candidateName}.webp`) : null;
                    const qualificationButton = candidateCardDetail.getByText("Hasil Kualifikasi").first();
                    yield qualificationButton.click();
                    const educationQualificationLabel = candidateCardDetail.locator(".fw-600").filter({ hasText: "Pendidikan" }).first();
                    const educationLevel = yield educationQualificationLabel
                        .locator("..")
                        .locator("div")
                        .last()
                        .textContent();
                    const genderLabel = candidateCardDetail.locator(".fw-600").filter({ hasText: "Jenis Kelamin" }).first();
                    const gender = yield genderLabel.locator("..").locator("div").last().textContent();
                    const applicant = {
                        channel: this.CHANNEL,
                        type: this.TYPE,
                        applied_for: appliedFor !== null && appliedFor !== void 0 ? appliedFor : "",
                        applied_for_id: appliedForId !== null && appliedForId !== void 0 ? appliedForId : "",
                        applied_date: this.parseStringDate(appliedDate !== null && appliedDate !== void 0 ? appliedDate : ""),
                        email: candidateEmail !== null && candidateEmail !== void 0 ? candidateEmail : "",
                        fullname: candidateName !== null && candidateName !== void 0 ? candidateName : "",
                        nickname: "",
                        photo: photoFile,
                        date_of_birth: "",
                        age: parseInt(candidateAge !== null && candidateAge !== void 0 ? candidateAge : "0"),
                        contact: {
                            type: "whatsapp",
                            contact_number: candidatePhone !== null && candidatePhone !== void 0 ? candidatePhone : "",
                        },
                        summary: "",
                        latest_salary: this.cleanSalary(latestSalary !== null && latestSalary !== void 0 ? latestSalary : "0"),
                        salary_expectation: 0,
                        work_experiences: experiences,
                        educations: [this.extractEducationData(education, educationLevel !== null && educationLevel !== void 0 ? educationLevel : "-")],
                        skills: this.cleanSkills(skills),
                        location: candidateLocation !== null && candidateLocation !== void 0 ? candidateLocation : "",
                        reference_links: [],
                        cv: null,
                        gender: gender ? this.cleanGender(gender) : "",
                    };
                    yield this.sendRequest(applicant);
                }
                catch (error) {
                    console.log(error);
                }
                nthCard++;
                console.info("-------------------------------------------------------");
            }
        });
    }
    /**
     * Establishes a connection to the SQLite database.
     * @returns {sqlite3.Database} The database connection.
     */
    createDatabaseConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            /**
             * Create the database file if it does not exist.
             */
            if (!fs_1.default.existsSync(this.DB_PATH)) {
                fs_1.default.mkdirSync(path_1.default.dirname(this.DB_PATH), { recursive: true });
                fs_1.default.writeFileSync(this.DB_PATH, "");
            }
            /**
             * Open the database connection.
             */
            return new Promise((resolve, reject) => {
                this.DB = new sqlite3_1.default.Database(this.DB_PATH, (err) => {
                    if (err) {
                        console.error("Error opening database", err.message);
                        reject(err.message);
                    }
                    else {
                        console.log("Connected to the database.");
                        resolve(this.DB);
                    }
                });
            });
        });
    }
    /**
     * Creates the job_vacancies table in the database.
     */
    createJobVacanciesTable() {
        return __awaiter(this, void 0, void 0, function* () {
            const createTableQuery = `
      CREATE TABLE IF NOT EXISTS job_vacancies (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        position TEXT NOT NULL,
        location TEXT NOT NULL,
        applicants INTEGER NOT NULL DEFAULT 0,
        pintarnya_job_id TEXT NOT NULL
      )
    `;
            return new Promise((resolve, reject) => {
                this.DB.run(createTableQuery, (err) => {
                    if (err) {
                        console.error("Error creating job_vacancies table", err.message);
                        reject(err.message);
                    }
                    else {
                        resolve(console.log("Created job_vacancies table."));
                    }
                });
            });
        });
    }
    /**
     * Creates the applicants table in the database.
     */
    createApplicantsTable() {
        return __awaiter(this, void 0, void 0, function* () {
            const createTableQuery = `
      CREATE TABLE IF NOT EXISTS applicants (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL,
        applied_for_id TEXT NOT NULL,
        data TEXT
      )
    `;
            return new Promise((resolve, reject) => {
                this.DB.run(createTableQuery, (err) => {
                    if (err) {
                        console.error("Error creating applicants table", err.message);
                        reject(err.message);
                    }
                    else {
                        resolve(console.log("Created applicants table."));
                    }
                });
            });
        });
    }
    /**
     * Checks if a table exists in the database.
     */
    isTableExist(tableName) {
        return __awaiter(this, void 0, void 0, function* () {
            console.info(`Checking if table ${tableName} exists...`);
            const query = `SELECT name FROM sqlite_master WHERE type='table' AND name='${tableName}'`;
            return new Promise((resolve, reject) => {
                this.DB.get(query, (err, row) => {
                    if (err) {
                        console.error("Error checking table", err.message);
                        reject(err.message);
                    }
                    else {
                        if (row !== undefined) {
                            console.log(`Table ${tableName} exists.`);
                        }
                        resolve(row !== undefined);
                    }
                });
            });
        });
    }
    /**
     * Creates the required tables in the database.
     * The required tables are the job_vacancies and applicants tables.
     */
    createRequiredTables() {
        return __awaiter(this, void 0, void 0, function* () {
            const isTableJobVacanciesExist = yield this.isTableExist("job_vacancies");
            if (!isTableJobVacanciesExist) {
                console.info("Creating job_vacancies table...");
                yield this.createJobVacanciesTable();
            }
            const isTableApplicantsExist = yield this.isTableExist("applicants");
            if (!isTableApplicantsExist) {
                console.info("Creating applicants table...");
                yield this.createApplicantsTable();
            }
            else {
                // Migrate existing table to add data column if missing
                yield new Promise((resolve) => {
                    this.DB.run('ALTER TABLE applicants ADD COLUMN data TEXT', () => resolve());
                });
            }
        });
    }
    /**
     * Inserts a vacancy into the database.
     * @param {string} position The position of the vacancy.
     * @param {string} location The location of the vacancy.
     * @param {string} pintarnyaJobId The Pintarnya job ID.
     * @returns {Promise<void>} A promise that resolves when the vacancy is inserted.
     * @example insertVacancy("Software Engineer", "Jakarta", "283020")
     */
    insertJobVacancy(position, location, pintarnyaJobId, applicants) {
        return __awaiter(this, void 0, void 0, function* () {
            console.info(`Inserting vacancy ${position} into the database...`);
            const insertQuery = `
      INSERT INTO job_vacancies (position, location, pintarnya_job_id, applicants)
      VALUES ('${position}', '${location}', '${pintarnyaJobId}', ${applicants})
    `;
            return new Promise((resolve, reject) => {
                this.DB.run(insertQuery, (err) => {
                    if (err) {
                        console.error("Error inserting vacancy", err.message);
                        reject(err.message);
                    }
                    else {
                        resolve(console.log("Inserted vacancy."));
                    }
                });
            });
        });
    }
    /**
     * Gets a vacancy by the Pintarnya job ID.
     * @param {string} pintarnyaJobId The Pintarnya job ID.
     * @returns {Promise<JobVacancyDB>} A promise that resolves with the vacancy.
     * @example getVacancyByPintarnyaJobId("283020")
     */
    getVacancyByPintarnyaJobId(pintarnyaJobId) {
        return __awaiter(this, void 0, void 0, function* () {
            console.info(`Getting vacancy by Pintarnya job ID ${pintarnyaJobId}...`);
            const selectQuery = `
      SELECT * FROM job_vacancies WHERE pintarnya_job_id = '${pintarnyaJobId}'
    `;
            return new Promise((resolve, reject) => {
                this.DB.get(selectQuery, (err, row) => {
                    if (err) {
                        console.error("Error getting vacancy", err.message);
                        reject(err.message);
                    }
                    else {
                        console.log("Got vacancy", row);
                        resolve(row);
                    }
                });
            });
        });
    }
    /**
     * Counts the applicant by the Pintarnya job ID.
     * @param {string} pintarnyaJobId The Pintarnya job ID.
     * @returns {Promise<number>} A promise that resolves with the applicant count.
     * @example countApplicantByPintarnyaJobId("283020")
     * @returns 31
     */
    countApplicantByPintarnyaJobId(pintarnyaJobId) {
        console.info(`Counting applicant by Pintarnya job ID ${pintarnyaJobId}...`);
        const selectQuery = `
      SELECT COUNT(*) as count FROM applicants WHERE applied_for_id = '${pintarnyaJobId}'
    `;
        return new Promise((resolve, reject) => {
            this.DB.get(selectQuery, (err, row) => {
                if (err) {
                    console.error("Error counting applicant", err.message);
                    reject(err.message);
                }
                else {
                    console.log("Counted applicant", row);
                    resolve(row.count);
                }
            });
        });
    }
    /**
     * Inserts an applicant into the database.
     * @param {string} email The email of the applicant.
     * @param {string} appliedForId The applied for ID.
     * @returns {Promise<void>} A promise that resolves when the applicant is inserted.
     * @example insertApplicant("johndoe@mail.app", "283020")
     * @returns Promise<void>
     */
    insertApplicant(email, appliedForId, param) {
        return __awaiter(this, void 0, void 0, function* () {
            console.info(`Inserting applicant ${email} into the database...`);
            const normalized = {
                name: param.fullname,
                email: param.email,
                applied_for: param.applied_for,
                applied_date: param.applied_date,
                portal: 'pintarnya',
                gender: param.gender,
                location: param.location,
                salary_expectation: param.salary_expectation,
                work_experience: param.work_experiences,
                education: param.educations,
                skill: param.skills,
                contact: param.contact,
                date_of_birth: param.date_of_birth,
            };
            const data = JSON.stringify(normalized).replace(/'/g, "''");
            const insertQuery = `
      INSERT INTO applicants (email, applied_for_id, data)
      VALUES ('${email}', '${appliedForId}', '${data}')
    `;
            return new Promise((resolve, reject) => {
                this.DB.run(insertQuery, (err) => {
                    if (err) {
                        console.error("Error inserting applicant", err.message);
                        reject(err.message);
                    }
                    else {
                        resolve(console.log("Inserted applicant."));
                    }
                });
            });
        });
    }
    /**
     * Gets an applicant by the email.
     * @param {string} email The email of the applicant.
     * @returns {Promise<ApplicantDB>} A promise that resolves with the applicant.
     * @example getApplicantByEmail("johndoe@mail.app")
     */
    getApplicantByEmail(email) {
        return __awaiter(this, void 0, void 0, function* () {
            console.info(`Getting applicant by email ${email}...`);
            const safeEmail = email.replace(/'/g, "''");
            const selectQuery = `
      SELECT * FROM applicants WHERE email = '${safeEmail}'
    `;
            return new Promise((resolve, reject) => {
                this.DB.get(selectQuery, (err, row) => {
                    if (err) {
                        console.error("Error getting applicant", err.message);
                        reject(err.message);
                    }
                    else {
                        console.log("Got applicant", row);
                        resolve(row);
                    }
                });
            });
        });
    }
    /**
     * Closes the database connection.
     */
    closeDatabaseConnection() {
        return __awaiter(this, void 0, void 0, function* () {
            new Promise((resolve, reject) => {
                this.DB.close((err) => {
                    if (err) {
                        console.error("Error closing database", err.message);
                        reject(err.message);
                    }
                    else {
                        resolve(console.log("Scraping completed."));
                    }
                });
            });
        });
    }
    /**
     * Handle if client side error
     * reload the page if client side error found
     */
    handleClientSideError(page) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const isClientSideError = yield page.getByText("Application error: a client-side exception has occurred (see the browser console for more information)").isVisible();
                if (isClientSideError) {
                    console.error("Client side error found. Reloading the page...");
                    yield page.reload();
                    yield page.waitForLoadState();
                }
            }
            catch (error) {
                console.error("No client side error found.");
            }
        });
    }
    /**
     * Checks for the presence of a lazy-loaded element on the page.
     *
     * @param page - The page object representing the web page.
     * @param locator - The locator string used to identify the element.
     * @param retryCount - The number of times to retry finding the element.
     * @returns A promise that resolves once the element is found or the timeout is reached.
     */
    checkLazyLoadedElement(page_1, locator_1) {
        return __awaiter(this, arguments, void 0, function* (page, locator, retryCount = 0) {
            let elementFound = false;
            let startTime = Date.now();
            const timeout = this.TIMEOUT;
            while (!elementFound && Date.now() - startTime < timeout) {
                console.info("Checking for lazy-loaded element: %s", locator);
                const element = locator;
                elementFound = (yield element.count()) > 0;
                yield page.waitForTimeout(1000);
            }
            if (elementFound) {
                console.info("Lazy-loaded element: %s found!", locator);
            }
            else if (!elementFound && retryCount < this.MAX_RETRY) {
                console.error("Lazy-loaded element: %s not found. Retrying...", locator);
                yield page.screenshot();
                yield this.checkLazyLoadedElement(page, locator, retryCount + 1);
            }
            else {
                console.error("Lazy-loaded element: %s not found after %s retries. Exiting...", locator, this.MAX_RETRY);
                yield page.screenshot();
                process.exit(1);
            }
        });
    }
    waitPageFromURL(page_1, url_1) {
        return __awaiter(this, arguments, void 0, function* (page, url, retryCount = 0) {
            try {
                console.log("Waiting for URL:", url);
                yield page.waitForURL(url, {
                    waitUntil: "load",
                });
                console.log("Page loaded successfully.");
                console.log("Current URL:", page.url());
            }
            catch (error) {
                console.error("Error waiting for URL:", url);
                if (retryCount < this.MAX_RETRY) {
                    console.error("Retrying...");
                    yield page.screenshot();
                    yield this.waitPageFromURL(page, url, retryCount + 1);
                }
                else {
                    yield page.screenshot();
                    console.error("Error waiting for URL after %s retries. Exiting...", this.MAX_RETRY);
                    process.exit(1);
                }
            }
        });
    }
}
exports.Pintarnya = Pintarnya;
