#!/usr/bin/env python3
"""Refresh the EMNLP 2026 people knowledge graph (rdflib is the source of truth).

    python pipeline/build_kg.py                       # live official site
    python pipeline/build_kg.py --fixtures pipeline/fixtures --out /tmp/kg   # offline test

Official pages used (https://2026.emnlp.org/):
    program/            session grid            program/keynotes/   keynote speakers (photo, bio, abstract)
    program/industry/   industry keynotes+panel program/panel/      panelists (photo, bio)
    program/tutorials/  tutorial organisers     program/workshops/  workshops, rooms, announced invited speakers
    organization/       committees (photo, homepage, affiliation)
    optional Google Sheet (CSV export) with the detailed paper-level programme, if it is public.

Only what the pages state is stored. Missing photos, affiliations and LinkedIn links stay blank;
LinkedIn is taken only from links on official pages.
"""
from __future__ import annotations

import argparse, collections, csv, datetime as dt, difflib, io, json, pathlib, re, sys, unicodedata, urllib.parse, urllib.request
from html.parser import HTMLParser
from rdflib import Graph, Literal, Namespace, RDF, RDFS, XSD

ROOT = pathlib.Path(__file__).resolve().parent.parent
HERE = pathlib.Path(__file__).resolve().parent
NK = Namespace("https://kg.local/conference#")
CONF = dict(
    name="EMNLP 2026", year=2026, venue="Budapest, Hungary", dates="24–29 October 2026", base="https://2026.emnlp.org/",
    pages=dict(overview="program/", keynotes="program/keynotes/", industry="program/industry/", panel="program/panel/",
               tutorials="program/tutorials/", workshops="program/workshops/", org="organization/"),
    sheet_csv="https://docs.google.com/spreadsheets/d/1aXGTy_7Xeh-OXIs3iJSbDpUsZ6YhbfA76b17kBZH0Yk/export?format=csv&gid=943432490",
)
LINKEDIN = re.compile(r"https?://(?:[a-z]{2,3}\.)?linkedin\.com/(?:in|pub)/[^\s\"'<>)\]]+", re.I)
WD = {"Saturday": 24, "Sunday": 25, "Monday": 26, "Tuesday": 27, "Wednesday": 28, "Thursday": 29}
DT = re.compile(r"(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day,?\s+October,?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})")
DAYH = re.compile(r"\w+day,?\s+October\s+(\d{1,2})")
SKIP = re.compile(r"registration|break|lunch|virtual presentation|social event|welcome reception", re.I)
NAME = re.compile(r"^[A-Z][\w'’.-]+(?: [A-Z][\w'’.-]+){1,3}$")
VOCAB = {k: re.compile(v, re.I) for k, v in {
    "LLMs": r"\b(llms?|large language models?|language models?)\b", "Agents": r"\bagent", "Multilingual NLP": r"multilingual|cross-lingual|languages\b",
    "Interpretability": r"interpretab|explainab|causal|mechanistic", "Speech & audio": r"\b(speech|audio|spoken)\b",
    "Multimodal": r"multimodal|vision|sign language|face-to-face", "Reasoning & math": r"reasoning|mathemat|formal", "Alignment & safety": r"alignment|safety|harms?\b|bias|trustworth",
    "Evaluation": r"evaluat|benchmark", "Legal & finance": r"\b(legal|financ)", "Knowledge bases": r"knowledge base|knowledge graph|\bakbc\b",
    "Tokenization": r"tokeniz", "Cognition & brain": r"cognitiv|brain|human language|acquisition", "Machine translation": r"machine translation|\bwmt\b",
    "Documents & web data": r"document|web[- ]as[- ]corpus|corpora|corpus", "Social good & climate": r"climate|positive impact|sustainable|social good",
    "Uncertainty": r"uncertaint", "Low-resource languages": r"low-resource|under-?resourced|less-resourced", "Open research": r"open research|open publishing|open-source",
}.items()}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", re.sub(r"[^a-z0-9 ]", " ", s)).strip()


def slug(s: str) -> str:
    return norm(s).replace(" ", "-")[:48] or "x"


def mins(hhmm: str) -> int:
    h, m = hhmm.split(":")
    return int(h) * 60 + int(m)


def iso(day: str, hhmm: str) -> str:
    h, m = hhmm.split(":")
    return f"{day}T{int(h):02d}:{m}:00"


