#!/usr/bin/env python3
"""Turn transparent sticker artwork into die-cut sticker mockup assets.

For every PNG in the source folder (transparent background):
1. Adds a uniform white outline around the artwork's silhouette (thickness
   adjustable) - a no-op ring if the source already has one baked in.
2. Adds a soft drop shadow beneath the sticker.
3. Saves the single sticker as a clean transparent PNG (free-use asset -
   store, social, etc).
4. Also builds a "pile" version - 3-4 shifted/rotated copies stacked under
   the main sticker, on a solid colored background.

Usage:
  python scripts/make-sticker-mockups.py <source-folder> --file <one.png>   # single-file test
  python scripts/make-sticker-mockups.py <source-folder>                   # batch, all PNGs
"""

import argparse
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
DEST_DIR = ROOT / "src" / "images" / "uploads"

WHITE = (255, 255, 255, 255)
DEFAULT_OUTLINE_PX = 10
DEFAULT_SHADOW_BLUR = 18
DEFAULT_SHADOW_OPACITY = 110  # 0-255
DEFAULT_SHADOW_OFFSET = (0, 14)
DEFAULT_PILE_COUNT = 3
DEFAULT_PILE_BG = "#2B2C47"  # site's --line token, a dark blue-slate
PADDING = 60  # transparent margin so outline/shadow never get clipped


def add_white_outline(img: Image.Image, thickness: int) -> Image.Image:
    """Dilate the alpha silhouette and fill the new ring with white."""
    alpha = img.split()[3]
    dilated = alpha
    # MaxFilter kernel size must be odd; iterate to reach the requested
    # thickness in ~3px steps per pass without an oversized single kernel.
    step = 3
    remaining = thickness
    while remaining > 0:
        k = min(step, remaining) * 2 + 1
        dilated = dilated.filter(ImageFilter.MaxFilter(k))
        remaining -= step
    white_layer = Image.new("RGBA", img.size, WHITE)
    white_layer.putalpha(dilated)
    return Image.alpha_composite(white_layer, img)


def add_padding(img: Image.Image, padding: int) -> Image.Image:
    padded = Image.new("RGBA", (img.width + padding * 2, img.height + padding * 2), (0, 0, 0, 0))
    padded.paste(img, (padding, padding), img)
    return padded


def add_drop_shadow(img: Image.Image, blur: int, opacity: int, offset: tuple) -> Image.Image:
    alpha = img.split()[3]
    shadow_layer = Image.new("RGBA", img.size, (0, 0, 0, 0))
    black = Image.new("RGBA", img.size, (0, 0, 0, opacity))
    black.putalpha(Image.eval(alpha, lambda a: min(a, opacity)))
    shadow_layer.paste(black, offset, black)
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(blur))
    return Image.alpha_composite(shadow_layer, img)


def make_single_sticker(src_path: Path, outline_px: int, shadow_blur: int,
                         shadow_opacity: int, shadow_offset: tuple) -> Image.Image:
    with Image.open(src_path) as raw:
        img = raw.convert("RGBA")
    img = add_padding(img, PADDING)
    img = add_white_outline(img, outline_px)
    img = add_drop_shadow(img, shadow_blur, shadow_opacity, shadow_offset)
    return img


PILE_STEP_PX = 14  # translational offset per layer - a tight fanned-deck look, no rotation
PILE_LAYERS = 3     # back layers behind the top sticker


