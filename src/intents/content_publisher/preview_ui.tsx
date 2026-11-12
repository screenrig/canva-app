import {
  ImageCard,
  LoadingIndicator,
  Rows,
  Text,
  VideoCard,
} from "@canva/app-ui-kit";
import type {
  Preview,
  PreviewMedia,
  RenderPreviewUiRequest,
} from "@canva/intents/content";
import { useEffect, useState } from "react";
import { useIntl } from "react-intl";
import * as styles from "styles/preview_ui.css";
import { parsePublishSettings } from "./types";

function PreviewScreen({ preview }: { preview: Preview }) {
  if (preview.status === "loading" || preview.status === "upgrading") {
    return (
      <div className={styles.screen}>
        <LoadingIndicator />
      </div>
    );
  }
  if (preview.kind === "video" && preview.status === "ready") {
    return (
      <div className={styles.screen}>
        <VideoCard
          ariaLabel=""
          thumbnailUrl={preview.thumbnailUrl}
          videoPreviewUrl={preview.url}
          mimeType="video/mp4"
          borderRadius="none"
          thumbnailAspectRatio={16 / 9}
        />
      </div>
    );
  }
  if (preview.kind === "video" && preview.status === "thumbnail") {
    return (
      <div className={styles.screen}>
        <ImageCard
          alt=""
          thumbnailUrl={preview.thumbnailUrl}
          borderRadius="none"
          thumbnailAspectRatio={16 / 9}
          thumbnailBackground="contrastOnDark"
        />
      </div>
    );
  }
  if (preview.kind === "image" && preview.status === "ready") {
    return (
      <div className={styles.screen}>
        <ImageCard
          alt=""
          thumbnailUrl={preview.url}
          borderRadius="none"
          thumbnailAspectRatio={16 / 9}
          thumbnailBackground="contrastOnDark"
        />
      </div>
    );
  }
  return <div className={styles.screen} />;
}

// Shows each page the way it fills a landscape screen: the whole page,
// letterboxed on black.
export const PreviewUi = ({
  invocationContext,
  registerOnPreviewChange,
}: RenderPreviewUiRequest) => {
  const intl = useIntl();
  const [media, setMedia] = useState<PreviewMedia[] | undefined>(
    invocationContext?.reason === "publish"
      ? (invocationContext.previewMedia as PreviewMedia[] | undefined)
      : undefined,
  );
  const [publishRef, setPublishRef] = useState<string | undefined>(
    invocationContext?.reason === "publish"
      ? invocationContext.publishRef
      : undefined,
  );

  useEffect(() => {
    return registerOnPreviewChange((data) => {
      setMedia(data.previewMedia);
      setPublishRef(data.publishRef);
    });
  }, [registerOnPreviewChange]);

  const previews = (media ?? []).flatMap((slot) => slot.previews);
  const settings = parsePublishSettings(publishRef);

  return (
    <div className={styles.container}>
      <Rows spacing="2u">
        {previews.map((preview) => (
          <PreviewScreen key={preview.id} preview={preview} />
        ))}
        {settings && previews.length > 1 && (
          <Text alignment="center" tone="tertiary">
            {intl.formatMessage(
              {
                defaultMessage: "Each page shows for {seconds} seconds.",
                description:
                  "Under the preview: how long each page stays on screen",
              },
              { seconds: settings.durationSeconds },
            )}
          </Text>
        )}
      </Rows>
    </div>
  );
};
