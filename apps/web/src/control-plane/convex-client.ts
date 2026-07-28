import { ConvexClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

import type {
  ControlPlaneClient,
  ControlPlaneSnapshot,
  Host,
  Milestone,
  Run,
  RunCommand,
  SubmitWorkInput,
} from "./types";

type Query = ReturnType<typeof makeFunctionReference<"query">>;
type Mutation = ReturnType<typeof makeFunctionReference<"mutation">>;

const queries = {
  runs: makeFunctionReference<"query">("runs:list"),
  run: makeFunctionReference<"query">("runs:get"),
  hosts: makeFunctionReference<"query">("hosts:list"),
} satisfies Record<string, Query>;

const mutations = {
  submit: makeFunctionReference<"mutation">("runs:submit"),
  command: makeFunctionReference<"mutation">("orchestration:requestControl"),
} satisfies Record<string, Mutation>;

export class ConvexControlPlaneClient implements ControlPlaneClient {
  readonly #client: ConvexClient;
  readonly #ownerId: string;
  readonly #listeners = new Set<() => void>();
  readonly #detailSubscriptions = new Map<string, () => void>();
  readonly #details = new Map<string, RawRunDetail>();
  readonly #subscriptions: (() => void)[] = [];
  #runs: RawRun[] = [];
  #hosts: RawHost[] = [];
  #runsLoaded = false;
  #hostsLoaded = false;
  #authority: ControlPlaneSnapshot["authority"] = "recovering";
  #snapshot: ControlPlaneSnapshot = {
    authority: "recovering",
    hosts: [],
    runs: [],
  };

  constructor(url: string, ownerId = "personal") {
    this.#client = new ConvexClient(url);
    this.#ownerId = ownerId;
    this.#subscriptions.push(
      this.#client.onUpdate(
        queries.runs,
        { ownerId, limit: 100 },
        (runs) => {
          this.#runsLoaded = true;
          this.#runs = runs as RawRun[];
          this.#updateAuthority();
          this.#syncDetails();
          this.#publish();
        },
        () => this.#setOffline(),
      ),
      this.#client.onUpdate(
        queries.hosts,
        { ownerId },
        (hosts) => {
          this.#hostsLoaded = true;
          this.#hosts = hosts as RawHost[];
          this.#updateAuthority();
          this.#publish();
        },
        () => this.#setOffline(),
      ),
    );
  }

  getSnapshot = (): ControlPlaneSnapshot => this.#snapshot;

  subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  };

  submitWork = async (input: SubmitWorkInput): Promise<string> => {
    const result = (await this.#client.mutation(mutations.submit, {
      ownerId: this.#ownerId,
      submitKey: operationId(),
      prompt: input.prompt,
      projectId: input.project,
      runtime: {
        provider: input.provider,
        model: input.model,
        reasoningLevel: input.reasoning,
      },
    })) as { runId: string };
    return result.runId;
  };

  commandRun = async (runId: string, command: RunCommand): Promise<void> => {
    await this.#client.mutation(mutations.command, {
      ownerId: this.#ownerId,
      runId,
      idempotencyKey: operationId(),
      kind: command.type,
    });
  };

  async close(): Promise<void> {
    for (const unsubscribe of this.#subscriptions) unsubscribe();
    for (const unsubscribe of this.#detailSubscriptions.values()) {
      unsubscribe();
    }
    this.#detailSubscriptions.clear();
    await this.#client.close();
  }

  #syncDetails(): void {
    const currentIds = new Set(this.#runs.map((run) => run._id));
    for (const [runId, unsubscribe] of this.#detailSubscriptions) {
      if (currentIds.has(runId)) continue;
      unsubscribe();
      this.#detailSubscriptions.delete(runId);
      this.#details.delete(runId);
    }
    for (const runId of currentIds) {
      if (this.#detailSubscriptions.has(runId)) continue;
      const unsubscribe = this.#client.onUpdate(
        queries.run,
        { ownerId: this.#ownerId, runId },
        (detail) => {
          if (detail) this.#details.set(runId, detail as RawRunDetail);
          this.#publish();
        },
        () => this.#setOffline(),
      );
      this.#detailSubscriptions.set(runId, unsubscribe);
    }
  }

  #setOffline(): void {
    this.#authority = "offline";
    this.#publish();
  }

  #updateAuthority(): void {
    this.#authority =
      this.#runsLoaded && this.#hostsLoaded ? "connected" : "recovering";
  }

  #publish(): void {
    this.#snapshot = {
      authority: this.#authority,
      hosts: this.#hosts.map(toHost),
      runs: this.#runs.map((run) => toRun(run, this.#details.get(run._id))),
    };
    for (const listener of this.#listeners) listener();
  }
}

