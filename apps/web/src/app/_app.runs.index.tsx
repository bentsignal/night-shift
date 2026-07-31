import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { createComponent, useStore } from "@night-shift/effect-react";
import { Button } from "@night-shift/ui-web/components/button";

import { controlPlane } from "../control-plane/client";
import { Page } from "../features/control-plane/page";
import { RunList } from "../features/control-plane/run-list";
import { QuickLink } from "../features/quick-link/quick-link";

const RunsPage = createComponent({
  displayName: "RunsPage",
  deps: [controlPlane.store],
  state: ({ deps: [store] }) => ({
    runs: useStore(store, (state) => state.runs),
  }),
  ui: ({ state }) => (
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
