import { callable } from "@decky/api";
import { PanelSection, PanelSectionRow, ToggleField } from "@decky/ui";
import { useEffect, useState } from "react";

interface BottomScreenState {
  /** Armada OS on a device with a second screen. */
  supported: boolean;
  enabled?: boolean;
  running?: boolean;
  /** From py_modules/bottom_screen/armada.py: "ok", "not_in_game_mode", "no_python", … */
  reason?: string;
  /** What the renderer last reported, e.g. "lease_busy" or "no_cairo". */
  error?: string | null;
}

const getBottomScreen = callable<[], BottomScreenState>("get_bottom_screen");
const setBottomScreen = callable<[enabled: boolean], BottomScreenState>("set_bottom_screen");

/** The renderer starts in the background, so the state is re-read while the panel is open. */
const POLL_MS = 3000;

function description(state: BottomScreenState): string {
  if (!state.enabled) {
    return "Shows the builder on the bottom screen, by touch, while you play. Armada's bottom-screen desktop pauses while it's on.";
  }
  if (state.reason === "not_in_game_mode") return "It will show up when game mode is back.";
  if (state.reason === "no_python") return "This system has no /usr/bin/python3 to draw the bottom screen with.";
  if (state.reason === "other_user") return "The game session belongs to another user, so the plugin can't start it.";
  if (state.error === "no_cairo") return "Drawing the bottom screen needs Python's cairo module (python3-cairo), which is missing.";
  if (state.error === "lease_busy") return "Another app has the bottom screen. Close it and this retries on its own.";
  if (state.running) return "Showing on the bottom screen. Changes on either screen show up on the other.";
  if (state.error) return "Couldn't open the bottom screen. It retries on its own.";
  return "Opening the bottom screen…";
}

/** The switch for the bottom-screen builder. Offered only where there's a bottom screen. */
export function BottomScreenSetting() {
  const [state, setState] = useState<BottomScreenState | null>(null);

  useEffect(() => {
    let alive = true;
    const read = () =>
      getBottomScreen()
        .then((next) => {
          if (!alive) return;
          setState(next);
          // A machine without a second screen never grows one.
          if (!next.supported) window.clearInterval(timer);
        })
        .catch((e) => console.error("[digimon-team-builder] could not read the bottom-screen state:", e));
    const timer = window.setInterval(read, POLL_MS);
    read();
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  if (!state?.supported) return null;

  const onChange = (enabled: boolean) => {
    setState({ ...state, enabled, error: null });
    setBottomScreen(enabled)
      .then(setState)
      .catch((e) => console.error("[digimon-team-builder] could not switch the bottom screen:", e));
  };

  return (
    <PanelSection title="Bottom screen">
      <PanelSectionRow>
        <ToggleField
          label="Show on the bottom screen"
          description={description(state)}
          checked={!!state.enabled}
          onChange={onChange}
          bottomSeparator="none"
        />
      </PanelSectionRow>
    </PanelSection>
  );
}
