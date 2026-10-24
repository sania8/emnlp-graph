"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";

/**
 * Before/after wipe comparison. Driven by pointer drag and by a native range
 * input so it stays fully keyboard- and screen-reader-operable.
 */
export function CompareSlider({
  before,
  after,
  beforeLabel = "Source tile",
  afterLabel = "Model prediction",
  caption,
}: {
  before: string;
  after: string;
  beforeLabel?: string;
  afterLabel?: string;
  caption?: string;
}) {
  const [position, setPosition] = useState(50);
  const frameRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  const setFromClientX = useCallback((clientX: number) => {
    const rect = frameRef.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, pct)));
  }, []);

  return (
    <figure>
      <div
        ref={frameRef}
        className="relative aspect-square w-full touch-none select-none overflow-hidden rounded-xl border border-edge bg-surface"
        onPointerDown={(e) => {
          draggingRef.current = true;
          e.currentTarget.setPointerCapture(e.pointerId);
          setFromClientX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (draggingRef.current) setFromClientX(e.clientX);
        }}
        onPointerUp={() => {
          draggingRef.current = false;
        }}
        onPointerCancel={() => {
          draggingRef.current = false;
        }}
      >
        <Image
          src={after}
          alt={afterLabel}
          fill
          sizes="(max-width: 768px) 100vw, 50vw"
          className="object-cover"
        />

        <div
          className="absolute inset-0"
          style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
        >
          <Image
            src={before}
            alt={beforeLabel}
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            className="object-cover"
          />
        </div>

        {/* Handle */}
        <div
          className="pointer-events-none absolute inset-y-0 w-px bg-accent"
          style={{ left: `${position}%` }}
        >
          <div className="absolute top-1/2 left-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-accent/60 bg-surface backdrop-blur">
            <span aria-hidden className="font-mono text-xs text-accent">
              ↔
            </span>
          </div>
        </div>

        <span className="pointer-events-none absolute left-3 top-3 rounded bg-surface px-2 py-1 font-mono text-[0.96rem] uppercase tracking-wider text-foreground">
          {beforeLabel}
        </span>
        <span className="pointer-events-none absolute right-3 top-3 rounded bg-surface px-2 py-1 font-mono text-[0.96rem] uppercase tracking-wider text-accent">
          {afterLabel}
        </span>
      </div>

      <label className="mt-4 block">
        <span className="font-mono text-[1.02rem] uppercase tracking-wider text-muted">
          Comparison position
        </span>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={Math.round(position)}
          onChange={(e) => setPosition(Number(e.target.value))}
          aria-label={`Reveal ${beforeLabel} versus ${afterLabel}`}
          className="mt-2 w-full accent-[var(--accent)]"
        />
      </label>

      {caption ? (
        <figcaption className="mt-3 text-xs leading-relaxed text-muted">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
