"""
build_papers.py: every accepted EMNLP 2026 paper, from the ACL Anthology.

No web scraping. The Anthology publishes its metadata as XML in a public GitHub repo:
  https://github.com/acl-org/acl-anthology/tree/master/data/xml
This script downloads the two files that hold EMNLP 2026, parses them, and writes
one small JSON file per volume (loaded on demand by the site, never all at once).

Run from the project root:   python pipeline/build_papers.py
Needs only the Python standard library.
"""
import json
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET
from pathlib import Path

RAW = "https://raw.githubusercontent.com/acl-org/acl-anthology/master/data/xml/{}.xml"
ROOT = Path(__file__).resolve().parent
CACHE = ROOT / "cache"
OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT.parent / "public" / "data" / "papers"

# key, XML file, volume id in that file, id used in the Anthology URL, label shown on the site
VOLUMES = [
    ("main", "2026.emnlp", "main", "2026.emnlp-main", "Main conference"),
    ("findings", "2026.findings", "emnlp", "2026.findings-emnlp", "Findings"),
    ("industry", "2026.emnlp", "industry", "2026.emnlp-industry", "Industry Track"),
    ("demos", "2026.emnlp", "demos", "2026.emnlp-demos", "System Demonstrations"),
    ("tutorials", "2026.emnlp", "tutorials", "2026.emnlp-tutorials", "Tutorial Abstracts"),
]


def fetch(name: str) -> Path:
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / f"{name}.xml"
    # re-download if missing or older than 6 hours (papers are still being added)
    if not path.exists() or time.time() - path.stat().st_mtime > 6 * 3600:
        print(f"downloading {name}.xml ...")
        req = urllib.request.Request(RAW.format(name), headers={"User-Agent": "emnlp-graph-build/1.0"})
        with urllib.request.urlopen(req, timeout=120) as r:
            path.write_bytes(r.read())
    return path


def text(el) -> str:
    """Element text with inner tags (fixed-case, math, urls) flattened and whitespace tidied."""
    return " ".join("".join(el.itertext()).split()) if el is not None else ""


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    roots = {}
    summary = {"generated": time.strftime("%Y-%m-%d"), "source": "ACL Anthology", "volumes": [], "totals": {}}
    authors, affiliations, total = set(), set(), 0

    for key, xml_name, vol_id, anth_id, label in VOLUMES:
        if xml_name not in roots:
            roots[xml_name] = ET.parse(fetch(xml_name)).getroot()
        vol = next((v for v in roots[xml_name].findall("volume") if v.get("id") == vol_id), None)
        if vol is None:
            print(f"  ! volume {vol_id} not found in {xml_name}.xml, skipped")
            continue

        rows = []
        for p in vol.findall("paper"):
            pid = p.get("id")
            people = []
            for a in p.findall("author"):
                name = " ".join(f"{a.findtext('first') or ''} {a.findtext('last') or ''}".split())
                aff = text(a.find("affiliation"))
                people.append([name, a.get("id") or "", aff])
                authors.add(a.get("id") or name)
                if aff:
                    affiliations.add(aff)
            rows.append(
                {
                    "id": f"{anth_id}.{pid}",  # e.g. 2026.emnlp-main.1 -> https://aclanthology.org/<id>/
                    "t": text(p.find("title")),
                    "a": people,  # [name, anthology author id, affiliation]
                    "p": p.findtext("pages") or "",
                    "ab": text(p.find("abstract")),
                }
            )
        (OUT / f"{key}.json").write_text(json.dumps(rows, ensure_ascii=False, separators=(",", ":")), encoding="utf8")
        size = (OUT / f"{key}.json").stat().st_size / 1e6
        summary["volumes"].append({"key": key, "label": label, "papers": len(rows), "file": f"{key}.json"})
        total += len(rows)
        print(f"  {label:<24} {len(rows):>5} papers  {size:5.1f} MB")

    summary["totals"] = {"papers": total, "authors": len(authors), "affiliations": len(affiliations)}
    (OUT / "summary.json").write_text(json.dumps(summary, indent=2), encoding="utf8")
    print(f"done: {total} papers, {len(authors)} authors, {len(affiliations)} distinct affiliations -> {OUT}")


if __name__ == "__main__":
    main()