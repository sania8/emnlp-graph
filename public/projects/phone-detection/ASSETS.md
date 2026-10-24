# Mobile Phone Usage Detection — asset inventory

## Source

One genuine asset was supplied:

```
portfolio/mobile-phone/Adobe Express - output_videonew.gif   (744 MB)
```

It is a screen capture of the working detector running over surveillance
footage, with live bounding boxes drawn on frame.

## Processing

A 744 MB GIF cannot be served to a browser. It was transcoded with ffmpeg:

```
ffmpeg -i "mobile-phone/Adobe Express - output_videonew.gif" \
  -vf "fps=20,crop=in_w:in_h*0.93:0:in_h*0.026,scale=1000:-2:flags=lanczos" \
  -c:v libx264 -crf 25 -preset slow -pix_fmt yuv420p -movflags +faststart -an \
  public/projects/phone-detection/detection-output.mp4
```

The crop removes the black bars introduced by the screen recorder. No frames
were retimed, reordered, masked or otherwise edited.

## Checklist

| Asset | Status | Path | Used by |
|-------|--------|------|---------|
| Recorded detector output | **Present (real)** | `detection-output.mp4` (~4.4 MB) | "Recorded output" section |
| Poster frame | **Present (real)** | `poster.webp` | Video poster, hero backdrop |
| Thumbnail | **Present (real)** | `thumbnail.webp` | Landing page card |
| Pipeline walkthrough frame | **Original illustration** | `src/components/phone/DetectionScene.tsx` | Interactive simulation |
| Baseline (YOLOv8) output clip | **Missing** | — | Would make the before/after concrete |
| MediaPipe landmark capture | **Missing** | — | Currently illustrated schematically |
| Evaluation plots / confusion matrix | **Missing** | — | Not displayed |

## Known gaps and honesty notes

- The interactive walkthrough is an **original SVG schematic**, drawn to explain
  the pipeline. It is labelled as such on the page and is not derived from real
  footage.
- The score bar in the decision-logic stage is schematic. Only the **0.60
  threshold** is an actual configured value.
- The **~75%** (pre-trained YOLOv8 baseline) and **~90%** (final system)
  accuracy figures are as reported for the project. No dataset, split or
  per-class breakdown is published, and the page says so.
- If a baseline clip or evaluation plots become available, they slot into the
  "Recorded output" and "On numbers" sections respectively.

## Housekeeping

The 744 MB source GIF lives in `portfolio/mobile-phone/` and should **not** be
committed. Add it to `.gitignore` or move it outside the repository.
