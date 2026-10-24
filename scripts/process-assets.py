"""
Process genuine DroneDest project outputs into web-optimised assets for the
portfolio case study.

Source (read-only):  C:\\Users\\HP\\Downloads\\DroneDest-010\\DroneDest
Destination:         public/projects/geospatial-ai

What it does
------------
1. "Inference Images/<class>_debug/sample_*.png" are 3-panel matplotlib figures
   (Image | GT | Prediction). We detect the three axes by scanning for
   non-white columns and export each panel separately, plus the full figure.
2. "overlaid samples/tile_*_overlay.png" are full-resolution tile overlays used
   for the tiling / stitching animation.
3. "overlaid samples/image (6).png" is the stitched full-scene class map.

Nothing is invented: every output is a crop or resize of a real project file.
Run with:  python scripts/process-assets.py
"""

from __future__ import annotations

import json
import re
import shutil
from pathlib import Path

import numpy as np
from PIL import Image

SRC = Path(r"C:\Users\HP\Downloads\DroneDest-010\DroneDest")
DEST = Path(__file__).resolve().parent.parent / "public" / "projects" / "geospatial-ai"

# Feature classes keyed by their source folder name.
CLASS_FOLDERS = {
    "bridge_debug": ("bridge", "Bridge"),
    "cadastral_debug": ("cadastral", "Cadastral boundary"),
    "railline_debug": ("rail-line", "Rail line"),
    "road_debug": ("road", "Road"),
    "sewline_debug_2": ("sewer-line", "Sewer line"),
    "ulu_debug_1": ("ulu", "ULU"),
    "waterline_debug": ("water-line", "Water line"),
    "water_point_debug": ("water-point", "Water point"),
    "water_poly_debug": ("water-polygon", "Water polygon"),
}

SAMPLES_PER_CLASS = 3
PANEL_SIZE = 640
TILE_SIZE = 768
STITCHED_SIZE = 1600


def split_panels(path: Path) -> list[tuple[int, int, int, int]]:
    """Return the bounding boxes of the three image axes in a 3-panel figure."""
    arr = np.asarray(Image.open(path).convert("L"))
    # Content = anything meaningfully darker than the white figure background.
    content = arr < 245

    col_has = content.any(axis=0)
    row_has = content.any(axis=1)

    # Group contiguous True runs of columns; the three widest runs are the axes.
    runs: list[tuple[int, int]] = []
    start = None
    for i, flag in enumerate(col_has):
        if flag and start is None:
            start = i
        elif not flag and start is not None:
            runs.append((start, i))
            start = None
    if start is not None:
        runs.append((start, len(col_has)))

    runs.sort(key=lambda r: r[1] - r[0], reverse=True)
    axes = sorted(runs[:3])
    if len(axes) != 3:
        raise ValueError(f"expected 3 panels in {path.name}, found {len(runs)}")

    rows = np.flatnonzero(row_has)
    # Drop the title text band at the top: use the tallest contiguous row run.
    row_runs: list[tuple[int, int]] = []
    start = None
    for i, flag in enumerate(row_has):
        if flag and start is None:
            start = i
        elif not flag and start is not None:
            row_runs.append((start, i))
            start = None
    if start is not None:
        row_runs.append((start, len(row_has)))
    if row_runs:
        top, bottom = max(row_runs, key=lambda r: r[1] - r[0])
    else:
        top, bottom = int(rows[0]), int(rows[-1]) + 1

    return [(x0, top, x1, bottom) for x0, x1 in axes]


def save_webp(img: Image.Image, out: Path, size: int, quality: int = 82) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    img = img.convert("RGB")
    if max(img.size) > size:
        scale = size / max(img.size)
        img = img.resize(
            (round(img.width * scale), round(img.height * scale)), Image.LANCZOS
        )
    img.save(out, "WEBP", quality=quality, method=6)


def extract_mask(panel: Image.Image, channel: str) -> Image.Image:
    """Lift the coloured overlay out of a GT/prediction panel as an alpha layer.

    The source figures draw the mask as a saturated tint over a washed-out copy
    of the tile: blue for predictions, red for ground truth. Measuring how far
    a pixel leans towards that channel separates the two populations cleanly
    (the distribution is strongly bimodal, with almost nothing between 0.03 and
    0.10). The geometry returned here is therefore the project's own mask, just
    re-expressed as transparency so the site can recolour it.
    """
    arr = np.asarray(panel.convert("RGB")).astype(np.float32) / 255.0
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    lean = b - (r + g) / 2 if channel == "blue" else r - (g + b) / 2

    alpha = np.clip((lean - 0.04) / 0.04, 0.0, 1.0)
    rgba = np.zeros((*alpha.shape, 4), dtype=np.uint8)
    rgba[..., :3] = 255
    rgba[..., 3] = (alpha * 255).astype(np.uint8)
    return Image.fromarray(rgba, "RGBA")


