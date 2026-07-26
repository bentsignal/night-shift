import { createFileRoute } from "@tanstack/react-router";

import { NewRunForm } from "../features/control-plane/new-run-form";
import { Page } from "../features/control-plane/page";

export const Route = createFileRoute("/_app/new")({
  component: NewRunPage,
});

function NewRunPage() {
  return (
    <Page
      description="Queue work now. Convex will hold it until a host is ready."
      size="medium"
      title="New run"
    >
      <NewRunForm />
    </Page>
  );
}
