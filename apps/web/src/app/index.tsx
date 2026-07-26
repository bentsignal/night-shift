import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";

import type {
  ControlPlaneClient,
  ReasoningLevel,
  Run,
  RunCommand,
  SubmitWorkInput,
} from "../control-plane/types";
import { ControlPlaneProvider, useControlPlane } from "../control-plane/client";
import { ConvexControlPlaneClient } from "../control-plane/convex-client";
import { demoControlPlaneClient } from "../control-plane/demo-client";
import {
  formatMoment,
  getHostCapacity,
  getRunActionState,
  getRunStatusLabel,
  providerOptions,
} from "../control-plane/view-model";

export const Route = createFileRoute("/")({
  component: ControlPlaneRoute,
});

function ControlPlaneRoute() {
  const [client, setClient] = useState<ControlPlaneClient>(
    demoControlPlaneClient,
  );
  useEffect(() => {
    const url = import.meta.env.VITE_CONVEX_URL;
    if (!url) return;
    const convexClient = new ConvexControlPlaneClient(
      url,
      import.meta.env.VITE_CODE_OWNER_ID ?? "personal",
    );
    const activation = window.setTimeout(() => setClient(convexClient), 0);
    return () => {
      window.clearTimeout(activation);
      void convexClient.close();
    };
  }, []);

  return (
    <ControlPlaneProvider client={client}>
      <ControlRoom />
    </ControlPlaneProvider>
  );
}

