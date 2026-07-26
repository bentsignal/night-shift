import { v } from "convex/values";

export const runStatusValidator = v.union(
  v.literal("queued"),
  v.literal("claimed"),
  v.literal("running"),
  v.literal("pause_requested"),
  v.literal("paused"),
  v.literal("cancel_requested"),
  v.literal("canceled"),
  v.literal("failed"),
  v.literal("completed"),
);

export const attemptStatusValidator = v.union(
  v.literal("claimed"),
  v.literal("running"),
  v.literal("paused"),
  v.literal("expired"),
  v.literal("canceled"),
  v.literal("failed"),
  v.literal("completed"),
);

export const hostStatusValidator = v.union(
  v.literal("online"),
  v.literal("draining"),
  v.literal("offline"),
);

export const milestoneKindValidator = v.union(
  v.literal("started"),
  v.literal("checkpoint"),
  v.literal("paused"),
  v.literal("validation"),
  v.literal("failed"),
  v.literal("canceled"),
  v.literal("completed"),
);

export const commandKindValidator = v.union(
  v.literal("pause"),
  v.literal("resume"),
  v.literal("cancel"),
);

export const commandStatusValidator = v.union(
  v.literal("pending"),
  v.literal("acknowledged"),
  v.literal("superseded"),
);

export const validationStatusValidator = v.union(
  v.literal("pending"),
  v.literal("passed"),
  v.literal("failed"),
);

export const validationOutcomeValidator = v.union(
  v.literal("passed"),
  v.literal("failed"),
);
