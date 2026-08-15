#!/usr/bin/env python3
"""Convert Printful mockup PNGs into site-ready WebP images.

For every PNG in the source folder whose filename contains "front" or
"back" (case-insensitive) - skipping "left"/"right"/anything else -
this flattens any transparency onto a solid white background, converts
to high-quality WebP, and writes it into src/images/uploads/ under the
same base filename (extension swapped to .webp).

Usage:
  python scripts/convert-mockups.py <source-folder> --file <one-filename.png>   # single-file test
  python scripts/convert-mockups.py <source-folder>                            # batch, all matching files
"""

import argparse
import sys
from pathlib import Path

from PIL import Image

WHITE = (255, 255, 255)
WEBP_QUALITY = 92
KEEP_KEYWORDS = ("front", "back")
SKIP_KEYWORDS = ("left", "right")

ROOT = Path(__file__).resolve().parent.parent
DEST_DIR = ROOT / "src" / "images" / "uploads"


def should_keep(filename: str) -> bool:
    lower = filename.lower()
    if any(skip in lower for skip in SKIP_KEYWORDS):
        return False
    return any(keep in lower for keep in KEEP_KEYWORDS)


def convert_one(src_path: Path, dest_dir: Path) -> Path:
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest_path = dest_dir / (src_path.stem + ".webp")

    with Image.open(src_path) as img:
        img = img.convert("RGBA")
        flattened = Image.new("RGB", img.size, WHITE)
        flattened.paste(img, mask=img.split()[3])
        flattened.save(dest_path, "WEBP", quality=WEBP_QUALITY)

    return dest_path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", help="Folder containing the mockup PNGs")
    parser.add_argument("--file", help="Convert only this one filename (test run)")
    args = parser.parse_args()

    src_dir = Path(args.source)
    if not src_dir.is_dir():
        print(f"Not a folder: {src_dir}", file=sys.stderr)
        sys.exit(1)

    if args.file:
        candidates = [src_dir / args.file]
        if not candidates[0].exists():
            print(f"File not found: {candidates[0]}", file=sys.stderr)
            sys.exit(1)
    else:
        candidates = sorted(
            p for p in src_dir.glob("*.png") if should_keep(p.name)
        )
        if not candidates:
            print("No front/back PNG files found in this folder.")
            return

    for src_path in candidates:
        dest_path = convert_one(src_path, DEST_DIR)
        before_kb = src_path.stat().st_size / 1024
        after_kb = dest_path.stat().st_size / 1024
        print(f"{src_path.name}  ->  {dest_path.relative_to(ROOT)}  ({before_kb:.0f}KB -> {after_kb:.0f}KB)")


if __name__ == "__main__":
    main()
