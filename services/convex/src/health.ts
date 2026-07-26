import { queryGeneric } from "convex/server";

export const check = queryGeneric({
  args: {},
  handler: () => ({ authority: "convex", ok: true }),
});
