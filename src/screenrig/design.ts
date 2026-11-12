import type {
  ImageOutputFile,
  OutputFile,
  VideoOutputFile,
} from "@canva/intents/content";

export type PublishedItem = {
  page: number;
  media_id: string;
  version?: number;
  status: "created" | "replaced" | "unchanged" | "pending_review";
};

export type PublishedFile = {
  file: OutputFile;
  page: number;
};

/** The design id inside Canva's signed design token (a JWT). */
export function designIdFromToken(token: string): string {
  const payload = token.split(".")[1];
  if (!payload) throw new Error("Canva sent a design token without a payload.");
  const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
  const claims = JSON.parse(json) as { designId?: string };
  if (!claims.designId)
    throw new Error("Canva sent a design token without a design id.");
  return claims.designId;
}

export function pagesOf(files: OutputFile[]): PublishedFile[] {
  return files.map((file, index) => ({
    file,
    page: file.contentMetadata.pages[0]?.pageNumber ?? index + 1,
  }));
}

type ScreenFile = ImageOutputFile | VideoOutputFile;

export function pageFor(
  item: PublishedItem,
  file: ScreenFile,
  durationSeconds: number,
): Record<string, unknown> {
  const width = file.widthPx;
  const height = file.heightPx;
  const video = file.format === "mp4";
  return {
    id: `canva_page_${item.page}`,
    canvas: { width, height, viewport_fit: "contain", background: "#000000FF" },
    transition: { type: "crossfade", duration_ms: 500 },
    advance: video
      ? { mode: "media_end" }
      : { mode: "duration", after_ms: durationSeconds * 1000 },
    primitives: [
      video
        ? {
            id: "design",
            primitive: "video",
            selector: { by: "id", media_id: item.media_id },
            muted: true,
            loop: false,
            rect: { x: 0, y: 0, width, height },
            layer: 0,
            content_fit: "contain",
          }
        : {
            id: "design",
            primitive: "image",
            selector: { by: "id", media_id: item.media_id },
            alt: `Page ${item.page}`,
            rect: { x: 0, y: 0, width, height },
            layer: 0,
            content_fit: "contain",
          },
    ],
  };
}

export function mediaIdsOf(playlist: {
  pages?: Record<string, unknown>[];
}): Set<string> {
  const ids = new Set<string>();
  for (const page of playlist.pages ?? []) {
    const primitives = (page.primitives ?? []) as {
      selector?: { by?: string; media_id?: string };
    }[];
    for (const primitive of primitives) {
      if (primitive.selector?.by === "id" && primitive.selector.media_id) {
        ids.add(primitive.selector.media_id);
      }
    }
  }
  return ids;
}

const UTM = {
  utm_source: "canva-app",
  utm_medium: "app",
  utm_campaign: "tof-tools",
} as const;

/**
 * A screenrig.ai link as the app shows it to people: the link's own query
 * parameters stay, and the app's UTM parameters are added.
 */
export function screenrigLink(raw: string): string {
  const url = new URL(raw);
  for (const [name, value] of Object.entries(UTM)) {
    url.searchParams.set(name, value);
  }
  return url.toString();
}

/** The screenRIG dashboard, where the published playlist and media are. */
export const DASHBOARD_URL = screenrigLink("https://screenrig.ai/dashboard/");
