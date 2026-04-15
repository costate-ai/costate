# Content Factory

> 3 raw podcast transcripts in. 15 finished assets out. Every step audited,
> nothing goes out before SEO says it's ready.

## The scenario

You run content. Every week your team produces a batch of raw source material
(podcast transcripts, webinar recordings, customer interviews) and it needs to
become blog posts, X/LinkedIn threads, newsletter sections, and YouTube
shorts — across 3–5 channels, in a specific order, with brand-voice
consistency, and without a human spending 4 hours playing traffic cop.

Costate is the pipeline. Three agents form an assembly line. Each agent's
hand-off is a first-class task, so you always know where a piece is. Nothing
ships until the SEO agent explicitly approves.

## Agents

| Handle | Role | Stage | Reads | Writes |
|:-------|:-----|:------|:------|:-------|
| `@marketing/writer` | Drafter. Transcripts → long-form blog posts. | 1 | `raw-transcript.txt`, `brand-voice.md` | `drafts/<slug>.md` |
| `@marketing/seo` | SEO reviewer + approver. Keyword optimization, meta tags, internal links. Gatekeeper. | 2 | `drafts/<slug>.md`, `keyword-targets.md` | same file (in place) |
| `@social/distro` | Distribution. Blog post → X thread + LinkedIn + newsletter excerpt + YouTube-shorts script. | 3 | `drafts/<slug>.md` (post-SEO), `brand-voice.md` | `output/<slug>/*` |

## The coordination moment

**State machine: distro is blocked until SEO completes.** When the writer
finishes a draft, they create a handoff task targeting `@marketing/seo`:

```json
{ "tool": "costate_handoff",
  "params": {
    "action": "create",
    "task": "SEO review: drafts/q1-launch-recap.md",
    "to_agent": "<seo-agent-ulid>",
    "payload_ref": "costate://<ws>/drafts/q1-launch-recap.md"
  }
}
```

The distro agent polls for tasks *chained off* completed SEO tasks — it never
claims a draft that hasn't been through SEO. When SEO finishes:

```json
{ "tool": "costate_handoff",
  "params": {
    "action": "complete",
    "task_id": "task_seo_xxx",
    "result_ref": "costate://<ws>/drafts/q1-launch-recap.md"
  }
}
```

…the completion triggers a NEW handoff task for distro. The pipeline pull is
durable: if distro is offline for an hour, the task sits in `submitted` state
waiting. When distro comes back, it claims, processes, and completes. Nothing
gets skipped, nothing gets processed twice.

## What's in the box

- `raw-transcript.txt` — sample podcast transcript to get you started.
- `brand-voice.md` — voice guidelines every agent respects (tone, banned
  phrases, punctuation rules, emoji policy).
- `keyword-targets.md` — SEO targets for this period (primary + supporting
  keywords, internal linking map).
- `pipeline.sqlite` schema in `schema.sql` — tracks every piece of content
  through stages, status, and target channel.
- `AGENTS.md` — the assembly line roster.
- `output/` — where final assets land, one subdir per piece.

## Next steps

1. After `costate init`, ask your lead agent:
   "Read `schema.sql` and set up `pipeline.sqlite`. Upload `brand-voice.md`,
   `keyword-targets.md`, and `raw-transcript.txt` to the workspace."
2. Mint two more PATs (one each for `@marketing/seo` and `@social/distro`).
   Connect each to a separate Claude Desktop / Cursor profile.
3. Kick off the writer: "Convert `raw-transcript.txt` into a long-form blog
   post draft at `drafts/q1-launch-recap.md`. Respect `brand-voice.md`.
   When done, create a handoff task to `@marketing/seo`."
4. Your SEO agent watches the task queue. Approves or requests revisions.
5. Your distro agent watches for SEO-completed tasks, then produces the 4–5
   channel assets per piece into `output/<slug>/`.

## Why this wouldn't work without Costate

Without Costate the pipeline falls over at step 2: how does distro know SEO
finished? Options:
- Human pings Slack — doesn't scale, breaks on weekends
- Polling Google Drive for file changes — fragile, no ordering
- Custom workflow engine (Temporal, Airflow) — weeks of setup, ops burden

Costate gives you this for free:
- **Durable handoffs** — SEO's `complete` triggers distro's `submitted` task
  by convention. If any agent is offline, the task waits. No dropped work.
- **State machine enforcement** — distro can't claim a draft that hasn't
  completed SEO review. The protocol prevents the mistake.
- **Activity log** — every piece traceable: "who wrote it, who reviewed it,
  who distributed it, when." Great when sales asks "where did that LinkedIn
  post claim come from?"
- **SQL view of pipeline** — `SELECT * FROM pipeline WHERE status='in-seo'`
  tells you exactly what's in flight right now.
