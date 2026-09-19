import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, ArrowUpRight, BadgeDollarSign, Pencil, Plus, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppShell } from "@/components/shell";
import { AlertBanner, DataTable, Field, KpiCard, ModalForm, SectionTitle, StatusBadge, TableReport } from "@/components/kit";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { fmtDZD, fmtDate, fmtNum, useAuth } from "@/lib/erp";
import { useToast } from "@/hooks/use-toast";

const EXPENSE_CATEGORIES = [
  "مشتريات", "إيجار", "كهرباء وماء", "نقل وشحن", "اتصالات", "صيانة", "تأمينات", "مصاريف إدارية", "أخرى",
];
const METHODS = ["تحويل بنكي", "نقداً", "صك", "سفتجة"];

export default function AccountingPage() {
  const { can } = useAuth();
  const { toast } = useToast();
  const writable = can("accounting", "write");

  const payments = useQuery<any[]>({ queryKey: ["/api/payments"] });
  const expenses = useQuery<any[]>({ queryKey: ["/api/expenses"] });
  const debts = useQuery<any[]>({ queryKey: ["/api/debts"] });
  const aging = useQuery<any[]>({ queryKey: ["/api/reports/aging"] });
  const clients = useQuery<any[]>({ queryKey: ["/api/clients"] });
  const suppliers = useQuery<any[]>({ queryKey: ["/api/suppliers"] });
  const invoices = useQuery<any[]>({ queryKey: ["/api/invoices"] });
  const company = useQuery<any>({ queryKey: ["/api/settings"] });
  const [printMode, setPrintMode] = useState<"" | "expenses" | "debts">("");

  const invalidate = (keys: string[]) => keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  const err = (e: any) => toast({ title: "تعذّر تنفيذ العملية", description: String(e.message), variant: "destructive" });

  const clientName = (id: number) => clients.data?.find((c) => c.id === id)?.name || "—";
  const supplierName = (id: number) => suppliers.data?.find((s) => s.id === id)?.name || "—";
  const invoiceNumber = (id: number) => invoices.data?.find((i) => i.id === id)?.number || "—";

  /* ---------------- income (payments) ---------------- */
  const [inOpen, setInOpen] = useState(false);
  const [inForm, setInForm] = useState<any>({});
  const openIncome = () => {
    setInForm({ direction: "مدخول", date: new Date().toISOString().slice(0, 10), method: "تحويل بنكي", amount: 0 });
    setInOpen(true);
  };
  const inSave = useMutation({
    mutationFn: async (d: any) => (await apiRequest("POST", "/api/payments", d)).json(),
    onSuccess: () => { setInOpen(false); invalidate(["/api/payments", "/api/invoices", "/api/debts", "/api/reports/aging"]); toast({ title: "تم تسجيل الحركة المالية" }); },
    onError: err,
  });
  const inDelete = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/payments/${id}`)).json(),
    onSuccess: () => { invalidate(["/api/payments", "/api/invoices"]); toast({ title: "تم الحذف" }); },
    onError: err,
  });

  /* ---------------- expenses ---------------- */
  const [exOpen, setExOpen] = useState(false);
  const [exForm, setExForm] = useState<any>({});
  const openExpense = (row?: any) => {
    setExForm(row ? { ...row } : { date: new Date().toISOString().slice(0, 10), category: EXPENSE_CATEGORIES[0], tva_rate: 19, amount_ht: 0, payment_method: "تحويل بنكي" });
    setExOpen(true);
  };
  const exSave = useMutation({
    mutationFn: async (d: any) => {
      const ht = +d.amount_ht || 0;
      const rate = +d.tva_rate || 0;
      const tva = Math.round((ht * rate) / 100);
      const payload = { ...d, amount_ht: ht, tva_rate: rate, tva_amount: tva, amount_ttc: ht + tva };
      return (d.id ? await apiRequest("PATCH", `/api/expenses/${d.id}`, payload) : await apiRequest("POST", "/api/expenses", payload)).json();
    },
    onSuccess: () => { setExOpen(false); invalidate(["/api/expenses"]); toast({ title: "تم حفظ المصروف" }); },
    onError: err,
  });
  const exDelete = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/expenses/${id}`)).json(),
    onSuccess: () => { invalidate(["/api/expenses"]); toast({ title: "تم حذف المصروف" }); },
    onError: err,
  });

  /* ---------------- debts ---------------- */
  const [dbOpen, setDbOpen] = useState(false);
  const [dbForm, setDbForm] = useState<any>({});
  const openDebt = (row?: any) => {
    setDbForm(row ? { ...row } : { party_type: "مورد", status: "مفتوح", amount: 0, paid: 0, due_date: new Date().toISOString().slice(0, 10) });
    setDbOpen(true);
  };
  const dbSave = useMutation({
    mutationFn: async (d: any) => {
      const payload = {
        ...d,
        party_name: d.party_name || (d.party_type === "عميل" ? clientName(d.party_id) : supplierName(d.party_id)),
      };
      return (d.id ? await apiRequest("PATCH", `/api/debts/${d.id}`, payload) : await apiRequest("POST", "/api/debts", payload)).json();
    },
    onSuccess: () => { setDbOpen(false); invalidate(["/api/debts", "/api/reports/aging"]); toast({ title: "تم حفظ الدين" }); },
    onError: err,
  });
  const dbDelete = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/debts/${id}`)).json(),
    onSuccess: () => { invalidate(["/api/debts", "/api/reports/aging"]); toast({ title: "تم الحذف" }); },
    onError: err,
  });

  /* ---------------- derived ---------------- */
  const income = (payments.data || []).filter((p) => p.direction === "مدخول");
  const outflow = (payments.data || []).filter((p) => p.direction !== "مدخول");
  const totalIncome = income.reduce((a, p) => a + p.amount, 0);
  const totalExpenses = (expenses.data || []).reduce((a, e) => a + e.amount_ht, 0);
  const tvaDeductible = (expenses.data || []).reduce((a, e) => a + e.tva_amount, 0);

  const buckets = useMemo(() => {
    const b = { b0: 0, b30: 0, b60: 0, b90: 0, total: 0, late: 0 };
    for (const d of aging.data || []) {
      const rest = d.amount - d.paid;
      const days = d.days_late ?? 0;
      b.total += rest;
      if (days <= 0) b.b0 += rest;
      else if (days <= 30) { b.b30 += rest; b.late += rest; }
      else if (days <= 90) { b.b60 += rest; b.late += rest; }
      else { b.b90 += rest; b.late += rest; }
    }
    return b;
  }, [aging.data]);

  const [partyFilter, setPartyFilter] = useState("all");
  const debtRows = (debts.data || [])
    .filter((d) => (partyFilter === "all" ? true : d.party_type === partyFilter))
    .map((d) => {
      const days = d.due_date ? Math.floor((Date.now() - new Date(d.due_date).getTime()) / 86400000) : 0;
      return { ...d, remaining: d.amount - d.paid, days_late: d.status === "مفتوح" ? days : 0, invoice_number: d.invoice_id ? invoiceNumber(d.invoice_id) : "—" };
    });

  return (
    <AppShell
      title="المحاسبة والديون"
      subtitle="المداخيل، المصاريف مع الرسم القابل للاسترداد، الديون وأعمار الديون"
      actions={writable ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={openIncome} data-testid="button-add-income">
            <ArrowDownLeft className="me-1.5 h-4 w-4" /> مدخول
          </Button>
          <Button size="sm" onClick={() => openExpense()} data-testid="button-add-expense">
            <ArrowUpRight className="me-1.5 h-4 w-4" /> مصروف
          </Button>
        </div>
      ) : null}
    >
      {buckets.late > 0 && (
        <AlertBanner tone="warning" title={<span>ديون متأخرة عن أجل السداد: <span className="num">{fmtDZD(buckets.late)}</span></span>} testId="banner-late-debts">
          موزّعة على {fmtNum((aging.data || []).filter((d) => (d.days_late ?? 0) > 0).length)} سجل — راجع تبويب «الديون وأعمارها» للمتابعة والتحصيل.
        </AlertBanner>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="المداخيل المحصَّلة" value={fmtDZD(totalIncome)} tone="positive" icon={<ArrowDownLeft className="h-4 w-4" />} testId="kpi-income" />
        <KpiCard label="المصاريف (خارج الرسم)" value={fmtDZD(totalExpenses)} icon={<ArrowUpRight className="h-4 w-4" />} testId="kpi-expenses" />
        <KpiCard label="TVA قابلة للاسترداد" value={fmtDZD(tvaDeductible)} hint="تُخصم في تصريح G50" testId="kpi-tva-deductible" />
        <KpiCard label="الديون المفتوحة" value={fmtDZD(buckets.total)} tone="warning" testId="kpi-debts-open" />
        <KpiCard label="منها متأخرة" value={fmtDZD(buckets.late)} tone={buckets.late ? "danger" : "default"} icon={<TriangleAlert className="h-4 w-4" />} testId="kpi-debts-late" />
      </div>

      <Tabs defaultValue="income">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="income" data-testid="tab-income">المداخيل</TabsTrigger>
          <TabsTrigger value="expenses" data-testid="tab-expenses">المصاريف</TabsTrigger>
          <TabsTrigger value="debts" data-testid="tab-debts">الديون وأعمارها</TabsTrigger>
        </TabsList>

        <TabsContent value="income">
          <DataTable
            testId="table-income"
            rows={(payments.data || []).map((p) => ({
              ...p,
              client: p.client_id ? clientName(p.client_id) : "—",
              invoice_number: p.invoice_id ? invoiceNumber(p.invoice_id) : "—",
            }))}
            isLoading={payments.isLoading}
            error={payments.error}
            onRetry={payments.refetch}
            searchKeys={["client", "invoice_number", "method", "ref"]}
            exportName="المداخيل-والمدفوعات"
            pageSize={12}
            columns={[
              { key: "date", label: "التاريخ", render: (r) => <span className="num">{fmtDate(r.date)}</span> },
              { key: "direction", label: "الاتجاه", render: (r) => <StatusBadge value={r.direction} /> },
              { key: "client", label: "العميل" },
              { key: "invoice_number", label: "الفاتورة", render: (r) => <span className="num text-xs">{r.invoice_number}</span> },
              { key: "amount", label: "المبلغ", align: "end", render: (r) => <span className="num font-semibold">{fmtNum(r.amount)}</span> },
              { key: "method", label: "الطريقة", hideOnMobile: true },
              { key: "ref", label: "المرجع", hideOnMobile: true, render: (r) => <span className="num text-xs">{r.ref || "—"}</span> },
              ...(writable ? [{
                key: "actions", label: "إجراء", align: "end" as const,
                render: (r: any) => (
                  <Button variant="outline" size="icon" className="h-8 w-8 text-destructive"
                    onClick={() => { if (confirm("حذف هذه الحركة المالية؟")) inDelete.mutate(r.id); }}
                    data-testid={`button-delete-payment-${r.id}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                ),
              }] : []),
            ]}
            toolbar={
              <span className="hidden flex-wrap items-center gap-x-3 text-xs text-muted-foreground sm:flex">
                <span>عدد المداخيل: <span className="num">{fmtNum(income.length)}</span></span>
                <span>عدد المصروفات النقدية: <span className="num">{fmtNum(outflow.length)}</span></span>
              </span>
            }
          />
        </TabsContent>

        <TabsContent value="expenses">
          <DataTable
            testId="table-expenses"
            rows={(expenses.data || []).map((e) => ({ ...e, supplier: e.supplier_id ? supplierName(e.supplier_id) : "—" }))}
            isLoading={expenses.isLoading}
            error={expenses.error}
            onRetry={expenses.refetch}
            searchKeys={["description", "category", "ref", "supplier"]}
            exportName="المصاريف"
            pageSize={12}
            onPrint={() => setPrintMode("expenses")}
            columns={[
              { key: "date", label: "التاريخ", render: (r) => <span className="num">{fmtDate(r.date)}</span> },
              { key: "category", label: "الطبيعة", render: (r) => <span className="font-medium">{r.category}</span> },
              { key: "description", label: "البيان" },
              { key: "supplier", label: "المورد", hideOnMobile: true },
              { key: "amount_ht", label: "خارج الرسم", align: "end", render: (r) => <span className="num">{fmtNum(r.amount_ht)}</span> },
              { key: "tva_rate", label: "TVA %", align: "center", hideOnMobile: true, render: (r) => <span className="num">{fmtNum(r.tva_rate)}</span> },
              { key: "tva_amount", label: "مبلغ الرسم", align: "end", hideOnMobile: true, render: (r) => <span className="num">{fmtNum(r.tva_amount)}</span> },
              { key: "amount_ttc", label: "الإجمالي", align: "end", render: (r) => <span className="num font-semibold">{fmtNum(r.amount_ttc)}</span> },
              { key: "payment_method", label: "طريقة الدفع", hideOnMobile: true },
              ...(writable ? [{
                key: "actions", label: "إجراءات", align: "end" as const,
                render: (r: any) => (
                  <div className="flex justify-end gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openExpense(r)} data-testid={`button-edit-expense-${r.id}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 text-destructive"
                      onClick={() => { if (confirm("حذف هذا المصروف؟")) exDelete.mutate(r.id); }}
                      data-testid={`button-delete-expense-${r.id}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ),
              }] : []),
            ]}
            toolbar={writable ? (
              <Button size="sm" onClick={() => openExpense()} data-testid="button-add-expense-tab">
                <Plus className="me-1.5 h-4 w-4" /> مصروف جديد
              </Button>
            ) : null}
          />
        </TabsContent>

        <TabsContent value="debts">
          <Card className="mb-4 p-4">
            <SectionTitle title="أعمار الديون" subtitle="الأرصدة المفتوحة موزّعة على فترات التأخير" />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard label="لم يحل أجلها" value={fmtDZD(buckets.b0)} testId="kpi-aging-0" />
              <KpiCard label="متأخرة 1 — 30 يوماً" value={fmtDZD(buckets.b30)} tone="warning" testId="kpi-aging-30" />
              <KpiCard label="متأخرة 31 — 90 يوماً" value={fmtDZD(buckets.b60)} tone="warning" testId="kpi-aging-60" />
              <KpiCard label="متأخرة أكثر من 90 يوماً" value={fmtDZD(buckets.b90)} tone="danger" testId="kpi-aging-90" />
            </div>
          </Card>

          <DataTable
            testId="table-debts"
            rows={debtRows}
            isLoading={debts.isLoading}
            error={debts.error}
            onRetry={debts.refetch}
            searchKeys={["party_name", "invoice_number", "status"]}
            exportName="الديون-وأعمارها"
            pageSize={12}
            onPrint={() => setPrintMode("debts")}
            filters={[{
              key: "party", label: "الطرف", value: partyFilter, onChange: setPartyFilter,
              options: [{ value: "all", label: "الكل" }, { value: "عميل", label: "ديون العملاء" }, { value: "مورد", label: "ديون الموردين" }],
            }]}
            columns={[
              { key: "party_type", label: "الطرف", render: (r) => <StatusBadge value={r.party_type} /> },
              { key: "party_name", label: "الاسم", render: (r) => <span className="font-medium">{r.party_name || "—"}</span> },
              { key: "invoice_number", label: "الفاتورة", hideOnMobile: true, render: (r) => <span className="num text-xs">{r.invoice_number}</span> },
              { key: "amount", label: "المبلغ", align: "end", render: (r) => <span className="num">{fmtNum(r.amount)}</span> },
              { key: "paid", label: "المسدَّد", align: "end", render: (r) => <span className="num">{fmtNum(r.paid)}</span> },
              { key: "remaining", label: "الباقي", align: "end", render: (r) => <span className="num font-semibold">{fmtNum(r.remaining)}</span> },
              { key: "due_date", label: "أجل السداد", render: (r) => <span className="num">{fmtDate(r.due_date)}</span> },
              {
                key: "days_late", label: "التأخير (يوم)", align: "end",
                render: (r) => (
                  <span className={`num ${r.days_late > 90 ? "font-bold text-destructive" : r.days_late > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>
                    {r.status === "مفتوح" && r.days_late > 0 ? fmtNum(r.days_late) : "—"}
                  </span>
                ),
              },
              { key: "status", label: "الحالة", render: (r) => <StatusBadge value={r.status} /> },
              ...(writable ? [{
                key: "actions", label: "إجراءات", align: "end" as const,
                render: (r: any) => (
                  <div className="flex justify-end gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openDebt(r)} data-testid={`button-edit-debt-${r.id}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 text-destructive"
                      onClick={() => { if (confirm("حذف هذا الدين؟")) dbDelete.mutate(r.id); }}
                      data-testid={`button-delete-debt-${r.id}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ),
              }] : []),
            ]}
            toolbar={writable ? (
              <Button size="sm" onClick={() => openDebt()} data-testid="button-add-debt">
                <BadgeDollarSign className="me-1.5 h-4 w-4" /> دين جديد
              </Button>
            ) : null}
          />
        </TabsContent>
      </Tabs>

      {printMode === "expenses" && (
        <TableReport
          title="كشف المصاريف"
          subtitle={<span>مجموع المصاريف خارج الرسم: <span className="num">{fmtDZD(totalExpenses)}</span> · TVA قابلة للاسترداد: <span className="num">{fmtDZD(tvaDeductible)}</span></span>}
          company={company.data}
          rows={expenses.data || []}
          onClose={() => setPrintMode("")}
          columns={[
            { key: "date", label: "التاريخ", render: (r: any) => fmtDate(r.date) },
            { key: "category", label: "الطبيعة" },
            { key: "description", label: "البيان" },
            { key: "amount_ht", label: "خارج الرسم", align: "end", render: (r: any) => fmtNum(r.amount_ht) },
            { key: "tva_amount", label: "الرسم", align: "end", render: (r: any) => fmtNum(r.tva_amount) },
            { key: "amount_ttc", label: "الإجمالي", align: "end", render: (r: any) => fmtNum(r.amount_ttc) },
          ]}
          totalRow={{
            label: "المجموع",
            values: {
              amount_ht: fmtNum(totalExpenses),
              tva_amount: fmtNum(tvaDeductible),
              amount_ttc: fmtNum((expenses.data || []).reduce((a, e) => a + e.amount_ttc, 0)),
            },
          }}
        />
      )}

      {printMode === "debts" && (
        <TableReport
          title="كشف الديون وأعمارها"
          subtitle={<span>الديون المفتوحة: <span className="num">{fmtDZD(buckets.total)}</span> · منها متأخرة: <span className="num">{fmtDZD(buckets.late)}</span></span>}
          company={company.data}
          rows={debtRows}
          onClose={() => setPrintMode("")}
          columns={[
            { key: "party_type", label: "الطرف" },
            { key: "party_name", label: "الاسم" },
            { key: "invoice_number", label: "الفاتورة" },
            { key: "due_date", label: "أجل السداد", render: (r: any) => fmtDate(r.due_date) },
            { key: "amount", label: "المبلغ", align: "end", render: (r: any) => fmtNum(r.amount) },
            { key: "paid", label: "المسدَّد", align: "end", render: (r: any) => fmtNum(r.paid) },
            { key: "remaining", label: "الباقي", align: "end", render: (r: any) => fmtNum(r.remaining) },
            { key: "days_late", label: "التأخير", align: "end", render: (r: any) => (r.days_late > 0 ? fmtNum(r.days_late) : "—") },
          ]}
          totalRow={{
            label: "المجموع",
            values: {
              amount: fmtNum(debtRows.reduce((a, d) => a + d.amount, 0)),
              paid: fmtNum(debtRows.reduce((a, d) => a + d.paid, 0)),
              remaining: fmtNum(debtRows.reduce((a, d) => a + d.remaining, 0)),
            },
          }}
        />
      )}

      {/* ---------------- modals ---------------- */}
      <ModalForm
        open={inOpen} onOpenChange={setInOpen}
        title="تسجيل حركة مالية"
        description="مدخول (تحصيل من عميل) أو مصروف نقدي — يُحدَّث رصيد الفاتورة آلياً عند ربطها"
        submitting={inSave.isPending}
        onSubmit={() => inSave.mutate(inForm)}
      >
        <Field label="الاتجاه">
          <Select value={inForm.direction || "مدخول"} onValueChange={(v) => setInForm({ ...inForm, direction: v })}>
            <SelectTrigger data-testid="select-income-direction"><SelectValue /></SelectTrigger>
            <SelectContent>{["مدخول", "مصروف"].map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="المبلغ (د.ج)">
          <Input type="number" value={inForm.amount ?? 0} onChange={(e) => setInForm({ ...inForm, amount: +e.target.value })} required data-testid="input-income-amount" />
        </Field>
        <Field label="العميل">
          <Select value={inForm.client_id ? String(inForm.client_id) : ""} onValueChange={(v) => setInForm({ ...inForm, client_id: +v })}>
            <SelectTrigger data-testid="select-income-client"><SelectValue placeholder="بدون عميل" /></SelectTrigger>
            <SelectContent>{(clients.data || []).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="الفاتورة">
          <Select value={inForm.invoice_id ? String(inForm.invoice_id) : ""} onValueChange={(v) => setInForm({ ...inForm, invoice_id: +v })}>
            <SelectTrigger data-testid="select-income-invoice"><SelectValue placeholder="بدون فاتورة" /></SelectTrigger>
            <SelectContent>
              {(invoices.data || []).filter((i) => i.status !== "ملغاة").slice(0, 60).map((i) => (
                <SelectItem key={i.id} value={String(i.id)}>{i.number} — {i.client_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="التاريخ">
          <Input type="date" value={inForm.date || ""} onChange={(e) => setInForm({ ...inForm, date: e.target.value })} required />
        </Field>
        <Field label="الطريقة">
          <Select value={inForm.method || "تحويل بنكي"} onValueChange={(v) => setInForm({ ...inForm, method: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="المرجع" full>
          <Input value={inForm.ref || ""} onChange={(e) => setInForm({ ...inForm, ref: e.target.value })} />
        </Field>
      </ModalForm>

      <ModalForm
        open={exOpen} onOpenChange={setExOpen}
        title={exForm.id ? "تعديل مصروف" : "مصروف جديد"}
        description="يُحسب الرسم على القيمة المضافة آلياً ويُدرج في TVA القابلة للاسترداد في G50"
        submitting={exSave.isPending}
        onSubmit={() => exSave.mutate(exForm)}
        wide
      >
        <Field label="التاريخ">
          <Input type="date" value={exForm.date || ""} onChange={(e) => setExForm({ ...exForm, date: e.target.value })} required />
        </Field>
        <Field label="الطبيعة">
          <Select value={exForm.category || EXPENSE_CATEGORIES[0]} onValueChange={(v) => setExForm({ ...exForm, category: v })}>
            <SelectTrigger data-testid="select-expense-category"><SelectValue /></SelectTrigger>
            <SelectContent>{EXPENSE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="البيان" full>
          <Input value={exForm.description || ""} onChange={(e) => setExForm({ ...exForm, description: e.target.value })} data-testid="input-expense-desc" />
        </Field>
        <Field label="المورد">
          <Select value={exForm.supplier_id ? String(exForm.supplier_id) : ""} onValueChange={(v) => setExForm({ ...exForm, supplier_id: +v })}>
            <SelectTrigger><SelectValue placeholder="بدون مورد" /></SelectTrigger>
            <SelectContent>{(suppliers.data || []).map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="المرجع">
          <Input value={exForm.ref || ""} onChange={(e) => setExForm({ ...exForm, ref: e.target.value })} />
        </Field>
        <Field label="المبلغ خارج الرسم (د.ج)">
          <Input type="number" value={exForm.amount_ht ?? 0} onChange={(e) => setExForm({ ...exForm, amount_ht: +e.target.value })} required data-testid="input-expense-ht" />
        </Field>
        <Field label="نسبة TVA %">
          <Input type="number" value={exForm.tva_rate ?? 19} onChange={(e) => setExForm({ ...exForm, tva_rate: +e.target.value })} />
        </Field>
        <Field label="طريقة الدفع">
          <Select value={exForm.payment_method || "تحويل بنكي"} onValueChange={(v) => setExForm({ ...exForm, payment_method: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <p className="num sm:col-span-2 text-xs text-muted-foreground">
          مبلغ الرسم: {fmtDZD(Math.round(((+exForm.amount_ht || 0) * (+exForm.tva_rate || 0)) / 100))} · الإجمالي بالرسم:{" "}
          {fmtDZD(Math.round((+exForm.amount_ht || 0) * (1 + (+exForm.tva_rate || 0) / 100)))}
        </p>
      </ModalForm>

      <ModalForm
        open={dbOpen} onOpenChange={setDbOpen}
        title={dbForm.id ? "تعديل دين" : "دين جديد"}
        description="ديون العملاء تُنشأ آلياً عند إصدار الفواتير — هنا تُسجَّل ديون الموردين والتسويات"
        submitting={dbSave.isPending}
        onSubmit={() => dbSave.mutate(dbForm)}
      >
        <Field label="نوع الطرف">
          <Select value={dbForm.party_type || "مورد"} onValueChange={(v) => setDbForm({ ...dbForm, party_type: v, party_id: undefined, party_name: "" })}>
            <SelectTrigger data-testid="select-debt-party-type"><SelectValue /></SelectTrigger>
            <SelectContent>{["عميل", "مورد"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="الطرف">
          <Select value={dbForm.party_id ? String(dbForm.party_id) : ""}
            onValueChange={(v) => setDbForm({ ...dbForm, party_id: +v, party_name: dbForm.party_type === "عميل" ? clientName(+v) : supplierName(+v) })}>
            <SelectTrigger data-testid="select-debt-party"><SelectValue placeholder="اختر" /></SelectTrigger>
            <SelectContent>
              {(dbForm.party_type === "عميل" ? clients.data || [] : suppliers.data || []).map((p: any) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="المبلغ (د.ج)">
          <Input type="number" value={dbForm.amount ?? 0} onChange={(e) => setDbForm({ ...dbForm, amount: +e.target.value })} required data-testid="input-debt-amount" />
        </Field>
        <Field label="المسدَّد (د.ج)">
          <Input type="number" value={dbForm.paid ?? 0} onChange={(e) => setDbForm({ ...dbForm, paid: +e.target.value })} />
        </Field>
        <Field label="أجل السداد">
          <Input type="date" value={dbForm.due_date || ""} onChange={(e) => setDbForm({ ...dbForm, due_date: e.target.value })} />
        </Field>
        <Field label="الحالة">
          <Select value={dbForm.status || "مفتوح"} onValueChange={(v) => setDbForm({ ...dbForm, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["مفتوح", "مسدد"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="ملاحظات" full>
          <Textarea value={dbForm.notes || ""} onChange={(e) => setDbForm({ ...dbForm, notes: e.target.value })} />
        </Field>
      </ModalForm>
    </AppShell>
  );
}
