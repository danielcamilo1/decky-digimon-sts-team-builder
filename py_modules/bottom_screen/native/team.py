"""The dataset and the team's editing rules, as the Steam UI applies them in src/state/teamStore.ts.

Edits take the chain list and return a new one, or the same list when they don't apply,
so the caller can tell a no-op from a change.
"""

from __future__ import annotations

import json
import os

GENERATIONS = ["In-Training I", "In-Training II", "Rookie", "Champion", "Ultimate", "Mega", "Mega +", "Armor", "Hybrid"]
GENERATION_SHORT = {
    "In-Training I": "IT-I", "In-Training II": "IT-II", "Rookie": "ROOKIE", "Champion": "CHAMP", "Ultimate": "ULT",
    "Mega": "MEGA", "Mega +": "MEGA+", "Armor": "ARMOR", "Hybrid": "HYBRID",
}
STAT_KEYS = ["HP", "SP", "ATK", "DEF", "INT", "SPI", "SPD"]


class Dex:
    def __init__(self, entries: list):
        self.by_id = {d["id"]: d for d in entries}
        rank = {g: i for i, g in enumerate(GENERATIONS)}
        self.sorted = sorted(entries, key=lambda d: (rank.get(d.get("generation"), 99), d.get("name", "").lower()))

    @classmethod
    def load(cls, assets_dir: str) -> "Dex":
        with open(os.path.join(assets_dir, "data", "digimon.json"), encoding="utf-8") as handle:
            return cls(json.load(handle))

    def get(self, digimon_id):
        return self.by_id.get(digimon_id)

    def resolve(self, ids) -> list:
        return [self.by_id[i] for i in ids if i in self.by_id]

    def evolutions(self, digimon: dict) -> list:
        return self.resolve(digimon.get("evolutions") or [])

    def pre_evolutions(self, digimon: dict) -> list:
        return self.resolve(digimon.get("pre_evolutions") or [])

    def of_generation(self, generation: str | None) -> list:
        return [d for d in self.sorted if generation is None or d.get("generation") == generation]


def generation_short(generation: str) -> str:
    return GENERATION_SHORT.get(generation, (generation or "").upper())


def short_requirement(key: str) -> str:
    if key.endswith("(Agent Skills)"):
        return key[: -len("(Agent Skills)")].strip()
    if key == "Req. Item":
        return "Item"
    if key.startswith("Jogress Partner"):
        return key.replace("Jogress Partner #", "Partner ")
    return key


def normalize_chains(value) -> list | None:
    """The same reading of a saved team as src/data/share.ts, minus the legacy share formats."""
    if not isinstance(value, list):
        return None
    chains = []
    for entry in value:
        if not isinstance(entry, dict):
            return None
        ids = entry.get("ids")
        if not isinstance(ids, list) or not ids or not all(isinstance(i, int) and not isinstance(i, bool) for i in ids):
            return None
        chain = {"ids": list(ids), "locked": bool(entry.get("locked"))}
        current = entry.get("current")
        if isinstance(current, int) and current in ids:
            chain["current"] = current
        chains.append(chain)
    return chains


class Progress:
    """Where a line is: the marked stage, or its head when nothing's marked."""

    def __init__(self, chain: dict, dex: Dex):
        self.members = dex.resolve(chain["ids"])
        ids = [m["id"] for m in self.members]
        at = ids.index(chain["current"]) if chain.get("current") in ids else -1
        self.marked = at != -1
        self.index = max(0, at)
        self.current = self.members[self.index] if self.members else None
        self.next = self.members[self.index + 1] if self.index + 1 < len(self.members) else None


