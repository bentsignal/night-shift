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
    setClient(convexClient);
    return () => {
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
      capacity.available === 0
        ? "Accepted into the durable queue. It will stay there until a trusted host is ready."
        : "Accepted. The scheduler can now match it to a trusted host.",
    );
  }

  async function handleCommand(command: RunCommand) {
    if (!selectedRun) return;
    await commandRun(selectedRun.id, command);
  }

  return (
    <main className="controlRoom">
      <header className="masthead">
        <a className="wordmark" href="/" aria-label="Code control plane home">
          <span className="wordmarkMark" aria-hidden="true">
            C/
          </span>
          <span>
            Code
            <small>Control plane</small>
          </span>
        </a>
        <div className="authority">
          <span className="authorityPulse" aria-hidden="true" />
          <span>
            <strong>
              Authority{" "}
              {snapshot.authority === "connected"
                ? "connected"
                : snapshot.authority}
            </strong>
            <small>
              {snapshot.authority === "connected"
                ? "Convex state is live"
                : "Durable mutations are unavailable"}
            </small>
          </span>
        </div>
        <div className="capacity" aria-label="Execution host capacity">
          <span className="capacityNumber">
            {capacity.available}/{capacity.total}
          </span>
          <span>
            hosts ready
            <small>{capacity.message}</small>
          </span>
        </div>
      </header>

      <section className="intro">
        <div>
          <p className="kicker">Dispatch / Observe / Intervene</p>
          <h1>Work keeps its place.</h1>
        </div>
        <p className="introCopy">
          Submit coding work now. Cloud authority preserves intent while local
          machines come and go.
        </p>
        <p className="edition">
          Personal system
          <span>Slice 001</span>
        </p>
      </section>

      <div className="workspace">
        <aside className="dispatchPanel" aria-labelledby="dispatch-title">
          <div className="sectionHeading">
            <span>01</span>
            <div>
              <p>New assignment</p>
              <h2 id="dispatch-title">Dispatch work</h2>
            </div>
          </div>
          <DispatchForm onSubmit={handleSubmit} />
          {submitNote ? (
            <p className="submitNotice" role="status">
              <span aria-hidden="true">✓</span>
              {submitNote}
            </p>
          ) : (
            <p className="queuePromise">
              <span aria-hidden="true">↳</span>
              No host required to submit. Your work is written to the durable
              queue first.
            </p>
          )}
        </aside>

        <section className="runLedger" aria-labelledby="runs-title">
          <div className="sectionHeading ledgerHeading">
            <span>02</span>
            <div>
              <p>Authority ledger</p>
              <h2 id="runs-title">Runs</h2>
            </div>
            <span className="runCount">{snapshot.runs.length}</span>
          </div>
          <div className="runList">
            {snapshot.runs.map((run, index) => (
              <RunRow
                key={run.id}
                run={run}
                index={snapshot.runs.length - index}
                selected={run.id === selectedRun?.id}
                onSelect={() => setSelectedRunId(run.id)}
              />
            ))}
          </div>
        </section>

        <section className="runDetail" aria-labelledby="detail-title">
          {selectedRun ? (
            <RunDetail run={selectedRun} onCommand={handleCommand} />
          ) : (
            <div className="emptyDetail">
              <p>Select a run to inspect its authority record.</p>
            </div>
          )}
        </section>
      </div>

      <footer className="systemFoot">
        <span>
          <i aria-hidden="true" />
          Sparse state stream
        </span>
        <span>Credentials remain on execution hosts</span>
        <span>Lease fencing enforced by authority</span>
      </footer>
    </main>
  );
}

interface DispatchFormProps {
  onSubmit: (input: SubmitWorkInput) => Promise<void>;
}

function DispatchForm({ onSubmit }: DispatchFormProps) {
  const firstProvider = providerOptions[0];
  const [provider, setProvider] = useState(firstProvider?.id ?? "openai");
  const providerOption =
    providerOptions.find((option) => option.id === provider) ?? firstProvider;
  const [model, setModel] = useState(
    providerOption?.models[0]?.id ?? "gpt-5.2-codex",
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
      <label className="field promptField">
        <span>Instruction</span>
        <textarea
          name="prompt"
          required
          rows={5}
          defaultValue="Implement the next safe vertical slice, then run its focused validation."
        />
      </label>
      <label className="field">
        <span>Project path</span>
        <input
          name="project"
          required
          defaultValue="~/dev/projects/code"
          spellCheck="false"
        />
      </label>
      <div className="fieldPair">
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
      </div>
      <label className="field reasoningField">
        <span>Reasoning</span>
        <select name="reasoning" defaultValue="high">
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="xhigh">Extra high</option>
        </select>
      </label>
      <button className="dispatchButton" type="submit" disabled={submitting}>
        <span>{submitting ? "Recording…" : "Place in queue"}</span>
        <span aria-hidden="true">↗</span>
      </button>
    </form>
  );
}

