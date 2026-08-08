import { randomUUID } from "node:crypto";

import type {
  ControlKind,
  HostSummary,
  NightShiftClient,
  RunDetails,
  RunSummary,
} from "./types.ts";

export interface ConversationContext {
  cwd: string;
  environment: NodeJS.ProcessEnv;
}

export async function respondToRequest(
  request: string,
  client: NightShiftClient,
  context: ConversationContext,
) {
  const normalized = request.trim();
  const control = parseControl(normalized);
  if (control) {
    const reply = await client.requestControl(
      control.runId,
      control.kind,
      randomUUID(),
    );
    return reply.accepted
      ? `${capitalize(control.kind)} requested for run ${control.runId}.`
      : `Run ${control.runId} could not be ${control.kind}d; command status is ${reply.status}.`;
  }

  const explicitRunId = parseRunInspection(normalized);
  if (explicitRunId) {
    return formatRunDetails(await client.getRun(explicitRunId), explicitRunId);
  }

  if (isHostQuestion(normalized)) {
    return formatHosts(await client.listHosts());
  }

  if (isAttentionQuestion(normalized)) {
    const runs = await client.listRuns(25);
    const attention = runs.filter((run) =>
      ["paused", "pause_requested", "failed"].includes(run.status),
    );
    return attention.length === 0
      ? "Nothing currently needs your attention."
      : `These runs may need your attention:\n${attention.map(formatRunLine).join("\n")}`;
  }

  if (isStatusQuestion(normalized)) {
    return formatRuns(await client.listRuns(10));
  }

  const runtime = parseRuntime(normalized, context.environment);
  const result = await client.submit({
    submitKey: randomUUID(),
    prompt: normalized,
    projectPath: context.cwd,
    requiredCapabilities: [`runtime:${runtime.adapter}`],
    runtime,
  });
  return `${result.created ? "Queued" : "Found"} run ${result.runId} for ${runtimeLabel(runtime.adapter)} in ${context.cwd}. It will remain durable until a matching enrolled host has capacity.`;
}

export function parseRuntime(
  request: string,
  environment: NodeJS.ProcessEnv = process.env,
) {
  const text = request.toLowerCase();
  if (/\b(custom effect|effect (ai )?agent|effect harness)\b/.test(text)) {
    return {
      adapter: "effect-ai",
      provider: environment.NIGHT_SHIFT_EFFECT_PROVIDER ?? "openai-codex",
      model: environment.NIGHT_SHIFT_EFFECT_MODEL ?? "gpt-5.6-sol",
      reasoningLevel: environment.NIGHT_SHIFT_REASONING ?? "high",
    };
  }
  if (/\bclaude( code)?\b/.test(text)) {
    return {
      adapter: "claude-code",
      provider: "anthropic",
      model: environment.NIGHT_SHIFT_CLAUDE_MODEL ?? "sonnet",
      reasoningLevel: environment.NIGHT_SHIFT_REASONING ?? "high",
    };
  }
  if (/\bpi\b/.test(text)) {
    return {
      adapter: "pi",
      provider: "openai-codex",
      model: environment.NIGHT_SHIFT_PI_MODEL ?? "gpt-5.6-terra",
      reasoningLevel: environment.NIGHT_SHIFT_REASONING ?? "high",
    };
  }
  if (/\b(grok|xai)\b/.test(text)) {
    return commandRuntime("grok-cli", "xai", environment);
  }
  return commandRuntime("codex-cli", "openai-codex", environment);
}

function commandRuntime(
  adapter: string,
  provider: string,
  environment: NodeJS.ProcessEnv,
) {
  return {
    adapter,
    provider,
    model:
      adapter === "codex-cli"
        ? (environment.NIGHT_SHIFT_CODEX_MODEL ?? "gpt-5.6-sol")
        : "default",
    reasoningLevel: environment.NIGHT_SHIFT_REASONING ?? "high",
  };
}

function parseControl(request: string) {
  const match = request.match(
    /\b(pause|resume|cancel)\s+(?:run\s+)?([a-z0-9_-]{8,})\b/i,
  );
  if (!match?.[1] || !match[2]) return undefined;
  return {
    kind: match[1].toLowerCase() as ControlKind,
    runId: match[2],
  };
}

function parseRunInspection(request: string) {
  const match = request.match(
    /\b(?:inspect|show|status(?:\s+of)?|what(?:'s| is) happening with)\s+(?:run\s+)?([a-z0-9_-]{8,})\b/i,
  );
  return match?.[1];
}

function isStatusQuestion(request: string) {
  return /\b(status|latest|progress|finished|overnight|what(?:'s| is) (?:going on|happening))\b/i.test(
    request,
  );
}

function isAttentionQuestion(request: string) {
  return /\b(attention|need(?:s)? (?:me|my input)|waiting (?:for|on) me)\b/i.test(
    request,
  );
}

function isHostQuestion(request: string) {
  return /\b(hosts?|machines?|computers?)\b/i.test(request);
}

function formatRuns(runs: RunSummary[]) {
  if (runs.length === 0) return "Night Shift has no work yet.";
  return `Latest Night Shift work:\n${runs.map(formatRunLine).join("\n")}`;
}

function formatRunLine(run: RunSummary) {
  const outcome = run.failure ?? run.resultSummary;
  return `- ${run.id}: ${run.status} (${runtimeLabel(run.runtime?.adapter)})${outcome ? ` — ${oneLine(outcome)}` : ""}`;
}

function formatRunDetails(details: RunDetails | null, runId: string) {
  if (!details) return `Run ${runId} was not found.`;
  const lines = [
    `Run ${runId} is ${details.run.status}; validation is ${details.run.validationStatus}.`,
    `Project: ${details.run.projectPath ?? "unspecified"}`,
    `Runtime: ${runtimeLabel(details.run.runtime?.adapter)}`,
  ];
  if (details.run.resultSummary)
    lines.push(`Result: ${details.run.resultSummary}`);
  if (details.run.failure) lines.push(`Failure: ${details.run.failure}`);
  const recent = details.milestones.slice(-5);
  if (recent.length > 0) {
    lines.push(
      "Recent milestones:",
      ...recent.map(
        (milestone) => `- ${milestone.kind}: ${oneLine(milestone.summary)}`,
      ),
    );
  }
  return lines.join("\n");
}

function formatHosts(hosts: HostSummary[]) {
  if (hosts.length === 0) return "No hosts have enrolled yet.";
  return `Enrolled hosts:\n${hosts
    .map((host) => {
      const status =
        host.sessionExpiresAt <= Date.now() ? "offline" : host.status;
      return `- ${host.displayName}: ${status}, ${host.activeAssignments}/${host.maxConcurrent} slots used; ${host.capabilities.join(", ")}`;
    })
    .join("\n")}`;
}

function runtimeLabel(adapter: string | undefined) {
  switch (adapter) {
    case "codex-cli":
      return "Codex CLI";
    case "effect-ai":
      return "the custom Effect AI harness";
    case "claude-code":
      return "Claude Code";
    case "pi":
      return "Pi";
    case "grok-cli":
      return "Grok CLI";
    default:
      return adapter ?? "the default runtime";
  }
}

function oneLine(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function capitalize(value: string) {
  return `${value.slice(0, 1).toUpperCase()}${value.slice(1)}`;
}
