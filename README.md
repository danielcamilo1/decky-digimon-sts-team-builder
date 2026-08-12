# Decky Digimon Story Time Stranger Team Builder

A [Decky Loader](https://github.com/SteamDeckHomebrew/decky-loader) plugin for planning
*Digimon Story: Time Stranger* evolution lines on the Steam Deck, without alt-tabbing to a
browser mid-game.

It's a gamepad-native port of the
[team builder](https://tools.diegogliarte.com/digimon/story-time-stranger/team-builder)
from [diegogliarte/tools](https://github.com/diegogliarte/tools).

[![Support me on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/danielcamilo)

## What it does

- **Build evolution lines.** Lay a line out left-to-right and change which branch it takes at
  any point, or extend it backwards to the Digimon it hatches from.
- **See the requirements.** Every Digimon shows the Agent Rank, stat, item or Jogress
  conditions needed to evolve into it, plus its base personality and Lv 99 base stats.
- **Track where you are.** Mark the stage each line has actually reached, and the Quick
  Access panel's *Next up* view turns the team into a to-do list: the evolution every line
  is working towards, exactly what it needs, and the base personality it arrives with.
- **Random teams.** Roll six full lines from In-Training I upward, never reusing a Digimon.
  Lock the lines you like and reroll the rest.
- **Share codes.** Export and import teams in the *same format the website uses*, so a team
  moves between your Deck and the browser tool in either direction — paste a
  `?team=…` link straight in.
- **Offline.** The dataset and all 475 sprites ship inside the plugin; nothing is fetched
  from the network at runtime.

## The two surfaces

Decky gives a plugin two very different amounts of room, so the plugin uses both:

| Surface | What lives there |
| --- | --- |
| **Quick Access panel** (~310 px wide, over a running game) | Two switchable views: *Lines*, an overview of your team — every line with its name, stage count, lock state and sprites — and *Next up*, the evolution each line is working towards with its requirements and base personality. Plus *Random Team* and *Share*. Picking a line opens it in the builder, with focus already on that line. |
| **Full-screen page** (`/digimon-time-stranger-team-builder`) | The actual builder: the team list on the left, the selected evolution line laid out horizontally on the right. |

The panel deliberately doesn't try to be an editor — there isn't room for an evolution graph
in a 310 px column, and you'd be fighting the layout with a thumbstick.

## Gamepad controls

Every control does one thing, and the evolution line reads left-to-right the way an
evolution does, so the d-pad moves along it without any mode switching.

| Input | Action |
| --- | --- |
| **A** on a line in the Quick Access panel | Open the builder with that line already focused |
| **Y** on a line in *Next up* | Mark the evolution it's working towards as reached |
| **D-pad up/down** in the team list | Move between evolution lines (the detail panel follows) |
| **A** on a line row | Open that line in the detail panel |
| **A** on the row's **⋮** | Line menu: move up/down, lock, remove |
| **A** on a Digimon tile | Open its details — stats, requirements, neighbours, and remove |
| **Y** on a Digimon tile | Mark it as the stage you're on (again to clear it) |
| **A** on **Change** / **Evolve** under a tile | Pick which evolution the line takes from there |
| **A** on the leading **+** | Add a pre-evolution to the front of the line |
| **Secondary button** on a line row | Toggle lock |
| **B** | Back / close |

Per-element actions publish their own labels, so Steam's own footer legend always shows the
correct glyph for the focused element.

Changing a branch part-way along a line replaces everything after that point — the picker
says so, and marks the branch currently taken.

## Install

### From a zip

1. Download the zip from the [latest release](https://github.com/danielcamilo1/decky-digimon-sts-team-builder/releases/latest) and copy it to the Deck.
2. In Game Mode, open the **Decky** menu (⋯ button) → gear icon → **Developer** →
   enable *Developer Mode* if it isn't already → **Install Plugin from File**, and pick the zip.

Or, from a terminal in Desktop Mode:

```bash
unzip decky-digimon-sts-team-builder-v*.zip -d ~/homebrew/plugins/
sudo systemctl restart plugin_loader
```

The plugin then appears in the Decky menu as **Team Builder**.

### Build it yourself

Requires Node 18+, pnpm, and Python 3. **No Docker needed** — the official CLI only uses a
container to compile native backends and vendor `py_modules`, and this plugin has neither
(`main.py` is plain stdlib Python).

```bash
git clone https://github.com/danielcamilo1/decky-digimon-sts-team-builder.git
cd decky-digimon-sts-team-builder

# 1. Fetch the upstream dataset and generate assets/ (only needed once, or to update data)
git clone --depth 1 https://github.com/diegogliarte/tools _ref-tools
pnpm prepare-data

# 2. Install deps
pnpm install

# 3. Build and package
pnpm package          # -> out/Digimon Time Stranger Team Builder.zip
```

`pnpm build` alone just produces `dist/`. `scripts/package.py` then zips it into the layout
Decky installs, reproducing what `decky plugin build` emits: one top-level folder named after
the plugin, containing `dist/`, `main.py`, `plugin.json`, `package.json`, `README.md` and
`LICENSE`, deflate-compressed. If you'd rather use the official tool, `decky plugin build .`
(from [SteamDeckHomebrew/cli](https://github.com/SteamDeckHomebrew/cli)) produces the same
thing.

For iterating on a Deck, `pnpm watch` plus rsyncing the plugin directory to
`~/homebrew/plugins/` and reloading from Decky's developer menu is the fastest loop.

## How it's put together

```
main.py                     backend: persists the team to Decky's settings dir
scripts/prepare-data.mjs    regenerates assets/ from the upstream repo
scripts/package.py          zips dist/ into an installable plugin (no container needed)
assets/
  data/digimon.json         trimmed dataset (475 entries, ~230 KB)
  digimon/<id>.webp         sprites
  attributes/*.png          attribute icons
src/
  data/       types, pure evolution-graph logic, share codes, asset URLs
  state/      team store (observable + debounced persistence), dex loader,
              panel → page hand-off, which panel view is showing
  components/ portrait, chain strip, detail panels
  pages/      full-screen route and the line editor
  panel/      Quick Access panel: the team overview and the "next up" rows
  modals/     add-Digimon browser, share/import
  ui/         theme tokens, focus CSS, inline SVG icons, primitives
```

A couple of decisions worth knowing about:

- **Sprites are served, not bundled.** decky-loader exposes `dist/assets/` at
  `http://127.0.0.1:1337/plugins/<name>/assets/…` and that route is exempt from its CSRF
  check, so plain `<img src>` works. Inlining 5.7 MB of sprites as data URIs would bloat the
  JS bundle that Steam parses at startup; this way the bundle stays ~60 KB and sprites load
  lazily.
- **The dataset is trimmed.** The possible-personality tables and skill lists are dropped
  during `prepare-data`, taking `digimon.json` from ~975 KB to ~230 KB. Each Digimon's single
  `base_personality` stays, which is what *Next up* shows.
- **`src/data/digimon.ts` has no Decky or browser imports.** The evolution-graph logic is
  pure so it can be run directly against `assets/data/digimon.json`.
- **Editing happens through modals, not side columns.** Tapping a tile opens that Digimon's
  full details; the control under it picks which branch the line takes from there. That keeps
  the line itself on one horizontal row instead of wrapping around option columns.
- **The panel and the page are separate React trees.** Decky mounts each surface on its
  own and the route takes no parameters, so opening a line from the overview leaves a
  short-lived note in `state/openIntent.ts` that the page reads on mount to decide where
  focus starts.
- **Trimming a middle Digimon keeps it** and cuts everything after, where the web tool drops
  it too. The remove action in the details modal spells out which it is.
- **Where you are in a line is stored as a Digimon id, not a position.** Prepending a
  pre-evolution shifts every position in the line but no ids, so the mark stays put; an edit
  that removes the marked Digimon drops the mark instead of silently moving it. It's also
  the one piece of state that isn't in a share code — a shared team is a plan, not a save,
  and leaving it out keeps codes identical to the ones the website emits.

## Thanks & attribution

This plugin exists because **[Diego Gliarte](https://github.com/diegogliarte)** built the
original team builder and made it genuinely great — the concept, the dataset and the sprites
all come from **[diegogliarte/tools](https://github.com/diegogliarte/tools)**
([tools.diegogliarte.com](https://tools.diegogliarte.com)). All I did was bring it to the
Steam Deck's controller. Please go star his repo and check out his other tools — he's the one
who did the hard part. 💙

The underlying Digimon data and icons come from
[Grindosaur](https://www.grindosaur.com/en/games/digimon-story-time-stranger). *Digimon Story:
Time Stranger*, and all Digimon names and artwork, are property of Bandai Namco Entertainment —
this is an unofficial fan tool with no affiliation. If any of the original authors would
prefer their work not be bundled here, open an issue and I'll take it out right away. The
plugin's own code is BSD-3-Clause; see [LICENSE](LICENSE).

## Support

This plugin is free, and it's staying free — no ads, no paywalls, nothing to unlock.

If you'd like to support someone, please make it
**[Diego](https://github.com/diegogliarte)** first. His team builder is the heart of this
thing; I just built a controller-friendly shell around it.

And if you've got some left over and this made your Deck a little nicer, a coffee is always
appreciated — but genuinely, no pressure. Enjoying it and telling a friend is more than
enough. ☕

[![Support me on Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/danielcamilo)

Built on the [Decky plugin template](https://github.com/SteamDeckHomebrew/decky-plugin-template).
