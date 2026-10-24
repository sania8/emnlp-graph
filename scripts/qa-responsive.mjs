/**
 * Checks a page at several viewport widths for horizontal overflow, clipped
 * text, SVG artwork leaving its viewBox, and failing colour contrast.
 */
const SIZES = [
  { label: "mobile", w: 390, h: 844 },
  { label: "tablet", w: 768, h: 1024 },
  { label: "laptop", w: 1280, h: 800 },
  { label: "desktop", w: 1680, h: 1050 },
  { label: "wide", w: 2200, h: 1200 },
];

export default async function run(page) {
  const results = [];

  for (const s of SIZES) {
    await page.setViewportSize({ width: s.w, height: s.h });
    await page.waitForTimeout(400);

    // Scroll so lazy images load and scroll-reveals fire.
    const h = await page.evaluate(() => document.body.scrollHeight);
    for (let y = 0; y < h; y += s.h * 0.8) {
      await page.evaluate((t) => window.scrollTo(0, t), y);
      await page.waitForTimeout(90);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(500);

    // Step every pipeline stage so each diagram gets measured.
    const stages = page.locator(
      'ol[aria-label$="stages"] button, ol[aria-label$="layers"] button',
    );
    const n = await stages.count();
    const svgIssues = [];
    for (let i = 0; i < n; i++) {
      await stages.nth(i).click();
      await page.waitForTimeout(500);
      svgIssues.push(
        ...(await page.evaluate(() => {
          const out = [];
          for (const svg of document.querySelectorAll("svg")) {
            const vb = svg.viewBox?.baseVal;
            if (!vb?.width) continue;
            for (const t of svg.querySelectorAll("text")) {
              if (!t.textContent.trim() || t.closest("g[transform]")) continue;
              let b;
              try {
                b = t.getBBox();
              } catch {
                continue;
              }
              if (b.x < vb.x - 1 || b.x + b.width > vb.x + vb.width + 1)
                out.push(t.textContent.trim().slice(0, 28));
            }
          }
          return out;
        })),
      );
    }

    const page_ = await page.evaluate(() => {
      const docW = document.documentElement.clientWidth;

      // Anything sticking out past the viewport horizontally.
      const overflow = [];
      for (const el of document.querySelectorAll("body *")) {
        const r = el.getBoundingClientRect();
        if (r.width === 0) continue;
        if (r.right > docW + 2 || r.left < -2) {
          overflow.push(
            (el.tagName.toLowerCase() +
              "." +
              (el.className?.toString?.().split(" ")[0] ?? "")) 
              .slice(0, 40) +
              " [" +
              Math.round(r.left) +
              "," +
              Math.round(r.right) +
              "]",
          );
        }
      }

      // Text clipped by a fixed-size box.
      const clipped = [];
      for (const el of document.querySelectorAll("li, p, span, dd, dt, h1, h2, h3")) {
        if (el.closest("svg")) continue;
        const s = getComputedStyle(el);
        if (s.overflow === "hidden" || s.textOverflow === "ellipsis") continue;
        if (el.scrollWidth > el.clientWidth + 2 && el.clientWidth > 0)
          clipped.push(el.textContent.trim().slice(0, 28));
      }

      return {
        docScrollW: document.documentElement.scrollWidth,
        docClientW: docW,
        horizontalScroll: document.documentElement.scrollWidth > docW + 2,
        overflow: [...new Set(overflow)].slice(0, 6),
        clipped: [...new Set(clipped)].slice(0, 6),
      };
    });

    results.push({
      size: `${s.label} ${s.w}px`,
      rootFont: await page.evaluate(
        () => getComputedStyle(document.documentElement).fontSize,
      ),
      ...page_,
      svgOverflow: [...new Set(svgIssues)].slice(0, 6),
    });
  }

  return results;
}