interface RunRowProps {
  run: Run;
  index: number;
  selected: boolean;
  onSelect: () => void;
}

function RunRow({ run, index, selected, onSelect }: RunRowProps) {
  return (
    <button
      type="button"
      className="runRow"
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className="runOrdinal">{String(index).padStart(2, "0")}</span>
      <span className="runSummary">
        <strong>{run.title}</strong>
        <small>{run.project}</small>
      </span>
      <span className={`statusLabel status-${run.status}`}>
        <i aria-hidden="true" />
        {getRunStatusLabel(run.status)}
      </span>
      <time dateTime={run.updatedAt}>{formatMoment(run.updatedAt)}</time>
      <span className="rowArrow" aria-hidden="true">
        →
      </span>
    </button>
  );
}

interface RunDetailProps {
  run: Run;
  onCommand: (command: RunCommand) => Promise<void>;
}

function RunDetail({ run, onCommand }: RunDetailProps) {
  const actions = getRunActionState(run.status);
  const activeLease =
    run.lease && run.status !== "completed" && run.status !== "canceled";

  return (
    <>
      <div className="detailHeading">
        <div className="sectionHeading">
          <span>03</span>
          <div>
            <p>Run record</p>
            <h2 id="detail-title">Inspect</h2>
          </div>
        </div>
        <span className={`detailStatus status-${run.status}`}>
          {getRunStatusLabel(run.status)}
        </span>
      </div>

      <div className="detailTitleBlock">
        <p>{run.id}</p>
        <h3>{run.title}</h3>
        <span>{run.prompt}</span>
      </div>

      <div className="actionRail" aria-label="Run controls">
        {actions.showResume ? (
          <button
            className="primaryAction"
            type="button"
            onClick={() => void onCommand({ type: "resume" })}
          >
            Resume
            <span aria-hidden="true">▶</span>
          </button>
        ) : (
          <button
            type="button"
            disabled={!actions.canPause}
            onClick={() => void onCommand({ type: "pause" })}
          >
            Pause
            <span aria-hidden="true">Ⅱ</span>
          </button>
        )}
        <button
          className="cancelAction"
          type="button"
          disabled={!actions.canCancel}
          onClick={() => void onCommand({ type: "cancel" })}
        >
          Cancel
          <span aria-hidden="true">×</span>
        </button>
      </div>

      <dl className="telemetry">
        <div>
          <dt>Execution host</dt>
          <dd>
            {run.host?.name ?? "Unassigned"}
            <small>{run.host?.id ?? "Awaiting eligible capacity"}</small>
          </dd>
        </div>
        <div>
          <dt>Lease</dt>
          <dd>
            {activeLease ? "Active" : run.lease ? "Closed" : "Not issued"}
            <small>
              {run.lease
                ? `Expires ${formatMoment(run.lease.expiresAt)}`
                : "Claim begins only after assignment"}
            </small>
          </dd>
        </div>
        <div>
          <dt>Fence generation</dt>
          <dd className="fenceValue">
            {run.lease
              ? `GEN-${String(run.lease.generation).padStart(4, "0")}`
              : "—"}
            <small>
              {run.lease ? "Required on every authoritative write" : "Pending"}
            </small>
          </dd>
        </div>
        <div>
          <dt>Runtime</dt>
          <dd>
            {run.provider} / {run.model}
            <small>{run.reasoning} reasoning · credentials host-local</small>
          </dd>
        </div>
      </dl>

      <section className="timeline" aria-labelledby="timeline-title">
        <div className="subheading">
          <h4 id="timeline-title">Milestones</h4>
          <span>{run.milestones.length} meaningful writes</span>
        </div>
        <ol>
          {run.milestones.map((milestone, index) => (
            <li
              key={milestone.id}
              className={index === run.milestones.length - 1 ? "current" : ""}
            >
              <span className="timelineMark" aria-hidden="true" />
              <div>
                <strong>{milestone.label}</strong>
                <p>{milestone.detail}</p>
              </div>
              <time dateTime={milestone.at}>{formatMoment(milestone.at)}</time>
            </li>
          ))}
        </ol>
      </section>

      <section
        className={`validation ${run.validation?.passed ? "validationPassed" : ""}`}
        aria-labelledby="validation-title"
      >
        <div>
          <p>Deterministic check</p>
          <h4 id="validation-title">
            {run.validation?.command ?? "Awaiting execution"}
          </h4>
        </div>
        <span>
          {run.validation
            ? run.validation.passed
              ? "Passed"
              : "Failed"
            : "Pending"}
          <small>
            {run.validation
              ? `${run.validation.durationMs} ms`
              : "Publishes as a sparse milestone"}
          </small>
        </span>
      </section>
    </>
  );
}
