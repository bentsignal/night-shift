# night shift

A personal control plane for agentic coding work. Convex owns durable orchestration state while enrolled host workers execute runs through a product-owned Effect AI harness.

The first vertical slice includes:

- A TanStack Start operations console for queueing and controlling runs
- A Convex service with explicit run, host, attempt, milestone, and command state,
  with durable admission executed as an Effect through Confect
- A TypeScript worker with host registration, health, fenced leases, sparse checkpoints, pause/resume/cancel, and deterministic validation
- A bounded Effect AI harness with typed tools, provider Layers, and sparse turn checkpoints
- An experimental `@night-shift/effect-react` package with selector stores and Effect-built,
  dependency-checked component and hook factories
- Viable CLI, Electron, and Expo client scaffolds

## Run locally

Use Node 22.19+ (below Node 23) and pnpm 9.15.4.

```sh
pnpm install
pnpm dev
```

This runs the workspace's full Turbo `dev` graph: the web control plane, local
Convex deployment, Electron shell, and Expo development server. The first run
may download Electron or ask you to finish the local Convex setup.

Start a local execution host in another terminal:

```sh
NIGHT_SHIFT_RUNTIME_MODE=faux pnpm dev:worker
```

`NIGHT_SHIFT_RUNTIME_MODE=faux` provides deterministic local execution without a
provider call. Real execution supports `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`,
and the existing OpenAI Codex subscription OAuth credential stored under
`PI_CODING_AGENT_DIR` or `~/.pi/agent/auth.json`. The worker owns the provider
transport and credential types; the compatible path only avoids forcing a new
login during migration. Credentials never enter Convex.

The Codex subscription transport fails explicitly when its access token is
expired; automatic OAuth refresh is not implemented yet. Its opt-in live smoke
test has no tools and refuses to make a request unless explicitly enabled:

```sh
NIGHT_SHIFT_LIVE_CODEX_SMOKE=1 pnpm --filter @night-shift/worker smoke:codex
```

Focused development commands are also available:

```sh
pnpm dev:desktop
pnpm dev:lab
pnpm dev:mobile
pnpm dev:web
```

Use `pnpm dev:web-only` when Convex is already running separately. Both web
commands load the local Convex URL automatically.

`pnpm dev:lab` starts the isolated Effect React compiler lab through Portless at
`https://effect-lab.night-shift.local`. The lab composes Effect components as
ordinary JSX, injects a selector store midway through the tree, and displays the
build-time requirement graph produced by the Vite analyzer. The analyzer runs
in memory; it does not add generated source files to the app.

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
