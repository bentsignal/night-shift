import type { Handler, RegisteredFunction } from "@confect/server";
import { FunctionSpec, GenericId } from "@confect/core";
import {
  DatabaseReader,
  DatabaseSchema,
  DatabaseWriter,
  RegisteredConvexFunction,
  RegistryItem,
  Table,
} from "@confect/server";
import * as Schema from "effect/Schema";

const runtime = Schema.Struct({
  provider: Schema.String,
  model: Schema.String,
  reasoningLevel: Schema.optional(Schema.String),
});

const runs = Table.make(() =>
  Schema.Struct({
    ownerId: Schema.String,
    submitKey: Schema.String,
    prompt: Schema.String,
    projectId: Schema.optional(Schema.String),
    requiredCapabilities: Schema.Array(Schema.String),
    runtime: Schema.optional(runtime),
    status: Schema.Literal(
      "queued",
      "claimed",
      "running",
      "pause_requested",
      "paused",
      "cancel_requested",
      "canceled",
      "failed",
      "completed",
    ),
    validationStatus: Schema.Literal("pending", "passed", "failed"),
    fencingGeneration: Schema.Number,
    controlGeneration: Schema.Number,
    activeAttemptId: Schema.optional(GenericId.GenericId("attempts")),
    createdAt: Schema.Number,
    updatedAt: Schema.Number,
    claimedAt: Schema.optional(Schema.Number),
    startedAt: Schema.optional(Schema.Number),
    finishedAt: Schema.optional(Schema.Number),
    resultSummary: Schema.optional(Schema.String),
    failure: Schema.optional(Schema.String),
  }),
)
  .index("by_owner_submit_key", ["ownerId", "submitKey"])
  .index("by_owner_status_created_at", ["ownerId", "status", "createdAt"])
  .index("by_owner_updated_at", ["ownerId", "updatedAt"])("runs");

/**
 * This is deliberately a runtime-only subset of the hand-authored Convex
 * schema. It lets one real function exercise Confect without making Confect's
 * CLI the owner of `src/` or `src/schema.ts`.
 */
export const experimentalDatabaseSchema = DatabaseSchema.make({ runs });

export const ExperimentalDatabaseReader =
  DatabaseReader.DatabaseReader<typeof experimentalDatabaseSchema>();
export const ExperimentalDatabaseWriter =
  DatabaseWriter.DatabaseWriter<typeof experimentalDatabaseSchema>();

export const SubmitArgs = Schema.Struct({
  ownerId: Schema.String,
  submitKey: Schema.String,
  prompt: Schema.String,
  projectId: Schema.optional(Schema.String),
  requiredCapabilities: Schema.optional(Schema.Array(Schema.String)),
  runtime: Schema.optional(runtime),
});

export const SubmitResult = Schema.Struct({
  created: Schema.Boolean,
  runId: GenericId.GenericId("runs"),
});

export const SubmitError = Schema.Struct({
  code: Schema.Literal("IDEMPOTENCY_CONFLICT"),
  message: Schema.String,
});

export const submitSpec = FunctionSpec.publicMutation({
  name: "submit",
  args: () => SubmitArgs,
  returns: () => SubmitResult,
  error: () => SubmitError,
});

/**
 * Confect's documented path generates a group registry and retains each
 * registered function's precise type. The public low-level constructor erases
 * that type to `RegisteredFunction.Any`, so this experimental adapter restores
 * only the type already guaranteed by the supplied spec and handler.
 *
 * Delete this adapter when the service intentionally migrates to Confect
 * codegen. Running that codegen before a full migration would overwrite the
 * existing Convex function directory.
 */
export function registerExperimentalConfectFunction<
  DatabaseSchema_ extends DatabaseSchema.AnyWithProps,
  FunctionSpec_ extends FunctionSpec.AnyConfect,
>(
  databaseSchema: DatabaseSchema_,
  functionSpec: FunctionSpec_,
  handler: Handler.Handler<DatabaseSchema_, FunctionSpec_>,
): RegisteredFunction.RegisteredFunction<FunctionSpec_> {
  return RegisteredConvexFunction.make(
    databaseSchema,
    RegistryItem.make({ functionSpec, handler }),
  ) as RegisteredFunction.RegisteredFunction<FunctionSpec_>;
}
