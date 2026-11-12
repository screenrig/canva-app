import {
  Alert,
  Button,
  CheckboxGroup,
  FormField,
  LoadingIndicator,
  NumberInput,
  Rows,
  Text,
} from "@canva/app-ui-kit";
import type {
  PublishRefValidityState,
  RenderSettingsUiRequest,
} from "@canva/intents/content";
import { useCallback, useEffect, useState } from "react";
import { useIntl } from "react-intl";
import * as styles from "styles/components.css";
import type { Project, Screen } from "src/screenrig/api";
import { getProject, listScreens, oauth, SCOPE } from "src/screenrig/api";
import type { PublishSettings } from "./types";
import {
  DEFAULT_SETTINGS,
  MAX_DURATION_SECONDS,
  MIN_DURATION_SECONDS,
  parsePublishSettings,
  validDuration,
} from "./types";

type Connection =
  | { state: "loading" }
  | { state: "signed_out"; error?: string }
  | { state: "connected"; project: Project; screens: Screen[] };

function validity(
  connection: Connection,
  settings: PublishSettings,
): PublishRefValidityState {
  if (connection.state !== "connected")
    return "invalid_authentication_required";
  return validDuration(settings.durationSeconds)
    ? "valid"
    : "invalid_missing_required_fields";
}

export const SettingsUi = ({
  invocationContext,
  updatePublishSettings,
  registerOnContextChange,
}: RenderSettingsUiRequest) => {
  const intl = useIntl();
  const [settings, setSettings] = useState<PublishSettings>(
    parsePublishSettings(invocationContext?.publishRef) ?? DEFAULT_SETTINGS,
  );
  const [connection, setConnection] = useState<Connection>({
    state: "loading",
  });

  const load = useCallback(async () => {
    try {
      const token = await oauth.getAccessToken({ scope: SCOPE });
      if (!token) {
        setConnection({ state: "signed_out" });
        return;
      }
      const [project, screens] = await Promise.all([
        getProject(),
        listScreens(),
      ]);
      setConnection({
        state: "connected",
        project,
        screens: screens.filter((screen) => screen.state !== "archived"),
      });
    } catch (error) {
      setConnection({
        state: "signed_out",
        error: error instanceof Error ? error.message : undefined,
      });
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    updatePublishSettings({
      publishRef: JSON.stringify(settings),
      validityState: validity(connection, settings),
    });
  }, [settings, connection, updatePublishSettings]);

  useEffect(() => {
    return registerOnContextChange({
      onContextChange: (context) => {
        if (context.reason === "publish_error") {
          try {
            const payload = JSON.parse(context.error.appDefinedPayload ?? "{}");
            if (payload.code === "signed_out") {
              setConnection({ state: "signed_out" });
            }
          } catch {
            // A payload the app did not write: keep the current state.
          }
        }
      },
    });
  }, [registerOnContextChange]);

  const connect = async () => {
    setConnection({ state: "loading" });
    const response = await oauth.requestAuthorization({ scope: SCOPE });
    if (response.status === "completed") {
      await load();
    } else {
      setConnection({ state: "signed_out" });
    }
  };

  const disconnect = async () => {
    await oauth.deauthorize();
    setSettings({ ...settings, screenIds: [] });
    setConnection({ state: "signed_out" });
  };

  if (connection.state === "loading") {
    return (
      <div className={styles.scrollContainer}>
        <LoadingIndicator />
      </div>
    );
  }

  return (
    <div className={styles.scrollContainer}>
      <Rows spacing="2u">
        <FormField
          label={intl.formatMessage({
            defaultMessage: "Seconds per page",
            description:
              "Label for how long each image page shows on the screens",
          })}
          description={intl.formatMessage({
            defaultMessage: "Videos play to their end.",
            description: "Help text under the seconds-per-page field",
          })}
          control={(props) => (
            <NumberInput
              {...props}
              min={MIN_DURATION_SECONDS}
              max={MAX_DURATION_SECONDS}
              step={1}
              hasSpinButtons
              decrementAriaLabel={intl.formatMessage({
                defaultMessage: "One second less",
                description:
                  "Screen reader label for the seconds-per-page decrement button",
              })}
              incrementAriaLabel={intl.formatMessage({
                defaultMessage: "One second more",
                description:
                  "Screen reader label for the seconds-per-page increment button",
              })}
              value={settings.durationSeconds}
              onChange={(value) =>
                setSettings({ ...settings, durationSeconds: value ?? 0 })
              }
            />
          )}
        />
        {connection.state === "signed_out" ? (
          <Rows spacing="1u">
            <Text>
              {intl.formatMessage({
                defaultMessage:
                  "Connect your screenRIG project to publish this design to your screens.",
                description: "Shown before the person connects screenRIG",
              })}
            </Text>
            {connection.error && (
              <Alert tone="critical">{connection.error}</Alert>
            )}
            <Button variant="primary" stretch onClick={connect}>
              {intl.formatMessage({
                defaultMessage: "Connect screenRIG",
                description: "Button that starts screenRIG sign-in",
              })}
            </Button>
          </Rows>
        ) : (
          <Rows spacing="2u">
            <Text>
              {intl.formatMessage(
                {
                  defaultMessage: "Publishing to {project}",
                  description: "Names the connected screenRIG project",
                },
                { project: connection.project.name },
              )}
            </Text>
            <FormField
              label={intl.formatMessage({
                defaultMessage: "Show on screens",
                description:
                  "Label for choosing the screens that play the design",
              })}
              description={intl.formatMessage({
                defaultMessage:
                  "The design plays as its own playlist. Publishing it again updates the same playlist.",
                description: "Help text under the screen list",
              })}
              control={(props) =>
                connection.screens.length === 0 ? (
                  <Text tone="tertiary">
                    {intl.formatMessage({
                      defaultMessage:
                        "No screens yet. The design is saved as a playlist in your project.",
                      description: "Shown when the project has no screens",
                    })}
                  </Text>
                ) : (
                  <CheckboxGroup
                    {...props}
                    value={settings.screenIds}
                    options={connection.screens.map((screen) => ({
                      value: screen.id,
                      label: screen.name,
                    }))}
                    onChange={(screenIds) =>
                      setSettings({ ...settings, screenIds })
                    }
                  />
                )
              }
            />
            <Button variant="tertiary" stretch onClick={disconnect}>
              {intl.formatMessage({
                defaultMessage: "Disconnect screenRIG",
                description: "Button that signs out of screenRIG",
              })}
            </Button>
          </Rows>
        )}
      </Rows>
    </div>
  );
};
