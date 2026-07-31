import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import { Effect } from "effect";
import {
  Bot,
  CircleDot,
  ListTodo,
  Plus,
  Server,
  SquareTerminal,
} from "lucide-react";

import { createComponent, useStore } from "@night-shift/effect-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@night-shift/ui-web/components/sidebar";

import { controlPlane } from "../../control-plane/client";
import { getHostCapacity } from "../../control-plane/view-model";
import { QuickLink } from "../quick-link/quick-link";
import { statusTone } from "./status-badge";

const navigation = [
  { label: "New run", to: "/new" as const, icon: Plus },
  { label: "All runs", to: "/runs" as const, icon: ListTodo },
  { label: "Hosts", to: "/hosts" as const, icon: Server },
];

export const AppSidebar = createComponent({
  displayName: "AppSidebar",
  deps: Effect.gen(function* () {
    return { store: yield* controlPlane.store };
  }),

  state: ({ deps }) => {
    const authorityState = useStore(deps.store, (state) => state.authority);
    const hosts = useStore(deps.store, (state) => state.hosts);
    const runs = useStore(deps.store, (state) => state.runs);
    const { isMobile, setOpenMobile } = useSidebar();
    const pathname = useRouterState({
      select: (state) => state.location.pathname,
    });
    const capacity = getHostCapacity(hosts);
    const authority =
      authorityState === "connected"
        ? { label: "Authority online", tone: "text-success" }
        : authorityState === "recovering"
          ? { label: "Reconnecting", tone: "text-warning" }
          : { label: "Authority offline", tone: "text-destructive" };

    // eslint-disable-next-line no-restricted-syntax -- Route changes are an external navigation signal that must close the mobile drawer.
    useEffect(() => {
      if (isMobile) setOpenMobile(false);
    }, [isMobile, pathname, setOpenMobile]);

    return Effect.succeed({ authority, capacity, pathname, runs });
  },
  ui: ({ state }) => (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-sidebar-border border-b">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="h-11 data-[slot=sidebar-menu-button]:font-semibold"
              size="lg"
              tooltip="night shift"
            >
              <QuickLink to="/new">
                <span className="bg-sidebar-primary text-sidebar-primary-foreground flex size-7 items-center justify-center rounded-md">
                  <SquareTerminal className="size-4" />
                </span>
                <span className="group-data-[collapsible=icon]:hidden">
                  night shift
                </span>
              </QuickLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton
                    asChild
                    isActive={state.pathname === item.to}
                    tooltip={item.label}
                  >
                    <QuickLink to={item.to}>
                      <item.icon />
                      <span>{item.label}</span>
                    </QuickLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="min-h-0 flex-1">
          <SidebarGroupLabel>Recent runs</SidebarGroupLabel>
          <SidebarGroupContent className="min-h-0">
            <SidebarMenu>
              {state.runs.slice(0, 12).map((run) => (
                <SidebarMenuItem key={run.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={state.pathname === `/runs/${run.id}`}
                    className="h-auto min-h-9 py-2"
                    tooltip={run.title}
                  >
                    <QuickLink to="/runs/$runId" params={{ runId: run.id }}>
                      <CircleDot className={statusTone(run.status)} />
                      <span className="truncate">{run.title}</span>
                    </QuickLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <EmptyRecentRuns visible={state.runs.length === 0} />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-sidebar-border border-t">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="cursor-default"
              tooltip={`${state.capacity.available}/${state.capacity.total} hosts ready`}
            >
              <div role="status">
                <Bot className={state.authority.tone} />
                <span className="truncate">{state.authority.label}</span>
                <SidebarMenuBadge>
                  {state.capacity.available}/{state.capacity.total}
                </SidebarMenuBadge>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  ),
});

function EmptyRecentRuns({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <li className="text-sidebar-foreground/50 px-2 py-3 text-xs group-data-[collapsible=icon]:hidden">
      No runs yet
    </li>
  );
}