def save_mask(img: Image.Image, out: Path, size: int) -> None:
    out.parent.mkdir(parents=True, exist_ok=True)
    if max(img.size) > size:
        scale = size / max(img.size)
        img = img.resize(
            (round(img.width * scale), round(img.height * scale)), Image.LANCZOS
        )
    img.save(out, "WEBP", quality=88, method=6, lossless=False)


def natural_key(p: Path) -> tuple:
    return tuple(int(t) if t.isdigit() else t for t in re.split(r"(\d+)", p.name))


def main() -> None:
    if DEST.exists():
        shutil.rmtree(DEST)
    DEST.mkdir(parents=True)

    manifest: dict[str, object] = {}

    # --- 1. Per-class inference panels -------------------------------------
    classes = []
    for folder, (slug, label) in CLASS_FOLDERS.items():
        src_dir = SRC / "Inference Images" / folder
        if not src_dir.is_dir():
            print(f"skip missing {src_dir}")
            continue

        files = sorted(src_dir.glob("sample_*.png"), key=natural_key)
        step = max(1, len(files) // SAMPLES_PER_CLASS)
        chosen = files[::step][:SAMPLES_PER_CLASS]

        samples = []
        for i, f in enumerate(chosen):
            try:
                boxes = split_panels(f)
            except ValueError as exc:
                print(f"  ! {exc}")
                continue
            full = Image.open(f)
            names = ("image", "ground-truth", "prediction")
            entry = {"source": f.name}
            panels = {}
            for box, name in zip(boxes, names):
                panel = full.crop(box)
                panels[name] = panel
                rel = f"inference/{slug}/sample-{i + 1}-{name}.webp"
                save_webp(panel, DEST / rel, PANEL_SIZE)
                entry[name] = f"/projects/geospatial-ai/{rel}"

            # Alpha-only versions of the masks so the site can recolour them.
            for name, channel, key in (
                ("prediction", "blue", "prediction-mask"),
                ("ground-truth", "red", "ground-truth-mask"),
            ):
                rel = f"inference/{slug}/sample-{i + 1}-{key}.webp"
                save_mask(extract_mask(panels[name], channel), DEST / rel, PANEL_SIZE)
                entry[key] = f"/projects/geospatial-ai/{rel}"

            samples.append(entry)

        if samples:
            classes.append({"slug": slug, "label": label, "samples": samples})
            print(f"{slug}: {len(samples)} samples")

    manifest["classes"] = classes

    # --- 2. Tile overlays ---------------------------------------------------
    tiles = []
    tile_dir = SRC / "overlaid samples"
    for f in sorted(tile_dir.glob("tile_*_overlay.png"), key=natural_key):
        rel = f"tiles/{f.stem}.webp"
        save_webp(Image.open(f), DEST / rel, TILE_SIZE)
        tiles.append(
            {"id": f.stem, "src": f"/projects/geospatial-ai/{rel}", "source": f.name}
        )
    manifest["tiles"] = tiles
    print(f"tiles: {len(tiles)}")

    # --- 3. Stitched scene --------------------------------------------------
    stitched_src = tile_dir / "image (6).png"
    if stitched_src.exists():
        img = Image.open(stitched_src)
        save_webp(img, DEST / "stitched-output.webp", STITCHED_SIZE)
        save_webp(img, DEST / "hero.webp", 1920, quality=78)
        save_webp(img, DEST / "thumbnail.webp", 640)
        manifest["stitched"] = {
            "src": "/projects/geospatial-ai/stitched-output.webp",
            "source": stitched_src.name,
            "width": img.width,
            "height": img.height,
        }
        print(f"stitched: {img.width}x{img.height}")

    (DEST / "manifest.json").write_text(json.dumps(manifest, indent=2), "utf-8")
    print(f"\nwrote {DEST / 'manifest.json'}")


if __name__ == "__main__":
    main()
