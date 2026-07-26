import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { Button } from "@code/ui-web/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@code/ui-web/components/card";
import { Skeleton } from "@code/ui-web/components/skeleton";

import { useControlPlane } from "../control-plane/client";
import { Page } from "../features/control-plane/page";
import { RunDetail } from "../features/control-plane/run-detail";

export const Route = createFileRoute("/_app/runs/$runId")({
  component: RunPage,
});

function RunPage() {
  const { runId } = Route.useParams();
  const { snapshot, commandRun } = useControlPlane();
  const run = snapshot.runs.find((candidate) => candidate.id === runId);

  if (!run) {
    if (snapshot.authority !== "connected") {
      return (
        <div className="mx-auto grid w-full max-w-6xl gap-5 px-5 py-8 md:px-8 md:py-10 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <Skeleton className="h-72 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      );
    }

    return (
      <Page title="Run not found">
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-sm">
              This run is not available.
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Button asChild size="sm" variant="outline">
              <Link to="/runs">
                <ArrowLeft />
                Back to runs
              </Link>
            </Button>
          </CardContent>
        </Card>
      </Page>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-5 py-8 md:px-8 md:py-10">
      <RunDetail
        onCommand={(command) => commandRun(run.id, command)}
        run={run}
      />
    </div>
  );
}
