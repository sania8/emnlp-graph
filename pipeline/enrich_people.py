import json, re, unicodedata
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GRAPH = ROOT / "public/data/conference-graph.json"
PAPERS = ROOT / "public/data/papers"
OUT = ROOT / "public/data/person-papers.json"

TRACKS = {
    "main": "Main conference",
    "findings": "Findings",
    "industry": "Industry Track",
    "demos": "System Demonstrations",
    "tutorials": "Tutorial Abstracts",
}

STOP = {"of", "the", "and", "university", "institute", "for", "de", "des", "und", "research", "college", "school"}


def strip_accents(s):
    s = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in s if not unicodedata.combining(c))


def norm(s):
    s = strip_accents(s).lower()
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def words(s):
    return {w for w in norm(s).split() if w not in STOP and len(w) > 2}


def same_place(a, b):
    """True if two affiliation strings share at least one meaningful word."""
    wa, wb = words(a), words(b)
    if not wa or not wb:
        return True  # nothing to compare, so don't reject
    return bool(wa & wb) or norm(a) in norm(b) or norm(b) in norm(a)


g = json.load(open(GRAPH, encoding="utf-8"))
people = [n["data"] for n in g["elements"]["nodes"] if n["data"].get("type") == "Person"]
by_name = defaultdict(list)
for p in people:
    by_name[norm(p["label"])].append(p)

# names that belong to several different places in the papers data (e.g. "Wei Xu") are risky:
# for them a paper only counts when its affiliation matches the person's
places = defaultdict(list)
for key in TRACKS:
    for paper in json.load(open(PAPERS / f"{key}.json", encoding="utf-8")):
        for name, _slug, aff in paper["a"]:
            if not aff or not aff.strip():
                continue
            lst = places[norm(name)]
            if not any(same_place(aff, x) for x in lst):
                lst.append(aff)
risky = {n for n, lst in places.items() if len(lst) > 1}

result = defaultdict(list)
dropped = defaultdict(int)
no_aff = [p["label"] for p in people if not (p.get("affiliation") or "").strip()]

for key, label in TRACKS.items():
    for paper in json.load(open(PAPERS / f"{key}.json", encoding="utf-8")):
        for name, _slug, aff in paper["a"]:
            for p in by_name.get(norm(name), []):
                mine = (p.get("affiliation") or "").strip()
                if not mine:
                    continue  # no affiliation to check against: attach nothing rather than guess
                if aff and aff.strip():
                    if not same_place(mine, aff):
                        dropped[p["label"]] += 1  # probably a different person with the same name
                        continue
                elif norm(name) in risky:
                    dropped[p["label"]] += 1  # blank affiliation on a common name: can't verify
                    continue
                result[p["id"]].append(
                    {
                        "id": paper["id"],
                        "t": paper["t"],
                        "track": label,
                        "url": f"https://aclanthology.org/{paper['id']}/",
                    }
                )

json.dump(result, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))

total = sum(len(v) for v in result.values())
print(f"people with papers: {len(result)} of {len(people)}")
print(f"paper links written: {total}")
print(f"file size: {OUT.stat().st_size / 1024:.0f} KB")
print("\n-- people with the most papers --")
for pid, v in sorted(result.items(), key=lambda kv: -len(kv[1]))[:10]:
    name = next(p["label"] for p in people if p["id"] == pid)
    print(f"  {name}: {len(v)}")
print("\n-- papers skipped as likely a different person with the same name --")
for n, c in sorted(dropped.items(), key=lambda kv: -kv[1]):
    print(f"  {n}: {c}")
print(f"\n-- no affiliation in the graph, so no papers attached ({len(no_aff)}) --")
for n in no_aff:
    print(f"  {n}")
print(f"\nwrote {OUT}")