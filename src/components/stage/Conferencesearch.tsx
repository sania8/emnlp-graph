"use client";
import { useEffect, useMemo, useRef, useState } from "react";

export type SearchItem = {
  id: string;
  kind: "area" | "talk" | "person" | "topic" | "paper";
  label: string;
  sub?: string;
  areaId?: string;
  talkId?: string;
  personId?: string;
  keywords?: string;
  children?: SearchItem[]; // topics expand into their talks
};

const KIND_RANK = { area: 0, topic: 1, talk: 2, person: 3, paper: 4 } as const;
const KIND_LABEL = { area: "Area", topic: "Topic", talk: "Talk", person: "Person", paper: "Paper" } as const;

// Every typed word must match the label (full weight) or the keywords (low weight).
function score(it: SearchItem, toks: string[]): number {
  const hay = it.label.toLowerCase();
  const kw = (it.keywords ?? "").toLowerCase();
  let sc = 0;
  for (const t of toks) {
    if (hay.startsWith(t)) sc += 3;
    else if (hay.includes(" " + t)) sc += 2.5;
    else if (hay.includes(t)) sc += 2;
    else if (kw.includes(t)) sc += 1;
    else return 0;
  }
  return sc;
}

export default function ConferenceSearch({ items, onPick }: { items: SearchItem[]; onPick: (it: SearchItem) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [act, setAct] = useState(0);
  const [topic, setTopic] = useState<SearchItem | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const inRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    if (topic) return topic.children ?? [];
    const toks = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!toks.length) return items.filter((i) => i.kind === "area" || i.kind === "topic");
    return items
      .map((i) => ({ i, s: score(i, toks) }))
      .filter((x) => x.s > 0)
      .sort((a, b) => b.s - a.s || KIND_RANK[a.i.kind] - KIND_RANK[b.i.kind])
      .slice(0, 60)
      .map((x) => x.i);
  }, [items, q, topic]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-i="${act}"]`)?.scrollIntoView({ block: "nearest" });
  }, [act]);

  const reset = () => {
    setQ("");
    setAct(0);
    setTopic(null);
    setOpen(false);
    inRef.current?.blur();
  };
  const choose = (it: SearchItem) => {
    if (it.kind === "topic" && it.children?.length) {
      setTopic(it); // drill into the topic's talks
      setAct(0);
      return;
    }
    onPick(it);
    reset();
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      if (topic) setTopic(null);
      else if (q) setQ("");
      else reset();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setAct((a) => Math.min(a + 1, rows.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAct((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && rows[act]) {
      e.preventDefault();
      choose(rows[act]);
    }
  };

  return (
    <div ref={boxRef} className="relative w-[640px] max-w-full shrink-0">
      {/* search bar: bigger bar and bigger buttons/icons, text size unchanged (text-base) */}
      <div
        className="flex min-h-[72px] items-center gap-4 rounded-full px-7 ring-1 ring-black/10 transition-shadow focus-within:ring-2 focus-within:ring-accent"
        style={{ background: "rgba(120,120,128,0.16)" }}
      >
        <svg width="36" height="36" viewBox="0 0 22 22" aria-hidden="true" className="shrink-0 text-muted">
          <circle cx="9.5" cy="9.5" r="6.5" fill="none" stroke="currentColor" strokeWidth="2.2" />
          <path d="m14.5 14.5 5 5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
        <input
          ref={inRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setTopic(null);
            setAct(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder="Search areas, talks, people, papers"
          aria-label="Search the conference graph"
          role="combobox"
          aria-expanded={open}
          className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted"
        />
        {q ? (
          <button
            onClick={() => {
              setQ("");
              setTopic(null);
              inRef.current?.focus();
            }}
            aria-label="Clear search"
            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-black/10 text-muted hover:bg-black/20"
          >
            <svg width="20" height="20" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M2 2l8 8M10 2 2 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        ) : (
          <svg width="28" height="28" viewBox="0 0 20 20" aria-hidden="true" className="shrink-0 text-muted">
            <path d="m4 7 6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>

      {open && (
        <div
          ref={listRef}
          className="absolute right-0 top-full z-50 mt-2 max-h-[70vh] w-[max(100%,960px)] max-w-[94vw] overflow-y-auto rounded-3xl bg-surface p-2 shadow-[0_24px_60px_-18px_rgba(0,0,0,0.35)] ring-1 ring-black/10"
          role="listbox"
        >
          {topic ? (
            <button
              onClick={() => setTopic(null)}
              className="flex w-full items-center gap-2 px-4 pb-1 pt-3 text-left text-base font-semibold uppercase tracking-wider text-accent"
            >
              ‹ {topic.label} · {rows.length}
            </button>
          ) : (
            <p className="px-4 pb-1 pt-3 text-base font-semibold uppercase tracking-wider text-muted">
              {q ? "Results" : "Areas & topics"} · {rows.length}
            </p>
          )}
          {rows.length === 0 && <p className="px-4 py-4 text-xl text-muted">No match. Try another word.</p>}
          {rows.map((it, idx) => (
            <button
              key={it.id}
              data-i={idx}
              role="option"
              aria-selected={idx === act}
              onMouseEnter={() => setAct(idx)}
              onClick={() => choose(it)}
              className={`flex w-full items-start justify-between gap-4 rounded-2xl px-4 py-2.5 text-left transition-colors ${idx === act ? "bg-accent/12" : ""}`}
            >
              <span className="flex min-w-0 flex-1 items-start gap-3">
                <span className="mt-0.5 shrink-0 rounded-full bg-black/5 px-2.5 py-0.5 text-base font-medium text-muted">{KIND_LABEL[it.kind]}</span>
                <span className="min-w-0 break-words text-xl font-semibold text-foreground">{it.label}</span>
              </span>
              {it.sub && <span className="mt-0.5 max-w-[42%] shrink-0 break-words text-right text-base text-muted">{it.sub}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}