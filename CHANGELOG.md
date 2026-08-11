# Changelog

All notable changes to this plugin are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this
project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
