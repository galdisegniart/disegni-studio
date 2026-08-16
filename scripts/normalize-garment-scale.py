#!/usr/bin/env python3
"""Crop white-background garment mockups tightly around the garment itself,
on all four sides independently (no forced square canvas), so each photo
shows the garment as large as its own shape allows. The site displays these
inside a CSS square box with object-fit:contain, so a tight natural-aspect
crop - not a padded square source - is what actually makes a narrow garment
(e.g. a sleeveless tank) fill the frame as much as a wide one (e.g. an
oversized tee).

For each file: finds the bounding box of non-white content and crops to it
plus a small uniform margin. Overwrites the file in place.

Usage:
  python scripts/normalize-garment-scale.py <file1.webp> [file2.webp ...]
"""

import sys
from pathlib import Path

from PIL import Image

WHITE_THRESHOLD = 245
MARGIN_RATIO = 0.03  # margin added on each side, as a fraction of content size


def find_content_bbox(img: Image.Image):
    gray = img.convert("L")
    mask = gray.point(lambda p: 255 if p < WHITE_THRESHOLD else 0)
    return mask.getbbox()


def normalize(path: Path):
    with Image.open(path) as raw:
        img = raw.convert("RGB")

    bbox = find_content_bbox(img)
    if not bbox:
        print(f"  {path.name}: no content found, skipping")
        return

    left, top, right, bottom = bbox
    content_w = right - left
    content_h = bottom - top
    margin_x = int(content_w * MARGIN_RATIO)
    margin_y = int(content_h * MARGIN_RATIO)

    crop_box = (
        max(0, left - margin_x),
        max(0, top - margin_y),
        min(img.width, right + margin_x),
        min(img.height, bottom + margin_y),
    )
    cropped = img.crop(crop_box)
    cropped.save(path, "WEBP", quality=92)

    before_pct = round(content_w / img.width * 100, 1)
    after_pct = round(content_w / cropped.width * 100, 1)
    print(
        f"  {path.name}: {img.width}x{img.height} ({before_pct}% fill) "
        f"-> {cropped.width}x{cropped.height} ({after_pct}% fill)"
    )


def main():
    if len(sys.argv) < 2:
        print("Usage: python scripts/normalize-garment-scale.py <file1.webp> [file2.webp ...]")
        sys.exit(1)

    for arg in sys.argv[1:]:
        path = Path(arg)
        if not path.exists():
            print(f"Not found: {path}", file=sys.stderr)
            continue
        normalize(path)


if __name__ == "__main__":
    main()
