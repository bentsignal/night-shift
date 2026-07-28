import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

import type {
  AttemptIdentity,
  AuthorityReply,
  HostRegistration,
  LeaseReply,
  RuntimeMilestone,
  ValidationResult,
  WorkerAssignment,
  WorkerAuthority,
} from "./types.ts";

type Mutation = ReturnType<typeof makeFunctionReference<"mutation">>;
type Query = ReturnType<typeof makeFunctionReference<"query">>;

const mutations = {
  registerHost: makeFunctionReference<"mutation">("hosts:register"),
  claimNext: makeFunctionReference<"mutation">("orchestration:claimNext"),
  renewLease: makeFunctionReference<"mutation">("orchestration:renewLease"),
  recordMilestone: makeFunctionReference<"mutation">(
    "orchestration:recordMilestone",
  ),
} satisfies Record<string, Mutation>;

const queries = {
  getAssignment: makeFunctionReference<"query">("orchestration:getAssignment"),
} satisfies Record<string, Query>;

export class ConvexWorkerAuthority implements WorkerAuthority {
  readonly #client: ConvexHttpClient;
  readonly #ownerId: string;

  constructor(url: string, ownerId: string) {
    this.#client = new ConvexHttpClient(url);
    this.#ownerId = ownerId;
  }

  async registerHost(
    input: Parameters<WorkerAuthority["registerHost"]>[0],
  ): Promise<HostRegistration> {
    const result = await this.#mutate<{ hostId: string }>(
      mutations.registerHost,
      {
        hostKey: input.hostKey,
        sessionId: input.sessionId,
        displayName: input.displayName,
        capabilities: [
          input.capabilities.platform,
          input.capabilities.arch,
          ...input.capabilities.providers,
        ],
        maxConcurrent: input.capabilities.maxConcurrent,
      },
    );
    return { hostId: result.hostId, sessionId: input.sessionId };
  }

  async claimNext(input: HostRegistration): Promise<WorkerAssignment | null> {
    const result = await this.#mutate<ClaimResult | null>(mutations.claimNext, {
      hostId: input.hostId,
      hostSessionId: input.sessionId,
    });
    if (!result) return null;
    const runtime = result.run.runtime;
    return {
      runId: result.run._id,
      attemptId: result.attempt.attemptId,
      generation: result.proof.fencingGeneration,
      hostId: result.proof.hostId,
      hostSessionId: result.proof.hostSessionId,
      prompt: result.run.prompt,
      projectPath: result.run.projectId ?? process.cwd(),
      leaseExpiresAt: result.attempt.leaseExpiresAt,
      controlGeneration: result.proof.controlGeneration,
      selection: {
        provider: runtime?.provider ?? "openai-codex",
        model: runtime?.model ?? "gpt-5.6-sol",
        reasoning: normalizeReasoning(runtime?.reasoningLevel),
      },
    };
  }

  async renewLease(input: AttemptIdentity): Promise<LeaseReply> {
    const assignment = await this.#query<AssignmentResult>(
      queries.getAssignment,
      proofWithoutControl(input),
    );
    const controlGeneration = assignment.run.controlGeneration;
    const renewed = await this.#mutate<{ leaseExpiresAt: number }>(
      mutations.renewLease,
      { ...proofWithoutControl(input), controlGeneration },
    );
    return {
      accepted: true,
      leaseExpiresAt: renewed.leaseExpiresAt,
      desiredState: desiredStateOf(assignment.run.status),
      controlGeneration,
    };
  }

  startAttempt(
    input: AttemptIdentity & { operationId: string },
  ): Promise<AuthorityReply> {
    return this.#milestone(input, "started", "Execution started.");
  }

  recordMilestone(
    input: AttemptIdentity & RuntimeMilestone,
  ): Promise<AuthorityReply> {
    return this.#milestone(input, "checkpoint", input.summary);
  }

  publishValidation(
    input: AttemptIdentity & {
      operationId: string;
      validation: ValidationResult;
    },
  ): Promise<AuthorityReply> {
    return this.#milestone(input, "validation", input.validation.summary, {
      name: input.validation.name,
      outcome: input.validation.status,
      details: JSON.stringify({
        exitCode: input.validation.exitCode,
        durationMs: input.validation.durationMs,
      }),
    });
  }

  pauseAttempt(
    input: Parameters<WorkerAuthority["pauseAttempt"]>[0],
  ): Promise<AuthorityReply> {
    return this.#milestone(input, "paused", input.summary);
  }

  cancelAttempt(
    input: Parameters<WorkerAuthority["cancelAttempt"]>[0],
  ): Promise<AuthorityReply> {
    return this.#milestone(input, "canceled", input.summary);
  }

  failAttempt(
    input: Parameters<WorkerAuthority["failAttempt"]>[0],
  ): Promise<AuthorityReply> {
    return this.#milestone(input, "failed", input.message);
  }

  completeAttempt(
    input: Parameters<WorkerAuthority["completeAttempt"]>[0],
  ): Promise<AuthorityReply> {
    return this.#milestone(input, "completed", input.summary);
  }

  async #milestone(
    input: AttemptIdentity & { operationId: string },
    kind:
      | "started"
      | "checkpoint"
      | "paused"
      | "validation"
      | "failed"
      | "canceled"
      | "completed",
    summary: string,
    validation?: {
      name: string;
      outcome: "passed" | "failed";
      details?: string;
    },
  ): Promise<AuthorityReply> {
    await this.#mutate(mutations.recordMilestone, {
      ...proofWithoutControl(input),
      controlGeneration: input.controlGeneration,
      idempotencyKey: input.operationId,
      kind,
      summary,
      validation,
    });
    return { accepted: true };
  }

  #mutate<T>(reference: Mutation, input: object): Promise<T> {
    return this.#client.mutation(reference, {
      ...input,
      ownerId: this.#ownerId,
    }) as Promise<T>;
  }

  #query<T>(reference: Query, input: object): Promise<T> {
    return this.#client.query(reference, {
      ...input,
      ownerId: this.#ownerId,
    }) as Promise<T>;
  }
}

interface ClaimResult {
  run: {
    _id: string;
    prompt: string;
    projectId?: string;
    runtime?: {
      provider: string;
      model: string;
      reasoningLevel?: string;
    };
  };
  attempt: {
    attemptId: string;
    leaseExpiresAt: number;
  };
  proof: {
    hostId: string;
    hostSessionId: string;
    fencingGeneration: number;
    controlGeneration: number;
  };
}

interface AssignmentResult {
  run: {
    status: string;
    controlGeneration: number;
  };
}

function proofWithoutControl(input: AttemptIdentity) {
  return {
    runId: input.runId,
    attemptId: input.attemptId,
    hostId: input.hostId,
    hostSessionId: input.hostSessionId,
    fencingGeneration: input.generation,
  };
}

function desiredStateOf(status: string) {
  if (status === "pause_requested" || status === "paused") return "paused";
  if (status === "cancel_requested" || status === "canceled") return "canceled";
  return "running";
}

function normalizeReasoning(value: string | undefined) {
  if (
    value === "off" ||
    value === "minimal" ||
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "xhigh" ||
    value === "max"
  ) {
    return value;
  }
  return "high";
}
