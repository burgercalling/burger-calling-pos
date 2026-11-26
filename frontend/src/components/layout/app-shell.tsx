"use client";

import {
  BarChart3,
  Boxes,
  Building2,
  DatabaseBackup,
  FileClock,
  LayoutDashboard,
  LogOut,
  Moon,
  PackageCheck,
  Receipt,
  Settings,
  Sun,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import type { ComponentType, ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCurrentUser, useLogout } from "@/hooks/use-auth";
import type { UserRole } from "@/types/auth";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
}

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  super_admin: [
    { href: "/superadmin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/superadmin/franchises", label: "Franchises", icon: Building2 },
    { href: "/superadmin/users", label: "Users & Cashiers", icon: Users },
    { href: "/superadmin/menu", label: "Menu & Combos", icon: UtensilsCrossed },
    { href: "/superadmin/inventory", label: "Inventory", icon: Boxes },
    { href: "/superadmin/stock-requests", label: "Stock Requests", icon: PackageCheck },
    { href: "/superadmin/reports", label: "Reports", icon: BarChart3 },
    { href: "/superadmin/settings", label: "Global Settings", icon: Settings },
    { href: "/superadmin/logs", label: "Audit & Activity", icon: FileClock },
    { href: "/superadmin/backup", label: "Backup & Restore", icon: DatabaseBackup },
  ],
  franchise_owner: [
    { href: "/owner/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/pos", label: "Billing POS", icon: Receipt },
    { href: "/owner/cashiers", label: "Cashiers", icon: Users },
    { href: "/owner/inventory", label: "Inventory", icon: Boxes },
    { href: "/owner/stock-requests", label: "Stock Requests", icon: PackageCheck },
    { href: "/owner/reports", label: "Reports", icon: BarChart3 },
  ],
  cashier: [{ href: "/pos", label: "Billing POS", icon: Receipt }],
};

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { data: user } = useCurrentUser();
  const logoutMutation = useLogout();
  const navItems = user ? NAV_BY_ROLE[user.role] ?? [] : [];

  return (
    <div className="flex min-h-screen bg-stone-50 dark:bg-stone-950">
      <aside className="no-print hidden w-64 flex-col border-r border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900 md:flex">
        <div className="border-b border-stone-200 px-5 py-4 dark:border-stone-800">
          <p className="text-lg font-extrabold tracking-tight text-orange-600">BURGER CALLING</p>
          <p className="text-xs text-stone-500">100% Pure Veg POS</p>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? "bg-orange-50 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400"
                    : "text-stone-700 hover:bg-stone-100 dark:text-stone-300 dark:hover:bg-stone-800"
                }`}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-stone-200 p-4 dark:border-stone-800">
          {user && (
            <div className="space-y-1">
              <p className="truncate text-sm font-semibold text-stone-900 dark:text-stone-100">{user.full_name}</p>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px] uppercase">{user.role.replace("_", " ")}</Badge>
                {user.franchise && (
                  <Badge className="bg-orange-100 text-[10px] text-orange-800 hover:bg-orange-100">{user.franchise.outlet_code}</Badge>
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="flex-1">
              {theme === "dark" ? <Sun className="mr-1.5 h-3.5 w-3.5" /> : <Moon className="mr-1.5 h-3.5 w-3.5" />}
              {theme === "dark" ? "Light" : "Dark"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => logoutMutation.mutate()}>
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden">{children}</main>
    </div>
  );
}
