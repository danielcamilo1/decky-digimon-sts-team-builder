# Changelog

All notable changes to this plugin are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] — 2026-08-12

### Added

- **The *Next up* view names the base personality you're evolving into.** Each row's next
  evolution now reads `stage · attribute · personality`, so you can see that the Mega you're
  working towards arrives *Zealous* before you commit the Agent Rank to it. It sits on the
  line that was already there, so the rows don't get taller and six lines still fit in the
  panel.
- **Base personality in the details modal too.** Pressing **A** on a Digimon in the builder
  now shows its base personality in the header, beside its stage, attribute and type — so
  the personality you saw in *Next up* is there when you open the evolution to check it.
- **And on the branch picker.** Each option in *Change* / *Evolve* lists the personality it
  arrives with next to its requirements, which is the moment you're actually choosing
  between branches.

### Notes

- The personality shown is the Digimon's *base* personality, the one it evolves in with —
  not whatever the Digimon currently has. It was already in the shipped dataset, so this
  needs no data regeneration and doesn't change the bundle or `digimon.json`.

## [1.2.0] — 2026-08-12

### Added

- **Mark where you are in a line.** Each evolution line can now carry the stage you've
  actually reached: press **Y** on a Digimon in the builder (or use *I'm here* in its details
  modal) and it's badged **NOW**. Pressing Y on the marked stage again clears it, as does
  *Clear the current-stage mark* in the line's ⋮ menu. The mark works on locked lines too —
  the lock protects a line's members, and where you've got to isn't one of them.
- **A *Next up* view in the Quick Access panel.** The panel now switches between two views:
  *Lines*, the team overview it has always shown, and *Next up*, which gives each line the
  evolution it's working towards and the Agent Rank, stat, item or Jogress requirements to
  get there — the thing you actually want mid-battle. Pressing **Y** on a line there marks
  that evolution as reached without opening the builder.

### Notes

- Lines with no mark are read as sitting on their first stage, and say so, so *Next up* is
  useful before anything has been marked.
- Share codes are unchanged, and stay byte-for-byte compatible with the website: the mark is
  a note about your save, not part of a team plan, so it doesn't travel in a share code.

## [1.1.0] — 2026-08-11

### Added

- **The Quick Access panel is now a team overview.** Opening the plugin from the Decky menu
  lists every evolution line with its name, how many stages it has, whether it's locked, and
  its sprites — so the team is readable without leaving the game.

### Changed

- **Opening a line from the overview lands on the line.** Pressing A on a line in the panel
  still jumps to the builder, but focus now starts on that line's first Digimon in the detail
  panel on the right instead of on the team list, so the d-pad carries on from where you were
  pointing. Opening the builder with *Open Team Builder* still starts in the team list.

## [1.0.1] — 2026-08-11

### Fixed

- **Sidebar buttons now move by position.** Pressing left from *Clear* went to *Add line* at
  the top of the other column instead of *Share* beside it; each column now keeps its vertical
  position when focus enters from the side.
- **Moving between the two panels.** D-pad right from a line's ⋮ now enters the evolution line,
  and left from the first Digimon in the line goes back to the team list. Steam's spatial
  search doesn't cross between the panels on its own — each is its own scroll container — so
  the elements on those boundaries now say explicitly where focus should go.
- **Focus highlight no longer clipped** at the top of the evolution line panel. A box with
  `overflow-x` also clips vertically, so the padding has to clear the focus ring on every side.
- **Digimon details modal opens at the top.** The remove action was the only focusable element,
  so Steam focused it on mount and scrolled the modal past its own header; the action now sits
  beside the Digimon's name instead of at the foot of the modal.

## [1.0.0] — 2026-08-11

First release. A gamepad-native Steam Deck port of diegogliarte's
[Digimon Story: Time Stranger team builder](https://tools.diegogliarte.com/digimon/story-time-stranger/team-builder).

### Added

- **Full-screen builder** at `/digimon-time-stranger-team-builder`: the team list on the
  left, the selected evolution line laid out horizontally on the right.
- **Quick Access panel** with a read-only team summary, *Random Team* and *Share*, sized for
  the ~310 px column over a running game.
- **Evolution line editing** — change which branch a line takes at any point, extend it
  backwards to a pre-evolution, and remove or cut it from a Digimon's detail modal.
- **Digimon details** — Lv 1 and Lv 99 base stats, evolution requirements (Agent Rank, stats,
  items, Jogress partners), and devolves-from / evolves-into neighbours.
- **Random teams** — six full lines from In-Training I upward with no Digimon reused; locked
  lines survive a reroll.
- **Share codes** in the same format the web tool uses, so teams move between the Deck and
  the website in either direction, including pasting a full `?team=…` link.
- **Offline dataset** — 475 Digimon and their sprites ship inside the plugin, served from
  decky-loader's asset route rather than inlined into the JS bundle.
- Team persistence through the Python backend, written atomically and debounced.
- `scripts/prepare-data.mjs` to regenerate assets from the upstream repo, and
  `scripts/package.py` to build an installable zip without a container.
