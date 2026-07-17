# Building artifacts

An artifact is a single self-contained HTML page — interactive (a chart,
calculator, small game, animated explainer) or a polished document (a report,
write-up, brief, or code explanation) — that the partner can open, version, and
share from the Artifacts app. You build the page; the Artifacts app is its
gallery: it shows which chat each artifact came from, its version history, a
live preview, and a public share button. This file is the source of truth for
how artifacts are stored and linked. Read this before building anything you
would call an artifact, canvas, visualization, report, or shareable page — and
before iterating on one that already exists.

---

## Artifact or mini-app?

Reach for an artifact when the thing is **significant and self-contained** —
substantial enough to stand on its own (a rule of thumb: more than a dozen
lines, not a one-liner you'd just put in the chat).

| Build an ARTIFACT when… | Build a MINI-APP when… |
|---|---|
| It is a self-contained page to look at, play with, read, or share — a viz, report, calculator, infographic, small game, document | It is a durable tool the partner returns to, with saved records and its own data model |
| It needs no storage, no embedded chat, no cron — the page IS the product | It needs `window.mobius` storage, notifications, schedules, or registration |
| A logged-out person you share it with should be able to use it | It only makes sense inside Möbius |

When genuinely unsure, name both options in your clarifying turn and let the
partner pick. An artifact is much cheaper — prefer it for one-shot interactive
content and for standalone documents.

---

## Where artifacts live

Artifacts are files in the **Artifacts app's storage tree**:
`/data/apps/<ARTIFACTS_APP_ID>/` where `ARTIFACTS_APP_ID` is the app's
**numeric id**. Resolve it fresh every time — it changes if the app is ever
reinstalled, so never hardcode it:

```bash
ARTIFACTS_APP_ID=$(curl -fsS -H "Authorization: Bearer $AGENT_TOKEN" \
  "$API_BASE_URL/api/apps/" | python3 -c \
  "import sys,json; print(next((a['id'] for a in json.load(sys.stdin) if a.get('slug')=='artifacts'),''))")
```

If it comes back empty, the Artifacts app is not installed — tell the partner
to install it from the App Store, and offer to build the page as a plain
mini-app instead. **Do not confuse the storage tree with
`/data/apps/artifacts/`** — that slug-named directory is the viewer app's
source code; never write artifacts there.

Inside the storage tree, you own exactly two paths:

```
artifacts/<artifact_id>.json      # the record — metadata + version index
versions/<artifact_id>/v<N>.html  # one immutable file per version
```

**Never touch `shares/` or `projects/`** — those are the app's own bookkeeping
for public sharing. Sharing is the partner's action, taken in the app.

---

## Create an artifact

1. Author the page (rules below) and save it to a temp file.
2. Mint the id: slugified title + 4 random hex, all `[a-z0-9-]`, ≤ 45 chars
   total — e.g. `"Tip Calculator"` → `tip-calculator-7f3a`.
3. Write the version blob, then the record. **Write the record atomically**
   (temp file + `os.replace`) so the app's live gallery never reads a
   half-written file:

```bash
AID="tip-calculator-$(openssl rand -hex 2)"
D="/data/apps/$ARTIFACTS_APP_ID"
NOW=$(date -u +%FT%TZ)

mkdir -p "$D/versions/$AID" "$D/artifacts"
cp page.html "$D/versions/$AID/v1.html"          # immutable once written

python3 - "$D/artifacts/$AID.json" <<PY
import json, os, sys
path = sys.argv[1]
tmp = path + ".tmp"
json.dump({
  "id": "$AID", "title": "Tip Calculator",
  "description": "Split a bill and compute per-person tips.",
  "chat_id": "$CHAT_ID",                    # provenance — the app links back here
  "created_at": "$NOW", "updated_at": "$NOW",
  "current_version": 1,
  "versions": [{"v": 1, "created_at": "$NOW", "chat_id": "$CHAT_ID",
                "note": "first version",
                "bytes": $(wc -c < "$D/versions/$AID/v1.html")}],
}, open(tmp, "w"))
os.replace(tmp, path)                        # atomic swap — no torn reads
PY
```

Stamp `$CHAT_ID` exactly as shown — it is how the partner gets the
"open the chat this came from" link. If you prefer HTTP, the equivalent is
`PUT $API_BASE_URL/api/storage/apps/$ARTIFACTS_APP_ID/<path>` with
`Bearer $AGENT_TOKEN` (`.html` → `Content-Type: text/html` raw body; `.json` →
`application/json`, the body IS the document, no envelope). The HTTP PUT path
writes atomically on the server and enforces the storage quota, so it is the
safer choice for large pages.

---

## Iterate an existing artifact

Find the id first: it is in your earlier reply's link, or list
`$D/artifacts/` and match by title or `chat_id`. Then:

1. **Reuse the same `artifact_id`** — a new id would create a second artifact
   instead of a new version.
2. **Never overwrite an existing `v<N>.html`** — history is immutable. Write
   the next free version number, and refuse to clobber if it already exists
   (a concurrent turn may have taken it):

```bash
REC="$D/artifacts/$AID.json"
NEXT=$(python3 -c "import json; print(json.load(open('$REC'))['current_version']+1)")
DEST="$D/versions/$AID/v$NEXT.html"
if [ -e "$DEST" ]; then echo "v$NEXT already exists — re-read the record and retry"; exit 1; fi
cp page.html "$DEST"
python3 - "$REC" "$DEST" $NEXT "dark theme + rounding" <<'PY'
import json, os, sys, datetime
rec, blob, nxt, note = sys.argv[1], sys.argv[2], int(sys.argv[3]), sys.argv[4]
d = json.load(open(rec))                     # re-read fresh, then append
now = datetime.datetime.now(datetime.UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
d["current_version"] = nxt; d["updated_at"] = now
d["versions"].append({"v": nxt, "created_at": now,
  "chat_id": os.environ.get("CHAT_ID", ""), "note": note,
  "bytes": os.path.getsize(blob)})
tmp = rec + ".tmp"; json.dump(d, open(tmp, "w")); os.replace(tmp, rec)
PY
```

3. Read the record fresh before appending (a different chat may have added a
   version) and bump `current_version` + `updated_at`.

If the partner shared the artifact publicly, the shared page keeps showing the
version it was shared at — tell them they can update the shared version from
the app's Share sheet.

---

## Authoring rules — what makes a good artifact

- **One file, everything inline.** All CSS in `<style>`, all JS in inline
  `<script>`, images as inline SVG or `data:` URIs. **No CDNs, no webfonts, no
  remote `<script src>`** — the preview runs in a sandbox and shared pages must
  work anywhere; an external request is a broken artifact.
- **Mobile-first.** `<meta name="viewport" content="width=device-width, initial-scale=1">`,
  fluid layout, tap targets ≥ 44px. The partner opens these on a phone.
- **Design both themes** with `@media (prefers-color-scheme: dark)` — unless
  the piece deliberately commits to one visual world (a neon game can stay
  dark). Keep contrast legible in both.
- **Calibrate the treatment.** A data report wants clean typography and quiet
  color; a game or showpiece earns a scene. Don't over-design utility pages,
  don't under-design the centerpiece. Real content throughout — never lorem.
- **Robust.** Wrap risky JS in try/catch and render a visible fallback message;
  a crashed artifact must not be a blank page.
- **Lean.** Keep the file well under 50 MB (large `data:` assets count) — the
  storage tree is capped at 1 GB; prefer SVG and generated canvas over big
  base64 blobs.
- **Title it like a product** ("Berlin Marathon Pacing", not "chart-v2") and
  give the record a one-line description — both show in the gallery.

### Documents and reports

A report, brief, write-up, or code explanation is a first-class artifact.
Render it as **semantic, self-contained HTML** — `<article>`, real headings,
paragraphs, lists, tables, links, and `<pre><code>` for code — with readable
typography and selectable text. Don't invent interactivity a document doesn't
need. Storage stays `.html` like any other artifact.

### Diagrams

Pre-render diagrams and flowcharts as accessible inline `<svg>` with a `<title>`
and `<desc>`. Do not emit raw Mermaid source and do not load Mermaid or any
diagram library from a CDN — the sandbox blocks it and a shared page must work
offline.

---

## Link it back in the chat

End your reply with the artifact link — the shell opens it in place:

```
[Open "Tip Calculator" →](/shell/?app=artifacts&intent=artifact:<artifact_id>)
```

Also send the durable notification so the partner can tap in later:

```bash
curl -fsS -X POST "$API_BASE_URL/api/notifications/send" \
  -H "Authorization: Bearer $AGENT_TOKEN" -H "Content-Type: application/json" \
  -d '{"title": "Artifact ready", "body": "Tip Calculator is ready to open and share.",
       "source_id": "'"$CHAT_ID"'",
       "target": "/shell/?app=artifacts&intent=artifact:'"$AID"'"}'
```

---

## Before you hand back

| If this turn… | Do before finishing |
|---|---|
| Built an artifact | Verify both files exist and the record parses (`python3 -m json.tool`); reply in partner language (what it does, not how it's stored); end with the Open link; send the notification. |
| Iterated one | Confirm `current_version` bumped and the new `v<N>.html` exists; say what changed; re-link it. If it was shared, mention the Share sheet can update the public version. |
| Hit a gotcha | Log it the usual way so future-you avoids it. |

Sharing, version browsing, downloading, and deletion are the partner's actions
inside the Artifacts app — point them there rather than doing it for them.