def make_pile(sticker_no_shadow: Image.Image, pile_count: int, bg_hex: str,
               shadow_blur: int, shadow_opacity: int) -> Image.Image:
    """Compose a colored-background canvas with a tight fanned stack: each
    back layer is the identical shape, only translated a few px down-left,
    no rotation - reads as a deck of stickers, not scattered duplicates.
    A single soft shadow sits under the whole stack rather than one shadow
    per layer (which reads as a harsh ring between stickers)."""
    margin = 100
    canvas_size = (sticker_no_shadow.width + margin * 2, sticker_no_shadow.height + margin * 2)
    bg_rgb = tuple(int(bg_hex.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4))
    canvas = Image.new("RGBA", canvas_size, bg_rgb + (255,))

    center = (canvas_size[0] // 2, canvas_size[1] // 2)
    base_pos = (center[0] - sticker_no_shadow.width // 2, center[1] - sticker_no_shadow.height // 2)

    # One shadow, cast from the bottom-most (most offset) layer's silhouette,
    # so the whole stack reads as a single object sitting on the surface.
    bottom_offset = pile_count * PILE_STEP_PX
    shadow_source_pos = (base_pos[0] + bottom_offset, base_pos[1] + bottom_offset)
    alpha = sticker_no_shadow.split()[3]
    shadow_layer = Image.new("RGBA", canvas_size, (0, 0, 0, 0))
    black = Image.new("RGBA", sticker_no_shadow.size, (0, 0, 0, shadow_opacity))
    black.putalpha(Image.eval(alpha, lambda a: min(a, shadow_opacity)))
    shadow_layer.paste(black, (shadow_source_pos[0], shadow_source_pos[1] + 10), black)
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(shadow_blur))
    canvas = Image.alpha_composite(canvas, shadow_layer)

    # Back layers, plain white-bordered artwork (no per-layer shadow), each
    # shifted the same small step so the edges peek out evenly.
    for i in range(pile_count, 0, -1):
        offset = i * PILE_STEP_PX
        pos = (base_pos[0] + offset, base_pos[1] + offset)
        canvas.alpha_composite(sticker_no_shadow, pos)

    # Top sticker, upright, no shadow of its own (the shared stack shadow covers it).
    canvas.alpha_composite(sticker_no_shadow, base_pos)

    return canvas.convert("RGB")


def make_combo(sticker_no_shadow: Image.Image, pile: Image.Image, bg_hex: str,
               shadow_blur: int, shadow_opacity: int) -> Image.Image:
    """Side-by-side reference layout: pile on the image-left, single sticker
    on the image-right (matches the reference screenshot), both on the same
    background."""
    bg_rgb = tuple(int(bg_hex.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4))
    pad = 80
    cell_w = pile.width
    cell_h = pile.height
    gap = int(cell_w * 0.18)
    canvas = Image.new("RGBA", (cell_w * 2 + pad * 2 + gap, cell_h + pad * 2), bg_rgb + (255,))

    pile_pos = (pad, pad)
    canvas.alpha_composite(pile.convert("RGBA"), pile_pos)

    single = add_drop_shadow(sticker_no_shadow, shadow_blur, shadow_opacity, DEFAULT_SHADOW_OFFSET)
    single_pos = (pad + cell_w + gap + (cell_w - single.width) // 2, pad + (cell_h - single.height) // 2)
    canvas.alpha_composite(single, single_pos)

    return canvas.convert("RGB")


def process_one(src_path: Path, dest_dir: Path, outline_px: int, shadow_blur: int,
                 shadow_opacity: int, shadow_offset: tuple, pile_count: int, pile_bg: str):
    dest_dir.mkdir(parents=True, exist_ok=True)
    base = src_path.stem

    # 1. Bordered artwork with no shadow yet - reused for both outputs.
    with Image.open(src_path) as raw:
        img = raw.convert("RGBA")
    img = add_padding(img, PADDING)
    bordered = add_white_outline(img, outline_px)

    # 2/3. Single clean sticker asset (bordered + shadow, transparent PNG).
    single = add_drop_shadow(bordered, shadow_blur, shadow_opacity, shadow_offset)
    single_path = dest_dir / f"{base}-sticker.png"
    single.save(single_path, "PNG")

    # 4. Pile version on a solid background.
    pile = make_pile(bordered, pile_count, pile_bg, shadow_blur, shadow_opacity)
    pile_path = dest_dir / f"{base}-pile.png"
    pile.save(pile_path, "PNG")

    # 5. Side-by-side reference layout: single on the right, pile on the left.
    combo = make_combo(bordered, pile, pile_bg, shadow_blur, shadow_opacity)
    combo_path = dest_dir / f"{base}-combo.png"
    combo.save(combo_path, "PNG")

    return single_path, pile_path, combo_path


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", help="Folder containing the transparent sticker PNGs")
    parser.add_argument("--file", help="Process only this one filename (test run)")
    parser.add_argument("--outline-px", type=int, default=DEFAULT_OUTLINE_PX)
    parser.add_argument("--shadow-blur", type=int, default=DEFAULT_SHADOW_BLUR)
    parser.add_argument("--shadow-opacity", type=int, default=DEFAULT_SHADOW_OPACITY)
    parser.add_argument("--pile-count", type=int, default=DEFAULT_PILE_COUNT)
    parser.add_argument("--pile-bg", default=DEFAULT_PILE_BG, help="Hex color, e.g. #F4F1EA")
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
        candidates = sorted(src_dir.glob("*.png"))
        if not candidates:
            print("No PNG files found in this folder.")
            return

    for src_path in candidates:
        single_path, pile_path, combo_path = process_one(
            src_path, DEST_DIR, args.outline_px, args.shadow_blur,
            args.shadow_opacity, DEFAULT_SHADOW_OFFSET, args.pile_count, args.pile_bg
        )
        print(f"{src_path.name}")
        print(f"  -> {single_path.relative_to(ROOT)}")
        print(f"  -> {pile_path.relative_to(ROOT)}")
        print(f"  -> {combo_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
