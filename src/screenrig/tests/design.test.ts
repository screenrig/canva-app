import type { OutputFile } from "@canva/intents/content";
import {
  DASHBOARD_URL,
  designIdFromToken,
  mediaIdsOf,
  pageFor,
  pagesOf,
  screenrigLink,
} from "src/screenrig/design";

function token(claims: object): string {
  const encode = (value: object) =>
    btoa(JSON.stringify(value))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  return `${encode({ alg: "RS256" })}.${encode(claims)}.signature`;
}

function file(format: "png" | "mp4", pageNumber: number): OutputFile {
  return {
    format,
    url: `https://export-download.canva.com/${pageNumber}`,
    widthPx: 1920,
    heightPx: 1080,
    contentMetadata: {
      type: "design",
      designToken: token({ designId: "DAF1" }),
      title: "Menu",
      pages: [{ pageId: `p${pageNumber}`, pageNumber }],
    },
  } as OutputFile;
}

describe("designIdFromToken", () => {
  it("reads the design id from the token payload", () => {
    expect(
      designIdFromToken(token({ designId: "DAGx_-9", appId: "AAF" })),
    ).toBe("DAGx_-9");
  });

  it("refuses a token without a design id", () => {
    expect(() => designIdFromToken(token({ appId: "AAF" }))).toThrow(
      "design id",
    );
    expect(() => designIdFromToken("not-a-token")).toThrow();
  });
});

describe("pagesOf", () => {
  it("numbers files by their design page", () => {
    expect(
      pagesOf([file("png", 3), file("png", 5)]).map((p) => p.page),
    ).toEqual([3, 5]);
  });
});

describe("pageFor", () => {
  it("shows an image page for the chosen seconds", () => {
    const page = pageFor(
      { page: 2, media_id: "med_1", status: "created" },
      file("png", 2) as never,
      12,
    );
    expect(page).toMatchObject({
      id: "canva_page_2",
      canvas: { width: 1920, height: 1080 },
      advance: { mode: "duration", after_ms: 12000 },
      primitives: [
        { primitive: "image", selector: { by: "id", media_id: "med_1" } },
      ],
    });
  });

  it("plays a video page to its end", () => {
    const page = pageFor(
      { page: 1, media_id: "med_2", status: "created" },
      file("mp4", 1) as never,
      10,
    );
    expect(page).toMatchObject({
      advance: { mode: "media_end" },
      primitives: [{ primitive: "video", loop: false, muted: true }],
    });
  });
});

describe("mediaIdsOf", () => {
  it("collects the media ids a playlist names", () => {
    const ids = mediaIdsOf({
      pages: [
        {
          id: "a",
          primitives: [{ selector: { by: "id", media_id: "med_1" } }],
        },
        { id: "b", primitives: [{ selector: { by: "tag", tag: "x" } }] },
      ],
    });
    expect([...ids]).toEqual(["med_1"]);
  });
});

describe("screenrigLink", () => {
  it("keeps the link's query and adds the app's UTM parameters", () => {
    expect(screenrigLink("https://screenrig.ai/docs/players?lang=fr")).toBe(
      "https://screenrig.ai/docs/players?lang=fr&utm_source=canva-app&utm_medium=app&utm_campaign=tof-tools",
    );
  });

  it("tags the dashboard link", () => {
    expect(DASHBOARD_URL).toBe(
      "https://screenrig.ai/dashboard/?utm_source=canva-app&utm_medium=app&utm_campaign=tof-tools",
    );
  });
});
