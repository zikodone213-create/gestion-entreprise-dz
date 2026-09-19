import { useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import {
  Archive, BadgeDollarSign, Banknote, BarChart3, Boxes, Building2, CalendarClock, ClipboardList,
  Database, FileText, LayoutDashboard, LogOut, Menu, Moon, PanelRightClose, PanelRightOpen,
  ReceiptText, ScrollText, Settings, ShieldCheck, Sun, Users, Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useAuth, useTheme } from "@/lib/erp";
import { Logo } from "./kit";

export type NavItem = { href: string; label: string; icon: any; module: string };

export const NAV: { section: string; items: NavItem[] }[] = [
  {
    section: "عام",
    items: [{ href: "/", label: "لوحة التحكم", icon: LayoutDashboard, module: "dashboard" }],
  },
  {
    section: "الموارد البشرية",
    items: [
      { href: "/hr", label: "الموظفون والحضور", icon: Users, module: "hr" },
      { href: "/payroll", label: "الرواتب وكشوفها", icon: Banknote, module: "payroll" },
      { href: "/advances", label: "التسبيقات", icon: Wallet, module: "advances" },
    ],
  },
  {
    section: "التسيير التجاري",
    items: [
      { href: "/inventory", label: "المخزون والمبيعات", icon: Boxes, module: "inventory" },
      { href: "/invoicing", label: "الفوترة", icon: ReceiptText, module: "invoicing" },
      { href: "/accounting", label: "المحاسبة والديون", icon: BadgeDollarSign, module: "accounting" },
      { href: "/crm", label: "العملاء (CRM)", icon: Building2, module: "crm" },
    ],
  },
  {
    section: "الجباية والمشاريع",
    items: [
      { href: "/fiscal", label: "الجباية (G50 / البيلان)", icon: FileText, module: "fiscal" },
      { href: "/projects", label: "المشاريع والمهام", icon: ClipboardList, module: "projects" },
      { href: "/calendar", label: "التقويم والاستحقاقات", icon: CalendarClock, module: "projects" },
      { href: "/reports", label: "التقارير المالية", icon: BarChart3, module: "accounting" },
    ],
  },
  {
    section: "النظام",
    items: [
      { href: "/settings", label: "الإعدادات والمستخدمون", icon: Settings, module: "settings" },
      { href: "/audit", label: "سجل العمليات", icon: ScrollText, module: "audit" },
      { href: "/backups", label: "النسخ الاحتياطي", icon: Database, module: "backups" },
    ],
  },
];

function NavLinks({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const [location] = useLocation();
  const { can } = useAuth();
  return (
    <nav className="flex-1 space-y-4 overflow-y-auto px-2 py-3">
      {NAV.map((group) => {
        const items = group.items.filter((i) => can(i.module, "read"));
        if (!items.length) return null;
        return (
          <div key={group.section}>
            {!collapsed && (
              <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                {group.section}
              </p>
            )}
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active = location === item.href;
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      title={item.label}
                      data-testid={`link-nav-${item.href.replace("/", "") || "dashboard"}`}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors",
                        active
                          ? "bg-sidebar-primary/12 font-semibold text-sidebar-primary"
                          : "text-sidebar-foreground/85 hover:bg-sidebar-accent",
                        collapsed && "justify-center px-0",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export function AppShell({ children, title, subtitle, actions }: { children: ReactNode; title: string; subtitle?: string; actions?: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user, logout } = useAuth();
  const { dark, toggle } = useTheme();

  const brand = (
    <div className={cn("flex items-center gap-2.5 border-b border-sidebar-border px-3 py-3.5", collapsed && "justify-center px-0")}>
      <span className="text-sidebar-primary"><Logo className="h-7 w-7" /></span>
      {!collapsed && (
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight">النور ERP</p>
          <p className="truncate text-[11px] text-muted-foreground">تسيير المؤسسة</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* sidebar — desktop */}
      <aside
        className={cn(
          "no-print sticky top-0 hidden h-screen shrink-0 flex-col border-e border-sidebar-border bg-sidebar md:flex",
          collapsed ? "w-[68px]" : "w-64",
        )}
      >
        {brand}
        <NavLinks collapsed={collapsed} />
        <div className="border-t border-sidebar-border p-2">
          <Button
            variant="ghost" size="sm" className="w-full justify-center"
            onClick={() => setCollapsed((c) => !c)}
            data-testid="button-collapse-sidebar"
            title={collapsed ? "توسيع القائمة" : "طي القائمة"}
          >
            {collapsed ? <PanelRightOpen className="h-4 w-4" /> : <><PanelRightClose className="me-1.5 h-4 w-4" /> طي القائمة</>}
          </Button>
        </div>
      </aside>

      {/* sidebar — mobile */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="right" className="w-[80vw] max-w-[280px] bg-sidebar p-0" dir="rtl">
          {brand}
          <NavLinks collapsed={false} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
          <Button
            variant="outline" size="icon" className="md:hidden"
            onClick={() => setMobileOpen(true)} data-testid="button-open-menu" aria-label="القائمة"
          >
            <Menu className="h-4 w-4" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold leading-tight" data-testid="text-page-title">{title}</h1>
            {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2">
            {actions}
            <Button variant="outline" size="icon" onClick={toggle} data-testid="button-theme" aria-label="تغيير المظهر">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <div className="hidden items-center gap-2 rounded-md border border-border px-2.5 py-1.5 sm:flex">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <div className="leading-tight">
                <p className="text-xs font-semibold" data-testid="text-current-user">{user?.name}</p>
                <p className="text-[11px] text-muted-foreground">{user?.role}</p>
              </div>
            </div>
            <Button variant="outline" size="icon" onClick={logout} data-testid="button-logout" aria-label="خروج">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
        <footer className="no-print border-t border-border px-4 py-3 text-[11px] text-muted-foreground">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>النور ERP — نظام تسيير مؤسسة جزائرية · العملة: الدينار الجزائري (د.ج)</span>
            <span className="flex items-center gap-1.5"><Archive className="h-3 w-3" /> المرحلة الثانية</span>
          </div>
        </footer>
      </div>
    </div>
  );
}
