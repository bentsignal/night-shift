import type {
  ControlPlaneClient,
  ControlPlaneSnapshot,
  Run,
  RunCommand,
  SubmitWorkInput,
} from "./types";

const initialSnapshot = {
  authority: "connected",
  hosts: [
    {
      id: "host_northstar",
      name: "Northstar",
      health: "offline",
      lastSeenAt: "2026-07-26T17:38:00.000Z",
      capabilities: ["darwin-arm64", "git", "xcode"],
    },
  ],
  runs: [
    {
      id: "run_01J3CP8TW8",
      title: "Isolate retry boundaries in worker loop",
      prompt:
        "Make retry boundaries explicit and verify a stale attempt cannot complete.",
      project: "~/dev/projects/night-shift",
      provider: "OpenAI",
      model: "gpt-5.2-codex",
      reasoning: "high",
      status: "queued",
      createdAt: "2026-07-26T17:42:00.000Z",
      updatedAt: "2026-07-26T17:42:00.000Z",
      milestones: [
        {
          id: "m_queued_01",
          kind: "queued",
          label: "Accepted by authority",
          detail: "Durably queued before host selection.",
          at: "2026-07-26T17:42:00.000Z",
        },
      ],
    },
    {
      id: "run_01J3CM1R7K",
      title: "Prove pause and resume boundaries",
      prompt:
        "Exercise the explicit pause state and keep the attempt recoverable.",
      project: "~/dev/projects/night-shift",
      provider: "OpenAI",
      model: "gpt-5.2-codex",
      reasoning: "xhigh",
      status: "paused",
      createdAt: "2026-07-26T17:01:00.000Z",
      updatedAt: "2026-07-26T17:29:00.000Z",
      host: { id: "host_northstar", name: "Northstar" },
      lease: {
        generation: 7,
        expiresAt: "2026-07-26T17:31:00.000Z",
      },
      milestones: [
        {
          id: "m_queued_02",
          kind: "queued",
          label: "Accepted by authority",
          detail: "Run entered the durable queue.",
          at: "2026-07-26T17:01:00.000Z",
        },
        {
          id: "m_claimed_02",
          kind: "claimed",
          label: "Lease issued",
          detail: "Northstar claimed generation 7.",
          at: "2026-07-26T17:12:00.000Z",
        },
        {
          id: "m_started_02",
          kind: "started",
          label: "Attempt started",
          detail: "Local adapter entered the worker loop.",
          at: "2026-07-26T17:13:00.000Z",
        },
        {
          id: "m_paused_02",
          kind: "paused",
          label: "Paused at safe boundary",
          detail: "Authority acknowledged the operator command.",
          at: "2026-07-26T17:29:00.000Z",
        },
      ],
    },
    {
      id: "run_01J3BZXQ2E",
      title: "Validate lease fencing contract",
      prompt:
        "Add focused coverage for queue claiming and stale generation rejection.",
      project: "~/dev/projects/night-shift",
      provider: "OpenAI",
      model: "gpt-5.2-codex",
      reasoning: "high",
      status: "completed",
      createdAt: "2026-07-26T15:12:00.000Z",
      updatedAt: "2026-07-26T16:04:00.000Z",
      host: { id: "host_northstar", name: "Northstar" },
      lease: {
        generation: 6,
        expiresAt: "2026-07-26T16:05:00.000Z",
      },
      validation: {
        command: "pnpm test -- fencing",
        passed: true,
        durationMs: 1842,
      },
      milestones: [
        {
          id: "m_queued_03",
          kind: "queued",
          label: "Accepted by authority",
          detail: "Run entered the durable queue.",
          at: "2026-07-26T15:12:00.000Z",
        },
        {
          id: "m_claimed_03",
          kind: "claimed",
          label: "Lease issued",
          detail: "Northstar claimed generation 6.",
          at: "2026-07-26T15:18:00.000Z",
        },
        {
          id: "m_started_03",
          kind: "started",
          label: "Attempt started",
          detail: "Host-local runtime adapter began execution.",
          at: "2026-07-26T15:19:00.000Z",
        },
        {
          id: "m_progress_03",
          kind: "progress",
          label: "Checkpoint published",
          detail: "Focused state-machine coverage added.",
          at: "2026-07-26T15:46:00.000Z",
        },
        {
          id: "m_validation_03",
          kind: "validation",
          label: "Validation passed",
          detail: "Fencing test completed in 1.84 seconds.",
          at: "2026-07-26T16:02:00.000Z",
        },
        {
          id: "m_completed_03",
          kind: "completed",
          label: "Authoritative completion",
          detail: "Generation 6 matched the active fence.",
          at: "2026-07-26T16:04:00.000Z",
        },
      ],
    },
  ],
} satisfies ControlPlaneSnapshot;

