# Agent Roster — Content Factory

## @marketing/writer

**Role:** drafter. Converts raw source material (transcripts, webinars,
interviews) into long-form blog drafts.

**On connect:**
1. Read `brand-voice.md`. Respect it religiously.
2. Read `schema.sql`. Confirm `pieces` and `assets` tables exist.
3. Poll `SELECT * FROM pieces WHERE stage='drafting' ORDER BY started_at`.

**Loop per source:**
1. Generate a `slug` (kebab-case, ≤ 40 chars).
2. `INSERT INTO pieces (slug, title, source_type, source_uri, stage)` —
   stage = 'drafting'.
3. Read the raw source from `source_uri`.
4. Write a blog draft to `drafts/<slug>.md`. Follow `brand-voice.md` rules
   (no em dashes, no AI vocab, direct opener, concrete examples, clear
   CTA).
5. `UPDATE pieces SET draft_uri='costate://<ws>/drafts/<slug>.md',
   stage='in-seo'` atomically via `costate_sql`.
6. Create a handoff task:
   ```json
   { "tool": "costate_handoff",
     "params": {
       "action": "create",
       "task": "SEO review: <slug>",
       "to_agent": "<seo-agent-ulid>",
       "payload_ref": "costate://<ws>/drafts/<slug>.md",
       "idempotency_key": "seo-<slug>"
     } }
   ```

## @marketing/seo

**Role:** gatekeeper. Keyword optimization, meta tags, internal links.
Nothing ships past them without approval.

**On connect:**
1. Read `brand-voice.md` and `keyword-targets.md`.
2. `costate_handoff list --to_agent <me> --status submitted`.

**Loop per task:**
1. `costate_handoff claim`.
2. Read the draft from `payload_ref`.
3. Verify against `keyword-targets.md`:
   - Primary keyword present in title + H1 + first paragraph?
   - ≥ 2 supporting keywords woven in naturally?
   - Internal links to canonical pages?
   - Meta title + description length correct?
4. If yes:
   - Edit the draft in place to add meta tags + fix anchor text.
   - `UPDATE pieces SET seo_approved=1, stage='in-distro'`.
   - `costate_handoff complete` with `result_ref = draft_uri`.
   - Create a follow-up task: `to_agent = <distro-agent-ulid>`,
     `task = "Distribute: <slug>"`.
5. If no (first or second revision):
   - Write specific fix requests into `seo_notes` column for this piece.
   - `costate_handoff fail` with `reason = "needs revisions — see pieces.seo_notes"`.
   - A new handoff goes back to @marketing/writer.
6. If a THIRD round of rejections on the same piece:
   - Escalate: `costate_handoff create` with `needs_approval=true`,
     `task = "Human review required — 3 rounds of SEO pushback on <slug>."`
   - Block the piece (`stage='blocked'`) until human decides.

## @social/distro

**Role:** multi-channel asset producer.

**On connect:**
1. Read `brand-voice.md` — channel rules matter here.
2. `costate_handoff list --to_agent <me> --status submitted`.

**Loop per task:**
1. `claim`.
2. Read the finalized draft from `payload_ref`.
3. Produce per channel (4–5 assets per piece):
   - `output/<slug>/x-thread.md` — 7–12 posts, hook first
   - `output/<slug>/linkedin.md` — 200–350 words
   - `output/<slug>/newsletter.md` — 150–250 words, one link
   - `output/<slug>/yt-short-script.md` — 30–60 sec
4. `INSERT INTO assets` rows for each produced file.
5. `UPDATE pieces SET stage='shipped', shipped_at=now()`.
6. `costate_handoff complete`.

## Human operator

Approves escalated pieces in the Control Tower. Watches `pipeline_status` view:

```sql
SELECT stage, COUNT(*) FROM pieces GROUP BY stage;
```

…so they know what's flowing vs stuck.

## Workflow

```
raw-transcript.txt ──▶ @marketing/writer ──▶ drafts/<slug>.md
                                                 │
                                                 │ handoff: SEO review
                                                 ▼
                              @marketing/seo (1-2 rounds)
                                                 │
                                 ─ approve ─▶ handoff: distribute ─▶ @social/distro
                                 ─ reject  ─▶ handoff: revise ────▶ @marketing/writer
                                 ─ 3x fail ─▶ needs_approval ─────▶ human
                                                                        │
                                                                        ▼
                                                        output/<slug>/{blog,x,linkedin,...}
```
