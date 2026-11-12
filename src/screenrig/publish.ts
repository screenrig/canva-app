import type { Operation, Playlist } from "./api";
import { ApiError, listPlaylists, request, waitForOperation } from "./api";
import type { PublishedFile, PublishedItem } from "./design";
import { mediaIdsOf, pageFor } from "./design";

export type PublishResult = {
  playlist?: {
    id: string;
    status: "created" | "updated" | "kept" | "pending_review";
  };
  items: PublishedItem[];
  screens: { id: string; status: "assigned" | "kept" | "pending_review" }[];
};

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  mp4: "video/mp4",
};

/**
 * Sends Canva's export files to screenRIG. screenRIG downloads them from Canva
 * and creates the design's media, or replaces the media an earlier publish of
 * the same design created, keeping each page's media id.
 */
export async function publishMedia(
  designId: string,
  title: string | undefined,
  files: PublishedFile[],
): Promise<PublishedItem[]> {
  const answer = await request<Operation>("/api/canva/publishes", {
    method: "POST",
    headers: { "Idempotency-Key": crypto.randomUUID() },
    body: {
      design_id: designId,
      title: title?.slice(0, 255) || undefined,
      files: files.map(({ file, page }) => ({
        url: file.url,
        page,
        content_type: CONTENT_TYPES[file.format],
      })),
    },
  });
  const operation = await waitForOperation(answer.body);
  if (operation.state !== "succeeded") {
    throw new ApiError(
      422,
      operation.error?.code,
      operation.error?.detail || "screenRIG could not prepare the design.",
    );
  }
  const items = (operation.result?.items ?? []) as PublishedItem[];
  return items.sort((a, b) => a.page - b.page);
}

/**
 * The design's playlist: the one an earlier publish made (it plays this
 * design's media), else a new one named after the design. Its pages follow the
 * design's pages; a republish that only replaced files leaves it as it is,
 * because the screens already play the replaced media.
 */
export { designIdFromToken, pagesOf } from "./design";
export type { PublishedItem } from "./design";

export async function ensurePlaylist(
  title: string | undefined,
  items: PublishedItem[],
  files: PublishedFile[],
  durationSeconds: number,
): Promise<PublishResult["playlist"]> {
  const mediaIds = new Set(items.map((item) => item.media_id));
  const existing = (await listPlaylists()).find((playlist) =>
    [...mediaIdsOf(playlist)].some((id) => mediaIds.has(id)),
  );
  const fileByPage = new Map(files.map(({ file, page }) => [page, file]));
  const pages = items.flatMap((item) => {
    const file = fileByPage.get(item.page);
    return file && "widthPx" in file
      ? [pageFor(item, file, durationSeconds)]
      : [];
  });
  const name = (title?.trim() || "Canva design").slice(0, 120);

  if (!existing) {
    const created = await request<Playlist & { review_id?: string }>(
      "/api/playlists",
      {
        method: "POST",
        headers: { "Idempotency-Key": crypto.randomUUID() },
        body: { name, pages },
      },
    );
    return {
      id: created.body.id,
      status: created.status === 202 ? "pending_review" : "created",
    };
  }

  const current = mediaIdsOf(existing);
  const same =
    current.size === mediaIds.size &&
    [...mediaIds].every((id) => current.has(id));
  if (same) {
    return { id: existing.id, status: "kept" };
  }
  const updated = await request<Playlist>(
    `/api/playlists/${encodeURIComponent(existing.id)}`,
    {
      method: "PUT",
      headers: {
        "If-Match": `"${existing.revision}"`,
        "Idempotency-Key": crypto.randomUUID(),
      },
      body: { name: existing.name, pages },
    },
  );
  return {
    id: existing.id,
    status: updated.status === 202 ? "pending_review" : "updated",
  };
}

/** Makes the playlist the default of each chosen screen that is not showing it. */
export async function assignScreens(
  playlistId: string,
  screenIds: string[],
): Promise<PublishResult["screens"]> {
  const results: PublishResult["screens"] = [];
  for (const id of screenIds) {
    const screen = await request<{ playlist_id?: string | null }>(
      `/api/screens/${encodeURIComponent(id)}`,
    );
    if (screen.body.playlist_id === playlistId) {
      results.push({ id, status: "kept" });
      continue;
    }
    const answer = await request(`/api/screens/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { "Idempotency-Key": crypto.randomUUID() },
      body: { playlist_id: playlistId },
    });
    results.push({
      id,
      status: answer.status === 202 ? "pending_review" : "assigned",
    });
  }
  return results;
}
