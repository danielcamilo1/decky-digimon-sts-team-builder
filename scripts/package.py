#!/usr/bin/env python3
"""
Packages the built plugin into an installable Decky zip.

This reproduces exactly what `decky plugin build` produces, without the container:
the official CLI only needs Docker to compile native backends and vendor py_modules,
and this plugin has neither — main.py is plain stdlib Python and the frontend is
already built by rollup.

Layout (matching SteamDeckHomebrew/cli src/cli/plugin/build.rs):

    <Plugin Name>.zip
      └── <Plugin Name>/
            dist/...          (mandatory)
            bin/...           (optional)
            py_modules/...    (optional)
            <defaults/* contents, flattened to the plugin root>
            LICENSE  main.py  package.json  plugin.json  README.md  *.py

Usage:  python3 scripts/package.py [--out out]
"""
import argparse
import json
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

# Directories copied wholesale, as (path, mandatory).
DIRECTORIES = [("dist", True), ("bin", False), ("py_modules", False)]

# Files copied from the plugin root if present.
EXPECTED_FILES = ["LICENSE", "main.py", "package.json", "plugin.json", "README.md"]


def iter_files(directory: Path):
    for path in sorted(directory.rglob("*")):
        if path.is_file():
            yield path


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="out", help="output directory (default: out)")
    args = parser.parse_args()

    manifest = json.loads((ROOT / "plugin.json").read_text(encoding="utf-8"))
    name = manifest["name"]

    dist = ROOT / "dist"
    if not (dist / "index.js").exists():
        print("dist/index.js is missing — run `pnpm build` first.", file=sys.stderr)
        return 1

    out_dir = ROOT / args.out
    out_dir.mkdir(parents=True, exist_ok=True)
    zip_path = out_dir / f"{name}.zip"

    count = 0
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as zf:
        for dirname, mandatory in DIRECTORIES:
            source = ROOT / dirname
            if not source.is_dir():
                if mandatory:
                    print(f"Required directory {dirname}/ is missing.", file=sys.stderr)
                    return 1
                continue
            for path in iter_files(source):
                zf.write(path, Path(name) / path.relative_to(ROOT))
                count += 1

        # defaults/ is special-cased by the CLI: its *contents* land in the plugin root.
        defaults = ROOT / "defaults"
        if defaults.is_dir():
            for path in iter_files(defaults):
                zf.write(path, Path(name) / path.relative_to(defaults))
                count += 1

        root_files = list(EXPECTED_FILES)
        root_files += [p.name for p in sorted(ROOT.glob("*.py")) if p.name not in root_files]
        for filename in root_files:
            path = ROOT / filename
            if not path.is_file():
                print(f"  note: {filename} not present, skipping")
                continue
            zf.write(path, Path(name) / filename)
            count += 1

    size = zip_path.stat().st_size
    print(f"{zip_path.relative_to(ROOT)}  —  {count} files, {size / 1024 / 1024:.1f} MB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