def sentences(s: str, n: int = 2, cap: int = 300) -> str:
    return " ".join(re.split(r"(?<=[.!?])\s+", re.sub(r"\s+", " ", s or "").strip())[:n])[:cap]


def get(url: str) -> str | None:
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "portfolio-kg/1.0"})
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.read().decode("utf-8", "replace")
    except Exception as e:  # noqa: BLE001
        print(f"[warn] {url}: {e}", file=sys.stderr)
        return None


# ---------------------------------------------------------------- HTML -> ordered blocks
def clean(t: str) -> str:
    return "\n".join(l for l in (re.sub(r"[ \t\xa0]+", " ", x).strip() for x in t.split("\n")) if l)


class Blocks(HTMLParser):
    """Ordered tokens after the page <h1>: headings, <p>/<li> text (+links), images and tables."""

    HEAD = {"h1", "h2", "h3", "h4"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.tokens, self.started, self.cur, self.table, self.row, self.cell = [], False, None, None, None, None

    def _target(self):
        return self.cell if self.cell is not None else self.cur

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if (tag in self.HEAD or tag in ("p", "li")) and self.table is None:
            self.cur = {"kind": tag, "text": "", "links": []}
        elif tag == "table":
            self.table = []
        elif tag == "tr" and self.table is not None:
            self.row = []
        elif tag in ("td", "th") and self.row is not None:
            self.cell = {"text": "", "links": []}
        elif tag == "img" and self.started and a.get("src"):
            self.tokens.append({"kind": "img", "alt": (a.get("alt") or "").strip(), "src": a["src"]})
        elif tag == "a" and a.get("href") and self._target() is not None:
            self._target()["links"].append(a["href"])
        elif tag == "br" and self._target() is not None:
            self._target()["text"] += "\n"

    def handle_endtag(self, tag):
        if tag in self.HEAD | {"p", "li"} and self.cur and self.cur["kind"] == tag:
            self.cur["text"] = clean(self.cur["text"])
            if tag == "h1":
                self.started = True
            if self.cur["text"] and self.started:
                self.tokens.append(self.cur)
            self.cur = None
        elif tag in ("td", "th") and self.cell is not None:
            self.row.append(self.cell); self.cell = None
        elif tag == "tr" and self.row is not None:
            self.table.append([clean(c["text"]).replace("\n", " ") for c in self.row]); self.row = None
        elif tag == "table" and self.table is not None:
            if self.started:
                self.tokens.append({"kind": "table", "rows": self.table})
            self.table = None

    def handle_data(self, d):
        if self._target() is not None:
            self._target()["text"] += d


def tokenize(html: str) -> list[dict]:
    b = Blocks(); b.feed(html)
    return b.tokens


def groups(toks, kind):
    out, cur = [], None
    for t in toks:
        if t["kind"] == kind:
            cur = dict(head=t["text"].replace("\n", " "), links=t["links"], toks=[]); out.append(cur)
        elif cur is not None and not (t["kind"] in ("h1", "h2", "h3") and t["kind"] <= kind):
            cur["toks"].append(t)
        elif cur is not None:
            cur = None
    return out


LABELS = {"organizers": "organizer", "organizer": "organizer", "speaker bio": "bio", "bio": "bio", "room": "room", "time": "time",
          "description": "description", "title": "title", "abstract": "abstract", "topic": "topic", "moderator": "moderator",
          "participants": "participants", "context": "context", "contact": "contact"}
LABEL_RX = re.compile(r"^(" + "|".join(sorted(LABELS, key=len, reverse=True)) + r")\s*:\s*(.*)$", re.I)


def fields(toks) -> dict:
    out, last = {}, None
    for t in toks:
        if t["kind"] != "p":
            continue
        for line in t["text"].split("\n"):
            m = LABEL_RX.match(line)
            if m:
                last = LABELS[m.group(1).lower()]; out[last] = m.group(2)
            elif last:
                out[last] = (out[last] + " " + line).strip()
    return out


def split_names(s: str) -> list[str]:
    return [n.strip(" .") for n in re.split(r",\s*|\s+and\s+|;\s*", s) if NAME.match(n.strip(" ."))]


def photo_url(page: str, src: str) -> str:
    if "default." in src.rsplit("/", 1)[-1].lower():
        return ""  # site placeholder, not a real photo
    return urllib.parse.quote(urllib.parse.urljoin(page, src), safe=":/%")


# ---------------------------------------------------------------- identity resolution
class People:
    def __init__(self):
        self.by_name, self.all = collections.defaultdict(list), []

    def resolve(self, raw: dict):
        name, affil = raw["fullname"], (raw.get("institution") or "").strip()
        p = None
        cands = self.by_name[norm(name)]
        for c in cands:  # same name merges only if affiliations agree, or when it is the only candidate
            if affil and c["affiliation"]:
                if difflib.SequenceMatcher(None, norm(affil), norm(c["affiliation"])).ratio() >= 0.8:
                    p = c; break
            elif len(cands) == 1:
                p = c; break
        if p is None:
            pid = f"person-{slug(name)}" + (f"-{slug(affil)[:16]}" if cands else "")
            p = dict(id=pid, name=name, affiliation="", bio="", photo="", url="", linkedin="", talks=[], roles=[], insts=[], confidence=0.4)
            self.all.append(p); cands.append(p)
        for k, v in (("affiliation", affil), ("bio", raw.get("bio")), ("photo", raw.get("image_url")), ("url", raw.get("url"))):
            if v and not p[k]:
                p[k] = str(v).strip()
        if not p["linkedin"]:
            m = LINKEDIN.search(" ".join(str(raw.get(k) or "") for k in ("url", "linkedin")))
            p["linkedin"] = m.group(0) if m else ""
        return p


def confidence(p) -> float:
    if p["affiliation"] and (p["photo"] or p["url"]): return 0.9
    if p["affiliation"]: return 0.8
    return 0.5 if (p["photo"] or p["bio"]) else 0.4


# ---------------------------------------------------------------- model
class Model:
    def __init__(self, overrides: dict):
        self.P, self.roles, self.insts, self.topics, self.talks, self.sessions, self.rows = People(), {}, {}, {}, {}, {}, []
        self.ov = {norm(k): v for k, v in overrides.items() if not k.startswith("_")}

    def person(self, name, affil="", photo="", url="", bio=""):
        name = re.sub(r"\s+", " ", name or "").strip(" .,")
        if not name:
            return None
        ov = self.ov.get(norm(name), {})
        p = self.P.resolve(dict(fullname=name, institution=affil or ov.get("affiliation", ""), image_url=photo,
                                url=url or ov.get("url", ""), bio=bio, linkedin=ov.get("linkedin", "")))
        for i in [x.strip() for x in re.split(r"\s+and\s+", p["affiliation"]) if x.strip()]:
            i = re.sub(r"^the\s+", "", i, flags=re.I)
            iid = f"inst-{slug(i)}"
            self.insts.setdefault(iid, dict(id=iid, label=i))
            if iid not in p["insts"]:
                p["insts"].append(iid)
        return p

    def role(self, p, label):
        if p:
            rid = f"role-{slug(label)}"
            self.roles.setdefault(rid, dict(id=rid, label=label))
            if rid not in p["roles"]:
                p["roles"].append(rid)

    def session(self, sid, label, start="", end=""):
        self.sessions.setdefault(sid, dict(id=sid, label=label, start=start, end=end))
        return sid

    def topics_for(self, text):
        out = []
        for lab, rx in VOCAB.items():
            if rx.search(text):
                tid = f"topic-{slug(lab)}"
                self.topics.setdefault(tid, dict(id=tid, label=lab)); out.append(tid)
        return out[:5]

    def event(self, key, label, etype, people, abstract="", time="", room="", url="", sessions=()):
        tid = f"talk-{slug(key)}"
        if tid in self.talks:
            return tid
        self.talks[tid] = dict(id=tid, label=label, type=etype, summary=sentences(abstract), time=time, room=room, url=url,
                               sessions=[s for s in sessions if s], topics=self.topics_for(f"{label} {abstract}"),
                               people=[(p["id"], rel) for p, rel in people if p])
        for p, _ in people:
            if p:
                p["talks"].append(tid)
        return tid

    def match_session(self, day, start, text):
        toks = lambda s: {w for w in norm(s).split() if len(w) > 3 and not w.isdigit()}  # noqa: E731
        best, score = None, 1
        for r in self.rows:
            sc = len(toks(text) & toks(r["label"])) if r["day"] == day else 0
            if sc > score:
                best, score = r, sc
        if best:
            return best["id"]
        if start:
            t = mins(start)
            for r in self.rows:
                if r["day"] == day and r["s"] <= t < r["e"]:
                    return r["id"]
        return None


# ---------------------------------------------------------------- page parsers
def when(txt):
    m = DT.search(txt)
    if not m:
        return "", "", "", ""
    day = f"2026-10-{int(m.group(1)):02d}"
    return day, m.group(2), m.group(3), f"{day} {m.group(2)}–{m.group(3)}"


def parse_overview(m: Model, toks, page):
    day = None
    for t in toks:
        if t["kind"] == "h2":
            d = DAYH.search(t["text"]); day = f"2026-10-{int(d.group(1)):02d}" if d else None
        elif t["kind"] == "table" and day:
            for r in t["rows"][1:]:
                if len(r) < 3 or SKIP.search(r[2]) or re.fullmatch(r"Session \d+", r[2]) or not re.match(r"\d", r[0]):
                    continue
                sid = f"session-{day[-2:]}-{r[0].replace(':', '')}-{slug(r[2])[:24]}"
                m.session(sid, r[2], iso(day, r[0]), iso(day, r[1]))
                m.rows.append(dict(id=sid, day=day, label=r[2], s=mins(r[0]), e=mins(r[1])))


def parse_keynotes(m: Model, toks, page):
    for g in groups(toks, "h2"):
        mm = re.match(r"^((?:Industry )?Keynote \d+):\s*(.+)$", g["head"])
        if not mm:
            continue
        role, name = mm.groups()
        f = fields(g["toks"])
        img = next((t for t in g["toks"] if t["kind"] == "img"), None)
        ptxt = " ".join(t["text"] for t in g["toks"] if t["kind"] == "p")
        home = next((l for t in g["toks"] if t["kind"] == "p" for l in t["links"] if l.startswith("http") and "emnlp.org" not in l), "")
        p = m.person(name, photo=photo_url(page, img["src"]) if img else "", url=home, bio=f.get("bio", "")[:400])
        day, s, _, label = when(ptxt)
        title = f.get("title") or role
        m.event(f"{role}-{name}", title, "Industry keynote" if role.startswith("Industry") else "Keynote", [(p, "keynote")],
                f.get("abstract", ""), label, "", page, [m.match_session(day, s, f"{role} {name} {title}")])


def parse_panel(m: Model, toks, page):
    h2 = [t["text"] for t in toks if t["kind"] == "h2"]
    title = h2[0] if h2 else "Panel"
    day, s, _, label = when(" ".join(t["text"] for t in toks if t["kind"] == "p"))
    ppl = []
    for g in groups(toks, "h3"):
        img = next((t for t in g["toks"] if t["kind"] == "img"), None)
        ppl.append((m.person(g["head"], photo=photo_url(page, img["src"]) if img else "", bio=fields(g["toks"]).get("bio", "")[:400]), "panelist"))
    intro = next((t["text"] for t in toks if t["kind"] == "p" and len(t["text"]) > 120), "")
    m.event("panel-" + title, title, "Panel", ppl, intro, label, "", page, [m.match_session(day, s, f"Panel {title}")])


def parse_industry(m: Model, toks, page):
    parse_keynotes(m, toks, page)
    for g in groups(toks, "h2"):
        if not g["head"].startswith("Panel:"):
            continue
        f = fields(g["toks"])
        d = DAYH.search(g["head"]); day = f"2026-10-{int(d.group(1)):02d}" if d else ""
        tm = re.search(r"(\d{1,2}:\d{2})\s*[–-]\s*(\d{1,2}:\d{2})", g["head"])
        ppl = [(m.person(n), "moderator") for n in split_names(f.get("moderator", ""))]
        ppl += [(m.person(n), "panelist") for n in split_names(f.get("participants", ""))]
        label = f"{day} {tm.group(1)}–{tm.group(2)}" if tm and day else ""
        m.event("panel-" + f.get("topic", "industry"), f.get("topic", "Industry panel"), "Industry panel", ppl, f.get("context", ""), label, "", page,
                [m.match_session(day, tm.group(1) if tm else "", "Industry panel agents")])


def parse_tutorials(m: Model, toks, page):
    for blk in groups(toks, "h2"):
        mm = re.match(r"(Morning|Afternoon):\s*(.+)", blk["head"])
        if not mm:
            continue
        sid = m.session(f"session-tutorials-{mm.group(1).lower()}", f"Tutorials · {mm.group(1)} {mm.group(2)}",
                        iso("2026-10-28", mm.group(2).split("–")[0]), iso("2026-10-28", mm.group(2).split("–")[-1]))
        for g in groups(blk["toks"], "h3"):
            f = fields(g["toks"])
            ppl = [(m.person(n), "organizer") for n in split_names(f.get("organizer", ""))]
            m.event("tutorial-" + g["head"], g["head"], "Tutorial", ppl, f.get("description", ""), f"2026-10-28 {mm.group(2)}", f.get("room", ""), page, [sid])


def invited(desc: str):
    out = []
    for rx in (r"keynote address by ([^.]+?)\.", r"invited talks? by ([^.]+?)\."):
        for s in re.findall(rx, desc):
            s = re.split(r",\s+and\s+(?:is|are|will|the)\b", s)[0]
            for part in re.split(r"\s+and\s+|,\s*", re.sub(r"\([^)]*\)", lambda x: "§" + x.group(0)[1:-1].replace(",", "¦") + "§", s)):
                mm = re.match(r"^(.+?)\s*§(.+)§$", part)
                name, aff = (mm.group(1), mm.group(2).replace("¦", ",")) if mm else (part, "")
                if NAME.match(name.strip()):
                    out.append((name.strip(), aff))
    return out


def parse_workshops(m: Model, toks, page):
    for d in groups(toks, "h2"):
        days = [WD[w] for w in WD if w in d["head"]]
        if not days:
            continue
        sids = [m.session(f"session-workshops-{dd}", f"Workshops · {w}, October {dd}", f"2026-10-{dd}T09:00:00", f"2026-10-{dd}T17:30:00")
                for w, dd in WD.items() if dd in days]
        for g in groups(d["toks"], "h3"):
            f = fields(g["toks"])
            ppl = [(m.person(n, a), "invited speaker") for n, a in invited(f.get("description", ""))]
            site = g["links"][0] if g["links"] else page
            m.event("workshop-" + g["head"], g["head"], "Workshop", ppl, f.get("description", ""), f"{d['head']} {f.get('time', '')}".strip(), f.get("room", ""), site, sids)


def parse_org(m: Model, toks, page):
    role, i = None, 0
    while i < len(toks):
        t = toks[i]
        if t["kind"] == "h2":
            role = t["text"]
        elif t["kind"] == "img" and role and i + 1 < len(toks) and toks[i + 1]["kind"] == "h3":
            h = toks[i + 1]
            affil = toks[i + 2]["text"] if i + 2 < len(toks) and toks[i + 2]["kind"] == "p" and not toks[i + 2]["text"].startswith("Contact") else ""
            home = next((l for l in h["links"] if l.startswith("http")), "")
            p = m.person(h["text"], affil.replace("\n", " "), photo_url(page, t["src"]), home or page)
            m.role(p, role)
            i += 2 if affil else 1
        i += 1


def parse_sheet(m: Model, text: str) -> int:
    rows = list(csv.reader(io.StringIO(text)))
    want = {"title": ("title", "paper"), "authors": ("author",), "session": ("session",), "time": ("time", "start", "date"),
            "type": ("type", "track", "category"), "room": ("room", "location"), "id": ("id", "paper id")}
    for hi, r in enumerate(rows[:40]):
        cols = {}
        for j, c in enumerate(r):
            for k, keys in want.items():
                if k not in cols and any(norm(c).startswith(x) for x in keys):
                    cols[k] = j
        if "title" in cols and "authors" in cols:
            break
    else:
        print("[warn] sheet has no title/authors columns; skipped", file=sys.stderr)
        return 0
    n = 0
    cell = lambda r, k: r[cols[k]].strip() if k in cols and cols[k] < len(r) else ""  # noqa: E731
    for r in rows[hi + 1:]:
        title, authors = cell(r, "title"), cell(r, "authors")
        if not title or not authors:
            continue
        names = [a.strip() for a in re.split(r";|\n", authors)] if re.search(r";|\n", authors) else [a.strip() for a in authors.split(",")]
        sid = m.session(f"session-sheet-{slug(cell(r, 'session'))}", cell(r, "session")) if cell(r, "session") else None
        m.event("paper-" + (cell(r, "id") or title), title, cell(r, "type") or "Paper", [(m.person(a), "author") for a in names if a],
                "", cell(r, "time"), cell(r, "room"), "", [sid]); n += 1
    return n


# ---------------------------------------------------------------- prune / rdf / export
def prune(m: Model, cap):
    score = {p["id"]: 2 * len(p["talks"]) + len(p["roles"]) for p in m.P.all}
    keep = set(sorted(score, key=score.get, reverse=True)[:cap])
    people = [p for p in m.P.all if p["id"] in keep]
    for p in people:
        p["confidence"] = confidence(p)
    talks = {}
    for t in m.talks.values():
        had = bool(t["people"]); t["people"] = [(a, r) for a, r in t["people"] if a in keep]
        if t["people"] or not had:
            talks[t["id"]] = t
    ss = {s for t in talks.values() for s in t["sessions"]}
    tt = {k for t in talks.values() for k in t["topics"]}
    return (people, talks, {k: v for k, v in m.sessions.items() if k in ss}, {k: v for k, v in m.topics.items() if k in tt},
            {k: v for k, v in m.roles.items() if any(k in p["roles"] for p in people)},
            {k: v for k, v in m.insts.items() if any(k in p["insts"] for p in people)})


REL = {"keynote": NK.presents, "invited speaker": NK.presents, "organizer": NK.organizes, "panelist": NK.panelistIn,
       "moderator": NK.moderates, "author": NK.authorOf}
PFX = "PREFIX nk: <https://kg.local/conference#>\n"
EVT = "(nk:presents|nk:organizes|nk:panelistIn|nk:moderates|nk:authorOf)"
Q_ROLE = PFX + "SELECT ?a ?b (COUNT(DISTINCT ?x) AS ?n) WHERE { ?a nk:holds ?x . ?b nk:holds ?x . FILTER(STR(?a) < STR(?b)) } GROUP BY ?a ?b"
Q_EVT = PFX + f"SELECT ?a ?b (COUNT(DISTINCT ?x) AS ?n) WHERE {{ ?a {EVT} ?x . ?b {EVT} ?x . FILTER(STR(?a) < STR(?b)) }} GROUP BY ?a ?b"
Q_TOP = PFX + f"SELECT ?p ?k (COUNT(DISTINCT ?x) AS ?n) WHERE {{ ?p {EVT} ?x . ?x nk:about ?k }} GROUP BY ?p ?k"


def lid(u) -> str:
    return str(u).replace(str(NK), "")


def build_rdf(people, talks, sessions, topics, roles, insts) -> Graph:
    g = Graph(); g.bind("nk", NK)
    for p in people:
        s = NK[p["id"]]
        g.add((s, RDF.type, NK.Person)); g.add((s, RDFS.label, Literal(p["name"])))
        for k, pred in (("affiliation", NK.affiliation), ("photo", NK.photo), ("url", NK.profile), ("linkedin", NK.linkedin)):
            if p[k]: g.add((s, pred, Literal(p[k])))
        g.add((s, NK.confidence, Literal(p["confidence"], datatype=XSD.decimal)))
        for r in p["roles"]: g.add((s, NK.holds, NK[r]))
        for i in p["insts"]: g.add((s, NK.affiliatedWith, NK[i]))
    for cls, d in ((NK.Role, roles), (NK.Institution, insts), (NK.Topic, topics), (NK.Session, sessions)):
        for x in d.values():
            g.add((NK[x["id"]], RDF.type, cls)); g.add((NK[x["id"]], RDFS.label, Literal(x["label"])))
    for t in talks.values():
        s = NK[t["id"]]
        g.add((s, RDF.type, NK.Talk)); g.add((s, RDFS.label, Literal(t["label"]))); g.add((s, NK.talkType, Literal(t["type"])))
        for k in ("summary", "time", "room", "url"):
            if t[k]: g.add((s, NK[k], Literal(t[k])))
        for x in t["sessions"]: g.add((s, NK.inSession, NK[x]))
        for k in t["topics"]: g.add((s, NK.about, NK[k]))
        for a, rel in t["people"]: g.add((NK[a], REL[rel], s))
    return g


def export(g, people, talks, sessions, topics, roles, insts, meta) -> dict:
    col = collections.Counter()
    for q in (Q_ROLE, Q_EVT):
        for a, b, n in g.query(q):
            col[(lid(a), lid(b))] += int(n)
    for a, b in col:
        g.add((NK[a], NK.colleagueOf, NK[b]))
    pt = collections.defaultdict(list)
    for p, k, n in g.query(Q_TOP):
        pt[lid(p)].append((lid(k), int(n)))
    nodes, edges = [], []
    N = lambda d: nodes.append({"data": d})  # noqa: E731
    E = lambda s, t, rel, w=1: edges.append({"data": {"id": f"{s}>{t}:{rel}", "source": s, "target": t, "rel": rel, "weight": w}})  # noqa: E731
    for p in people:
        N(dict(id=p["id"], label=p["name"], type="Person", affiliation=p["affiliation"], photo=p["photo"], linkedin=p["linkedin"],
               profile=p["url"], bio=p["bio"][:400], confidence=p["confidence"]))
        for r in p["roles"]: E(p["id"], r, "holds")
        for i in p["insts"]: E(p["id"], i, "affiliated")
    for typ, d in (("Role", roles), ("Institution", insts), ("Topic", topics), ("Session", sessions)):
        for x in d.values():
            N(dict(id=x["id"], label=x["label"], type=typ, **({"time": x.get("start", "")[:16].replace("T", " ")} if typ == "Session" else {})))
    for t in talks.values():
        N(dict(id=t["id"], label=t["label"], type="Talk", talkType=t["type"], summary=t["summary"], time=t["time"], room=t["room"], url=t["url"]))
        for a, rel in t["people"]: E(a, t["id"], rel)
        for s in t["sessions"]: E(t["id"], s, "in_session")
        for k in t["topics"]: E(t["id"], k, "about")
    for (a, b), n in col.items():
        E(a, b, "colleague", n)
    for p, ks in pt.items():
        for k, n in sorted(ks, key=lambda x: -x[1])[:3]: E(p, k, "researches", n)
    counts = dict(people=len(people), talks=len(talks), sessions=len(sessions), institutions=len(insts), topics=len(topics), roles=len(roles), triples=len(g))
    return {"meta": {**meta, "counts": counts}, "elements": {"nodes": nodes, "edges": edges}}


PARSERS = dict(overview=parse_overview, keynotes=parse_keynotes, industry=parse_industry, panel=parse_panel,
               tutorials=parse_tutorials, workshops=parse_workshops, org=parse_org)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--fixtures", help="directory of saved pages named <key>.html (offline test)")
    ap.add_argument("--out", default=str(ROOT / "public" / "data"))
    ap.add_argument("--max-people", type=int, default=500)
    a = ap.parse_args()
    out = pathlib.Path(a.out); out.mkdir(parents=True, exist_ok=True)
    m, sources = Model(json.loads((HERE / "overrides.json").read_text())), []
    for key, parser in PARSERS.items():
        url = CONF["base"] + CONF["pages"][key]
        html = (pathlib.Path(a.fixtures) / f"{key}.html").read_text() if a.fixtures else get(url)
        if html:
            before = len(m.P.all) + len(m.talks) + len(m.rows)
            parser(m, tokenize(html), url)
            if len(m.P.all) + len(m.talks) + len(m.rows) == before:
                print(f"[warn] {key}: page fetched but nothing parsed; page layout may have changed", file=sys.stderr)
            else:
                sources.append(url)
    if not a.fixtures and CONF.get("sheet_csv"):
        text = get(CONF["sheet_csv"])
        if text and not text.lstrip().startswith("<"):
            n = parse_sheet(m, text)
            if n: sources.append(CONF["sheet_csv"]); print(f"[ok] sheet: {n} papers")
        elif text:
            print("[info] detailed programme sheet is not public; paper-level data skipped", file=sys.stderr)
    if not m.P.all:
        print("[keep] nothing parsed; leaving existing dataset untouched")
        return 0 if (out / "conference-graph.json").exists() else 1
    people, talks, sessions, topics, roles, insts = prune(m, a.max_people)
    g = build_rdf(people, talks, sessions, topics, roles, insts)
    data = export(g, people, talks, sessions, topics, roles, insts,
                  {"conference": CONF["name"], "year": CONF["year"], "venue": CONF["venue"], "dates": CONF["dates"],
                   "generated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"), "sources": sources})
    g.serialize(out / "conference.ttl", format="turtle")
    (out / "conference-graph.json").write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")
    print("[ok]", data["meta"]["counts"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