def random_team(dex: Dex, size: int, keep: list) -> list:
    """Full lines from random In-Training I Digimon, never reusing one; `keep` stays as it is.
    The same walk as randomTeam in src/data/digimon.ts."""
    import random

    used = {i for chain in keep for i in chain["ids"]}
    chains = list(keep)
    starters = [d for d in dex.sorted if d.get("generation") == "In-Training I"]
    while len(chains) < size:
        available = [d for d in starters if d["id"] not in used]
        if not available:
            break
        current = random.choice(available)
        ids = [current["id"]]
        used.add(current["id"])
        while True:
            candidates = [d for d in dex.evolutions(current) if d["id"] not in used]
            if not candidates:
                break
            current = random.choice(candidates)
            used.add(current["id"])
            ids.append(current["id"])
        chains.append({"ids": ids, "locked": False})
    return chains


def prepend_options(chain: dict, dex: Dex) -> list:
    head = dex.get(chain["ids"][0]) if chain["ids"] else None
    if head is None:
        return []
    return [d for d in dex.pre_evolutions(head) if d["id"] not in chain["ids"]]


# --- edits ----------------------------------------------------------------------------


def _with_ids(chain: dict, ids: list) -> dict:
    out = {**chain, "ids": ids}
    if out.get("current") is not None and out["current"] not in ids:
        out.pop("current")
    return out


def set_chain_ids(chains: list, index: int, ids: list) -> list:
    if not 0 <= index < len(chains):
        return chains
    if not ids:
        return remove_chain(chains, index)
    return [_with_ids(c, ids) if i == index else c for i, c in enumerate(chains)]


def add_chain(chains: list, digimon_id: int) -> list:
    return [*chains, {"ids": [digimon_id], "locked": False}]


def set_current(chains: list, index: int, digimon_id) -> list:
    """Marks the stage a line has reached, or clears the mark with None. Allowed on locked lines."""
    if not 0 <= index < len(chains):
        return chains
    chain = chains[index]
    if digimon_id is not None and digimon_id not in chain["ids"]:
        return chains
    if chain.get("current") == digimon_id:
        return chains
    updated = {k: v for k, v in chain.items() if k != "current"}
    if digimon_id is not None:
        updated["current"] = digimon_id
    return [updated if i == index else c for i, c in enumerate(chains)]


def prepend(chains: list, index: int, digimon_id: int) -> list:
    if not 0 <= index < len(chains):
        return chains
    chain = chains[index]
    if chain.get("locked") or digimon_id in chain["ids"]:
        return chains
    return set_chain_ids(chains, index, [digimon_id, *chain["ids"]])


def trim_at(chains: list, index: int, digimon_id: int) -> list:
    """Removing an end drops it; picking a member in the middle trims everything after it."""
    if not 0 <= index < len(chains):
        return chains
    chain = chains[index]
    if chain.get("locked") or digimon_id not in chain["ids"]:
        return chains
    ids = chain["ids"]
    position = ids.index(digimon_id)
    if position == 0:
        return set_chain_ids(chains, index, ids[1:])
    if position == len(ids) - 1:
        return set_chain_ids(chains, index, ids[:-1])
    return set_chain_ids(chains, index, ids[: position + 1])


def choose_branch(chains: list, index: int, position: int, digimon_id: int) -> list:
    """Replaces everything after `position` with `digimon_id`; from the last member it extends."""
    if not 0 <= index < len(chains):
        return chains
    chain = chains[index]
    if chain.get("locked") or not 0 <= position < len(chain["ids"]):
        return chains
    head = chain["ids"][: position + 1]
    # Re-entering a Digimon already earlier in the line would make a loop.
    if digimon_id in head:
        return chains
    return set_chain_ids(chains, index, [*head, digimon_id])


def toggle_lock(chains: list, index: int) -> list:
    if not 0 <= index < len(chains):
        return chains
    return [{**c, "locked": not c.get("locked")} if i == index else c for i, c in enumerate(chains)]


def remove_chain(chains: list, index: int) -> list:
    if not 0 <= index < len(chains):
        return chains
    return [c for i, c in enumerate(chains) if i != index]


def move(chains: list, index: int, delta: int) -> list:
    target = index + delta
    if not 0 <= index < len(chains) or not 0 <= target < len(chains):
        return chains
    out = list(chains)
    out[index], out[target] = out[target], out[index]
    return out
