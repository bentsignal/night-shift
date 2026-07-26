import { ConvexError, v } from "convex/values";

import { mutation, query } from "./_generated/server";

export const submit = mutation({
  args: {
    ownerId: v.string(),
    submitKey: v.string(),
    prompt: v.string(),
    projectId: v.optional(v.string()),
    requiredCapabilities: v.optional(v.array(v.string())),
    runtime: v.optional(
      v.object({
        provider: v.string(),
        model: v.string(),
        reasoningLevel: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("runs")
      .withIndex("by_owner_submit_key", (q) =>
        q.eq("ownerId", args.ownerId).eq("submitKey", args.submitKey),
      )
      .unique();

    if (existing) {
      if (
        existing.prompt !== args.prompt ||
        existing.projectId !== args.projectId ||
        JSON.stringify(existing.requiredCapabilities) !==
          JSON.stringify(
            [...new Set(args.requiredCapabilities ?? [])].sort(),
          ) ||
        JSON.stringify(existing.runtime) !== JSON.stringify(args.runtime)
      ) {
        throw new ConvexError({
          code: "IDEMPOTENCY_CONFLICT",
          message: "submitKey was already used for different work",
        });
      }
      return { created: false, runId: existing._id };
    }

    const now = Date.now();
    const runId = await ctx.db.insert("runs", {
      ownerId: args.ownerId,
      submitKey: args.submitKey,
      prompt: args.prompt,
      projectId: args.projectId,
      requiredCapabilities: [
        ...new Set(args.requiredCapabilities ?? []),
      ].sort(),
      runtime: args.runtime,
      status: "queued",
      validationStatus: "pending",
      fencingGeneration: 0,
      controlGeneration: 0,
      createdAt: now,
      updatedAt: now,
    });

    return { created: true, runId };
  },
});

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
