import { useEffect } from "react";
import { useRouterState } from "@tanstack/react-router";
import {
  Bot,
  CircleDot,
  ListTodo,
  Plus,
  Server,
  SquareTerminal,
} from "lucide-react";

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
} from "@code/ui-web/components/sidebar";

import { useControlPlane } from "../../control-plane/client";
import { getHostCapacity } from "../../control-plane/view-model";
import { QuickLink } from "../quick-link/quick-link";
import { statusTone } from "./status-badge";

const navigation = [
  { label: "New run", to: "/new" as const, icon: Plus },
  { label: "All runs", to: "/runs" as const, icon: ListTodo },
  { label: "Hosts", to: "/hosts" as const, icon: Server },
];

export function AppSidebar() {
  const authorityState = useControlPlane((state) => state.authority);
  const hosts = useControlPlane((state) => state.hosts);
  const runs = useControlPlane((state) => state.runs);
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

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-sidebar-border border-b">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="h-11 data-[slot=sidebar-menu-button]:font-semibold"
              size="lg"
              tooltip="Code"
            >
              <QuickLink to="/new">
                <span className="bg-sidebar-primary text-sidebar-primary-foreground flex size-7 items-center justify-center rounded-md">
                  <SquareTerminal className="size-4" />
                </span>
                <span className="group-data-[collapsible=icon]:hidden">
                  Code
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
                    isActive={pathname === item.to}
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
              {runs.slice(0, 12).map((run) => (
                <SidebarMenuItem key={run.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === `/runs/${run.id}`}
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
              <EmptyRecentRuns visible={runs.length === 0} />
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
              tooltip={`${capacity.available}/${capacity.total} hosts ready`}
            >
              <div role="status">
                <Bot className={authority.tone} />
                <span className="truncate">{authority.label}</span>
                <SidebarMenuBadge>
                  {capacity.available}/{capacity.total}
                </SidebarMenuBadge>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}

function EmptyRecentRuns({ visible }: { visible: boolean }) {
  if (!visible) return null;

  return (
    <li className="text-sidebar-foreground/50 px-2 py-3 text-xs group-data-[collapsible=icon]:hidden">
      No runs yet
    </li>
  );
}
