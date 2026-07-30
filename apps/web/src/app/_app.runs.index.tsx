import { createFileRoute } from "@tanstack/react-router";
import { Effect } from "effect";
import { Plus } from "lucide-react";

import { createComponent } from "@night-shift/effect-react";
import { Button } from "@night-shift/ui-web/components/button";

import { controlPlane } from "../control-plane/client";
import { Page } from "../features/control-plane/page";
import { RunList } from "../features/control-plane/run-list";
import { QuickLink } from "../features/quick-link/quick-link";

const RunsPage = createComponent({
  displayName: "RunsPage",
  state: Effect.gen(function* () {
    const useControlPlane = yield* controlPlane.service;
    return function useRunsPageState() {
      return Effect.succeed({
        runs: useControlPlane((state) => state.runs),
      });
    };
  }),
  component: ({ state }) => (
    <Page
      actions={
        <Button asChild size="sm">
          <QuickLink to="/new">
            <Plus />
            New run
          </QuickLink>
        </Button>
      }
      description="Durable assignments across queued, active, and completed work."
      title="Runs"
    >
      <RunList runs={state.runs} />
    </Page>
  ),
});

export const Route = createFileRoute("/_app/runs/")({
  component: RunsPage,
});
