import { v } from "convex/values";
import * as Effect from "effect/Effect";

import { query } from "./_generated/server";
import {
  ExperimentalDatabaseReader,
  experimentalDatabaseSchema,
  ExperimentalDatabaseWriter,
  registerExperimentalConfectFunction,
  submitSpec,
} from "./experimentalConfect";

export const submit = registerExperimentalConfectFunction(
  experimentalDatabaseSchema,
  submitSpec,
  Effect.fn(function* (args) {
    const reader = yield* ExperimentalDatabaseReader;
    const writer = yield* ExperimentalDatabaseWriter;
    const requiredCapabilities = [
      ...new Set(args.requiredCapabilities ?? []),
    ].sort();
    const matches = yield* reader
      .table("runs")
      .index("by_owner_submit_key", (q) =>
        q.eq("ownerId", args.ownerId).eq("submitKey", args.submitKey),
      )
      .take(2)
      .pipe(Effect.orDie);

    if (matches.length > 1) {
      return yield* Effect.dieMessage(
        "runs:submit expected ownerId and submitKey to identify one run",
      );
    }

    const existing = matches[0];
    if (existing !== undefined) {
      if (
        existing.prompt !== args.prompt ||
        existing.projectId !== args.projectId ||
        JSON.stringify(existing.requiredCapabilities) !==
          JSON.stringify(requiredCapabilities) ||
        JSON.stringify(existing.runtime) !== JSON.stringify(args.runtime)
      ) {
        return yield* Effect.fail({
          code: "IDEMPOTENCY_CONFLICT" as const,
          message: "submitKey was already used for different work",
        });
      }
      return { created: false, runId: existing._id };
    }

    const now = Date.now();
    const runId = yield* writer
      .table("runs")
      .insert({
        ownerId: args.ownerId,
        submitKey: args.submitKey,
        prompt: args.prompt,
        projectId: args.projectId,
        requiredCapabilities,
        runtime: args.runtime,
        status: "queued",
        validationStatus: "pending",
        fencingGeneration: 0,
        controlGeneration: 0,
        createdAt: now,
        updatedAt: now,
      })
      .pipe(Effect.orDie);

    return { created: true, runId };
  }),
);

export const get = query({
  args: { ownerId: v.string(), runId: v.id("runs") },
  handler: async (ctx, args) => {
    const run = await ctx.db.get("runs", args.runId);
    if (!run || run.ownerId !== args.ownerId) {
      return null;
    }

    const [attempts, milestones, commands] = await Promise.all([
      ctx.db
        .query("attempts")
        .withIndex("by_run_attempt_number", (q) => q.eq("runId", args.runId))
        .order("asc")
        .collect(),
      ctx.db
        .query("milestones")
        .withIndex("by_run_created_at", (q) => q.eq("runId", args.runId))
        .order("asc")
        .collect(),
      ctx.db
        .query("commands")
        .withIndex("by_run_generation", (q) => q.eq("runId", args.runId))
        .order("asc")
        .collect(),
    ]);

    return { run, attempts, milestones, commands };
  },
});

export const list = query({
  args: {
    ownerId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(args.limit ?? 50, 100));
    return await ctx.db
      .query("runs")
      .withIndex("by_owner_updated_at", (q) => q.eq("ownerId", args.ownerId))
      .order("desc")
      .take(limit);
  },
});
