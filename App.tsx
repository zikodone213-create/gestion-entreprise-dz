import { Switch, Route, Router } from "wouter";
import { useHashLocation } from "wouter/use-hash-location";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, ThemeProvider, useAuth } from "@/lib/erp";
import { AppShell } from "@/components/shell";
import { StubPanel } from "@/components/kit";
import LoginPage from "@/pages/login";
import DashboardPage from "@/pages/dashboard";
import HrPage from "@/pages/hr";
import PayrollPage from "@/pages/payroll";
import AdvancesPage from "@/pages/advances";
import SettingsPage from "@/pages/settings";
import AuditPage from "@/pages/audit";
import BackupsPage from "@/pages/backups";
import InventoryPage from "@/pages/inventory";
import InvoicingPage from "@/pages/invoicing";
import AccountingPage from "@/pages/accounting";
import ReportsPage from "@/pages/reports";
import FiscalPage from "@/pages/fiscal";
import CrmPage from "@/pages/crm";
import ProjectsPage from "@/pages/projects";
import CalendarPage from "@/pages/calendar";
import NotFound from "@/pages/not-found";

function Guarded({ module, children }: { module: string; children: any }) {
  const { can } = useAuth();
  if (!can(module, "read"))
    return (
      <AppShell title="صلاحية غير كافية">
        <StubPanel
          title="لا تملك صلاحية الاطلاع على هذه الوحدة"
          note="تواصل مع مدير النظام لتعديل صلاحيات حسابك. التحقق يتم أيضاً في الباك-إند."
        />
      </AppShell>
    );
  return children;
}

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/hr">{() => <Guarded module="hr"><HrPage /></Guarded>}</Route>
      <Route path="/payroll">{() => <Guarded module="payroll"><PayrollPage /></Guarded>}</Route>
      <Route path="/advances">{() => <Guarded module="advances"><AdvancesPage /></Guarded>}</Route>
      <Route path="/settings">{() => <Guarded module="settings"><SettingsPage /></Guarded>}</Route>
      <Route path="/audit">{() => <Guarded module="audit"><AuditPage /></Guarded>}</Route>
      <Route path="/backups">{() => <Guarded module="backups"><BackupsPage /></Guarded>}</Route>

      <Route path="/inventory">{() => <Guarded module="inventory"><InventoryPage /></Guarded>}</Route>
      <Route path="/invoicing">{() => <Guarded module="invoicing"><InvoicingPage /></Guarded>}</Route>
      <Route path="/accounting">{() => <Guarded module="accounting"><AccountingPage /></Guarded>}</Route>
      <Route path="/reports">{() => <Guarded module="accounting"><ReportsPage /></Guarded>}</Route>
      <Route path="/fiscal">{() => <Guarded module="fiscal"><FiscalPage /></Guarded>}</Route>
      <Route path="/crm">{() => <Guarded module="crm"><CrmPage /></Guarded>}</Route>
      <Route path="/projects">{() => <Guarded module="projects"><ProjectsPage /></Guarded>}</Route>
      <Route path="/calendar">{() => <Guarded module="projects"><CalendarPage /></Guarded>}</Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function Gate() {
  const { user } = useAuth();
  if (!user) return <LoginPage />;
  return (
    <Router hook={useHashLocation}>
      <AppRouter />
    </Router>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Gate />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
