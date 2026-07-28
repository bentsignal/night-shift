import { createFileRoute } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { Button } from "@code/ui-web/components/button";

import { useControlPlane } from "../control-plane/client";
import { Page } from "../features/control-plane/page";
import { RunList } from "../features/control-plane/run-list";
import { QuickLink } from "../features/quick-link/quick-link";

export const Route = createFileRoute("/_app/runs/")({
  component: RunsPage,
});

function RunsPage() {
  const runs = useControlPlane((state) => state.runs);

  return (
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
      <RunList runs={runs} />
    </Page>
  );
}
