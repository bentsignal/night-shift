import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type {
  ControlKind,
  HostSummary,
  NightShiftClient,
  RunDetails,
  RunSummary,
  SubmitRequest,
} from "./types.ts";
import { parseRuntime, respondToRequest } from "./conversation.ts";

describe("conversational CLI", () => {
  it("routes ordinary language to durable Codex work in the current project", async () => {
    const client = new FakeClient();

    const answer = await respondToRequest(
      "Please fix the parser and run the tests.",
      client,
      context,
    );

    assert.equal(client.submissions.length, 1);
    assert.deepEqual(client.submissions[0], {
      submitKey: client.submissions[0]?.submitKey,
      prompt: "Please fix the parser and run the tests.",
      projectPath: "/projects/example",
      requiredCapabilities: ["runtime:codex-cli"],
      runtime: {
        adapter: "codex-cli",
        provider: "openai-codex",
        model: "gpt-5.6-sol",
        reasoningLevel: "high",
      },
    });
    assert.match(answer, /Queued run run-1 for Codex CLI/);
  });

  it("selects modular runtimes from natural language", () => {
    assert.equal(
      parseRuntime("Use the custom Effect agent").adapter,
      "effect-ai",
    );
    assert.equal(
      parseRuntime("Have Claude Code do this").adapter,
      "claude-code",
    );
    assert.equal(parseRuntime("Run this with Pi").adapter, "pi");
    assert.equal(parseRuntime("Ask Grok to implement it").adapter, "grok-cli");
  });

  it("answers status and attention questions without submitting work", async () => {
    const client = new FakeClient();
    client.runs = [
      {
        id: "run-failed",
        prompt: "test",
        status: "failed",
        validationStatus: "failed",
        updatedAt: 1,
        failure: "Tests failed",
      },
    ];

    const status = await respondToRequest(
      "What finished overnight?",
      client,
      context,
    );
    const attention = await respondToRequest(
      "What needs my attention?",
      client,
      context,
    );

    assert.match(status, /run-failed: failed/);
    assert.match(attention, /Tests failed/);
    assert.equal(client.submissions.length, 0);
  });

  it("turns natural-language control requests into typed mutations", async () => {
    const client = new FakeClient();

    const answer = await respondToRequest(
      "Please pause run abcdefgh1234",
      client,
      context,
    );

    assert.equal(client.controls[0]?.kind, "pause");
    assert.equal(client.controls[0]?.runId, "abcdefgh1234");
    assert.match(answer, /Pause requested/);
  });
});

const context = {
  cwd: "/projects/example",
  environment: {},
};

class FakeClient implements NightShiftClient {
  submissions: SubmitRequest[] = [];
  controls: Array<{ runId: string; kind: ControlKind }> = [];
  runs: RunSummary[] = [];
  hosts: HostSummary[] = [];
  details: RunDetails | null = null;

  async submit(input: SubmitRequest) {
    this.submissions.push(input);
    return { created: true, runId: "run-1" };
  }

  async listRuns() {
    return this.runs;
  }

  async getRun() {
    return this.details;
  }

  async listHosts() {
    return this.hosts;
  }

  async requestControl(runId: string, kind: ControlKind) {
    this.controls.push({ runId, kind });
    return { accepted: true, status: "pending" };
  }
}
