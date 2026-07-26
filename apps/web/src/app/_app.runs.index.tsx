import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";

import { Button } from "@code/ui-web/components/button";

import { useControlPlane } from "../control-plane/client";
import { Page } from "../features/control-plane/page";
import { RunList } from "../features/control-plane/run-list";

export const Route = createFileRoute("/_app/runs/")({
  component: RunsPage,
});

function RunsPage() {
  const { snapshot } = useControlPlane();

  return (
    <Page
      actions={
        <Button asChild size="sm">
          <Link to="/new">
            <Plus />
            New run
          </Link>
        </Button>
      }
      description="Durable assignments across queued, active, and completed work."
      title="Runs"
    >
      <RunList runs={snapshot.runs} />
    </Page>
  );
}
