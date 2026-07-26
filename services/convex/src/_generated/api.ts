/**
 * Function references for clients before a deployment-backed codegen run.
 * This preserves the normal `api.runs.submit` call shape, albeit untyped.
 */
import { anyApi } from "convex/server";

export const api = anyApi;
