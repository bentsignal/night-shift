import { defineSchema } from "convex/server";

// The first vertical slice owns the durable orchestration tables. This empty
// schema keeps the Convex package deployable without preempting that model.
export default defineSchema({});
