import { callable } from "@decky/api";
import { PanelSection, PanelSectionRow, ToggleField } from "@decky/ui";
import { useEffect, useState } from "react";

import { theme } from "../ui/theme";

interface SecondScreenState {
  /** Running under DroidDeck, where a browser on the other screen can reach the page. */
  supported: boolean;
  enabled: boolean;
  running: boolean;
  url: string;
  error: string | null;
}

const getSecondScreen = callable<[], SecondScreenState>("get_second_screen");
const setSecondScreen = callable<[enabled: boolean], SecondScreenState>("set_second_screen");

function description(state: SecondScreenState): string {
  if (!state.enabled) return "Serves a touch version of the builder for a browser on the bottom screen.";
  if (state.running) return "Open this address in a browser on the bottom screen:";
  if (state.error === "port_in_use") return "Couldn't start: another app is using the port. Try again after closing it.";
  if (state.error) return "Couldn't start the page. Turn it off and on again to retry.";
  return "Starting…";
}

/**
 * The switch for the second-screen page. Offered only under DroidDeck: elsewhere there's
 * no browser on another screen to open it in.
 */
export function SecondScreenSetting() {
  const [state, setState] = useState<SecondScreenState | null>(null);

  useEffect(() => {
    let alive = true;
    getSecondScreen()
      .then((next) => alive && setState(next))
      .catch((e) => console.error("[digimon-team-builder] could not read the second-screen state:", e));
    return () => {
      alive = false;
    };
  }, []);

  if (!state?.supported) return null;

  const onChange = (enabled: boolean) => {
    setState({ ...state, enabled });
    setSecondScreen(enabled)
      .then(setState)
      .catch((e) => {
        console.error("[digimon-team-builder] could not switch the second screen:", e);
        getSecondScreen().then(setState).catch(() => {});
      });
  };

  return (
    <PanelSection title="Second screen">
      <PanelSectionRow>
        <ToggleField
          label="Show on the bottom screen"
          description={description(state)}
          checked={state.enabled}
          onChange={onChange}
          bottomSeparator="none"
        />
      </PanelSectionRow>
      {state.enabled && state.running && (
        <PanelSectionRow>
          <div style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11, lineHeight: 1.45 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: theme.color.accent, userSelect: "text" }}>{state.url}</span>
            <span style={{ color: theme.color.textFaint }}>
              Add it to the home screen once and it opens full screen. Changes on either screen show up on the other.
            </span>
          </div>
        </PanelSectionRow>
      )}
    </PanelSection>
  );
}
