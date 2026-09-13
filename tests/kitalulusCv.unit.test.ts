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