interface RawRun {
  _id: string;
  prompt: string;
  projectId?: string;
  runtime?: {
    provider: string;
    model: string;
    reasoningLevel?: string;
  };
  status: string;
  fencingGeneration: number;
  createdAt: number;
  updatedAt: number;
  activeAttemptId?: string;
}

interface RawAttempt {
  _id: string;
  hostId: string;
  leaseExpiresAt: number;
  fencingGeneration: number;
}

interface RawMilestone {
  _id: string;
  kind: string;
  summary: string;
  createdAt: number;
  validation?: {
    name: string;
    outcome: "passed" | "failed";
    details?: string;
  };
}

interface RawRunDetail {
  run: RawRun;
  attempts: RawAttempt[];
  milestones: RawMilestone[];
}

interface RawHost {
  _id: string;
  displayName: string;
  status: string;
  capabilities: string[];
  activeAssignments: number;
  lastSeenAt: number;
  sessionExpiresAt: number;
}

function toRun(run: RawRun, detail: RawRunDetail | undefined) {
  const attempt =
    detail?.attempts.find(
      (candidate) => candidate._id === run.activeAttemptId,
    ) ?? detail?.attempts.at(-1);
  const validationMilestone = [...(detail?.milestones ?? [])]
    .reverse()
    .find((milestone) => milestone.kind === "validation");
  const validationDetails = parseValidationDetails(
    validationMilestone?.validation?.details,
  );
  return {
    id: run._id,
    title: runTitle(run.prompt),
    prompt: run.prompt,
    project: run.projectId ?? "Unspecified project",
    provider: run.runtime?.provider ?? "openai-codex",
    model: run.runtime?.model ?? "gpt-5.6-sol",
    reasoning: normalizeReasoning(run.runtime?.reasoningLevel),
    status: normalizeStatus(run.status),
    createdAt: new Date(run.createdAt).toISOString(),
    updatedAt: new Date(run.updatedAt).toISOString(),
    host: attempt
      ? { id: attempt.hostId, name: hostName(attempt.hostId) }
      : undefined,
    lease: attempt
      ? {
          generation: attempt.fencingGeneration,
          expiresAt: new Date(attempt.leaseExpiresAt).toISOString(),
        }
      : undefined,
    validation: validationMilestone?.validation
      ? {
          command: validationMilestone.validation.name,
          passed: validationMilestone.validation.outcome === "passed",
          durationMs: validationDetails.durationMs ?? 0,
        }
      : undefined,
    milestones: (detail?.milestones ?? []).map(toMilestone),
  } satisfies Run;
}

export function runTitle(prompt: string) {
  const firstLine = prompt.trim().split("\n")[0]?.replace(/\s+/g, " ") ?? "";
  if (!firstLine) return "Untitled assignment";
  if (firstLine.length <= 72) return firstLine;

  const preview = firstLine.slice(0, 69);
  const boundary = preview.lastIndexOf(" ");
  return `${preview.slice(0, boundary > 48 ? boundary : 69).trimEnd()}…`;
}

function toMilestone(milestone: RawMilestone) {
  const kind =
    milestone.kind === "checkpoint"
      ? "progress"
      : (milestone.kind as Milestone["kind"]);
  return {
    id: milestone._id,
    kind,
    label: kind.charAt(0).toUpperCase() + kind.slice(1),
    detail: milestone.summary,
    at: new Date(milestone.createdAt).toISOString(),
  } satisfies Milestone;
}

function toHost(host: RawHost) {
  const expired = host.sessionExpiresAt <= Date.now();
  return {
    id: host._id,
    name: host.displayName,
    health:
      expired || host.status !== "online"
        ? "offline"
        : host.activeAssignments > 0
          ? "busy"
          : "ready",
    lastSeenAt: new Date(host.lastSeenAt).toISOString(),
    capabilities: host.capabilities,
  } satisfies Host;
}

function normalizeStatus(status: string) {
  if (status === "pause_requested") return "running";
  if (status === "cancel_requested") return "canceling";
  if (
    status === "queued" ||
    status === "claimed" ||
    status === "running" ||
    status === "paused" ||
    status === "canceled" ||
    status === "failed" ||
    status === "completed"
  ) {
    return status;
  }
  return "failed";
}

function normalizeReasoning(value: string | undefined) {
  return value === "medium" || value === "xhigh" ? value : "high";
}

function hostName(hostId: string) {
  return `Host ${hostId.slice(-6)}`;
}

function parseValidationDetails(value: string | undefined) {
  if (!value) return {};
  try {
    return JSON.parse(value) as { durationMs?: number };
  } catch {
    return {};
  }
}

function operationId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}
