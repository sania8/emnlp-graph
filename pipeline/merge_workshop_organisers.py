import json, re, unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GRAPH = ROOT / "public/data/conference-graph.json"
REVIEW = ROOT / "pipeline/workshop-organisers.json"
OUT = ROOT / "public/data/conference-graph.workshops.json"


def strip_accents(s):
    s = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in s if not unicodedata.combining(c))


def norm(s):
    s = strip_accents(s).lower()
    s = re.sub(r"[^a-z0-9 ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", strip_accents(s).lower()).strip("-")


g = json.load(open(GRAPH, encoding="utf-8"))
nodes, edges = g["elements"]["nodes"], g["elements"]["edges"]
by_id = {n["data"]["id"]: n["data"] for n in nodes}
person_by_name = {norm(n["data"]["label"]): n["data"] for n in nodes if n["data"].get("type") == "Person"}
inst_by_norm = {norm(n["data"]["label"]): n["data"]["id"] for n in nodes if n["data"].get("type") == "Institution"}
edge_ids = {e["data"]["id"] for e in edges}

new_people, reused, filled, new_inst, new_edges, bad = [], [], [], [], 0, []


def add_edge(src, tgt, rel):
    global new_edges
    eid = f"{src}>{tgt}:{rel}"
    if eid in edge_ids:
        return
    edges.append({"data": {"id": eid, "source": src, "target": tgt, "rel": rel, "weight": 1}})
    edge_ids.add(eid)
    new_edges += 1


def attach_inst(person, aff):
    key = norm(aff)
    if key not in inst_by_norm:
        iid = "inst-" + slug(aff)
        nodes.append({"data": {"id": iid, "label": aff, "type": "Institution"}})
        inst_by_norm[key] = iid
        new_inst.append(aff)
    add_edge(person["id"], inst_by_norm[key], "affiliated")


review = json.load(open(REVIEW, encoding="utf-8"))["workshops"]
for talk_id, entry in review.items():
    talk = by_id.get(talk_id)
    if not talk or talk.get("type") != "Talk":
        bad.append(talk_id)
        continue
    for o in entry["organizers"]:
        name, aff = o["name"].strip(), (o.get("affiliation") or "").strip()
        p = person_by_name.get(norm(name))
        if p:
            reused.append(name)
            if aff and not (p.get("affiliation") or "").strip():
                p["affiliation"] = aff
                p["affiliation_source"] = "workshop-page"
                attach_inst(p, aff)
                filled.append(name)
        else:
            pid = "person-" + slug(name)
            p = {"id": pid, "label": name, "type": "Person", "affiliation": aff, "photo": "",
                 "linkedin": "", "profile": "", "bio": "", "confidence": 0.7,
                 "affiliation_source": "workshop-page"}
            nodes.append({"data": p})
            person_by_name[norm(name)] = p
            new_people.append(name)
            if aff:
                attach_inst(p, aff)
        add_edge(p["id"], talk_id, "organizer")

json.dump(g, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"workshops in review file: {len(review)}")
print(f"new people added:         {len(new_people)}")
print(f"already in graph (reused): {len(reused)}  | affiliation filled for: {len(filled)}")
print(f"new institution nodes:    {len(new_inst)}")
print(f"new edges:                {new_edges}")
if bad:
    print("UNKNOWN WORKSHOP IDS:", bad)
print("\n-- reused people (check these are really the same person) --")
for n in reused:
    print("  ", n)
print(f"\nwrote {OUT}")
