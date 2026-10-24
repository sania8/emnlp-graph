"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";

export type GroupItem = {
  href: string;
  kind: "Research" | "Thesis" | "Applied";
  venue: string;
  title: string;
  line: string;
  short: string; // short name shown as a chip on the closed tile
  thumbnail?: string;
};

export type Group = {
  id: string;
  title: string;
  sub: string;
  accent: "sky" | "emerald" | "fuchsia";
  items: GroupItem[];
};

const ACCENT = {
  sky: {
    dot: "bg-sky-400",
    border: "border-sky-400/60",
    glow: "shadow-[0_0_70px_-20px_rgba(56,189,248,0.55)]",
    tile: "bg-sky-500/10",
    inner: "bg-sky-500/15",
  },
  emerald: {
    dot: "bg-emerald-400",
    border: "border-emerald-400/60",
    glow: "shadow-[0_0_70px_-20px_rgba(52,211,153,0.55)]",
    tile: "bg-emerald-500/10",
    inner: "bg-emerald-500/15",
  },
  fuchsia: {
    dot: "bg-fuchsia-400",
    border: "border-fuchsia-400/60",
    glow: "shadow-[0_0_70px_-20px_rgba(232,121,249,0.55)]",
    tile: "bg-fuchsia-500/10",
    inner: "bg-fuchsia-500/15",
  },
} as const;

function Orbit({ n, dot }: { n: number; dot: string }) {
  return (
    <div
      aria-hidden
      className="relative hidden h-20 w-20 shrink-0 animate-spin motion-reduce:animate-none sm:block"
      style={{ animationDuration: "16s" }}
    >
      <span className="absolute inset-0 rounded-full border border-edge" />
      {Array.from({ length: n }).map((_, i) => (
        <span
          key={i}
          className={`absolute left-1/2 top-1/2 -ml-[5px] -mt-[5px] h-[10px] w-[10px] rounded-full ${dot}`}
          style={{ transform: `rotate(${(360 / n) * i}deg) translateY(-34px)` }}
        />
      ))}
    </div>
  );
}

export default function ProjectGroups({ groups }: { groups: Group[] }) {
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActive(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // row sizes animate between "all equal" and "one big, the rest slim"
  const rows =
    active === null
      ? groups.map(() => "1fr").join(" ")
      : groups.map((_, i) => (i === active ? "7fr" : "0.8fr")).join(" ");

  return (
    <div
      className="grid gap-4 lg:h-full lg:[grid-template-rows:var(--rows)] lg:transition-[grid-template-rows] lg:duration-700 lg:ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
      style={{ "--rows": rows } as React.CSSProperties}
    >
      {groups.map((g, i) => {
        const a = ACCENT[g.accent];
        const open = active === i;
        const compact = active !== null && !open;
        const n = g.items.length;
        const cols = n === 1 ? "grid-cols-1" : "grid-cols-1 sm:grid-cols-2";

        return (
          <section
            key={g.id}
            className={`relative flex min-h-0 flex-col overflow-hidden rounded-3xl border ${a.tile} transition-all duration-500 ${
              open ? `${a.border} ${a.glow}` : "border-edge hover:border-accent/40"
            }`}
          >
            <button
              aria-expanded={open}
              aria-controls={`grp-${g.id}`}
              onClick={() => setActive(open ? null : i)}
              className="flex w-full items-center justify-between gap-5 p-5 text-left lg:p-7"
            >
              <div className="min-w-0">
                {!compact && (
                  <p className="flex items-center gap-3 font-mono text-sm uppercase tracking-[0.2em] text-muted">
                    <span className={`h-3 w-3 rounded-full ${a.dot}`} />
                    {n} {n === 1 ? "project" : "projects"}
                  </p>
                )}
                <h2
                  className={`font-semibold leading-tight tracking-tight ${
                    compact
                      ? "truncate text-2xl"
                      : open
                        ? "mt-2 text-3xl xl:text-4xl"
                        : "mt-3 text-3xl xl:text-5xl"
                  }`}
                >
                  {g.title}
                </h2>
                {!compact && <p className="mt-2 text-xl text-muted">{g.sub}</p>}

                {!open && !compact && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {g.items.map((it) => (
                      <span
                        key={it.href}
                        className="rounded-full border border-edge px-4 py-1.5 font-mono text-sm uppercase tracking-wider text-muted"
                      >
                        {it.short}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-5">
                {!open && !compact && <Orbit n={n} dot={a.dot} />}
                <span
                  className={`grid h-12 w-12 place-items-center rounded-full border border-edge text-3xl transition-transform duration-500 ${
                    open ? "rotate-45 text-accent" : "text-muted"
                  }`}
                >
                  +
                </span>
              </div>
            </button>

            <div
              id={`grp-${g.id}`}
              aria-hidden={!open}
              className={`min-h-0 flex-1 px-5 pb-5 transition-opacity duration-500 lg:px-7 lg:pb-7 ${
                open ? "" : "max-lg:hidden lg:pointer-events-none lg:opacity-0"
              }`}
            >
              <div className={`grid h-full gap-4 ${cols}`}>
                {g.items.map((it, j) => (
                  <Link
                    key={it.href}
                    href={it.href}
                    tabIndex={open ? 0 : -1}
                    style={{ transitionDelay: open ? `${300 + j * 110}ms` : "0ms" }}
                    className={`group relative flex min-h-[10rem] flex-col justify-between overflow-hidden rounded-2xl border border-edge ${a.inner} p-6 transition-all duration-700 ...
                      open ? "translate-y-0 scale-100 opacity-100" : "translate-y-8 scale-90 opacity-0"
                    }`}
                  >
                    {it.thumbnail && (
                      <Image
                        src={it.thumbnail}
                        alt=""
                        aria-hidden
                        fill
                        sizes="(max-width: 1024px) 100vw, 35vw"
                        className="object-cover opacity-20 transition-all duration-700 group-hover:scale-105 group-hover:opacity-30"
                      />
                    )}
                    <div className="relative">
                      <p className="flex items-center gap-2.5 font-mono text-sm uppercase tracking-[0.18em] text-muted">
                        <span className={`h-2.5 w-2.5 rounded-full ${a.dot}`} />
                        {it.kind}
                      </p>
                      <h3 className="mt-3 text-2xl font-semibold leading-tight tracking-tight xl:text-3xl">
                        {it.title}
                      </h3>
                      <p className="mt-3 line-clamp-3 text-lg leading-snug text-muted">{it.line}</p>
                    </div>
                    <div className="relative mt-4 flex items-center justify-between gap-3">
                      <p className="truncate font-mono text-sm uppercase tracking-wider text-accent">
                        {it.venue}
                      </p>
                      <span className="shrink-0 text-2xl text-accent transition-transform duration-300 group-hover:translate-x-1.5">
                        →
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        );
      })}
    </div>
  );
}