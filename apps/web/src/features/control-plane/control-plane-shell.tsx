import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Outlet, useRouterState } from "@tanstack/react-router";

import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@code/ui-web/components/sidebar";
import { ThemeProvider } from "@code/ui-web/theme-provider";

import type { ControlPlaneClient } from "../../control-plane/types";
import { ControlPlaneProvider } from "../../control-plane/client";
import { ConvexControlPlaneClient } from "../../control-plane/convex-client";
import { demoControlPlaneClient } from "../../control-plane/demo-client";
import { AppSidebar } from "./app-sidebar";
import { ThemeToggle } from "./theme-toggle";

function pageTitle(pathname: string) {
  if (pathname === "/new") return "New run";
  if (pathname === "/runs") return "Runs";
  if (pathname.startsWith("/runs/")) return "Run";
  if (pathname === "/hosts") return "Hosts";
  return "Code";
}

export function ControlPlaneShell() {
  const [client, setClient] = useState<ControlPlaneClient | null>(
    import.meta.env.VITE_CONVEX_URL ? null : demoControlPlaneClient,
  );

  useEffect(() => {
    const url = import.meta.env.VITE_CONVEX_URL;
    if (!url) return;
    const convexClient = new ConvexControlPlaneClient(
      url,
      import.meta.env.VITE_CODE_OWNER_ID ?? "personal",
    );
    const activation = window.setTimeout(() => setClient(convexClient), 0);
    return () => {
      window.clearTimeout(activation);
      void convexClient.close();
    };
  }, []);

  if (!client) {
    return (
      <ThemeProvider defaultTheme="dark">
        <div className="bg-background text-muted-foreground flex min-h-svh items-center justify-center text-xs">
          Connecting…
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ControlPlaneProvider client={client}>
      <ThemeProvider defaultTheme="dark">
        <ApplicationFrame>
          <Outlet />
        </ApplicationFrame>
      </ThemeProvider>
    </ControlPlaneProvider>
  );
}

function ApplicationFrame({ children }: { children: ReactNode }) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <SidebarProvider
      defaultOpen
      style={
        {
          "--sidebar-width": "17rem",
          "--sidebar-width-icon": "3.5rem",
        } as React.CSSProperties
      }
    >
      <AppSidebar />
      <SidebarInset className="bg-background h-svh min-w-0 overflow-hidden">
        <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 flex h-14 shrink-0 items-center justify-between border-b px-4 backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <SidebarTrigger className="-ml-1" />
            <div className="bg-border h-4 w-px" />
            <span className="truncate text-sm font-medium">
              {pageTitle(pathname)}
            </span>
          </div>
          <ThemeToggle />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
