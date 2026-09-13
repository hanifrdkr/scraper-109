import { KitaLulus } from "../src/kitalulus";

// The KitaLulus CV tab renders the file in-page with react-pdf, fetched from
// asset.kitalulus.com/file/…/auth_download/… as application/pdf when the tab
// opens; "Unduh CV" fires no download, popup or request in the automated
// browser (verified live 2026-09-13), so every applicant had come back with
// no CV. extractCV now keeps the viewer's own response, which is only safe if
// the filter admits the CV file and nothing else the panel loads.

describe("KitaLulus.isCvResponse", () => {
  const FILE = "https://asset.kitalulus.com/file/dZXH0MtjgZan9HGnLX1lW/auth_download/VsqeC40f4hywsYYEMBwcZ/cv.pdf";

  it("accepts the viewer's PDF from the asset host", () => {
    expect(KitaLulus.isCvResponse(FILE, "application/pdf")).toBe(true);
    expect(KitaLulus.isCvResponse(FILE, "application/pdf; charset=binary")).toBe(true);
  });

  it("accepts non-PDF CV documents served from the same file route", () => {
    expect(KitaLulus.isCvResponse(FILE.replace(".pdf", ".docx"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")).toBe(true);
    expect(KitaLulus.isCvResponse(FILE, "application/octet-stream")).toBe(true);
  });

  it.each([
    ["the applicant's avatar image", "https://img.kitalulus.com/2026-09-04/cons/abc/photo.jpg", "image/jpeg"],
    ["the GraphQL response that names the CV", "https://gql.kitalulus.com/graphql", "application/json"],
    ["an HTML page on the asset host", "https://asset.kitalulus.com/file/abc/page", "text/html"],
    ["a PDF from an unrelated host", "https://evil.example.com/file/abc/cv.pdf", "application/pdf"],
    ["a lookalike host", "https://asset.kitalulus.com.evil.example/file/abc/cv.pdf", "application/pdf"],
    ["a non-file route on the asset host", "https://asset.kitalulus.com/public/brochure.pdf", "application/pdf"],
    ["an unparseable URL", "not a url", "application/pdf"],
  ])("rejects %s", (_label, url, contentType) => {
    expect(KitaLulus.isCvResponse(url, contentType)).toBe(false);
  });
});

// The viewer turned out to render only for the first applicant of a drawer
// session. The dependable source is the `jobApplication` GraphQL response
// fired when each applicant's drawer opens: it carried a CV URL for every
// applicant, and a direct GET of it returned the PDF each time.
describe("KitaLulus.cvUrlFromJobApplication", () => {
  const CV = "https://asset.kitalulus.com/file/lf35l1H23xB9TlCf9Gfks/auth_download/rUDEUVBFpqB_0cc4EynLb/cv.pdf";

  it("reads the applicant's CV URL from the payload", () => {
    expect(
      KitaLulus.cvUrlFromJobApplication({ data: { jobApplication: { userProfile: { cv: { url: CV } } } } }),
    ).toBe(CV);
  });

  it.each([
    ["no CV on the profile", { data: { jobApplication: { userProfile: { cv: null } } } }],
    ["an errors-only payload", { errors: [{ message: "Unauthorized" }] }],
    ["a non-string url", { data: { jobApplication: { userProfile: { cv: { url: 42 } } } } }],
    ["a URL off the KitaLulus file route", { data: { jobApplication: { userProfile: { cv: { url: "https://evil.example.com/file/x/cv.pdf" } } } } }],
    ["the avatar image instead of a file", { data: { jobApplication: { userProfile: { cv: { url: "https://img.kitalulus.com/2026/cons/a.jpg" } } } } }],
    ["null", null],
  ])("returns null for %s", (_label, payload) => {
    expect(KitaLulus.cvUrlFromJobApplication(payload)).toBeNull();
  });
});

describe("KitaLulus.isJobApplicationQuery", () => {
  const GQL = "https://gql.kitalulus.com/graphql";

  it("matches the jobApplication operation, single or batched", () => {
    expect(KitaLulus.isJobApplicationQuery(GQL, JSON.stringify({ operationName: "jobApplication", variables: {} }))).toBe(true);
    expect(
      KitaLulus.isJobApplicationQuery(GQL, JSON.stringify([{ operationName: "identity" }, { operationName: "jobApplication" }])),
    ).toBe(true);
  });

  it.each([
    ["the userCv query", GQL, JSON.stringify({ operationName: "userCv" })],
    ["the screening query", GQL, JSON.stringify({ operationName: "jobApplicationScreening" })],
    ["a non-GraphQL host", "https://api.openpanel.dev/track", JSON.stringify({ operationName: "jobApplication" })],
    ["no body", GQL, null],
    ["a non-JSON body", GQL, "operationName=jobApplication"],
  ])("does not match %s", (_label, url, postData) => {
    expect(KitaLulus.isJobApplicationQuery(url, postData)).toBe(false);
  });
});