function titleFromPrompt(prompt: string) {
  const normalized = prompt.trim().replace(/\s+/g, " ");
  const sentence = normalized.split(/[.!?]/)[0] ?? normalized;
  const title = sentence.length > 58 ? `${sentence.slice(0, 55)}…` : sentence;
  return title || "Untitled assignment";
}

function nextRunForCommand(run: Run, command: RunCommand) {
  const at = new Date().toISOString();
  const base = { ...run, updatedAt: at };

  if (command.type === "pause" && run.status === "running") {
    return {
      ...base,
      status: "paused",
      milestones: [
        ...run.milestones,
        {
          id: `${run.id}_paused_${run.milestones.length}`,
          kind: "paused",
          label: "Paused at safe boundary",
          detail: "Demo authority acknowledged the operator command.",
          at,
        },
      ],
    } satisfies Run;
  }

  if (command.type === "resume" && run.status === "paused") {
    return {
      ...base,
      status: "queued",
      host: undefined,
      lease: undefined,
      milestones: [
        ...run.milestones,
        {
          id: `${run.id}_resumed_${run.milestones.length}`,
          kind: "resumed",
          label: "Resume requested",
          detail: "Returned to the durable queue for a fresh fenced attempt.",
          at,
        },
      ],
    } satisfies Run;
  }

  if (
    command.type === "cancel" &&
    !["completed", "failed", "canceled"].includes(run.status)
  ) {
    return {
      ...base,
      status: "canceled",
      milestones: [
        ...run.milestones,
        {
          id: `${run.id}_canceled_${run.milestones.length}`,
          kind: "canceled",
          label: "Canceled by operator",
          detail: "Authority closed the run to further claims.",
          at,
        },
      ],
    } satisfies Run;
  }

  return run;
}

export function createDemoControlPlaneClient(
  seed: ControlPlaneSnapshot = initialSnapshot,
) {
  let snapshot = seed;
  let sequence = seed.runs.length;
  const listeners = new Set<() => void>();

  function publish(next: ControlPlaneSnapshot) {
    snapshot = next;
    listeners.forEach((listener) => listener());
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    submitWork: async (input: SubmitWorkInput) => {
      sequence += 1;
      const at = new Date().toISOString();
      const id = `run_demo_${String(sequence).padStart(3, "0")}`;
      const run = {
        id,
        title: titleFromPrompt(input.prompt),
        prompt: input.prompt,
        project: input.project,
        provider:
          input.provider === "openai"
            ? "OpenAI"
            : input.provider === "anthropic"
              ? "Anthropic"
              : input.provider,
        model: input.model,
        reasoning: input.reasoning,
        status: "queued",
        createdAt: at,
        updatedAt: at,
        milestones: [
          {
            id: `${id}_queued`,
            kind: "queued",
            label: "Accepted by authority",
            detail: "Durably queued before host selection.",
            at,
          },
        ],
      } satisfies Run;
      publish({ ...snapshot, runs: [run, ...snapshot.runs] });
      return id;
    },
    commandRun: async (runId, command) => {
      publish({
        ...snapshot,
        runs: snapshot.runs.map((run) =>
          run.id === runId ? nextRunForCommand(run, command) : run,
        ),
      });
    },
  } satisfies ControlPlaneClient;
}

export const demoControlPlaneClient = createDemoControlPlaneClient();
