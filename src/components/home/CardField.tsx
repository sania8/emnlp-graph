"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

export type FieldCard = {
  href: string;
  kind: "Research" | "Thesis" | "Applied";
  venue: string;
  title: string;
  line: string;
  tags: string[];
  themes: string[];
  thumbnail?: string;
  x: number; // centre of the card, % of canvas width
  y: number; // centre of the card, % of canvas height
  big?: boolean;
};

const KIND_STYLE: Record<FieldCard["kind"], { dot: string; glow: string }> = {
  Research: { dot: "bg-sky-400", glow: "hover:shadow-[0_0_60px_-12px_rgba(56,189,248,0.5)]" },
  Thesis: { dot: "bg-fuchsia-400", glow: "hover:shadow-[0_0_60px_-12px_rgba(232,121,249,0.5)]" },
  Applied: { dot: "bg-emerald-400", glow: "hover:shadow-[0_0_60px_-12px_rgba(52,211,153,0.5)]" },
};

function CardBody({ c, className = "" }: { c: FieldCard; className?: string }) {
  const k = KIND_STYLE[c.kind];
  return (
    <Link
      href={c.href}
      className={`group relative flex h-full flex-col justify-between overflow-hidden rounded-3xl border border-edge bg-surface p-7 transition-all duration-500 hover:border-accent/50 ${k.glow} ${className}`}
    >
      {c.thumbnail && (
        <Image
          src={c.thumbnail}
          alt=""
          aria-hidden
          fill
          sizes="(max-width: 1280px) 100vw, 30vw"
          className="object-cover opacity-20 transition-all duration-700 group-hover:scale-105 group-hover:opacity-30"
        />
      )}
      <div className="relative">
        <p className="flex items-center gap-3 font-mono text-sm uppercase tracking-[0.2em] text-muted">
          <span className={`h-3 w-3 rounded-full ${k.dot}`} />
          {c.kind}
        </p>
        <h3
          className={`mt-4 font-semibold leading-[1.1] tracking-tight ${
            c.big ? "text-4xl" : "text-3xl"
          }`}
        >
          {c.title}
        </h3>
        <p className="mt-3 text-lg leading-snug text-muted">{c.line}</p>
      </div>
      <div className="relative mt-5">
        <p className="font-mono text-sm uppercase tracking-wider text-accent">{c.venue}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {c.tags.map((t) => (
            <span
              key={t}
              className="rounded-full border border-edge px-3 py-1 font-mono text-xs uppercase tracking-wider text-muted"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

export default function CardField({ items }: { items: FieldCard[] }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [go, setGo] = useState(false); // burst outward
  const [settled, setSettled] = useState(false); // start drifting
  const [hover, setHover] = useState<string | null>(null);

  // start the burst when the canvas scrolls into view
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setGo(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!go) return;
    const t = setTimeout(() => setSettled(true), 2600);
    return () => clearTimeout(t);
  }, [go]);

  // cards that share a theme are linked
  const links = useMemo(() => {
    const out: { a: FieldCard; b: FieldCard }[] = [];
    for (let i = 0; i < items.length; i++)
      for (let j = i + 1; j < items.length; j++)
        if (items[i].themes.some((t) => items[j].themes.includes(t)))
          out.push({ a: items[i], b: items[j] });
    return out;
  }, [items]);

  const connected = (id: string) =>
    hover === null ||
    hover === id ||
    links.some((l) => (l.a.href === hover && l.b.href === id) || (l.b.href === hover && l.a.href === id));

  return (
    <>
      <style>{`
        @keyframes kg-float {
          from { transform: translateY(-9px); }
          to { transform: translateY(9px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .kg-float { animation: none !important; }
        }
      `}</style>

      {/* wide screens: scattered simulation canvas */}
      <div ref={wrap} className="relative hidden h-[1600px] xl:block">
        <svg className="absolute inset-0 h-full w-full" aria-hidden>
          {links.map(({ a, b }) => {
            const hot = hover !== null && (a.href === hover || b.href === hover);
            return (
              <line
                key={a.href + b.href}
                x1={`${a.x}%`}
                y1={`${a.y}%`}
                x2={`${b.x}%`}
                y2={`${b.y}%`}
                stroke="currentColor"
                className={hot ? "text-accent" : "text-muted"}
                strokeWidth={hot ? 2 : 1}
                strokeDasharray={hot ? "10 6" : undefined}
                style={{
                  opacity: !go ? 0 : hot ? 0.9 : hover ? 0.05 : 0.18,
                  transition: `opacity 0.5s ${settled ? 0 : 1200}ms`,
                }}
              />
            );
          })}
        </svg>

        {items.map((c, i) => {
          const d = i * 110;
          const ease = "cubic-bezier(0.34, 1.45, 0.64, 1)";
          return (
            <div
              key={c.href}
              onMouseEnter={() => setHover(c.href)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(c.href)}
              onBlur={() => setHover(null)}
              className="absolute"
              style={{
                left: go ? `${c.x}%` : "50%",
                top: go ? `${c.y}%` : "50%",
                width: c.big ? "clamp(400px, 32vw, 600px)" : "clamp(340px, 28vw, 520px)",
                transform: `translate(-50%, -50%) scale(${go ? (hover === c.href ? 1.05 : 1) : 0.2})`,
                opacity: !go ? 0 : connected(c.href) ? 1 : 0.3,
                zIndex: hover === c.href ? 30 : 10,
                transition: `left 1.5s ${ease} ${d}ms, top 1.5s ${ease} ${d}ms, transform ${
                  settled ? "0.35s" : `1.5s ${ease} ${d}ms`
                }, opacity ${settled ? "0.35s" : `0.5s ${d}ms`}`,
              }}
            >
              <div
                className="kg-float"
                style={
                  settled
                    ? { animation: `kg-float ${6 + (i % 3) * 1.5}s ease-in-out ${i * 0.4}s infinite alternate` }
                    : undefined
                }
              >
                <CardBody c={c} className="min-h-[21rem]" />
              </div>
            </div>
          );
        })}
      </div>

      {/* smaller screens: simple grid */}
      <div className="grid gap-5 md:grid-cols-2 xl:hidden">
        {items.map((c) => (
          <CardBody key={c.href} c={c} className="min-h-[20rem]" />
        ))}
      </div>
    </>
  );
}