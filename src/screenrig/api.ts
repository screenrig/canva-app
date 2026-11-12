import { auth } from "@canva/user";

// BACKEND_HOST is the screenRIG API origin this build talks to
// (CANVA_BACKEND_HOST at build time). It defaults to https://api.screenrig.ai.
const ORIGIN = (BACKEND_HOST || "https://api.screenrig.ai").replace(/\/+$/, "");

// The access the app asks for at sign-in. The person chooses the project, and
// may lower the access, on screenRIG's consent page.
export const SCOPE = new Set(["access:manage"]);

// The auth provider named "screenrig" in the Developer Portal (Auth providers).
export const oauth = auth.initOauth({
  provider: "screenrig",
  type: "single_account",
});

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string | undefined,
    message: string,
  ) {
    super(message);
  }
}

export class SignedOutError extends Error {}

async function token(forceRefresh = false): Promise<string> {
  const response = await oauth.getAccessToken({ scope: SCOPE, forceRefresh });
  if (!response?.token) {
    throw new SignedOutError("Connect screenRIG to publish.");
  }
  return response.token;
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
};

async function send(
  path: string,
  options: RequestOptions,
  forceRefresh: boolean,
): Promise<Response> {
  const headers: Record<string, string> = {
    Accept: "application/json",
    Authorization: `Bearer ${await token(forceRefresh)}`,
    ...options.headers,
  };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  return fetch(`${ORIGIN}${path}`, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    credentials: "omit",
  });
}

export type Answer<T> = { status: number; body: T; etag?: string };

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<Answer<T>> {
  let response = await send(path, options, false);
  if (response.status === 401) {
    // The access token can lapse between Canva's refreshes: refresh once.
    response = await send(path, options, true);
  }
  const text = await response.text();
  const body = text ? JSON.parse(text) : undefined;
  if (!response.ok) {
    if (response.status === 401) {
      throw new SignedOutError("Connect screenRIG again to publish.");
    }
    const problem = (body ?? {}) as {
      code?: string;
      detail?: string;
      title?: string;
    };
    throw new ApiError(
      response.status,
      problem.code,
      problem.detail ||
        problem.title ||
        `screenRIG answered ${response.status}.`,
    );
  }
  return {
    status: response.status,
    body: body as T,
    etag: response.headers.get("ETag") ?? undefined,
  };
}

export type Project = { id: string; name: string };
export type Playlist = {
  id: string;
  name: string;
  revision: number;
  pages: PlaylistPage[];
};
export type PlaylistPage = Record<string, unknown> & { id: string };
export type Screen = {
  id: string;
  name: string;
  playlist_id?: string | null;
  state?: string;
};
export type Operation = {
  id: string;
  state:
    "receiving" | "queued" | "running" | "succeeded" | "failed" | "cancelled";
  result?: Record<string, unknown>;
  error?: { code?: string; detail?: string };
};

export async function getProject(): Promise<Project> {
  return (await request<Project>("/api/project")).body;
}

export async function listPlaylists(): Promise<Playlist[]> {
  return (await request<{ items: Playlist[] }>("/api/playlists")).body.items;
}

export async function listScreens(): Promise<Screen[]> {
  return (await request<{ items: Screen[] }>("/api/screens")).body.items;
}

export async function waitForOperation(
  operation: Operation,
  budgetMs = 120_000,
): Promise<Operation> {
  const started = Date.now();
  let current = operation;
  let delay = 500;
  while (!["succeeded", "failed", "cancelled"].includes(current.state)) {
    if (Date.now() - started > budgetMs) {
      throw new ApiError(
        504,
        "timeout",
        "screenRIG is still preparing the design. Check the media library in a minute.",
      );
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay = Math.min(delay * 1.5, 3000);
    current = (
      await request<Operation>(
        `/api/operations/${encodeURIComponent(current.id)}`,
      )
    ).body;
  }
  return current;
}
