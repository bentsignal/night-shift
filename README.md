# night shift

Night Shift is a headless, cloud-coordinated system for durable agent work. It
is not another coding-agent GUI. It runs work across enrolled macOS, Linux, and
Windows hosts, improves its own capabilities, and involves its owner only when
a decision, verification, permission, or recovery action is actually needed.

## Interaction model

The primary surface is conversational. A person can ask ChatGPT, Codex, or
another agent something like:

```sh
night-shift "What needs my attention?"
night-shift "Add Linux support to the resource monitor and tell me when it is ready to verify."
```

Night Shift interprets the request, calls typed internal operations, and
returns a useful natural-language answer. Authentication, host enrollment, and
daemon lifecycle may require a few explicit bootstrap operations, but the
product must not become a command zoo that callers have to memorize.

A primitive durable notification/attention channel will let future voice,
text, phone, and automation clients subscribe without making any one of those
clients the control plane.

## Operating model

- One managed cloud authority durably accepts work and coordinates workflows.
  Every execution host connects outbound to it; clients and phones connect to
  the same authority rather than discovering every personal machine.
- Host daemons own execution, provider credentials, worktrees, tools, local
  artifacts, validation, and detailed/high-frequency telemetry.
- Workflows are explicit, versioned programs with retries, idempotency,
  pause/resume, crash recovery, durable human-input events, and bounded agent
  steps. Correctness does not depend on an agent remembering a checklist.
- Agent runtimes sit behind adapters. Codex CLI is the bootstrap runtime;
  Claude Code, Pi, other harnesses, and a product-owned Effect AI runtime can
  be substituted without owning workflow semantics.
- Effect TS remains the product programming model for schemas, services,
  failures, retries, observability, and owned agent loops. The cloud workflow
  substrate stays behind an Effect service boundary.

The first vertical slice stays deliberately small:

```text
converse -> accept -> plan -> admit -> assign host -> execute -> validate -> complete
                                      \-> request attention -> resume
```

## Intelligent resource control

Resource management has two cooperating layers:

1. A deterministic safety kernel enforces hard capacity limits, fair admission,
   isolation, fenced ownership, cancellation, and rollback.
2. An AI resource governor interprets telemetry and project context, recommends
   priorities, tunes policy inside those limits, and improves host support.

This means the LLM is genuinely involved in resource decisions without being
able to exceed a hard safety boundary. Night Shift may author and install a
better platform-specific probe or adapter for an enrolled host, but every such
change must be explicit, least-privileged, tested, observable, and reversible.
Self-improvement is a core workload, not a distant milestone.

## Cloud authority decision

Convex is Night Shift's single managed cloud authority. Confect keeps the
Effect schema and failure model intact at retained Convex boundaries. Convex
Workflow and Workpool may provide durable workflow and admission primitives,
while Night Shift owns the outbound host protocol: enrollment, heartbeats,
capability matching, resource admission, leases, fencing, recovery, and sparse
result publication. Hatchet and Temporal remain reference designs and escape
hatches, not active implementation targets.

## First dogfood workload

After the smallest authority-to-Codex execution path works, Night Shift's first
job is to improve Night Shift: start from a portable conservative resource
sampler, inspect an enrolled Mac, implement a richer macOS capacity probe in an
isolated worktree, test it against recorded fixtures and live measurements,
install it canary-first, and report the new capability through the
conversational CLI. The next run repeats the workflow for Linux.

That slice exercises planning, context selection, runtime adapters, isolated
attempts, validation, resource safety, self-modification, notifications, and
rollback without pretending the whole platform already exists.

## Repository shape

- `apps/cli`: conversational human/agent integration surface
- `apps/worker`: enrolled-host daemon and execution-runtime adapters
- `services/convex`: current authority prototype and Confect experiment
- `docs/raw`: verbatim historical planning transcripts

The stale web, desktop, mobile, Effect React, and Effect lab experiments have
been removed. Night Shift has no product UI.

## Develop and validate

Use Node 22.19+ (below Node 23) and pnpm 9.15.4.

```sh
pnpm install
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Bring the configured Convex development deployment up to date once, then run a
host daemon in one terminal and converse with it from another:

```sh
pnpm --filter @night-shift/convex exec convex dev --once
NIGHT_SHIFT_CODEX_SANDBOX=workspace-write pnpm dev:worker
pnpm night-shift -- "What is going on with our projects?"
pnpm night-shift -- "Use Codex to inspect this project and suggest one small improvement."
```

The Codex adapter reuses the installed Codex CLI's host-local ChatGPT login;
credentials never enter Convex. `NIGHT_SHIFT_CODEX_SANDBOX` accepts
`read-only`, `workspace-write` (the default), or `danger-full-access`. New work
targets the caller's current directory (`NIGHT_SHIFT_PROJECT_PATH` can override
it). This personal development slice
uses an owner ID rather than production authentication; authenticated host
enrollment remains required before sharing the authority.

The current Mac worker also advertises the custom Effect AI harness and Pi.
Pi starts conservatively with read-only tools; set `NIGHT_SHIFT_PI_TOOLS` to an
explicit comma-separated tool allowlist when a workflow has proper isolation.
Claude Code support is implemented but only advertised when
`NIGHT_SHIFT_ENABLE_CLAUDE=1`, after its host-local subscription has been
reauthenticated. Grok requests are parsed and remain durably queued until a
Grok adapter is enabled on an authenticated host.

## Project memory

UAV is the source of truth for current intent, decisions, architecture notes,
and tasks. Verbatim planning transcripts live under `docs/raw/`; they are source
material, not a parallel synthesized-note system. Night Shift will absorb the
needed UAV capabilities rather than depending forever on the separate UAV
repository.
