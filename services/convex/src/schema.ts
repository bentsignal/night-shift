import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import {
  attemptStatusValidator,
  commandKindValidator,
  commandStatusValidator,
  hostStatusValidator,
  milestoneKindValidator,
  runStatusValidator,
  validationOutcomeValidator,
  validationStatusValidator,
} from "./validators";

/**
 * Convex is the authority for orchestration, but it deliberately does not hold
 * provider credentials or high-volume agent output. The explicit ownerId field
 * is the seam where deployment authentication will replace personal-mode args.
 */
export default defineSchema({
  runs: defineTable({
    ownerId: v.string(),
    submitKey: v.string(),
    prompt: v.string(),
    projectId: v.optional(v.string()),
    requiredCapabilities: v.array(v.string()),
    runtime: v.optional(
      v.object({
        provider: v.string(),
        model: v.string(),
        reasoningLevel: v.optional(v.string()),
      }),
    ),
    status: runStatusValidator,
    validationStatus: validationStatusValidator,
    fencingGeneration: v.number(),
    controlGeneration: v.number(),
    activeAttemptId: v.optional(v.id("attempts")),
    createdAt: v.number(),
    updatedAt: v.number(),
    claimedAt: v.optional(v.number()),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
    resultSummary: v.optional(v.string()),
    failure: v.optional(v.string()),
  })
    .index("by_owner_submit_key", ["ownerId", "submitKey"])
    .index("by_owner_status_created_at", ["ownerId", "status", "createdAt"])
    .index("by_owner_updated_at", ["ownerId", "updatedAt"]),

  hosts: defineTable({
    ownerId: v.string(),
    hostKey: v.string(),
    sessionId: v.string(),
    displayName: v.string(),
    status: hostStatusValidator,
    capabilities: v.array(v.string()),
    maxConcurrent: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    lastSeenAt: v.number(),
    sessionExpiresAt: v.number(),
  })
    .index("by_owner_host_key", ["ownerId", "hostKey"])
    .index("by_owner_status", ["ownerId", "status"]),

  attempts: defineTable({
    ownerId: v.string(),
    runId: v.id("runs"),
    attemptNumber: v.number(),
    hostId: v.id("hosts"),
    hostSessionId: v.string(),
    fencingGeneration: v.number(),
    status: attemptStatusValidator,
    claimedAt: v.number(),
    startedAt: v.optional(v.number()),
    finishedAt: v.optional(v.number()),
    leaseExpiresAt: v.number(),
    lastHeartbeatAt: v.number(),
    updatedAt: v.number(),
    failure: v.optional(v.string()),
  })
    .index("by_run_attempt_number", ["runId", "attemptNumber"])
    .index("by_host_session", ["hostId", "hostSessionId"])
    .index("by_lease_expiration", ["leaseExpiresAt"]),

  milestones: defineTable({
    ownerId: v.string(),
    runId: v.id("runs"),
    attemptId: v.id("attempts"),
    idempotencyKey: v.string(),
    kind: milestoneKindValidator,
    fencingGeneration: v.number(),
    controlGeneration: v.number(),
    summary: v.string(),
    validation: v.optional(
      v.object({
        name: v.string(),
        outcome: validationOutcomeValidator,
        details: v.optional(v.string()),
      }),
    ),
    createdAt: v.number(),
  })
    .index("by_attempt_idempotency_key", ["attemptId", "idempotencyKey"])
    .index("by_run_created_at", ["runId", "createdAt"]),

  commands: defineTable({
    ownerId: v.string(),
    runId: v.id("runs"),
    idempotencyKey: v.string(),
    kind: commandKindValidator,
    status: commandStatusValidator,
    controlGeneration: v.number(),
    createdAt: v.number(),
    acknowledgedAt: v.optional(v.number()),
  })
    .index("by_run_idempotency_key", ["runId", "idempotencyKey"])
    .index("by_run_generation", ["runId", "controlGeneration"]),
});
