import { useEffect, useMemo, useRef, useState } from "react";

import type { Dex } from "../data/digimon";
import {
  buildDex,
  chainMembers,
  evolutionsOf,
  lineProgress,
  prependOptions,
  randomTeam,
  searchDigimon,
  shortRequirement,
} from "../data/digimon";
import type { Attribute, Chain, Digimon, EvolutionCondition, Generation } from "../data/types";
import { GENERATIONS, STAT_KEYS, TEAM_SIZE } from "../data/types";
import * as ops from "../state/teamOps";
import { IconDice, IconDots, IconEdit, IconFlag, IconLock, IconPlus, IconTrash } from "../ui/icons";
import { attributeColor, generationShort, theme } from "../ui/theme";
import { CSS } from "./styles";
import { syncStore, useSync } from "./sync";

const DATA_URL = "/assets/data/digimon.json";
const spriteUrl = (id: number) => `/assets/digimon/${id}.webp`;

const ATTRIBUTE_ICONS: Record<Attribute, string> = {
  Vaccine: "vaccine.png",
  Data: "data.png",
  Virus: "virus.png",
  Free: "free.png",
  Variable: "variable.png",
  Unknown: "unknown.png",
  "No Data": "no-data.png",
};
const attributeIconUrl = (attribute: Attribute) =>
  `/assets/attributes/${ATTRIBUTE_ICONS[attribute] ?? ATTRIBUTE_ICONS.Unknown}`;

/** Per-stat maxima for the bars, the same as the Steam-side details. */
const STAT_SCALE: Record<string, number> = { HP: 4200, SP: 2400, ATK: 1800, DEF: 1600, INT: 1800, SPI: 1600, SPD: 1500 };

const CONDITION_LABEL: Record<EvolutionCondition["type"], string> = {
  simple: "Requires",
  stats: "Stats",
  jogress: "Jogress",
  item: "Item",
};

/** How long a destructive button stays armed for its confirming second tap. */
const ARM_MS = 3000;
const SEARCH_LIMIT = 90;
const SELECTED_KEY = "dtb-second-screen-line";

type Sheet =
  | { kind: "evolve"; position: number }
  | { kind: "devolve" }
  | { kind: "add" }
  | { kind: "menu" };

