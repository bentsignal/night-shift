# Code

A personal control plane for agentic coding work. Convex owns durable orchestration state while enrolled host workers execute runs through a product-owned Pi runtime adapter.

The first vertical slice includes:

- A TanStack Start operations console for queueing and controlling runs
- A Convex service with explicit run, host, attempt, milestone, and command state
- A TypeScript worker with host registration, health, fenced leases, sparse checkpoints, pause/resume/cancel, and deterministic validation
- A Pi adapter using `@earendil-works/pi-agent-core` and `@earendil-works/pi-ai`
- Viable CLI, Electron, and Expo client scaffolds

## Run locally

Use Node 22.19+ (below Node 23) and pnpm 10.

```sh
pnpm install
pnpm --dir services/convex dev
```

The Convex command prints the local deployment URL. In separate terminals:

```sh
VITE_CONVEX_URL=http://127.0.0.1:3210 \
VITE_CODE_OWNER_ID=personal \
pnpm --filter @code/web dev
```

```sh
CONVEX_URL=http://127.0.0.1:3210 \
CODE_OWNER_ID=personal \
pnpm --filter @code/worker start
```

Set `CODE_RUNTIME_MODE=faux` on the worker for deterministic local execution without a provider call. Real execution reads Pi-compatible provider credentials from the host, including the OpenAI Codex subscription stored under `PI_CODING_AGENT_DIR` or `~/.pi/agent/auth.json`. Credentials never enter Convex.

## Validate

```sh
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

## Project memory

UAV is the source of truth for project intent, decisions, architecture notes, and tasks. Use `uav status`, `uav ask`, `uav notes`, and `uav task list` from this repository.

Verbatim planning transcripts live under `docs/raw/`; they are source material rather than a parallel project-management system.
