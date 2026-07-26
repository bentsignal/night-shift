import { createFileRoute } from "@tanstack/react-router";

import { productDescription, productName } from "@code/config/product";
import { Button } from "@code/ui-web/button";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <main className="shell">
      <section className="hero">
        <p className="eyebrow">Local execution · durable orchestration</p>
        <h1>{productName}</h1>
        <p className="lede">{productDescription}</p>
        <div className="status">
          <span className="statusDot" />
          Scaffold ready for the first orchestration slice
        </div>
        <Button disabled type="button">
          Submit work
        </Button>
      </section>
    </main>
  );
}
