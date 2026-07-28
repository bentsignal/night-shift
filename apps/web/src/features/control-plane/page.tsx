import type { ReactNode } from "react";

export function Page({
  title,
  description,
  actions,
  children,
  size = "wide",
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  size?: "medium" | "wide";
}) {
  return (
    <div
      className={
        size === "medium"
          ? "mx-auto w-full max-w-3xl px-5 py-8 md:px-8 md:py-10"
          : "mx-auto w-full max-w-6xl px-5 py-8 md:px-8 md:py-10"
      }
    >
      <div className="mb-7 flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          <PageDescription description={description} />
        </div>
        {actions}
      </div>
      {children}
    </div>
  );
}

function PageDescription({ description }: { description: string | undefined }) {
  if (!description) return null;
  return (
    <p className="text-muted-foreground mt-1.5 max-w-2xl text-sm">
      {description}
    </p>
  );
}
