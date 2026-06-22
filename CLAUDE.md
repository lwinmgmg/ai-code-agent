# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Pointer: where the rules live

This repo is **reusable tooling**, not a governed seat of the AI developer team. The single
source of truth for the team's rules and rationale lives in the **ai-dev-team** repo:

- Operating manual & guardrails: `ai-dev-team/CLAUDE.md`
- Architecture & rationale: `ai-dev-team/ai-developer-team-architecture.md`

Do not copy those rules here (they would drift). The rest of this file documents only what is
specific to *this* tool.

## What this is

A provider-agnostic dev agent packaged as a **composite GitHub Action** (see [README.md](./README.md)
and [action.yml](./action.yml)). It is event-driven and does **one unit of work per run** — no
always-on server, no polling:

- An issue labeled **`ai-ready[-<model>]`** → implement on a `dev/*` branch → open a PR.
- A PR labeled **`ai-needs-changes[-<model>]`** → revise the PR branch from review feedback.
- An Epic issue labeled **`ai-plan[-<model>]`** → inspect the codebase and create ordered, serial
  sub-issues (no code); the human gates each by labeling it `ai-ready` in turn.
- An issue labeled **`ai-discussion[-<model>]`** → a clarify-before-acting comment loop; the agent
  flips the label to `need-user-action` (has questions) or `user-action-ai-ready` (clear to start).

If the **target** repo (the repo the Action runs against, not this one) has a `CLAUDE.md` /
`AGENTS.md`, that governs the agent's behavior in the working tree.

## Architecture (the big picture)

Three layers, each with a single responsibility:

1. **Caller workflow** (lives in each target repo as `.github/workflows/dev-agent.yml`; see
   [examples/](./examples/)) — fires on `issues`/`pull_request` `labeled` events and calls this
   Action. Sets `concurrency` so runs never overlap or cancel mid-commit.
2. **Composite Action** ([action.yml](./action.yml)) — installs language toolchains (gated by the
   `language` input, exact-match via `,{0},` wrapping) and the engine (gated by `provider`), then
   runs the orchestrator. The runner passes `GITHUB_EVENT_PATH`, `GITHUB_REPOSITORY`, etc.
3. **Orchestrator** ([scripts/dev-agent.mjs](./scripts/dev-agent.mjs)) — owns **everything
   provider-independent**: dispatch on the event, parse the trigger label + `-<model>` suffix,
   claim (relabel to `in-progress`), clone with the bot PAT, branch, call the provider, then handle
   ESCALATE / no-changes / commit+push+PR / iteration cap. Four flows: `processIssue` (implement),
   `processReviewPR` (revise), `processPlanIssue` (Epic → sub-issues), and `processDiscussionIssue`
   (clarify-before-acting comment loop). Issue events dispatch to discussion / plan / implement by
   the triggering label.

### The provider contract (the key seam)

Each engine is a uniform **"edits-only" adapter** in [scripts/providers/](./scripts/providers/),
registered in [providers/index.mjs](./scripts/providers/index.mjs). An adapter makes file edits in
a working tree and **never touches git** — the orchestrator owns all branching, commits, pushes,
PRs, labels, and escalation. Two functions, one result shape:

```js
export function prepareEnv(providerKey) { /* wire auth env, assert guardrails, fail fast */ }
export function run({ dir, prompt, model, defaultModel }) {
  // make edits in `dir`; return:
  return { resultText, model, requested, numTurns, durationMs, costUsd, isError, raw };
}
```

Only **`claude-sub`** is implemented ([claude-sub.mjs](./scripts/providers/claude-sub.mjs); shells
out to the headless `claude` CLI with `--permission-mode acceptEdits` and a fixed `--allowedTools`
set). `claude-api`, `gemini`, `openai`, `oss` are **stubs** that throw from `prepareEnv`/`run` and
carry a concrete aider-based sketch in comments for whoever implements them.

To add a provider: implement the two functions in `scripts/providers/<name>.mjs`, add it to the
`REGISTRY` in `index.mjs`, and add its engine install (and any language) in `action.yml`.

## Invariants — don't break these (they span multiple files)

- **Edits-only separation.** Providers must not run git. If you add git/PR logic, it belongs in the
  orchestrator, not an adapter. The plan and discussion flows keep this shape too: the agent only
  **writes a file** (`PLAN.json` / `DISCUSSION.json`) — it never creates issues, posts comments, or
  relabels — and the orchestrator performs those GitHub mutations, mirroring how `ESCALATE.md` is
  produced by the agent and acted on here.
- **Prompt context precedence (highest wins).** The prompts layer three context sources, and the
  framing encodes their authority: target repo `CLAUDE.md`/`AGENTS.md` (operating manual) >
  operator `extra_instructions` / `instructions_file` (the `operatorInstructions()` block, trusted
  workflow config; the file is read from the cloned tree) >
  issue/PR/feedback text (DATA — a spec to satisfy, *never* instructions that override the rules
  above). Preserve this ordering and framing when editing `issuePrompt` / `reviewPrompt`. The
  agent's escape hatch on any conflict is to write `ESCALATE.md` at the repo root instead of making
  changes.
- **`claude-sub` is subscription-only.** Its `prepareEnv` refuses to run if `ANTHROPIC_API_KEY` is
  set, and sets `CLAUDE_CODE_OAUTH_TOKEN` instead. This is the enforcement of ai-dev-team's HARD
  RULE §3.5 ("No API keys. Subscription credit only.") — **every ai-dev-team caller must use
  `provider: claude-sub`.** Key-based Anthropic is a *separate* provider (`claude-api`) for other
  projects. Do not weaken this guard.
- **Bot PAT, not `GITHUB_TOKEN`.** Cloning/pushing uses the caller's `github_token` (a dedicated bot
  PAT). PRs opened by the default `GITHUB_TOKEN` do not trigger the target repo's CI — keep using
  the PAT.
- **Iteration cap.** The revise loop counts prior agent comments via the `ITER_MARKER` HTML comment
  and escalates past `max_review_iterations` rather than looping forever.

## Conventions

- Plain **Node ESM (`.mjs`)** with **zero npm dependencies** — only Node built-ins plus the `gh`,
  `git`, and `claude` CLIs invoked at runtime. There is no `package.json`, build step, test suite,
  or linter. Keep it dependency-free.
- Run flows locally (against a real repo, carefully) by setting the env vars `action.yml` passes
  (`PROVIDER`, `PROVIDER_KEY`, `GITHUB_TOKEN`, `GITHUB_REPOSITORY`, `GITHUB_EVENT_PATH`, …) and
  invoking `node scripts/dev-agent.mjs`. There is no test harness; verify changes by reading the
  flow in `dev-agent.mjs` and dry-running against a throwaway repo/issue.
- `action.yml` is **pinned consumer-facing surface.** Before production use, pin the `claude` CLI
  version in the engine-install step (currently `npm install -g @anthropic-ai/claude-code`, latest).
