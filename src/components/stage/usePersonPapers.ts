"use client";
import { useEffect, useState } from "react";

// Loads public/data/person-papers.json once (built by pipeline/build_person_papers.py).
// If the file is missing the hook returns {} and the site simply shows no papers.
export type PaperRef = { id: string; t: string; track: string; url: string };
export type PapersByPerson = Record<string, PaperRef[]>;

let cache: Promise<PapersByPerson> | null = null;

export function usePersonPapers(): PapersByPerson {
  const [data, setData] = useState<PapersByPerson>({});
  useEffect(() => {
    let live = true;
    if (!cache) {
      cache = fetch("/data/person-papers.json")
        .then((r) => (r.ok ? r.json() : {}))
        .catch(() => ({}));
    }
    cache.then((d) => live && setData(d));
    return () => {
      live = false;
    };
  }, []);
  return data;
}
