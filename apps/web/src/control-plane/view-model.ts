import type { Host, RunStatus } from "./types";

export interface ProviderOption {
  id: string;
  label: string;
  models: { id: string; label: string }[];
}

export const providerOptions = [
  {
    id: "openai-codex",
    label: "OpenAI subscription",
    models: [
      { id: "gpt-5.6-sol", label: "GPT-5.6 Sol" },
      { id: "gpt-5.6-terra", label: "GPT-5.6 Terra" },
    ],
  },
  {
    id: "anthropic",
    label: "Anthropic",
    models: [
      { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
      { id: "claude-opus-4-5", label: "Claude Opus 4.5" },
    ],
  },
] satisfies ProviderOption[];

const statusLabels = {
  queued: "Queued",
  claimed: "Claimed",
  running: "Running",
  paused: "Paused",
  canceling: "Canceling",
  canceled: "Canceled",
  failed: "Failed",
  completed: "Completed",
} satisfies Record<RunStatus, string>;

export function getRunStatusLabel(status: RunStatus) {
  return statusLabels[status];
}

export interface RunActionState {
  canPause: boolean;
  showResume: boolean;
  canCancel: boolean;
}

export function getRunActionState(status: RunStatus) {
  const terminal = ["completed", "failed", "canceled"].includes(status);
  return {
    canPause: status === "running",
    showResume: status === "paused",
    canCancel: !terminal && status !== "canceling",
  };
}

export interface HostCapacity {
  total: number;
  available: number;
  message: string;
}

export function getHostCapacity(hosts: Host[]) {
  const available = hosts.filter((host) => host.health === "ready").length;
  return {
    total: hosts.length,
    available,
    message:
      available === 0
        ? "Submissions remain available"
        : `${available} ${available === 1 ? "machine" : "machines"} can claim work`,
  };
}

export function formatMoment(isoTimestamp: string) {
  const time = new Date(isoTimestamp);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
    timeZone: "America/New_York",
  }).format(time);
}
