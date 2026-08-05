---
name: claude-code-workflow-optimizer
description: Governs how Claude operates inside Claude Code sessions that mix Opus (planning/architecture) and Sonnet 4.6 (execution) — minimizing token spend, avoiding redundant reads/tool calls, using Claude Code's own context tools (/compact, /clear, subagents, plan mode, opusplan) correctly, and keeping a running task state across long sessions. Trigger this any time a Claude Code session involves multi-file work, plan-then-execute flows, long debugging threads, or explicit requests to switch models, save tokens, manage context, or "pick up where we left off." Also trigger on mentions of /compact, /clear, opusplan, effort level, subagents, or context window warnings.
---

# Claude Code Workflow Optimizer (Opus + Sonnet 4.6)

A discipline layer for running Claude Code sessions efficiently when the workflow deliberately splits work between **Opus** (architecture, planning, hard reasoning) and **Sonnet 4.6** (implementation, routine edits). This skill governs _how_ Claude Code uses its own built-in tools — it doesn't replace them.

## The one thing to get right: model switches are not free

Claude Code's prompt cache is invalidated by switching models. A manual `/model opus` → `/model sonnet` → `/model opus` pattern across a session re-processes the full conversation history at full price every time it crosses a switch, on top of losing cache discount on everything since the last switch.

**Default to `opusplan` instead of manual switching.** `opusplan` automatically runs Opus during plan mode and Sonnet 4.6 during execution, switching at the plan/execute boundary — the one switch point that's actually worth paying for. Only hand-switch with `/model` when the task doesn't fit the plan→execute shape (e.g. "just reason through this tradeoff on Opus, no code needed").

If a task will clearly need both reasoning and heavy implementation:

1. Start (or switch to) plan mode — Shift+Tab, or ask Claude to plan first.
2. Let `opusplan` route planning to Opus.
3. Approve the plan; execution runs on Sonnet 4.6 without a manual switch.
4. Only re-invoke Opus mid-execution for a genuine architectural fork, not routine debugging — a fork is worth eating one cache miss for, iteration on the same bug isn't.

## Core failure modes this skill prevents

1. **Cache-invalidating model thrash** — switching models more than the task's actual plan/execute boundary requires.
2. **Re-reading unchanged files** — viewing a file again when nothing in it has changed since the last read.
3. **Full-file rewrites for small changes** — regenerating a whole file via Write when a targeted Edit would do.
4. **Verbose tool output flooding the main context** — piping raw test/log output into the main conversation instead of filtering it or delegating to a subagent.
5. **CLAUDE.md bloat** — stuffing task-specific instructions into CLAUDE.md (loaded every session) instead of a skill (loaded on demand).
6. **Lost state on long sessions** — losing track of what's done/pending, forcing re-explanation after a /compact or a new session.
7. **Vague prompts that trigger broad scanning** — "improve this codebase" instead of a scoped, specific ask.
8. **Reasoning at the wrong effort level** — running trivial edits at high/xhigh effort, or complex architecture decisions at low effort.

## Operating rules

### 1. Maintain a running task state (survives /compact)

For any task with 3+ discrete steps (file-by-file builds, multi-file refactors, CTF-style multi-stage problems), keep one compact checklist and update it in place rather than restating history:

```
STATE
- Goal: <one line>
- Done: [x] step A, [x] step B
- Now: [ ] step C
- Next: [ ] step D
- Decisions locked: <choices not to re-litigate>
- Open questions: none | <blocking item>
```

When context is getting heavy, this block is exactly what should survive a /compact — if the project has custom compaction instructions in CLAUDE.md, make sure they preserve this over raw exploration history. If none exist, suggest adding a short "Compact instructions" section to CLAUDE.md.

### 2. Read once, reuse the read

Don't re-Read a file that hasn't changed since it was last surfaced in context. Re-read only after an Edit/Write touched that specific file, or when a large file needs a different, narrower slice than what's already in context.

### 3. Edit, don't rewrite

Prefer Edit (targeted patch) over Write (full regeneration) for changes to existing files. Reserve full rewrites for changes touching most of the file.

### 4. Delegate verbose operations to subagents

Test runs, log processing, or wide codebase exploration belong in a subagent so only a summary returns to the main conversation — the raw output never touches the primary context window. This matters more in Opus-heavy planning phases, where context is expensive to fill with noise.

### 5. Match effort to the step, not the session

Both Opus and Sonnet 4.6 support low/medium/high/max effort. Default (high) is right for most coding work. Drop to low/medium for mechanical, low-risk steps (renames, boilerplate, formatting fixes) via /effort. Reserve max for a specific hard step, not the whole session — it's session-scoped by design and prone to overthinking on easy tasks.

### 6. Use plan mode before non-trivial changes

For anything beyond a one-file fix, plan mode (Shift+Tab) lets Claude explore and propose an approach before writing code — this is what makes opusplan pay for itself, and it prevents expensive re-work when the first direction is wrong.

### 7. Keep CLAUDE.md thin; push specifics into skills

CLAUDE.md loads on every session start regardless of relevance. If instructions only matter for a specific recurring workflow (PR review, migrations, a particular subsystem), that belongs in a skill, invoked on demand, not in CLAUDE.md. Keep CLAUDE.md under ~200 lines.

### 8. Prefer CLI tools over MCP servers when both exist

gh, aws, gcloud, and similar CLIs cost nothing extra in context (no per-tool listing); MCP servers add overhead even when idle unless the server defers tool definitions. Reach for the CLI first when the task allows it.

### 9. Write specific prompts, not broad ones

"Add input validation to the login handler in auth.ts" scans one file. "Improve the codebase" scans everything. Specificity is a token-cost decision, not just a clarity one.

### 10. Checkpoint discipline

Use Claude Code's own checkpoints to make course-correction cheap: if a change is heading the wrong way, stop early (Escape) and /rewind rather than letting a wrong direction run to completion and needing a bigger fix afterward.

### 11. Batch clarifying questions

If multiple things are ambiguous, ask them together in one turn. If a safe default exists, state the assumption and proceed rather than pausing the whole plan for a minor fork.

### 12. Session handoff

When the user signals they're stopping ("continue tomorrow", "pick this up later"), close with the STATE block in a form that a fresh session (or --resume/--continue) can pick up without re-explanation. If the project uses named sessions, suggest /rename before stepping away.

## Quick self-check before each tool call or model switch

- Would this switch cross a cache boundary I don't actually need to cross? → prefer opusplan's automatic boundary instead.
- Have I already read this file/established this fact in this session?
- Is this an Edit-sized change dressed up as a Write?
- Should this verbose operation go to a subagent instead of the main thread?
- Is this instruction session-specific enough that it belongs in a skill, not CLAUDE.md?
- Does my STATE block still reflect reality?

## What this skill does NOT do

- It does not shorten or hedge the actual deliverable (code, docs, answers).
- It does not skip real verification steps (e.g. re-reading a file _after_ an edit to confirm it landed).
- It does not override an explicit user instruction to switch models or effort levels — it only avoids _unnecessary_ switches.
- It is not a terse-output persona; it eliminates wasted work, not legitimate output.
