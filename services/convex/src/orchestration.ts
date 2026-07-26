import { ConvexError, v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import type {
  AttemptState,
  AttemptStatus,
  AuthorityProof,
  MilestoneKind,
  RunState,
  RunStatus,
  ValidationStatus,
} from "./domain";
import { mutation, query } from "./_generated/server";
import {
  assertAuthority,
  AuthorityError,
  claimState,
  commandState,
  HOST_SESSION_DURATION_MS,
  LEASE_DURATION_MS,
  milestoneState,
  recoverExpiredState,
  renewLeaseState,
} from "./domain";
import {
  commandKindValidator,
  milestoneKindValidator,
  validationOutcomeValidator,
} from "./validators";

const activeAttemptStatuses = new Set<AttemptStatus>(["claimed", "running"]);

const proofArgs = {
  ownerId: v.string(),
  runId: v.id("runs"),
  attemptId: v.id("attempts"),
  hostId: v.id("hosts"),
  hostSessionId: v.string(),
  fencingGeneration: v.number(),
  controlGeneration: v.number(),
};

export const claimNext = mutation({
  args: {
    ownerId: v.string(),
    hostId: v.id("hosts"),
    hostSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    await recoverExpiredForOwner(ctx, args.ownerId, now);

    const host = await ctx.db.get("hosts", args.hostId);
    if (
      !host ||
      host.ownerId !== args.ownerId ||
      host.sessionId !== args.hostSessionId ||
      host.status !== "online" ||
      host.sessionExpiresAt <= now
    ) {
      throw authorityError(
        "HOST_SESSION_STALE",
        "Host must have a current online session before claiming",
      );
    }

    const hostAttempts = await ctx.db
      .query("attempts")
      .withIndex("by_host_session", (q) =>
        q.eq("hostId", args.hostId).eq("hostSessionId", args.hostSessionId),
      )
      .collect();
    const activeCount = hostAttempts.filter((attempt) =>
      activeAttemptStatuses.has(attempt.status),
    ).length;
    if (activeCount >= host.maxConcurrent) {
      return null;
    }

    const queuedRuns = await ctx.db
      .query("runs")
      .withIndex("by_owner_status_created_at", (q) =>
        q.eq("ownerId", args.ownerId).eq("status", "queued"),
      )
      .order("asc")
      .take(100);
    const hostCapabilities = new Set(host.capabilities);
    const run = queuedRuns.find((candidate) =>
      candidate.requiredCapabilities.every((capability) =>
        hostCapabilities.has(capability),
      ),
    );
    if (!run) {
      return null;
    }

    const previousAttempt = await ctx.db
      .query("attempts")
      .withIndex("by_run_attempt_number", (q) => q.eq("runId", run._id))
      .order("desc")
      .first();
    const generation = run.fencingGeneration + 1;
    const attemptId = await ctx.db.insert("attempts", {
      ownerId: args.ownerId,
      runId: run._id,
      attemptNumber: (previousAttempt?.attemptNumber ?? 0) + 1,
      hostId: args.hostId,
      hostSessionId: args.hostSessionId,
      fencingGeneration: generation,
      status: "claimed",
      claimedAt: now,
      leaseExpiresAt: now + LEASE_DURATION_MS,
      lastHeartbeatAt: now,
      updatedAt: now,
    });
    const state = domainCall(() => claimState(toRunState(run), attemptId, now));
    await ctx.db.patch("runs", run._id, {
      status: state.run.status,
      activeAttemptId: attemptId,
      fencingGeneration: generation,
      validationStatus: "pending",
      claimedAt: now,
      startedAt: undefined,
      finishedAt: undefined,
      resultSummary: undefined,
      failure: undefined,
      updatedAt: now,
    });

    return {
      run: {
        ...run,
        status: "claimed" as const,
        activeAttemptId: attemptId,
        fencingGeneration: generation,
        validationStatus: "pending" as const,
        claimedAt: now,
        updatedAt: now,
      },
      attempt: {
        attemptId,
        attemptNumber: (previousAttempt?.attemptNumber ?? 0) + 1,
        leaseExpiresAt: now + LEASE_DURATION_MS,
      },
      proof: {
        attemptId,
        hostId: args.hostId,
        hostSessionId: args.hostSessionId,
        fencingGeneration: generation,
        controlGeneration: run.controlGeneration,
      },
    };
  },
});

export const getAssignment = query({
  args: {
    ownerId: v.string(),
    runId: v.id("runs"),
    attemptId: v.id("attempts"),
    hostId: v.id("hosts"),
    hostSessionId: v.string(),
    fencingGeneration: v.number(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const [run, attempt, host] = await Promise.all([
      ctx.db.get("runs", args.runId),
      ctx.db.get("attempts", args.attemptId),
      ctx.db.get("hosts", args.hostId),
    ]);
    if (
      !run ||
      !attempt ||
      !host ||
      run.ownerId !== args.ownerId ||
      attempt.ownerId !== args.ownerId ||
      host.ownerId !== args.ownerId ||
      run.activeAttemptId !== args.attemptId ||
      attempt.runId !== args.runId ||
      attempt.hostId !== args.hostId ||
      attempt.hostSessionId !== args.hostSessionId ||
      host.sessionId !== args.hostSessionId ||
      run.fencingGeneration !== args.fencingGeneration ||
      attempt.fencingGeneration !== args.fencingGeneration ||
      attempt.leaseExpiresAt <= now ||
      host.sessionExpiresAt <= now
    ) {
      throw authorityError(
        "ATTEMPT_NOT_ACTIVE",
        "Assignment authority is no longer current",
      );
    }

    const commands = await ctx.db
      .query("commands")
      .withIndex("by_run_generation", (q) => q.eq("runId", args.runId))
      .order("asc")
      .collect();
    return {
      run,
      attempt,
      commands: commands.filter(
        (command) =>
          command.status === "pending" &&
          command.controlGeneration <= run.controlGeneration,
      ),
    };
  },
});

export const renewLease = mutation({
  args: proofArgs,
  handler: async (ctx, args) => {
    const now = Date.now();
    const { run, attempt } = await loadAuthoritativeAttempt(ctx, args, now);
    const patch = domainCall(() =>
      renewLeaseState(
        toRunState(run),
        toAttemptState(attempt),
        toProof(args),
        now,
      ),
    );
    const leaseExpiresAt = patch.attempt?.leaseExpiresAt;
    if (leaseExpiresAt === undefined) {
      throw new Error("Lease renewal did not produce an expiration");
    }
    await ctx.db.patch("attempts", attempt._id, {
      leaseExpiresAt,
      lastHeartbeatAt: now,
      updatedAt: now,
    });
    await ctx.db.patch("hosts", args.hostId, {
      status: "online",
      lastSeenAt: now,
      sessionExpiresAt: now + HOST_SESSION_DURATION_MS,
      updatedAt: now,
    });
    return { leaseExpiresAt };
  },
});

export const recordMilestone = mutation({
  args: {
    ...proofArgs,
    idempotencyKey: v.string(),
    kind: milestoneKindValidator,
    summary: v.string(),
    validation: v.optional(
      v.object({
        name: v.string(),
        outcome: validationOutcomeValidator,
        details: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    if (args.summary.length > 4_000) {
      throw new ConvexError({
        code: "MILESTONE_TOO_LARGE",
        message:
          "Milestones are sparse summaries and may not exceed 4000 chars",
      });
    }

    const existing = await ctx.db
      .query("milestones")
      .withIndex("by_attempt_idempotency_key", (q) =>
        q
          .eq("attemptId", args.attemptId)
          .eq("idempotencyKey", args.idempotencyKey),
      )
      .unique();
    if (existing) {
      if (
        existing.kind !== args.kind ||
        existing.fencingGeneration !== args.fencingGeneration ||
        existing.controlGeneration !== args.controlGeneration ||
        existing.summary !== args.summary ||
        JSON.stringify(existing.validation) !== JSON.stringify(args.validation)
      ) {
        throw new ConvexError({
          code: "IDEMPOTENCY_CONFLICT",
          message: "Milestone key was reused with different content",
        });
      }
      return { applied: false, milestoneId: existing._id };
    }

    if (args.kind === "validation" && !args.validation) {
      throw new ConvexError({
        code: "VALIDATION_RESULT_REQUIRED",
        message: "Validation milestones require a deterministic result",
      });
    }
    if (args.kind !== "validation" && args.validation) {
      throw new ConvexError({
        code: "UNEXPECTED_VALIDATION_RESULT",
        message: "Only validation milestones may include a validation result",
      });
    }

    const now = Date.now();
    const { run, attempt } = await loadAuthoritativeAttempt(ctx, args, now);
    const patch = domainCall(() =>
      milestoneState(
        toRunState(run),
        toAttemptState(attempt),
        toProof(args),
        {
          kind: args.kind,
          validationOutcome: args.validation?.outcome,
        },
        now,
      ),
    );

    const milestoneId = await ctx.db.insert("milestones", {
      ownerId: args.ownerId,
      runId: args.runId,
      attemptId: args.attemptId,
      idempotencyKey: args.idempotencyKey,
      kind: args.kind,
      fencingGeneration: args.fencingGeneration,
      controlGeneration: args.controlGeneration,
      summary: args.summary,
      validation: args.validation,
      createdAt: now,
    });

    await applyMilestonePatch(ctx, run, attempt, patch, args, now);
    await acknowledgeCurrentCommand(
      ctx,
      args.runId,
      args.controlGeneration,
      now,
    );
    return { applied: true, milestoneId };
  },
});

export const requestControl = mutation({
  args: {
    ownerId: v.string(),
    runId: v.id("runs"),
    idempotencyKey: v.string(),
    kind: commandKindValidator,
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get("runs", args.runId);
    if (!run || run.ownerId !== args.ownerId) {
      throw new ConvexError({
        code: "RUN_NOT_FOUND",
        message: "Run does not exist for owner",
      });
    }

    const existing = await ctx.db
      .query("commands")
      .withIndex("by_run_idempotency_key", (q) =>
        q.eq("runId", args.runId).eq("idempotencyKey", args.idempotencyKey),
      )
      .unique();
    if (existing) {
      if (existing.kind !== args.kind) {
        throw new ConvexError({
          code: "IDEMPOTENCY_CONFLICT",
          message: "Command key was reused for another command",
        });
      }
      return { created: false, command: existing };
    }

    const now = Date.now();
    const change = commandState(toRunState(run), args.kind);
    if (change.accepted) {
      const commands = await ctx.db
        .query("commands")
        .withIndex("by_run_generation", (q) => q.eq("runId", args.runId))
        .collect();
      await Promise.all(
        commands
          .filter((command) => command.status === "pending")
          .map((command) =>
            ctx.db.patch("commands", command._id, { status: "superseded" }),
          ),
      );

      await ctx.db.patch("runs", run._id, {
        status: change.run.status,
        controlGeneration: change.controlGeneration,
        updatedAt: now,
        finishedAt: change.run.status === "canceled" ? now : run.finishedAt,
      });
      if (
        args.kind === "resume" &&
        run.activeAttemptId &&
        run.startedAt !== undefined
      ) {
        await ctx.db.patch("attempts", run.activeAttemptId, {
          status: "running",
          updatedAt: now,
        });
      }
    }

    const commandId = await ctx.db.insert("commands", {
      ownerId: args.ownerId,
      runId: args.runId,
      idempotencyKey: args.idempotencyKey,
      kind: args.kind,
      status: change.status,
      controlGeneration: change.controlGeneration,
      createdAt: now,
      acknowledgedAt: change.status === "acknowledged" ? now : undefined,
    });
    return {
      created: true,
      command: {
        _id: commandId,
        kind: args.kind,
        status: change.status,
        controlGeneration: change.controlGeneration,
      },
    };
  },
});

export const recoverExpiredLeases = mutation({
  args: { ownerId: v.string() },
  handler: async (ctx, args) =>
    await recoverExpiredForOwner(ctx, args.ownerId, Date.now()),
});

async function recoverExpiredForOwner(
  ctx: MutationCtx,
  ownerId: string,
  now: number,
): Promise<number> {
  const expired = await ctx.db
    .query("attempts")
    .withIndex("by_lease_expiration", (q) => q.lte("leaseExpiresAt", now))
    .take(100);
  let recovered = 0;

  for (const attempt of expired) {
    if (
      attempt.ownerId !== ownerId ||
      !activeAttemptStatuses.has(attempt.status)
    ) {
      continue;
    }
    const run = await ctx.db.get("runs", attempt.runId);
    if (!run || run.ownerId !== ownerId) {
      continue;
    }
    const patch = recoverExpiredState(
      toRunState(run),
      toAttemptState(attempt),
      now,
    );
    if (!patch) {
      continue;
    }

    await ctx.db.patch("attempts", attempt._id, {
      status: patch.attempt?.status,
      finishedAt: now,
      updatedAt: now,
      failure:
        patch.attempt?.status === "expired"
          ? "Lease expired before the worker renewed authority"
          : undefined,
    });
    await ctx.db.patch("runs", run._id, {
      status: patch.run.status,
      activeAttemptId: undefined,
      validationStatus: patch.run.validationStatus,
      startedAt: patch.run.startedAt,
      finishedAt: patch.run.status === "canceled" ? now : undefined,
      updatedAt: now,
      failure:
        patch.run.status === "queued"
          ? "Previous attempt lease expired; queued for recovery"
          : undefined,
    });
    recovered += 1;
  }

  return recovered;
}

async function loadAuthoritativeAttempt(
  ctx: MutationCtx,
  args: {
    ownerId: string;
    runId: Id<"runs">;
    attemptId: Id<"attempts">;
    hostId: Id<"hosts">;
    hostSessionId: string;
    fencingGeneration: number;
    controlGeneration: number;
  },
  now: number,
): Promise<{ run: Doc<"runs">; attempt: Doc<"attempts"> }> {
  const [run, attempt, host] = await Promise.all([
    ctx.db.get("runs", args.runId),
    ctx.db.get("attempts", args.attemptId),
    ctx.db.get("hosts", args.hostId),
  ]);
  if (
    !run ||
    !attempt ||
    !host ||
    run.ownerId !== args.ownerId ||
    attempt.ownerId !== args.ownerId ||
    host.ownerId !== args.ownerId ||
    attempt.runId !== args.runId
  ) {
    throw authorityError(
      "ATTEMPT_NOT_ACTIVE",
      "Run or attempt does not exist for owner",
    );
  }
  if (
    host.sessionId !== args.hostSessionId ||
    host.sessionExpiresAt <= now ||
    attempt.hostId !== host._id
  ) {
    throw authorityError(
      "HOST_SESSION_STALE",
      "Host session has been replaced or expired",
    );
  }
  domainCall(() =>
    assertAuthority(
      toRunState(run),
      toAttemptState(attempt),
      toProof(args),
      now,
    ),
  );
  return { run, attempt };
}

async function applyMilestonePatch(
  ctx: MutationCtx,
  run: Doc<"runs">,
  attempt: Doc<"attempts">,
  patch: {
    run: Partial<RunState>;
    attempt?: Partial<AttemptState>;
  },
  args: {
    kind: MilestoneKind;
    summary: string;
    validation?: {
      name: string;
      outcome: "passed" | "failed";
      details?: string;
    };
  },
  now: number,
): Promise<void> {
  const runPatch: {
    status?: RunStatus;
    validationStatus?: ValidationStatus;
    activeAttemptId?: undefined;
    startedAt?: number;
    finishedAt?: number;
    resultSummary?: string;
    failure?: string;
    updatedAt: number;
  } = { updatedAt: now };
  if (patch.run.status) runPatch.status = patch.run.status;
  if (patch.run.validationStatus) {
    runPatch.validationStatus = patch.run.validationStatus;
  }
  if (Object.hasOwn(patch.run, "activeAttemptId")) {
    runPatch.activeAttemptId = undefined;
  }
  if (Object.hasOwn(patch.run, "startedAt")) {
    runPatch.startedAt = patch.run.startedAt;
  }
  if (
    args.kind === "completed" ||
    args.kind === "failed" ||
    args.kind === "canceled"
  ) {
    runPatch.finishedAt = now;
  }
  if (args.kind === "completed") runPatch.resultSummary = args.summary;
  if (args.kind === "failed") runPatch.failure = args.summary;

  const attemptPatch: {
    status?: AttemptStatus;
    startedAt?: number;
    finishedAt?: number;
    failure?: string;
    updatedAt: number;
  } = { updatedAt: now };
  if (patch.attempt?.status) attemptPatch.status = patch.attempt.status;
  if (args.kind === "started") attemptPatch.startedAt = now;
  if (
    args.kind === "paused" ||
    args.kind === "completed" ||
    args.kind === "failed" ||
    args.kind === "canceled"
  ) {
    attemptPatch.finishedAt = now;
  }
  if (args.kind === "failed") attemptPatch.failure = args.summary;

  await Promise.all([
    ctx.db.patch("runs", run._id, runPatch),
    ctx.db.patch("attempts", attempt._id, attemptPatch),
  ]);
}

async function acknowledgeCurrentCommand(
  ctx: MutationCtx,
  runId: Id<"runs">,
  controlGeneration: number,
  now: number,
): Promise<void> {
  const commands = await ctx.db
    .query("commands")
    .withIndex("by_run_generation", (q) =>
      q.eq("runId", runId).eq("controlGeneration", controlGeneration),
    )
    .collect();
  await Promise.all(
    commands
      .filter((command) => command.status === "pending")
      .map((command) =>
        ctx.db.patch("commands", command._id, {
          status: "acknowledged",
          acknowledgedAt: now,
        }),
      ),
  );
}

function toRunState(run: Doc<"runs">): RunState {
  return {
    status: run.status,
    validationStatus: run.validationStatus,
    fencingGeneration: run.fencingGeneration,
    controlGeneration: run.controlGeneration,
    activeAttemptId: run.activeAttemptId,
    startedAt: run.startedAt,
  };
}

function toAttemptState(attempt: Doc<"attempts">): AttemptState {
  return {
    id: attempt._id,
    hostId: attempt.hostId,
    hostSessionId: attempt.hostSessionId,
    fencingGeneration: attempt.fencingGeneration,
    status: attempt.status,
    leaseExpiresAt: attempt.leaseExpiresAt,
  };
}

function toProof(args: {
  attemptId: Id<"attempts">;
  hostId: Id<"hosts">;
  hostSessionId: string;
  fencingGeneration: number;
  controlGeneration: number;
}): AuthorityProof {
  return {
    attemptId: args.attemptId,
    hostId: args.hostId,
    hostSessionId: args.hostSessionId,
    fencingGeneration: args.fencingGeneration,
    controlGeneration: args.controlGeneration,
  };
}

function domainCall<T>(fn: () => T): T {
  try {
    return fn();
  } catch (error) {
    if (error instanceof AuthorityError) {
      throw authorityError(error.code, error.message);
    }
    throw error;
  }
}

function authorityError(code: string, message: string): ConvexError<string> {
  return new ConvexError(JSON.stringify({ code, message }));
}
