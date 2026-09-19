import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppShell } from "@/components/shell";
import { DataTable, Field, KpiCard, ModalForm, SectionTitle, StatusBadge } from "@/components/kit";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { fmtDZD, fmtDate, fmtNum, useAuth } from "@/lib/erp";
import { useToast } from "@/hooks/use-toast";

export default function AdvancesPage() {
  const { can } = useAuth();
  const { toast } = useToast();
  const writable = can("advances", "write");

  const advances = useQuery<any[]>({ queryKey: ["/api/advances"] });
  const employees = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const balances = useQuery<any[]>({ queryKey: ["/api/advances-balances"] });

  const empName = (id: number) => {
    const e = employees.data?.find((x) => x.id === id);
    return e ? `${e.first_name} ${e.last_name}` : `#${id}`;
  };

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({});

  const invalidate = () => {
    ["/api/advances", "/api/advances-balances"].forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  };

  const save = useMutation({
    mutationFn: async (d: any) => (await apiRequest("POST", "/api/advances", d)).json(),
    onSuccess: () => { setOpen(false); invalidate(); toast({ title: "تم تسجيل طلب التسبيق" }); },
    onError: (e: any) => toast({ title: "تعذّر الحفظ", description: String(e.message), variant: "destructive" }),
  });

  const setStatus = useMutation({
    mutationFn: async ({ id, status }: any) => (await apiRequest("POST", `/api/advances/${id}/status`, { status })).json(),
    onSuccess: () => { invalidate(); toast({ title: "تم تحديث حالة التسبيق" }); },
  });

  const rows = (advances.data || []).map((a) => ({ ...a, employee: empName(a.employee_id) }));
  const totals = rows.reduce(
    (acc, r) => ({
      total: acc.total + (r.status !== "مرفوضة" ? r.amount : 0),
      remaining: acc.remaining + (r.status === "مقبولة" ? r.remaining : 0),
      pending: acc.pending + (r.status === "قيد الانتظار" ? 1 : 0),
    }),
    { total: 0, remaining: 0, pending: 0 },
  );

  return (
    <AppShell
      title="التسبيقات على الراتب"
      subtitle="طلب التسبيق، الخصم التلقائي عند توليد الراتب، ومتابعة الرصيد المتبقي لكل موظف"
      actions={writable ? (
        <Button size="sm" onClick={() => { setForm({ request_date: new Date().toISOString().slice(0, 10), installments: 3, status: "قيد الانتظار" }); setOpen(true); }} data-testid="button-add-advance-open">
          <Plus className="me-1.5 h-4 w-4" /> طلب تسبيق
        </Button>
      ) : null}
    >
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="مجموع التسبيقات الممنوحة" value={fmtDZD(totals.total)} icon={<Wallet className="h-4 w-4" />} testId="kpi-adv-total" />
        <KpiCard label="الرصيد المتبقي للاستقطاع" value={fmtDZD(totals.remaining)} tone="warning" testId="kpi-adv-remaining" />
        <KpiCard label="طلبات قيد الانتظار" value={fmtNum(totals.pending)} testId="kpi-adv-pending" />
        <KpiCard label="عدد الملفات" value={fmtNum(rows.length)} testId="kpi-adv-count" />
      </div>

      <SectionTitle title="طلبات التسبيق" subtitle="المبلغ، عدد الأقساط، القسط الشهري، والمخصوم" />
      <DataTable
        testId="table-advances"
        rows={rows}
        isLoading={advances.isLoading}
        error={advances.error}
        onRetry={advances.refetch}
        searchKeys={["employee", "reason", "status"]}
        exportName="التسبيقات"
        columns={[
          { key: "employee", label: "الموظف", render: (r) => <span className="font-medium">{r.employee}</span> },
          { key: "request_date", label: "التاريخ", render: (r) => <span className="num">{fmtDate(r.request_date)}</span> },
          { key: "amount", label: "المبلغ", align: "end", render: (r) => <span className="num">{fmtNum(r.amount)}</span> },
          { key: "installments", label: "الأقساط", align: "center", render: (r) => <span className="num">{r.installments}</span> },
          { key: "monthly_deduction", label: "القسط الشهري", align: "end", render: (r) => <span className="num">{fmtNum(r.monthly_deduction)}</span> },
          { key: "deducted", label: "المخصوم", align: "end", hideOnMobile: true, render: (r) => <span className="num">{fmtNum(r.deducted)}</span> },
          { key: "remaining", label: "المتبقي", align: "end", render: (r) => <span className="num font-semibold">{fmtNum(r.remaining)}</span> },
          { key: "reason", label: "السبب", hideOnMobile: true },
          { key: "status", label: "الحالة", render: (r) => <StatusBadge value={r.status} /> },
          ...(writable ? [{
            key: "actions", label: "قرار", align: "end" as const,
            render: (r: any) => r.status === "قيد الانتظار" ? (
              <div className="flex justify-end gap-1">
                <Button size="sm" variant="outline" className="h-8" onClick={() => setStatus.mutate({ id: r.id, status: "مقبولة" })} data-testid={`button-approve-advance-${r.id}`}>موافقة</Button>
                <Button size="sm" variant="outline" className="h-8 text-destructive" onClick={() => setStatus.mutate({ id: r.id, status: "مرفوضة" })} data-testid={`button-reject-advance-${r.id}`}>رفض</Button>
              </div>
            ) : <span className="text-xs text-muted-foreground">—</span>,
          }] : []),
        ]}
      />

      <Card className="mt-5 p-4">
        <SectionTitle title="رصيد التسبيقات لكل موظف" subtitle="الخصم يتم آلياً عند توليد كشف الراتب الشهري" />
        <DataTable
          testId="table-advance-balances"
          rows={(balances.data || []).map((b) => ({ ...b, employee: `${b.first_name} ${b.last_name}` }))}
          isLoading={balances.isLoading}
          error={balances.error}
          onRetry={balances.refetch}
          searchKeys={["employee", "matricule"]}
          exportName="أرصدة-التسبيقات"
          pageSize={12}
          columns={[
            { key: "matricule", label: "الرقم", render: (r) => <span className="num">{r.matricule}</span> },
            { key: "employee", label: "الموظف" },
            { key: "base_salary", label: "الراتب الأساسي", align: "end", render: (r) => <span className="num">{fmtNum(r.base_salary)}</span> },
            { key: "total", label: "مجموع التسبيقات", align: "end", render: (r) => <span className="num">{fmtNum(r.total)}</span> },
            { key: "deducted", label: "المخصوم", align: "end", render: (r) => <span className="num">{fmtNum(r.deducted)}</span> },
            { key: "remaining", label: "الرصيد المتبقي", align: "end", render: (r) => <span className={`num font-semibold ${r.remaining > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>{fmtNum(r.remaining)}</span> },
          ]}
        />
      </Card>

      <ModalForm
        open={open}
        onOpenChange={(v) => { setOpen(v); if (!v) setForm({}); }}
        title="طلب تسبيق على الراتب"
        description="القسط الشهري يُحسب آلياً = المبلغ ÷ عدد الأقساط، ويُخصم عند توليد كشف الراتب"
        submitting={save.isPending}
        onSubmit={() => save.mutate(form)}
      >
        <Field label="الموظف" full>
          <Select value={form.employee_id ? String(form.employee_id) : ""} onValueChange={(v) => setForm({ ...form, employee_id: +v })}>
            <SelectTrigger data-testid="select-advance-employee"><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
            <SelectContent>
              {(employees.data || []).map((e) => (
                <SelectItem key={e.id} value={String(e.id)}>{e.matricule} — {e.first_name} {e.last_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="المبلغ (د.ج)">
          <Input type="number" value={form.amount ?? ""} onChange={(e) => setForm({ ...form, amount: +e.target.value })} data-testid="input-advance-amount" required />
        </Field>
        <Field label="عدد الأقساط">
          <Input type="number" min={1} max={12} value={form.installments ?? 3} onChange={(e) => setForm({ ...form, installments: +e.target.value })} data-testid="input-advance-installments" />
        </Field>
        <Field label="تاريخ الطلب">
          <Input type="date" value={form.request_date || ""} onChange={(e) => setForm({ ...form, request_date: e.target.value })} />
        </Field>
        <Field label="الحالة">
          <Select value={form.status || "قيد الانتظار"} onValueChange={(v) => setForm({ ...form, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["قيد الانتظار", "مقبولة", "مرفوضة"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="السبب" full>
          <Textarea value={form.reason || ""} onChange={(e) => setForm({ ...form, reason: e.target.value })} data-testid="input-advance-reason" />
        </Field>
        <p className="num sm:col-span-2 text-xs text-muted-foreground">
          القسط الشهري التقديري: {fmtDZD(Math.round((+form.amount || 0) / Math.max(1, +form.installments || 1)))}
        </p>
      </ModalForm>
    </AppShell>
  );
}