function readSelected(): number {
  try {
    return Number(localStorage.getItem(SELECTED_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeSelected(index: number) {
  try {
    localStorage.setItem(SELECTED_KEY, String(index));
  } catch {
    // A private window: the page still works, it just starts on line 1 next time.
  }
}

function useDexOnce(): { dex: Dex | null; error: boolean } {
  const [dex, setDex] = useState<Dex | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    fetch(DATA_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status}`);
        return res.json() as Promise<Digimon[]>;
      })
      .then((all) => setDex(buildDex(all)))
      .catch(() => setError(true));
  }, []);
  return { dex, error };
}

/** Two-tap confirmation: the first tap arms, the second (within ARM_MS) acts. */
function useArmed(): [string | null, (key: string, act: () => void) => void] {
  const [armed, setArmed] = useState<string | null>(null);
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(null), ARM_MS);
    return () => clearTimeout(timer);
  }, [armed]);
  const press = (key: string, act: () => void) => {
    if (armed === key) {
      setArmed(null);
      act();
    } else {
      setArmed(key);
    }
  };
  return [armed, press];
}

export function App() {
  const sync = useSync();
  const { dex, error } = useDexOnce();
  const [selected, setSelectedState] = useState(readSelected);
  const [sheet, setSheet] = useState<Sheet | null>(null);

  const chains = sync.chains;
  const index = ops.clampIndex(selected, chains.length);
  const chain = chains[index];

  const select = (next: number) => {
    setSelectedState(next);
    writeSelected(next);
    setSheet(null);
  };

  let body;
  if (error) {
    body = <div className="ss-center">Couldn't load the Digimon data. Reload the page to try again.</div>;
  } else if (!dex || !sync.loaded) {
    body = <div className="ss-center">Loading…</div>;
  } else if (!chain) {
    body = (
      <div className="ss-center">
        <div>No evolution lines yet.</div>
        <div className="ss-actions" style={{ justifyContent: "center" }}>
          <button className="ss-action ss-primary" onClick={() => setSheet({ kind: "add" })}>
            <IconPlus size={16} /> Add a line
          </button>
          <button className="ss-action" onClick={() => sync.edit(() => randomTeam(dex, TEAM_SIZE))}>
            <IconDice size={16} /> Random team
          </button>
        </div>
      </div>
    );
  } else {
    body = <LineView key={index} dex={dex} chain={chain} index={index} openSheet={setSheet} />;
  }

  return (
    <>
      <style>{CSS}</style>
      <div className="ss-app">
        <nav className="ss-rail">
          <div className="ss-rail-list ss-scroll">
            {dex &&
              chains.map((c, i) => (
                <LineButton key={i} dex={dex} chain={c} index={i} on={i === index} onSelect={() => select(i)} />
              ))}
            {dex && sync.loaded && (
              <button className="ss-add-line" aria-label="Add a line" onClick={() => setSheet({ kind: "add" })}>
                <IconPlus size={20} />
              </button>
            )}
          </div>
        </nav>

        <main className="ss-main">
          {body}
          {dex && sheet && (
            <SheetView
              sheet={sheet}
              dex={dex}
              chain={chain}
              index={index}
              total={chains.length}
              onClose={() => setSheet(null)}
              onAdded={(newIndex) => select(newIndex)}
              onRemoved={() => select(Math.max(0, index - 1))}
              onMoved={(newIndex) => select(newIndex)}
            />
          )}
          {!sync.online && <div className="ss-offline">Can't reach the plugin. Is "Show on the bottom screen" still on?</div>}
        </main>
      </div>
    </>
  );
}

/* --- rail -------------------------------------------------------------------------- */

function LineButton({ dex, chain, index, on, onSelect }: { dex: Dex; chain: Chain; index: number; on: boolean; onSelect: () => void }) {
  const progress = lineProgress(chain, dex.byId);
  // Where the line is is what you glance down for mid-game, so that's the sprite shown.
  const shown = progress.current;
  return (
    <button className={`ss-line-btn${on ? " ss-on" : ""}`} onClick={onSelect} aria-label={`Line ${index + 1}`}>
      <span className="ss-line-num">{index + 1}</span>
      {chain.locked && (
        <span className="ss-line-lock">
          <IconLock size={10} />
        </span>
      )}
      <div className="ss-line-sprite">{shown && <img className="ss-sprite" src={spriteUrl(shown.id)} alt={shown.name} />}</div>
      <span className="ss-line-meta">
        {progress.marked && <IconFlag size={9} color={theme.color.accent} />}
        {progress.index + 1}/{progress.members.length}
      </span>
    </button>
  );
}

/* --- the selected line ----------------------------------------------------------- */

function Frame({ digimon, className, member = true, current = false, badge = false }: {
  digimon: Digimon;
  className: string;
  member?: boolean;
  current?: boolean;
  badge?: boolean;
}) {
  const accent = attributeColor(digimon.attribute);
  return (
    <div
      className={className}
      style={{
        position: "relative",
        background: member ? `linear-gradient(160deg, ${accent}38, rgba(10, 15, 22, 0.9))` : "rgba(255, 255, 255, 0.05)",
        border: `1px solid ${member ? accent : theme.color.border}`,
        outline: current ? `2px solid ${theme.color.accent}` : undefined,
        outlineOffset: -1,
      }}
    >
      <img className="ss-sprite" src={spriteUrl(digimon.id)} alt={digimon.name} loading="lazy" />
      {badge && (
        <span className="ss-badge ss-badge-gen" style={{ background: accent }}>
          {generationShort(digimon.generation)}
        </span>
      )}
      {current && badge && <span className="ss-badge ss-badge-now">NOW</span>}
    </div>
  );
}

function LineView({ dex, chain, index, openSheet }: { dex: Dex; chain: Chain; index: number; openSheet: (sheet: Sheet) => void }) {
  const progress = lineProgress(chain, dex.byId);
  const members = progress.members;
  const tail = members.at(-1) ?? null;
  const before = chain.locked ? [] : prependOptions(chain, dex.byId);
  const tailEvolutions = !chain.locked && tail ? evolutionsOf(tail, dex.byId) : [];
  const branchesAt = (i: number) => (!chain.locked && i < members.length - 1 ? evolutionsOf(members[i], dex.byId) : []);
  // Spacers keep chips under their own tiles; without any chips they'd only add a gap.
  const anyChip = members.some((_, i) => branchesAt(i).length > 1);

  // Opens on what the line is working towards: that's the question mid-game.
  const fallback = progress.next ?? progress.current ?? tail;
  const [inspectedId, setInspectedId] = useState<number | null>(fallback?.id ?? null);
  const inspectedPosition = members.findIndex((m) => m.id === inspectedId);
  const inspected = inspectedPosition === -1 ? fallback : members[inspectedPosition];
  const position = inspectedPosition === -1 ? members.indexOf(fallback as Digimon) : inspectedPosition;

  const stripRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = stripRef.current?.querySelector<HTMLElement>(".ss-inspected");
    node?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [inspected?.id]);

  return (
    <>
      <header className="ss-head">
        <div className="ss-head-text">
          <span className="ss-head-title">
            Line {index + 1}
            {tail && members[0] && members[0].id !== tail.id ? ` · ${members[0].name} → ${tail.name}` : tail ? ` · ${tail.name}` : ""}
          </span>
          {progress.marked && progress.current ? (
            <span className="ss-head-sub ss-marked">
              <IconFlag size={10} />
              On {progress.current.name}
              <span style={{ color: theme.color.textDim }}>
                {progress.next ? `· next ${progress.next.name}` : "· final stage"}
              </span>
            </span>
          ) : (
            <span className="ss-head-sub">
              {chain.locked && <IconLock size={10} color={theme.color.locked} />}
              Tap a Digimon, then "I'm here" to mark your progress
            </span>
          )}
        </div>
        <button className="ss-icon-btn" aria-label="Line options" onClick={() => openSheet({ kind: "menu" })}>
          <IconDots size={20} />
        </button>
      </header>

      <div className="ss-strip ss-scroll" ref={stripRef}>
        <div className="ss-strip-row">
          {before.length > 0 && (
            <>
              <div className="ss-cell">
                <button className="ss-tile" onClick={() => openSheet({ kind: "devolve" })} aria-label="Add a pre-evolution">
                  <div className="ss-ghost">
                    <IconPlus size={22} />
                  </div>
                  <span className="ss-ghost-label">Devolve</span>
                </button>
              </div>
              <div className="ss-arrow">›</div>
            </>
          )}
          {members.map((digimon, i) => {
            const branches = branchesAt(i);
            return (
              <div key={`${digimon.id}-${i}`} style={{ display: "flex" }}>
                {i > 0 && <div className="ss-arrow">›</div>}
                <div className="ss-cell">
                  <button
                    className={`ss-tile${digimon.id === inspected?.id ? " ss-inspected" : ""}`}
                    onClick={() => setInspectedId(digimon.id)}
                  >
                    <Frame className="ss-frame" digimon={digimon} current={chain.current === digimon.id} badge />
                    <span className="ss-tile-name">{digimon.name}</span>
                  </button>
                  {/* "Change" sits under the Digimon the branch leaves from, as in the builder. */}
                  {branches.length > 1 ? (
                    <button className="ss-chip" onClick={() => openSheet({ kind: "evolve", position: i })}>
                      <IconEdit size={11} /> Change
                    </button>
                  ) : (
                    anyChip && <span className="ss-chip-spacer" />
                  )}
                </div>
              </div>
            );
          })}
          {tailEvolutions.length > 0 && (
            <>
              <div className="ss-arrow">›</div>
              <div className="ss-cell">
                <button
                  className="ss-tile"
                  onClick={() => openSheet({ kind: "evolve", position: members.length - 1 })}
                  aria-label="Choose the next evolution"
                >
                  <div className="ss-ghost">
                    <IconPlus size={22} />
                  </div>
                  <span className="ss-ghost-label">Evolve</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {inspected && (
        <Details
          key={inspected.id}
          dex={dex}
          digimon={inspected}
          chain={chain}
          index={index}
          position={position}
          length={members.length}
        />
      )}
    </>
  );
}

function Details({ dex, digimon, chain, index, position, length }: {
  dex: Dex;
  digimon: Digimon;
  chain: Chain;
  index: number;
  position: number;
  length: number;
}) {
  const [armed, press] = useArmed();
  const isCurrent = chain.current === digimon.id;
  const accent = attributeColor(digimon.attribute);
  const stats = digimon.base_stats?.lv99 ?? {};
  const into = evolutionsOf(digimon, dex.byId);

  const removeLabel = length === 1 ? "Remove line" : position === 0 || position === length - 1 ? "Remove" : "Cut here";

  return (
    <section className="ss-details ss-scroll">
      <div className="ss-detail-top">
        <Frame className="ss-detail-frame" digimon={digimon} />
        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "0.2rem" }}>
          <span className="ss-detail-name">{digimon.name}</span>
          <span className="ss-detail-meta">
            <span style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", color: accent }}>
              <img src={attributeIconUrl(digimon.attribute)} alt="" />
              {digimon.attribute}
            </span>
            <span>
              {digimon.generation} · {digimon.type}
            </span>
          </span>
          {digimon.base_personality && (
            <span className="ss-detail-meta">
              <span>
                <span style={{ color: theme.color.textFaint }}>Base personality </span>
                {digimon.base_personality}
              </span>
            </span>
          )}
        </div>
      </div>

      <div className="ss-actions">
        <button
          className={`ss-action${isCurrent ? "" : " ss-primary"}`}
          onClick={() => syncStore.edit((chains) => ops.setCurrent(chains, index, isCurrent ? null : digimon.id))}
        >
          <IconFlag size={14} /> {isCurrent ? "Clear mark" : "I'm here"}
        </button>
        {!chain.locked && (
          <button
            className={`ss-action ss-danger${armed === "remove" ? " ss-armed" : ""}`}
            onClick={() => press("remove", () => syncStore.edit((chains) => ops.trimAt(chains, index, digimon.id)))}
          >
            <IconTrash size={14} /> {armed === "remove" ? "Tap again" : removeLabel}
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
        <span className="ss-label">How to evolve into {digimon.name}</span>
        <Requirements digimon={digimon} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
        <span className="ss-label">Base stats · Lv 99</span>
        <div className="ss-stats">
          {STAT_KEYS.map((key) => {
            const value = stats[key] ?? 0;
            const pct = Math.min(100, (value / (STAT_SCALE[key] ?? 2000)) * 100);
            return (
              <div key={key} className="ss-stat">
                <span className="ss-stat-key">{key}</span>
                <span className="ss-stat-bar">
                  <span className="ss-stat-fill" style={{ display: "block", width: `${pct}%`, background: accent }} />
                </span>
                <span className="ss-stat-value">{value}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
        <span className="ss-label">Evolves into</span>
        {into.length ? (
          <span className="ss-faint">{into.map((d) => d.name).join(" · ")}</span>
        ) : (
          <span className="ss-faint">End of the line. It doesn't evolve further.</span>
        )}
      </div>
    </section>
  );
}

function Requirements({ digimon }: { digimon: Digimon }) {
  const conditions = digimon.evolution_conditions ?? [];
  if (!conditions.length) return <span className="ss-faint">No recorded requirements.</span>;
  return (
    <div className="ss-reqs">
      {conditions.map((condition, i) => (
        <div key={i} className="ss-req-line">
          {i > 0 && <span className="ss-faint">or</span>}
          {condition.type !== "stats" && condition.type !== "simple" && <span className="ss-label">{CONDITION_LABEL[condition.type]}</span>}
          {Object.entries(condition.requirements).map(([key, value]) => (
            <span key={key} className="ss-req">
              <span className="ss-req-key">{shortRequirement(key)}</span>
              <span className="ss-req-value">{value}</span>
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

/* --- sheets ------------------------------------------------------------------------- */

interface SheetProps {
  sheet: Sheet;
  dex: Dex;
  chain: Chain | undefined;
  index: number;
  total: number;
  onClose: () => void;
  onAdded: (index: number) => void;
  onRemoved: () => void;
  onMoved: (index: number) => void;
}

function SheetView(props: SheetProps) {
  const { sheet, dex, chain, index, onClose } = props;

  if (sheet.kind === "add") return <AddLineSheet {...props} />;
  if (!chain) return null;
  if (sheet.kind === "menu") return <LineMenuSheet {...props} chain={chain} />;

  const members = chainMembers(chain, dex.byId);
  if (sheet.kind === "devolve") {
    const head = members[0];
    if (!head) return null;
    return (
      <PickerSheet
        title={`${head.name} devolves from…`}
        note="Added to the front of the line."
        options={prependOptions(chain, dex.byId)}
        onClose={onClose}
        onPick={(picked) => syncStore.edit((chains) => ops.prepend(chains, index, picked.id))}
      />
    );
  }

  const source = members[sheet.position];
  if (!source) return null;
  const isLast = sheet.position === members.length - 1;
  return (
    <PickerSheet
      title={`Evolve ${source.name} into…`}
      note={isLast ? "Added to the end of the line." : "Replaces everything after it."}
      options={evolutionsOf(source, dex.byId)}
      takenId={chain.ids[sheet.position + 1]}
      onClose={onClose}
      onPick={(picked) => syncStore.edit((chains) => ops.chooseBranch(chains, index, sheet.position, picked.id))}
    />
  );
}

function SheetHead({ title, note, onClose }: { title: string; note?: string; onClose: () => void }) {
  return (
    <div className="ss-sheet-head">
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "0.1rem" }}>
        <span className="ss-sheet-title">{title}</span>
        {note && <span className="ss-sheet-note">{note}</span>}
      </div>
      <button className="ss-icon-btn" aria-label="Close" onClick={onClose} style={{ fontSize: "1.3rem" }}>
        ×
      </button>
    </div>
  );
}

function PickerSheet({ title, note, options, takenId, onPick, onClose }: {
  title: string;
  note: string;
  options: Digimon[];
  takenId?: number;
  onPick: (digimon: Digimon) => void;
  onClose: () => void;
}) {
  return (
    <div className="ss-sheet">
      <SheetHead title={title} note={note} onClose={onClose} />
      <div className="ss-sheet-body ss-scroll">
        {options.map((option) => {
          const taken = option.id === takenId;
          return (
            <button
              key={option.id}
              className={`ss-option${taken ? " ss-taken" : ""}`}
              onClick={() => {
                onPick(option);
                onClose();
              }}
            >
              <Frame className="ss-option-frame" digimon={option} member={taken} />
              <span className="ss-option-text">
                <span className="ss-option-name">
                  {option.name}
                  {taken && <span className="ss-pill-in">IN LINE</span>}
                </span>
                <span className="ss-detail-meta">
                  <span style={{ color: attributeColor(option.attribute) }}>{option.attribute}</span>
                  <span>{generationShort(option.generation)}</span>
                  {option.base_personality && <span>{option.base_personality}</span>}
                </span>
                <Requirements digimon={option} />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AddLineSheet({ dex, onClose, onAdded }: SheetProps) {
  const [query, setQuery] = useState("");
  const [generation, setGeneration] = useState<Generation | "All">("All");
  const results = useMemo(() => searchDigimon(dex, query, generation), [dex, query, generation]);
  const shown = results.slice(0, SEARCH_LIMIT);

  return (
    <div className="ss-sheet">
      <SheetHead title="Start a new line with…" onClose={onClose} />
      <input
        className="ss-search"
        type="search"
        placeholder="Search by name or type"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
      />
      <div className="ss-gens ss-scroll">
        {(["All", ...GENERATIONS] as const).map((g) => (
          <button key={g} className={`ss-chip${g === generation ? " ss-on" : ""}`} onClick={() => setGeneration(g)}>
            {g === "All" ? "All" : generationShort(g)}
          </button>
        ))}
      </div>
      <div className="ss-sheet-body ss-scroll">
        <div className="ss-grid">
          {shown.map((digimon) => (
            <button
              key={digimon.id}
              className="ss-grid-item"
              onClick={() => {
                let added = -1;
                syncStore.edit((chains) => {
                  const next = ops.addChain(chains, digimon.id);
                  added = next.length - 1;
                  return next;
                });
                onAdded(added);
              }}
            >
              <Frame className="ss-grid-frame" digimon={digimon} badge />
              <span className="ss-grid-name">{digimon.name}</span>
            </button>
          ))}
        </div>
        {results.length > shown.length && (
          <span className="ss-faint" style={{ textAlign: "center", padding: "0.4rem" }}>
            Showing {shown.length} of {results.length}. Search to narrow it down.
          </span>
        )}
        {results.length === 0 && <span className="ss-faint" style={{ textAlign: "center" }}>No Digimon match.</span>}
      </div>
    </div>
  );
}

function LineMenuSheet({ chain, index, total, onClose, onRemoved, onMoved }: SheetProps & { chain: Chain }) {
  const [armed, press] = useArmed();
  return (
    <div className="ss-sheet">
      <SheetHead title={`Line ${index + 1}`} onClose={onClose} />
      <div className="ss-sheet-body ss-scroll">
        <button
          className="ss-menu-item"
          onClick={() => {
            syncStore.edit((chains) => ops.toggleLock(chains, index));
            onClose();
          }}
        >
          <IconLock size={16} /> {chain.locked ? "Unlock (allow edits)" : "Lock (keep through a random reroll)"}
        </button>
        <button
          className="ss-menu-item"
          disabled={index === 0}
          onClick={() => {
            syncStore.edit((chains) => ops.move(chains, index, -1));
            onMoved(index - 1);
          }}
        >
          ↑ Move up
        </button>
        <button
          className="ss-menu-item"
          disabled={index >= total - 1}
          onClick={() => {
            syncStore.edit((chains) => ops.move(chains, index, 1));
            onMoved(index + 1);
          }}
        >
          ↓ Move down
        </button>
        <button
          className={`ss-menu-item ss-danger${armed === "line" ? " ss-armed" : ""}`}
          onClick={() =>
            press("line", () => {
              syncStore.edit((chains) => ops.removeChain(chains, index));
              onRemoved();
            })
          }
        >
          <IconTrash size={16} /> {armed === "line" ? "Tap again to remove the line" : "Remove line"}
        </button>
      </div>
    </div>
  );
}
