import { AppI18nProvider, initIntl } from "@canva/app-i18n-kit";
import { AppUiProvider } from "@canva/app-ui-kit";
import type {
  ContentPublisherIntent,
  GetPublishConfigurationResponse,
  OutputFile,
  PublishContentRequest,
  PublishContentResponse,
  RenderPreviewUiRequest,
  RenderSettingsUiRequest,
} from "@canva/intents/content";
import type { ReactNode } from "react";
import type { Root } from "react-dom/client";
import { createRoot } from "react-dom/client";
import "@canva/app-ui-kit/styles.css";
import { ApiError, SignedOutError } from "src/screenrig/api";
import { DASHBOARD_URL } from "src/screenrig/design";
import {
  assignScreens,
  designIdFromToken,
  ensurePlaylist,
  pagesOf,
  publishMedia,
} from "src/screenrig/publish";
import { PreviewUi } from "./preview_ui";
import { SettingsUi } from "./settings_ui";
import { DEFAULT_SETTINGS, parsePublishSettings } from "./types";

const intl = initIntl();

// A playlist holds at most 100 pages.
const MAX_PAGES = 100;

// One React root for the iframe: Canva may ask for a view again (after
// sign-in, for example), and a second root on the same element would leave
// the first one's stale view in place.
let root: Root | undefined;

function mount(view: ReactNode) {
  root ??= createRoot(document.getElementById("root") as Element);
  root.render(
    <AppI18nProvider>
      <AppUiProvider>{view}</AppUiProvider>
    </AppI18nProvider>,
  );
}

function renderSettingsUi(request: RenderSettingsUiRequest) {
  mount(<SettingsUi {...request} />);
}

function renderPreviewUi(request: RenderPreviewUiRequest) {
  mount(<PreviewUi {...request} />);
}

async function getPublishConfiguration(): Promise<GetPublishConfigurationResponse> {
  return {
    status: "completed",
    outputTypes: [
      {
        id: "pages",
        displayName: intl.formatMessage({
          defaultMessage: "Pages as images",
          description:
            "Output type: each selected page of the design plays as an image on the screens",
        }),
        contentNoun: "content",
        mediaSlots: [
          {
            id: "pages",
            displayName: intl.formatMessage({
              defaultMessage: "Pages",
              description:
                "Label for choosing which design pages play on the screens",
            }),
            fileCount: { min: 1, max: MAX_PAGES },
            accepts: { image: { format: "png" } },
          },
        ],
      },
      {
        id: "video",
        displayName: intl.formatMessage({
          defaultMessage: "Video",
          description:
            "Output type: the design plays as one MP4 video on the screens",
        }),
        contentNoun: "content",
        mediaSlots: [
          {
            id: "video",
            displayName: intl.formatMessage({
              defaultMessage: "Pages in the video",
              description:
                "Label for choosing which design pages make up the video",
            }),
            fileCount: { exact: 1 },
            accepts: { video: { format: "mp4" } },
          },
        ],
      },
    ],
  };
}

function appError(message: string): PublishContentResponse {
  return { status: "app_error", message };
}

async function publishContent(
  request: PublishContentRequest,
): Promise<PublishContentResponse> {
  const settings = parsePublishSettings(request.publishRef) ?? DEFAULT_SETTINGS;
  const files: OutputFile[] = request.outputMedia.flatMap(
    (media) => media.files,
  );
  const [first] = files;
  if (!first) {
    return appError("Choose at least one page to publish.");
  }
  const metadata = first.contentMetadata;
  try {
    const designId = designIdFromToken(metadata.designToken);
    const pages = pagesOf(files);
    const items = await publishMedia(designId, metadata.title, pages);
    const playlist = await ensurePlaylist(
      metadata.title,
      items,
      pages,
      settings.durationSeconds,
    );
    if (
      playlist &&
      playlist.status !== "pending_review" &&
      settings.screenIds.length > 0
    ) {
      await assignScreens(playlist.id, settings.screenIds);
    }
    return {
      status: "completed",
      externalId: playlist?.id ?? items[0]?.media_id,
      externalUrl: DASHBOARD_URL,
    };
  } catch (error) {
    if (error instanceof SignedOutError) {
      return {
        status: "app_error",
        message: error.message,
        appDefinedPayload: JSON.stringify({ code: "signed_out" }),
      };
    }
    if (error instanceof ApiError) {
      if (error.status >= 500 || error.status === 0) {
        return { status: "remote_request_failed" };
      }
      return appError(error.message);
    }
    return { status: "remote_request_failed" };
  }
}

const contentPublisher: ContentPublisherIntent = {
  renderSettingsUi,
  renderPreviewUi,
  getPublishConfiguration,
  publishContent,
};

export default contentPublisher;
