"use client";
import { useEffect, useRef, useState } from "react";

export default function HorizontalTrack({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // turn the vertical mouse wheel into sideways movement
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
      e.preventDefault();
      el.scrollLeft += e.deltaY;
    };
    const onScroll = () => {
      const max = el.scrollWidth - el.clientWidth;
      setProgress(max > 0 ? el.scrollLeft / max : 0);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("scroll", onScroll);
    };
  }, []);

  const by = (dir: 1 | -1) =>
    ref.current?.scrollBy({ left: dir * ref.current.clientWidth * 0.6, behavior: "smooth" });

  const arrow =
    "grid h-16 w-16 place-items-center rounded-full border border-edge bg-surface text-3xl text-muted shadow-md transition-colors hover:border-accent/60 hover:text-accent";

  return (
    <div className="relative">
      <div
        ref={ref}
        className="flex snap-x snap-proximity gap-6 overflow-x-auto scroll-smooth px-4 pb-6 [scrollbar-width:none] sm:px-8 [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>

      <div className="mt-2 flex items-center gap-6 px-4 sm:px-8">
        <button aria-label="Scroll left" onClick={() => by(-1)} className={arrow}>
          ←
        </button>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-edge">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-150"
            style={{ width: `${Math.max(6, progress * 100)}%` }}
          />
        </div>
        <button aria-label="Scroll right" onClick={() => by(1)} className={arrow}>
          →
        </button>
      </div>
    </div>
  );
}