"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Organization, User } from "@crm/core";
import { PRESENCE_LABEL, ROLE_LABEL } from "@crm/core";
import {
  Avatar,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  PresenceDot,
  Tooltip,
  cn,
} from "@crm/ui";
import { ChevronsLeft, ChevronsRight, LogOut, Settings, ShieldCheck } from "lucide-react";

import { NAV_GROUPS } from "@/lib/nav";
import { ThemeToggle } from "./theme-toggle";

export function AppSidebar({
  organization,
  currentUser,
}: {
  organization: Organization;
  currentUser: User;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={cn(
        "bg-sidebar text-sidebar-foreground flex shrink-0 flex-col transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
        collapsed ? "w-[4.25rem]" : "w-60",
      )}
    >
      {/* Marca */}
      <div
        className={cn(
          "brand-surface flex h-16 items-center gap-2.5 px-4",
          collapsed && "justify-center px-0",
        )}
      >
        <span className="bg-accent font-display text-accent-foreground shadow-raised flex size-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold">
          CF
        </span>
        {collapsed ? null : (
          <div className="min-w-0 flex-1">
            <p className="font-display truncate text-sm font-semibold leading-tight">CRM CF</p>
            <p className="text-sidebar-muted truncate text-[11px] leading-tight">
              {organization.name}
            </p>
          </div>
        )}
      </div>

      {/* Navegação */}
      <nav className="flex-1 overflow-y-auto px-2.5 py-4" aria-label="Navegação principal">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="mb-5 last:mb-0">
            {collapsed ? null : (
              <p className="text-sidebar-muted/70 mb-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em]">
                {group.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                const disabled = Boolean(item.phase);

                const content = (
                  <span
                    className={cn(
                      "relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-sm transition-all duration-200",
                      collapsed && "justify-center px-0",
                      disabled
                        ? "text-sidebar-muted/50 cursor-not-allowed"
                        : active
                          ? "bg-sidebar-accent text-sidebar-foreground font-medium"
                          : "text-sidebar-muted hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                    )}
                  >
                    {/* Marcador de página atual: um filete laranja à esquerda. */}
                    {active ? (
                      <span
                        className="bg-accent absolute -left-2.5 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full"
                        aria-hidden
                      />
                    ) : null}
                    <Icon className="size-[1.05rem] shrink-0" aria-hidden />
                    {collapsed ? null : (
                      <>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.phase ? (
                          <span className="text-sidebar-muted/70 rounded px-1 text-[9px] font-medium uppercase tracking-wide">
                            {item.phase}
                          </span>
                        ) : null}
                      </>
                    )}
                  </span>
                );

                return (
                  <li key={item.href}>
                    {disabled ? (
                      <Tooltip
                        side="right"
                        content={`${item.label} entra na ${item.phase} do roadmap. Ainda não construído.`}
                      >
                        <div aria-disabled>{content}</div>
                      </Tooltip>
                    ) : collapsed ? (
                      <Tooltip side="right" content={item.label}>
                        <Link href={item.href} aria-current={active ? "page" : undefined}>
                          {content}
                        </Link>
                      </Tooltip>
                    ) : (
                      <Link href={item.href} aria-current={active ? "page" : undefined}>
                        {content}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Rodapé: usuário e controles */}
      <div className="p-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={cn(
                "hover:bg-sidebar-accent flex w-full items-center gap-2.5 rounded-lg p-1.5 text-left transition-colors",
                collapsed && "justify-center",
              )}
            >
              <span className="relative">
                <Avatar initials={currentUser.initials} hue={currentUser.accentHue} size="sm" />
                <PresenceDot
                  presence={currentUser.presence}
                  className="ring-sidebar absolute -bottom-0.5 -right-0.5"
                />
              </span>
              {collapsed ? null : (
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">{currentUser.name}</span>
                  <span className="text-sidebar-muted block truncate text-[11px]">
                    {ROLE_LABEL[currentUser.role]}
                  </span>
                </span>
              )}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" className="w-60">
            <DropdownMenuLabel>Presença</DropdownMenuLabel>
            <div className="flex items-center gap-2 px-2 pb-2 text-xs">
              <PresenceDot presence={currentUser.presence} />
              {PRESENCE_LABEL[currentUser.presence]} · capacidade {currentUser.capacity}
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              <Settings /> Preferências
            </DropdownMenuItem>
            <DropdownMenuItem disabled>
              <ShieldCheck /> Sessões e segurança
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/login">
                <LogOut /> Sair
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <div
          className={cn("mt-1 flex items-center gap-1", collapsed ? "flex-col" : "justify-between")}
        >
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
            className="text-sidebar-muted hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            {collapsed ? <ChevronsRight /> : <ChevronsLeft />}
          </Button>
        </div>
      </div>
    </aside>
  );
}