function ControlRoom() {
  const { snapshot, submitWork, commandRun } = useControlPlane();
  const [selectedRunId, setSelectedRunId] = useState<string>(
    snapshot.runs[0]?.id ?? "",
  );
  const [submitNote, setSubmitNote] = useState<string>();
  const selectedRun =
    snapshot.runs.find((run) => run.id === selectedRunId) ?? snapshot.runs[0];
  const capacity = getHostCapacity(snapshot.hosts);

  async function handleSubmit(input: SubmitWorkInput) {
    const runId = await submitWork(input);
    setSelectedRunId(runId);
    setSubmitNote(
      capacity.available === 0 ? "Queued — waiting for a host" : "Queued",
    );
  }

  async function handleCommand(command: RunCommand) {
    if (!selectedRun) return;
    await commandRun(selectedRun.id, command);
  }

  return (
    <main className="controlRoom">
      <header className="topbar">
        <a className="productName" href="/" aria-label="Code control plane">
          Code
        </a>
        <div className="systemStatus">
          <span
            className={`authorityState authority-${snapshot.authority}`}
            role="status"
          >
            <i aria-hidden="true" />
            {snapshot.authority === "connected"
              ? "Connected"
              : snapshot.authority === "recovering"
                ? "Reconnecting"
                : "Offline"}
          </span>
          <span className="hostCount" aria-label="Execution host capacity">
            Hosts {capacity.available}/{capacity.total}
          </span>
        </div>
      </header>

      <section className="composer" aria-labelledby="composer-title">
        <div className="composerHeading">
          <h1 id="composer-title">New run</h1>
          {submitNote && (
            <span className="submitNotice" role="status">
              {submitNote}
            </span>
          )}
        </div>
        <DispatchForm onSubmit={handleSubmit} />
      </section>

      <div className="workspace">
        <aside className="runListPane" aria-labelledby="runs-title">
          <div className="paneHeading">
            <h2 id="runs-title">Runs</h2>
            <span className="runCount">{snapshot.runs.length}</span>
          </div>
          <div className="runList">
            {snapshot.runs.map((run) => (
              <RunRow
                key={run.id}
                run={run}
                selected={run.id === selectedRun?.id}
                onSelect={() => setSelectedRunId(run.id)}
              />
            ))}
            {snapshot.runs.length === 0 && (
              <p className="emptyRuns">No runs yet</p>
            )}
          </div>
        </aside>

        <section className="runDetail" aria-labelledby="detail-title">
          {selectedRun ? (
            <RunDetail run={selectedRun} onCommand={handleCommand} />
          ) : (
            <div className="emptyDetail">
              <p>Select a run</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

interface DispatchFormProps {
  onSubmit: (input: SubmitWorkInput) => Promise<void>;
}

function DispatchForm({ onSubmit }: DispatchFormProps) {
  const firstProvider = providerOptions[0];
  const [provider, setProvider] = useState(firstProvider?.id ?? "openai-codex");
  const providerOption =
    providerOptions.find((option) => option.id === provider) ?? firstProvider;
  const [model, setModel] = useState(
    providerOption?.models[0]?.id ?? "gpt-5.6-sol",
  );
  const [submitting, setSubmitting] = useState(false);

  async function submit(formData: FormData) {
    setSubmitting(true);
    try {
      await onSubmit({
        prompt: String(formData.get("prompt") ?? ""),
        project: String(formData.get("project") ?? ""),
        provider,
        model,
        reasoning: String(
          formData.get("reasoning") ?? "high",
        ) as ReasoningLevel,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="dispatchForm" action={(formData) => void submit(formData)}>
      <div className="promptComposer">
        <label className="field promptField">
          <span className="srOnly">Prompt</span>
          <textarea
            name="prompt"
            required
            rows={2}
            placeholder="Describe the work to run…"
            aria-label="Run prompt"
          />
        </label>
        <button className="dispatchButton" type="submit" disabled={submitting}>
          {submitting ? "Queueing…" : "Queue"}
        </button>
      </div>
      <div className="composerOptions">
        <label className="field projectField">
          <span>Project</span>
          <input
            name="project"
            required
            defaultValue="~/dev/projects/code"
            spellCheck="false"
          />
        </label>
        <label className="field">
          <span>Provider</span>
          <select
            value={provider}
            onChange={(event) => {
              const nextProvider = providerOptions.find(
                (option) => option.id === event.target.value,
              );
              setProvider(event.target.value);
              setModel(nextProvider?.models[0]?.id ?? "");
            }}
          >
            {providerOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Model</span>
          <select
            value={model}
            onChange={(event) => setModel(event.target.value)}
          >
            {providerOption?.models.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field reasoningField">
          <span>Reasoning</span>
          <select name="reasoning" defaultValue="high">
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="xhigh">Extra high</option>
          </select>
        </label>
      </div>
    </form>
  );
}

interface RunRowProps {
  run: Run;
  selected: boolean;
  onSelect: () => void;
}

function RunRow({ run, selected, onSelect }: RunRowProps) {
  return (
    <button
      type="button"
      className="runRow"
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className="runSummary">
        <strong>{run.title}</strong>
        <small>{run.project}</small>
      </span>
      <span className={`statusLabel status-${run.status}`}>
        <i aria-hidden="true" />
        {getRunStatusLabel(run.status)}
      </span>
      <time dateTime={run.updatedAt}>{formatMoment(run.updatedAt)}</time>
    </button>
  );
}

interface RunDetailProps {
  run: Run;
  onCommand: (command: RunCommand) => Promise<void>;
}

function RunDetail({ run, onCommand }: RunDetailProps) {
  const actions = getRunActionState(run.status);
  const activeLease = Boolean(
    run.lease && !["completed", "canceled", "failed"].includes(run.status),
  );

  return (
    <>
      <header className="detailHeading">
        <div className="detailTitle">
          <span className={`detailStatus status-${run.status}`}>
            <i aria-hidden="true" />
            {getRunStatusLabel(run.status)}
          </span>
          <h2 id="detail-title">{run.title}</h2>
        </div>
        <div className="actionRail" aria-label="Run controls">
          {actions.showResume ? (
            <button
              className="primaryAction"
              type="button"
              onClick={() => void onCommand({ type: "resume" })}
            >
              Resume
            </button>
          ) : (
            <button
              type="button"
              disabled={!actions.canPause}
              onClick={() => void onCommand({ type: "pause" })}
            >
              Pause
            </button>
          )}
          <button
            className="cancelAction"
            type="button"
            disabled={!actions.canCancel}
            onClick={() => void onCommand({ type: "cancel" })}
          >
            Cancel
          </button>
        </div>
      </header>

      <div className="detailBody">
        <section className="promptPanel" aria-labelledby="prompt-title">
          <h3 id="prompt-title">Prompt</h3>
          <p>{run.prompt}</p>
        </section>

        <dl className="telemetry">
          <div>
            <dt>Host</dt>
            <dd>
              {run.host?.name ?? "Unassigned"}
              {run.host && <small>{run.host.id}</small>}
            </dd>
          </div>
          <div>
            <dt>Lease</dt>
            <dd>
              {activeLease ? "Active" : run.lease ? "Closed" : "Not issued"}
              {run.lease && <small>{formatMoment(run.lease.expiresAt)}</small>}
            </dd>
          </div>
          <div>
            <dt>Fence</dt>
            <dd className="fenceValue">
              {run.lease ? run.lease.generation : "—"}
            </dd>
          </div>
          <div>
            <dt>Runtime</dt>
            <dd>
              {run.model}
              <small>
                {run.provider} · {run.reasoning}
              </small>
            </dd>
          </div>
        </dl>

        <section
          className={`validation ${run.validation?.passed ? "validationPassed" : run.validation ? "validationFailed" : ""}`}
          aria-labelledby="validation-title"
        >
          <div>
            <h3 id="validation-title">Validation</h3>
            <p>{run.validation?.command ?? "Pending"}</p>
          </div>
          {run.validation && (
            <span className="validationResult">
              {run.validation.passed ? "Passed" : "Failed"}
              <small>{run.validation.durationMs} ms</small>
            </span>
          )}
        </section>

        <section className="timeline" aria-labelledby="timeline-title">
          <div className="subheading">
            <h3 id="timeline-title">Events</h3>
            <span>{run.milestones.length}</span>
          </div>
          <ol>
            {run.milestones.map((milestone) => (
              <li key={milestone.id}>
                <span
                  className={`timelineMark event-${milestone.kind}`}
                  aria-hidden="true"
                />
                <div>
                  <strong>{milestone.label}</strong>
                  <p>{milestone.detail}</p>
                </div>
                <time dateTime={milestone.at}>
                  {formatMoment(milestone.at)}
                </time>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </>
  );
}
