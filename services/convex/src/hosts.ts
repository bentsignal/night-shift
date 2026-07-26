import { ConvexError, v } from "convex/values";

import type { AttemptStatus } from "./domain";
import { mutation, query } from "./_generated/server";
import { HOST_SESSION_DURATION_MS } from "./domain";

const activeAttemptStatuses = new Set<AttemptStatus>([
  "claimed",
  "running",
  "paused",
]);

export const register = mutation({
  args: {
    ownerId: v.string(),
    hostKey: v.string(),
    sessionId: v.string(),
    displayName: v.string(),
    capabilities: v.array(v.string()),
    maxConcurrent: v.number(),
  },
  handler: async (ctx, args) => {
    if (!Number.isInteger(args.maxConcurrent) || args.maxConcurrent < 1) {
      throw new ConvexError({
        code: "INVALID_CAPACITY",
        message: "maxConcurrent must be a positive integer",
      });
    }

    const existing = await ctx.db
      .query("hosts")
      .withIndex("by_owner_host_key", (q) =>
        q.eq("ownerId", args.ownerId).eq("hostKey", args.hostKey),
      )
      .unique();
    const now = Date.now();
    const patch = {
      sessionId: args.sessionId,
      displayName: args.displayName,
      status: "online" as const,
      capabilities: [...new Set(args.capabilities)].sort(),
      maxConcurrent: args.maxConcurrent,
      updatedAt: now,
      lastSeenAt: now,
      sessionExpiresAt: now + HOST_SESSION_DURATION_MS,
    };

    if (existing) {
      await ctx.db.patch("hosts", existing._id, patch);
      return { created: false, hostId: existing._id };
    }

    const hostId = await ctx.db.insert("hosts", {
      ownerId: args.ownerId,
      hostKey: args.hostKey,
      createdAt: now,
      ...patch,
    });
    return { created: true, hostId };
  },
});

export const heartbeat = mutation({
  args: {
    ownerId: v.string(),
    hostId: v.id("hosts"),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const host = await ctx.db.get("hosts", args.hostId);
    assertCurrentSession(host, args.ownerId, args.sessionId);

    const now = Date.now();
    await ctx.db.patch("hosts", args.hostId, {
      status: "online",
      updatedAt: now,
      lastSeenAt: now,
      sessionExpiresAt: now + HOST_SESSION_DURATION_MS,
    });
    return { sessionExpiresAt: now + HOST_SESSION_DURATION_MS };
  },
});

export const setDraining = mutation({
  args: {
    ownerId: v.string(),
    hostId: v.id("hosts"),
    sessionId: v.string(),
    draining: v.boolean(),
  },
  handler: async (ctx, args) => {
    const host = await ctx.db.get("hosts", args.hostId);
    assertCurrentSession(host, args.ownerId, args.sessionId);
    await ctx.db.patch("hosts", args.hostId, {
      status: args.draining ? "draining" : "online",
      updatedAt: Date.now(),
    });
  },
});

export const list = query({
  args: { ownerId: v.string() },
  handler: async (ctx, args) => {
    const hosts = await ctx.db
      .query("hosts")
      .withIndex("by_owner_status", (q) => q.eq("ownerId", args.ownerId))
      .collect();

    return await Promise.all(
      hosts.map(async (host) => {
        const attempts = await ctx.db
          .query("attempts")
          .withIndex("by_host_session", (q) =>
            q.eq("hostId", host._id).eq("hostSessionId", host.sessionId),
          )
          .collect();
        return {
          ...host,
          activeAssignments: attempts.filter((attempt) =>
            activeAttemptStatuses.has(attempt.status),
          ).length,
        };
      }),
    );
  },
});

function assertCurrentSession(
  host: { ownerId: string; sessionId: string } | null,
  ownerId: string,
  sessionId: string,
): asserts host is { ownerId: string; sessionId: string } {
  if (!host || host.ownerId !== ownerId || host.sessionId !== sessionId) {
    throw new ConvexError({
      code: "HOST_SESSION_STALE",
      message: "Host session is not current",
    });
  }
}
