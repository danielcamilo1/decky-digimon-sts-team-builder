import { toaster } from "@decky/api";
import { Focusable, ModalRoot } from "@decky/ui";
import { useState } from "react";

import { decodeTeam, shareUrl } from "../data/share";
import type { Chain } from "../data/types";
import { GlobalStyles } from "../ui/GlobalStyles";
import { ActionButton, ButtonHints, Divider, SectionLabel, TextInput } from "../ui/primitives";
import { theme } from "../ui/theme";

interface Props {
  chains: Chain[];
  onImport: (chains: Chain[]) => void;
  closeModal?: () => void;
}

/** Steam's CEF exposes the async clipboard API; fall back to execCommand if a
 * future build locks it down. */
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const input = document.createElement("textarea");
      input.value = text;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(input);
      return ok;
    } catch {
      return false;
    }
  }
}

export function ShareModal({ chains, onImport, closeModal }: Props) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const exported = shareUrl(chains);

  const doImport = () => {
    const imported = decodeTeam(code);
    if (!imported) {
      setError("That doesn't look like a valid team code or link.");
      return;
    }
    onImport(imported);
    toaster.toast({ title: "Team imported", body: `${imported.length} evolution line${imported.length === 1 ? "" : "s"}` });
    closeModal?.();
  };

  return (
    <ModalRoot closeModal={closeModal} onCancel={closeModal} bAllowFullSize>
      <GlobalStyles />
      <div className="dtb-root" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Share team</div>
        <div style={{ fontSize: 12, color: theme.color.textDim }}>
          These codes are the same format the web team builder uses, so a team moves between your Deck and the site
          either way.
        </div>

        <Divider />

        <SectionLabel>Your team</SectionLabel>
        <div
          style={{
            padding: 10,
            borderRadius: theme.radius.md,
            background: "rgba(0, 0, 0, 0.35)",
            border: `1px solid ${theme.color.border}`,
            fontSize: 11,
            fontFamily: "monospace",
            wordBreak: "break-all",
            maxHeight: 96,
            overflowY: "auto",
            color: chains.length ? theme.color.text : theme.color.textFaint,
          }}
          className="dtb-scroll"
        >
          {chains.length ? exported : "Add an evolution line first."}
        </div>
        <Focusable style={{ display: "flex", gap: 8 }}>
          <ActionButton
            disabled={!chains.length}
            actionLabel="Copy"
            onClick={async () => {
              const ok = await copyToClipboard(exported);
              toaster.toast(
                ok
                  ? { title: "Copied", body: "Team link copied to the clipboard" }
                  : { title: "Could not copy", body: "Steam blocked clipboard access" },
              );
            }}
          >
            Copy link
          </ActionButton>
          <ActionButton
            disabled={!chains.length}
            actionLabel="Copy"
            onClick={async () => {
              const ok = await copyToClipboard(exported.split("team=")[1] ?? "");
              toaster.toast(
                ok
                  ? { title: "Copied", body: "Team code copied to the clipboard" }
                  : { title: "Could not copy", body: "Steam blocked clipboard access" },
              );
            }}
          >
            Copy code only
          </ActionButton>
        </Focusable>

        <Divider />

        <SectionLabel>Load a team</SectionLabel>
        <TextInput
          label="Team code or link"
          placeholder="W3siaWRzIjpbMSwxNl0…"
          value={code}
          bShowClearAction
          onChange={(e) => {
            setCode(e.target.value);
            setError(null);
          }}
        />
        {error && <div style={{ fontSize: 12, color: theme.color.danger }}>{error}</div>}
        <Focusable style={{ display: "flex", gap: 8 }}>
          <ActionButton disabled={!code.trim()} actionLabel="Load" onClick={doImport}>
            Replace my team with this code
          </ActionButton>
        </Focusable>

        <Divider />
        <ButtonHints hints={[["B", "Close"]]} />
      </div>
    </ModalRoot>
  );
}
