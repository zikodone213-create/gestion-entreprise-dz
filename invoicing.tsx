import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Ban, BadgeCheck, FilePlus2, LayoutTemplate, Pencil, Plus, Printer, ReceiptText, Trash2, Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { AppShell } from "@/components/shell";
import {
  AlertBanner, DataTable, Field, KpiCard, ModalForm, PrintHeader, PrintLayout, SectionTitle, StatusBadge,
} from "@/components/kit";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { amountInArabicWords, fmtDZD, fmtDate, fmtNum, useAuth } from "@/lib/erp";
import { useToast } from "@/hooks/use-toast";

const METHODS = ["تحويل بنكي", "نقداً", "صك", "سفتجة"];
const KINDS = ["قياسي", "بالتقسيط", "بريفورما", "بدون رسوم"];

/* ------------------------------------------------ printable invoice */

export function InvoicePrint({ inv, company, onClose }: { inv: any; company: any; onClose: () => void }) {
  const tmpl = inv.template;
  const installments: any[] = inv.installments_json ? JSON.parse(inv.installments_json) : [];
  const showTaxes = tmpl ? !!tmpl.show_taxes : true;
  return (
    <PrintLayout title={`فاتورة ${inv.number}`} onClose={onClose}>
      <PrintHeader
        company={company}
        docTitle={tmpl?.header_text || (inv.kind === "بريفورما" ? "فاتورة أولية (Proforma)" : "فاتورة")}
        meta={[
          { label: "رقم الفاتورة", value: inv.number },
          { label: "التاريخ", value: fmtDate(inv.date) },
          { label: "أجل الدفع", value: fmtDate(inv.due_date) },
        ]}
      />

      <div className="mb-4 grid grid-cols-2 gap-4 text-[12px]">
        <div className="rounded border border-neutral-300 p-2.5">
          <p className="mb-1 font-bold">معلومات العميل</p>
          <p className="font-semibold">{inv.client_name || "—"}</p>
          <p>{inv.client_address} {inv.client_city ? `— ${inv.client_city}` : ""}</p>
          <p>الهاتف: <span dir="ltr" className="num">{inv.client_phone || "—"}</span></p>
          <p>NIF: <span dir="ltr" className="num">{inv.client_nif || "—"}</span> · NIS: <span dir="ltr" className="num">{inv.client_nis || "—"}</span></p>
          <p>السجل التجاري: <span dir="ltr" className="num">{inv.client_rc || "—"}</span></p>
        </div>
        <div className="rounded border border-neutral-300 p-2.5">
          <p className="mb-1 font-bold">شروط الفاتورة</p>
          <p>نوع الفاتورة: {inv.kind}</p>
          <p>طريقة الدفع: {inv.payment_method || "تحويل بنكي"}</p>
          <p>شروط الدفع: {tmpl?.payment_terms || "—"}</p>
          <p>الحالة: {inv.status}</p>
        </div>
      </div>

      <table className="w-full border-collapse text-[11.5px]">
        <thead>
          <tr className="bg-neutral-100">
            <th className="border border-neutral-300 px-2 py-1.5 text-start">#</th>
            <th className="border border-neutral-300 px-2 py-1.5 text-start">البيان</th>
            <th className="border border-neutral-300 px-2 py-1.5 text-end">الكمية</th>
            <th className="border border-neutral-300 px-2 py-1.5 text-end">سعر الوحدة</th>
            <th className="border border-neutral-300 px-2 py-1.5 text-end">الخصم %</th>
            {showTaxes && <th className="border border-neutral-300 px-2 py-1.5 text-end">TVA %</th>}
            <th className="border border-neutral-300 px-2 py-1.5 text-end">المبلغ خارج الرسم</th>
          </tr>
        </thead>
        <tbody>
          {(inv.lines || []).map((l: any, i: number) => (
            <tr key={l.id ?? i}>
              <td className="numfont border border-neutral-300 px-2 py-1 text-start">{i + 1}</td>
              <td className="border border-neutral-300 px-2 py-1">{l.description}</td>
              <td className="numfont border border-neutral-300 px-2 py-1 text-end">{fmtNum(l.quantity)}</td>
              <td className="numfont border border-neutral-300 px-2 py-1 text-end">{fmtNum(l.unit_price)}</td>
              <td className="numfont border border-neutral-300 px-2 py-1 text-end">{fmtNum(l.discount)}</td>
              {showTaxes && <td className="numfont border border-neutral-300 px-2 py-1 text-end">{fmtNum(l.tva_rate)}</td>}
              <td className="numfont border border-neutral-300 px-2 py-1 text-end">{fmtNum(l.total_ht)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-[240px] flex-1 text-[11.5px]">
          <p className="mb-1 font-bold">المبلغ بالحروف</p>
          <p className="rounded border border-neutral-300 bg-neutral-50 p-2 leading-relaxed">{amountInArabicWords(inv.total_ttc)}</p>
          {inv.notes ? <p className="mt-2">ملاحظات: {inv.notes}</p> : null}
          {tmpl?.notes ? <p className="mt-1">{tmpl.notes}</p> : null}
        </div>
        <table className="w-[280px] border-collapse text-[12px]">
          <tbody>
            <tr>
              <td className="border border-neutral-300 px-2 py-1.5">المجموع خارج الرسم (HT)</td>
              <td className="numfont border border-neutral-300 px-2 py-1.5 text-end">{fmtDZD(inv.total_ht)}</td>
            </tr>
            {showTaxes && (
              <tr>
                <td className="border border-neutral-300 px-2 py-1.5">الرسم على القيمة المضافة (TVA)</td>
                <td className="numfont border border-neutral-300 px-2 py-1.5 text-end">{fmtDZD(inv.total_tva)}</td>
              </tr>
            )}
            {inv.timbre > 0 && (
              <tr>
                <td className="border border-neutral-300 px-2 py-1.5">طابع الدمغة</td>
                <td className="numfont border border-neutral-300 px-2 py-1.5 text-end">{fmtDZD(inv.timbre)}</td>
              </tr>
            )}
            <tr className="bg-neutral-100 font-bold">
              <td className="border border-neutral-300 px-2 py-1.5">الإجمالي بالرسم (TTC)</td>
              <td className="numfont border border-neutral-300 px-2 py-1.5 text-end">{fmtDZD(inv.total_ttc)}</td>
            </tr>
            <tr>
              <td className="border border-neutral-300 px-2 py-1.5">المدفوع</td>
              <td className="numfont border border-neutral-300 px-2 py-1.5 text-end">{fmtDZD(inv.paid_amount)}</td>
            </tr>
            <tr>
              <td className="border border-neutral-300 px-2 py-1.5">الباقي</td>
              <td className="numfont border border-neutral-300 px-2 py-1.5 text-end">{fmtDZD(inv.total_ttc - inv.paid_amount)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {installments.length > 0 && (
        <div className="mt-4">
          <p className="mb-1 text-[12px] font-bold">جدول الأقساط</p>
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr className="bg-neutral-100">
                <th className="border border-neutral-300 px-2 py-1.5 text-start">القسط</th>
                <th className="border border-neutral-300 px-2 py-1.5 text-start">تاريخ الاستحقاق</th>
                <th className="border border-neutral-300 px-2 py-1.5 text-end">المبلغ</th>
                <th className="border border-neutral-300 px-2 py-1.5 text-start">التوقيع / الملاحظة</th>
              </tr>
            </thead>
            <tbody>
              {installments.map((it) => (
                <tr key={it.n}>
                  <td className="numfont border border-neutral-300 px-2 py-1">{it.n}</td>
                  <td className="numfont border border-neutral-300 px-2 py-1">{fmtDate(it.due_date)}</td>
                  <td className="numfont border border-neutral-300 px-2 py-1 text-end">{fmtDZD(it.amount)}</td>
                  <td className="border border-neutral-300 px-2 py-4"></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {(inv.payments || []).length > 0 && (
        <div className="mt-4">
          <p className="mb-1 text-[12px] font-bold">المدفوعات المسجّلة</p>
          <table className="w-full border-collapse text-[11.5px]">
            <thead>
              <tr className="bg-neutral-100">
                <th className="border border-neutral-300 px-2 py-1.5 text-start">التاريخ</th>
                <th className="border border-neutral-300 px-2 py-1.5 text-start">الطريقة</th>
                <th className="border border-neutral-300 px-2 py-1.5 text-start">المرجع</th>
                <th className="border border-neutral-300 px-2 py-1.5 text-end">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {inv.payments.map((p: any) => (
                <tr key={p.id}>
                  <td className="numfont border border-neutral-300 px-2 py-1">{fmtDate(p.date)}</td>
                  <td className="border border-neutral-300 px-2 py-1">{p.method}</td>
                  <td className="numfont border border-neutral-300 px-2 py-1">{p.ref || "—"}</td>
                  <td className="numfont border border-neutral-300 px-2 py-1 text-end">{fmtDZD(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8 grid grid-cols-2 gap-8 text-[12px]">
        <div className="border-t border-neutral-400 pt-2 text-center">توقيع العميل</div>
        <div className="border-t border-neutral-400 pt-2 text-center">توقيع وختم المؤسسة</div>
      </div>
      <p className="mt-5 text-center text-[10px] text-neutral-500">
        {tmpl?.footer_text || "فاتورة مُصدرة آلياً من نظام النور ERP"} — الحساب البنكي: <span dir="ltr" className="num">{company?.company_rib}</span> ({company?.company_bank})
      </p>
    </PrintLayout>
  );
}

/* ------------------------------------------------ page */

export default function InvoicingPage() {
  const { can } = useAuth();
  const { toast } = useToast();
  const writable = can("invoicing", "write");
  const canPay = can("accounting", "write");

  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [status, setStatus] = useState("all");
  const [tab, setTab] = useState("list");

  const invoices = useQuery<any[]>({ queryKey: [`/api/invoices?year=${year}&status=${status}`] });
  const templates = useQuery<any[]>({ queryKey: ["/api/invoice-templates"] });
  const clients = useQuery<any[]>({ queryKey: ["/api/clients"] });
  const products = useQuery<any[]>({ queryKey: ["/api/products"] });
  const company = useQuery<any>({ queryKey: ["/api/settings"] });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/invoices?year=${year}&status=${status}`] });
    queryClient.invalidateQueries({ queryKey: ["/api/products"] });
    queryClient.invalidateQueries({ queryKey: ["/api/debts"] });
  };
  const err = (e: any) => toast({ title: "تعذّر تنفيذ العملية", description: String(e.message), variant: "destructive" });

  /* ---------------- print one invoice ---------------- */
  const [printId, setPrintId] = useState<number | null>(null);
  const printInv = useQuery<any>({ queryKey: [`/api/invoices/${printId}`], enabled: !!printId });

  /* ---------------- new invoice flow ---------------- */
  const emptyLine = { product_id: undefined as any, description: "", quantity: 1, unit_price: 0, discount: 0, tva_rate: 19 };
  const [form, setForm] = useState<any>({
    date: new Date().toISOString().slice(0, 10),
    payment_method: "تحويل بنكي",
    lines: [{ ...emptyLine }],
  });

  const nextNumber = useMemo(() => {
    const prefix = company.data?.invoice_prefix || "FA";
    const y = +(form.date || "").slice(0, 4) || new Date().getFullYear();
    const nums = (invoices.data || [])
      .filter((i) => i.number?.includes(`-${y}-`))
      .map((i) => +(String(i.number).split("-").pop() || 0));
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return `${prefix}-${y}-${String(next).padStart(5, "0")}`;
  }, [company.data, invoices.data, form.date]);

  const applyTemplate = (id: number) => {
    const t = templates.data?.find((x) => x.id === id);
    if (!t) return;
    const lines = t.default_lines ? JSON.parse(t.default_lines) : [{ ...emptyLine, tva_rate: t.show_taxes ? t.tva_rate : 0 }];
    const due = new Date(form.date || new Date().toISOString().slice(0, 10));
    due.setDate(due.getDate() + (t.due_days || 30));
    setForm((f: any) => ({
      ...f,
      template_id: id,
      kind: t.kind,
      client_id: t.default_client_id || f.client_id,
      due_date: due.toISOString().slice(0, 10),
      notes: t.notes || "",
      installments_count: t.has_installments ? t.installments_count : 0,
      lines: lines.map((l: any) => ({
        ...emptyLine, ...l,
        description: l.description || products.data?.find((p) => p.id === l.product_id)?.name || "",
        tva_rate: t.show_taxes ? (l.tva_rate ?? t.tva_rate) : 0,
      })),
    }));
    toast({ title: `تم تطبيق النموذج «${t.name}»`, description: "تم تعبئة العميل والسطور وشروط الدفع آلياً — يمكنك التعديل قبل الحفظ" });
  };

  const selectedTemplate = templates.data?.find((t) => t.id === form.template_id);

  const totals = useMemo(() => {
    let ht = 0, tva = 0;
    for (const l of form.lines || []) {
      const lineHt = (+l.quantity || 0) * (+l.unit_price || 0) * (1 - (+l.discount || 0) / 100);
      ht += lineHt;
      tva += (lineHt * (+l.tva_rate || 0)) / 100;
    }
    ht = Math.round(ht); tva = Math.round(tva);
    const timbre = form.payment_method === "نقداً" ? Math.round((ht + tva) * 0.01) : 0;
    return { ht, tva, timbre, ttc: ht + tva + timbre };
  }, [form]);

  const create = useMutation({
    mutationFn: async () => {
      const lines = (form.lines || []).filter((l: any) => (l.product_id || l.description) && +l.quantity > 0);
      if (!lines.length) throw new Error("أضف سطراً واحداً على الأقل");
      if (!form.client_id) throw new Error("اختر العميل");
      return (await apiRequest("POST", "/api/invoices", { ...form, lines })).json();
    },
    onSuccess: (inv: any) => {
      invalidate();
      setTab("list");
      setForm({ date: new Date().toISOString().slice(0, 10), payment_method: "تحويل بنكي", lines: [{ ...emptyLine }] });
      toast({ title: `تم إنشاء الفاتورة ${inv.number}`, description: `الإجمالي بالرسم ${fmtDZD(inv.total_ttc)}` });
      setPrintId(inv.id);
    },
    onError: err,
  });

  const cancelInvoice = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/invoices/${id}`)).json(),
    onSuccess: () => { invalidate(); toast({ title: "تم إلغاء الفاتورة", description: "الترقيم يبقى متسلسلاً بدون فراغات" }); },
    onError: err,
  });

  /* ---------------- payments ---------------- */
  const [payOpen, setPayOpen] = useState(false);
  const [payForm, setPayForm] = useState<any>({});
  const openPay = (inv: any) => {
    setPayForm({
      invoice_id: inv.id, client_id: inv.client_id, direction: "مدخول",
      date: new Date().toISOString().slice(0, 10),
      amount: Math.max(0, Math.round(inv.total_ttc - inv.paid_amount)),
      method: "تحويل بنكي", ref: "", invoice_number: inv.number,
    });
    setPayOpen(true);
  };
  const paySave = useMutation({
    mutationFn: async (d: any) => (await apiRequest("POST", "/api/payments", {
      invoice_id: d.invoice_id, client_id: d.client_id, direction: "مدخول",
      date: d.date, amount: +d.amount, method: d.method, ref: d.ref, notes: d.notes,
    })).json(),
    onSuccess: () => {
      setPayOpen(false);
      invalidate();
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      toast({ title: "تم تسجيل الدفعة", description: "تم تحديث حالة الفاتورة والدين آلياً" });
    },
    onError: err,
  });

  /* ---------------- templates ---------------- */
  const [tmOpen, setTmOpen] = useState(false);
  const [tmForm, setTmForm] = useState<any>({});
  const openTmpl = (row?: any) => {
    setTmForm(row
      ? { ...row, lines: row.default_lines ? JSON.parse(row.default_lines) : [] }
      : { kind: "قياسي", tva_rate: 19, show_taxes: 1, has_installments: 0, installments_count: 0, due_days: 30, active: 1, lines: [] });
    setTmOpen(true);
  };
  const tmSave = useMutation({
    mutationFn: async (d: any) => {
      const payload = {
        name: d.name, kind: d.kind, header_text: d.header_text, payment_terms: d.payment_terms,
        tva_rate: +d.tva_rate || 0, has_installments: d.has_installments ? 1 : 0,
        installments_count: +d.installments_count || 0, show_taxes: d.show_taxes ? 1 : 0,
        notes: d.notes || "", footer_text: d.footer_text || "", active: d.active ? 1 : 0,
        default_client_id: d.default_client_id || null, due_days: +d.due_days || 30,
        default_lines: JSON.stringify((d.lines || []).filter((l: any) => l.product_id)),
      };
      return (d.id ? await apiRequest("PATCH", `/api/invoice-templates/${d.id}`, payload) : await apiRequest("POST", "/api/invoice-templates", payload)).json();
    },
    onSuccess: () => { setTmOpen(false); queryClient.invalidateQueries({ queryKey: ["/api/invoice-templates"] }); toast({ title: "تم حفظ نموذج الفاتورة" }); },
    onError: err,
  });
  const tmDelete = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/invoice-templates/${id}`)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/invoice-templates"] }); toast({ title: "تم حذف النموذج" }); },
    onError: err,
  });

  useEffect(() => {
    if (tab === "new" && !form.template_id && templates.data?.length) {
      // لا تطبيق تلقائي — المستخدم يختار النموذج بنفسه
    }
  }, [tab, templates.data]);

  const rows = invoices.data || [];
  const kpis = rows.reduce(
    (a, r) => ({
      count: a.count + 1,
      ttc: a.ttc + (r.status !== "ملغاة" ? r.total_ttc : 0),
      paid: a.paid + r.paid_amount,
      unpaid: a.unpaid + (["غير مدفوعة", "مدفوعة جزئياً"].includes(r.status) ? r.total_ttc - r.paid_amount : 0),
    }),
    { count: 0, ttc: 0, paid: 0, unpaid: 0 },
  );

  const clientName = (id: number) => clients.data?.find((c) => c.id === id)?.name || "—";

  return (
    <AppShell
      title="الفوترة"
      subtitle="نماذج الفواتير، إنشاء فاتورة بترقيم تسلسلي بدون فراغات، الطباعة والمدفوعات"
      actions={writable ? (
        <Button size="sm" onClick={() => setTab("new")} data-testid="button-new-invoice">
          <FilePlus2 className="me-1.5 h-4 w-4" /> فاتورة جديدة
        </Button>
      ) : null}
    >
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="عدد الفواتير" value={fmtNum(kpis.count)} icon={<ReceiptText className="h-4 w-4" />} testId="kpi-inv-count" />
        <KpiCard label="رقم الأعمال بالرسم" value={fmtDZD(kpis.ttc)} tone="positive" testId="kpi-inv-ttc" />
        <KpiCard label="المحصَّل" value={fmtDZD(kpis.paid)} testId="kpi-inv-paid" />
        <KpiCard label="المبالغ غير المحصَّلة" value={fmtDZD(kpis.unpaid)} tone="warning" testId="kpi-inv-unpaid" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="list" data-testid="tab-invoices">الفواتير</TabsTrigger>
          {writable && <TabsTrigger value="new" data-testid="tab-new-invoice">فاتورة جديدة</TabsTrigger>}
          <TabsTrigger value="templates" data-testid="tab-templates">نماذج الفواتير</TabsTrigger>
        </TabsList>

        {/* ---------------- invoices list ---------------- */}
        <TabsContent value="list">
          <DataTable
            testId="table-invoices"
            rows={rows}
            isLoading={invoices.isLoading}
            error={invoices.error}
            onRetry={invoices.refetch}
            searchKeys={["number", "client_name"]}
            exportName={`الفواتير-${year}`}
            pageSize={12}
            filters={[
              { key: "year", label: "السنة", value: year, onChange: setYear, options: ["2024", "2025", "2026"].map((y) => ({ value: y, label: y })) },
              {
                key: "status", label: "الحالة", value: status, onChange: setStatus,
                options: [{ value: "all", label: "كل الحالات" }, ...["مدفوعة", "مدفوعة جزئياً", "غير مدفوعة", "ملغاة"].map((s) => ({ value: s, label: s }))],
              },
            ]}
            columns={[
              { key: "number", label: "الرقم", render: (r) => <span className="num text-xs font-semibold">{r.number}</span> },
              { key: "date", label: "التاريخ", render: (r) => <span className="num">{fmtDate(r.date)}</span> },
              { key: "client_name", label: "العميل", className: "min-w-[150px]", render: (r) => <span className="font-medium">{r.client_name || "—"}</span> },
              { key: "kind", label: "النوع", hideOnMobile: true },
              { key: "total_ht", label: "خارج الرسم", align: "end", hideOnMobile: true, render: (r) => <span className="num">{fmtNum(r.total_ht)}</span> },
              { key: "total_tva", label: "TVA", align: "end", hideOnMobile: true, render: (r) => <span className="num">{fmtNum(r.total_tva)}</span> },
              { key: "total_ttc", label: "الإجمالي TTC", align: "end", render: (r) => <span className="num font-semibold">{fmtNum(r.total_ttc)}</span> },
              { key: "paid_amount", label: "المدفوع", align: "end", render: (r) => <span className="num">{fmtNum(r.paid_amount)}</span> },
              { key: "status", label: "الحالة", render: (r) => <StatusBadge value={r.status} /> },
              {
                key: "actions", label: "إجراءات", align: "end",
                render: (r: any) => (
                  <div className="flex justify-end gap-1">
                    <Button variant="outline" size="sm" className="h-8" onClick={() => setPrintId(r.id)} data-testid={`button-print-invoice-${r.id}`}>
                      <Printer className="me-1 h-3.5 w-3.5" /> طباعة
                    </Button>
                    {canPay && r.status !== "ملغاة" && r.status !== "مدفوعة" && (
                      <Button variant="outline" size="sm" className="h-8" onClick={() => openPay(r)} data-testid={`button-pay-invoice-${r.id}`}>
                        <Wallet className="me-1 h-3.5 w-3.5" /> دفعة
                      </Button>
                    )}
                    {writable && r.status !== "ملغاة" && (
                      <Button variant="outline" size="icon" className="h-8 w-8 text-destructive"
                        onClick={() => { if (confirm(`إلغاء الفاتورة ${r.number}؟ (لا تُحذف للحفاظ على تسلسل الترقيم)`)) cancelInvoice.mutate(r.id); }}
                        data-testid={`button-cancel-invoice-${r.id}`}>
                        <Ban className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </TabsContent>

        {/* ---------------- new invoice ---------------- */}
        {writable && (
          <TabsContent value="new">
            <AlertBanner
              tone="info"
              title={<span>الرقم التالي المخصص آلياً: <span className="num font-bold">{nextNumber}</span></span>}
              icon={<BadgeCheck className="h-4 w-4" />}
              testId="banner-next-number"
            >
              الترقيم تسلسلي بدون فراغات ويُدار في الباك-إند داخل معاملة قاعدة بيانات — لا يمكن تعديله أو حذفه (الإلغاء فقط).
            </AlertBanner>

            <Card className="mb-4 p-4">
              <SectionTitle title="1 — اختيار النموذج" subtitle="اختيار النموذج يملأ العميل والسطور وشروط الدفع ونسبة الرسم آلياً" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {(templates.data || []).filter((t) => t.active).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => applyTemplate(t.id)}
                    data-testid={`button-template-${t.id}`}
                    className={`rounded-lg border p-3 text-start transition-colors hover-elevate ${form.template_id === t.id ? "border-primary bg-primary/8" : "border-border"}`}
                  >
                    <p className="text-sm font-bold">{t.name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{t.kind} · TVA <span className="num">{fmtNum(t.tva_rate)}%</span></p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{t.payment_terms}</p>
                    {t.has_installments ? (
                      <p className="num mt-1 text-[11px] text-amber-700 dark:text-amber-400">{t.installments_count} أقساط</p>
                    ) : null}
                  </button>
                ))}
              </div>
            </Card>

            <Card className="mb-4 p-4">
              <SectionTitle title="2 — بيانات الفاتورة" subtitle={selectedTemplate ? `النموذج: ${selectedTemplate.name}` : "بدون نموذج — نسبة الرسم من الإعدادات الجبائية"} />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <Field label="العميل">
                  <Select value={form.client_id ? String(form.client_id) : ""} onValueChange={(v) => setForm({ ...form, client_id: +v })}>
                    <SelectTrigger data-testid="select-invoice-client"><SelectValue placeholder="اختر العميل" /></SelectTrigger>
                    <SelectContent>
                      {(clients.data || []).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="تاريخ الفاتورة">
                  <Input type="date" value={form.date || ""} onChange={(e) => setForm({ ...form, date: e.target.value })} data-testid="input-invoice-date" />
                </Field>
                <Field label="أجل الدفع">
                  <Input type="date" value={form.due_date || ""} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
                </Field>
                <Field label="طريقة الدفع">
                  <Select value={form.payment_method} onValueChange={(v) => setForm({ ...form, payment_method: v })}>
                    <SelectTrigger data-testid="select-invoice-method"><SelectValue /></SelectTrigger>
                    <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
                <Field label="عدد الأقساط (0 = بدون)">
                  <Input type="number" min={0} max={24} value={form.installments_count ?? 0}
                    onChange={(e) => setForm({ ...form, installments_count: +e.target.value })} data-testid="input-invoice-installments" />
                </Field>
                <Field label="ملاحظات">
                  <Input value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </Field>
              </div>
              {form.client_id ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  العميل: <span className="font-semibold text-foreground">{clientName(form.client_id)}</span> · NIF <span className="num">{clients.data?.find((c) => c.id === form.client_id)?.nif}</span> · RC <span className="num">{clients.data?.find((c) => c.id === form.client_id)?.rc}</span>
                </p>
              ) : null}
            </Card>

            <Card className="mb-4 p-4">
              <SectionTitle title="3 — سطور الفاتورة" subtitle="اختيار المنتج يعبّئ السعر ونسبة الرسم آلياً" />
              <div className="space-y-2">
                {(form.lines || []).map((l: any, i: number) => (
                  <div key={i} className="grid grid-cols-2 items-end gap-2 rounded-md border border-border p-2 lg:grid-cols-7">
                    <div className="col-span-2">
                      <Select
                        value={l.product_id ? String(l.product_id) : ""}
                        onValueChange={(v) => {
                          const p = products.data?.find((x) => x.id === +v);
                          const lines = [...form.lines];
                          lines[i] = {
                            ...l, product_id: +v, description: p?.name || "", unit_price: p?.sale_price ?? 0,
                            tva_rate: selectedTemplate && !selectedTemplate.show_taxes ? 0 : (selectedTemplate?.tva_rate ?? p?.tva_rate ?? 19),
                          };
                          setForm({ ...form, lines });
                        }}
                      >
                        <SelectTrigger data-testid={`select-line-product-${i}`}><SelectValue placeholder="المنتج / الخدمة" /></SelectTrigger>
                        <SelectContent>
                          {(products.data || []).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.ref} — {p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Input className="lg:col-span-2" value={l.description || ""} placeholder="البيان"
                      onChange={(e) => { const lines = [...form.lines]; lines[i] = { ...l, description: e.target.value }; setForm({ ...form, lines }); }} />
                    <Input type="number" min={1} value={l.quantity} placeholder="الكمية"
                      onChange={(e) => { const lines = [...form.lines]; lines[i] = { ...l, quantity: +e.target.value }; setForm({ ...form, lines }); }}
                      data-testid={`input-line-qty-${i}`} />
                    <Input type="number" value={l.unit_price} placeholder="سعر الوحدة"
                      onChange={(e) => { const lines = [...form.lines]; lines[i] = { ...l, unit_price: +e.target.value }; setForm({ ...form, lines }); }}
                      data-testid={`input-line-price-${i}`} />
                    <div className="flex items-center gap-1">
                      <Input type="number" value={l.tva_rate} placeholder="TVA %"
                        onChange={(e) => { const lines = [...form.lines]; lines[i] = { ...l, tva_rate: +e.target.value }; setForm({ ...form, lines }); }} />
                      <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 text-destructive"
                        onClick={() => setForm({ ...form, lines: form.lines.filter((_: any, j: number) => j !== i) })}
                        data-testid={`button-remove-line-${i}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              <Button type="button" variant="outline" size="sm" className="mt-2"
                onClick={() => setForm({ ...form, lines: [...(form.lines || []), { ...emptyLine, tva_rate: selectedTemplate?.show_taxes === 0 ? 0 : (selectedTemplate?.tva_rate ?? 19) }] })}
                data-testid="button-add-line">
                <Plus className="me-1.5 h-4 w-4" /> إضافة سطر
              </Button>
            </Card>

            <Card className="p-4">
              <SectionTitle title="4 — المجاميع والحفظ" subtitle="طابع الدمغة يُطبَّق آلياً على الدفع نقداً" />
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <KpiCard label="المجموع خارج الرسم" value={fmtDZD(totals.ht)} testId="kpi-new-ht" />
                <KpiCard label="الرسم على القيمة المضافة" value={fmtDZD(totals.tva)} testId="kpi-new-tva" />
                <KpiCard label="طابع الدمغة" value={fmtDZD(totals.timbre)} testId="kpi-new-timbre" />
                <KpiCard label="الإجمالي بالرسم" value={fmtDZD(totals.ttc)} tone="positive" testId="kpi-new-ttc" />
              </div>
              <p className="mt-3 rounded-md border border-border bg-muted/40 p-2.5 text-xs leading-relaxed">
                المبلغ بالحروف: <span className="font-semibold">{amountInArabicWords(totals.ttc)}</span>
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Button onClick={() => create.mutate()} disabled={create.isPending} data-testid="button-save-invoice">
                  <ReceiptText className="me-1.5 h-4 w-4" /> حفظ الفاتورة وطباعتها
                </Button>
                <Button variant="outline" onClick={() => setForm({ date: new Date().toISOString().slice(0, 10), payment_method: "تحويل بنكي", lines: [{ ...emptyLine }] })}>
                  تفريغ النموذج
                </Button>
              </div>
            </Card>
          </TabsContent>
        )}

        {/* ---------------- templates ---------------- */}
        <TabsContent value="templates">
          <DataTable
            testId="table-templates"
            rows={templates.data}
            isLoading={templates.isLoading}
            error={templates.error}
            onRetry={templates.refetch}
            searchKeys={["name", "kind"]}
            exportName="نماذج-الفواتير"
            columns={[
              { key: "name", label: "النموذج", render: (r) => <span className="font-medium">{r.name}</span> },
              { key: "kind", label: "النوع" },
              { key: "tva_rate", label: "TVA %", align: "center", render: (r) => <span className="num">{fmtNum(r.tva_rate)}</span> },
              { key: "show_taxes", label: "يظهر الرسم", align: "center", render: (r) => (r.show_taxes ? "نعم" : "لا") },
              {
                key: "has_installments", label: "أقساط", align: "center",
                render: (r) => (r.has_installments ? <span className="num">{fmtNum(r.installments_count)}</span> : "—"),
              },
              { key: "due_days", label: "أجل الدفع (يوم)", align: "center", hideOnMobile: true, render: (r) => <span className="num">{fmtNum(r.due_days ?? 30)}</span> },
              { key: "payment_terms", label: "شروط الدفع", hideOnMobile: true },
              {
                key: "default_client_id", label: "العميل الافتراضي", hideOnMobile: true,
                render: (r) => (r.default_client_id ? clientName(r.default_client_id) : "—"),
              },
              {
                key: "default_lines", label: "سطور افتراضية", align: "center", hideOnMobile: true,
                render: (r) => <span className="num">{fmtNum(r.default_lines ? JSON.parse(r.default_lines).length : 0)}</span>,
              },
              { key: "active", label: "الحالة", render: (r) => <StatusBadge value={r.active ? "نشط" : "موقوف"} /> },
              ...(writable ? [{
                key: "actions", label: "إجراءات", align: "end" as const,
                render: (r: any) => (
                  <div className="flex justify-end gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openTmpl(r)} data-testid={`button-edit-template-${r.id}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 text-destructive"
                      onClick={() => { if (confirm(`حذف النموذج ${r.name}؟`)) tmDelete.mutate(r.id); }}
                      data-testid={`button-delete-template-${r.id}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ),
              }] : []),
            ]}
            toolbar={writable ? (
              <Button size="sm" onClick={() => openTmpl()} data-testid="button-add-template">
                <LayoutTemplate className="me-1.5 h-4 w-4" /> نموذج جديد
              </Button>
            ) : null}
          />
        </TabsContent>
      </Tabs>

      {/* ---------------- payment modal ---------------- */}
      <ModalForm
        open={payOpen} onOpenChange={setPayOpen}
        title={`تسجيل دفعة — الفاتورة ${payForm.invoice_number || ""}`}
        description="تُحدَّث حالة الفاتورة ورصيد الدين آلياً بعد الحفظ"
        submitting={paySave.isPending}
        onSubmit={() => paySave.mutate(payForm)}
      >
        <Field label="المبلغ (د.ج)">
          <Input type="number" value={payForm.amount ?? 0} onChange={(e) => setPayForm({ ...payForm, amount: +e.target.value })} required data-testid="input-payment-amount" />
        </Field>
        <Field label="التاريخ">
          <Input type="date" value={payForm.date || ""} onChange={(e) => setPayForm({ ...payForm, date: e.target.value })} required />
        </Field>
        <Field label="طريقة الدفع">
          <Select value={payForm.method || "تحويل بنكي"} onValueChange={(v) => setPayForm({ ...payForm, method: v })}>
            <SelectTrigger data-testid="select-payment-method"><SelectValue /></SelectTrigger>
            <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="المرجع">
          <Input value={payForm.ref || ""} onChange={(e) => setPayForm({ ...payForm, ref: e.target.value })} placeholder="رقم الصك / التحويل" />
        </Field>
        <Field label="ملاحظات" full>
          <Textarea value={payForm.notes || ""} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} />
        </Field>
      </ModalForm>

      {/* ---------------- template modal ---------------- */}
      <ModalForm
        open={tmOpen} onOpenChange={setTmOpen}
        title={tmForm.id ? `تعديل النموذج ${tmForm.name || ""}` : "نموذج فاتورة جديد"}
        description="كل نموذج بحقوله الخاصة: الترويسة، شروط الدفع، جدول الأقساط، نسبة الرسم، الملاحظات، والعميل والسطور الافتراضية"
        submitting={tmSave.isPending}
        onSubmit={() => tmSave.mutate(tmForm)}
        wide
      >
        <Field label="اسم النموذج">
          <Input value={tmForm.name || ""} onChange={(e) => setTmForm({ ...tmForm, name: e.target.value })} required data-testid="input-template-name" />
        </Field>
        <Field label="نوع الفاتورة">
          <Select value={tmForm.kind || "قياسي"} onValueChange={(v) => setTmForm({ ...tmForm, kind: v })}>
            <SelectTrigger data-testid="select-template-kind"><SelectValue /></SelectTrigger>
            <SelectContent>{KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="نص الترويسة">
          <Input value={tmForm.header_text || ""} onChange={(e) => setTmForm({ ...tmForm, header_text: e.target.value })} data-testid="input-template-header" />
        </Field>
        <Field label="نسبة TVA %">
          <Input type="number" value={tmForm.tva_rate ?? 19} onChange={(e) => setTmForm({ ...tmForm, tva_rate: +e.target.value })} data-testid="input-template-tva" />
        </Field>
        <Field label="أجل الدفع (بالأيام)">
          <Input type="number" value={tmForm.due_days ?? 30} onChange={(e) => setTmForm({ ...tmForm, due_days: +e.target.value })} />
        </Field>
        <Field label="عدد الأقساط">
          <Input type="number" min={0} value={tmForm.installments_count ?? 0}
            onChange={(e) => setTmForm({ ...tmForm, installments_count: +e.target.value, has_installments: +e.target.value > 1 ? 1 : 0 })}
            data-testid="input-template-installments" />
        </Field>
        <Field label="شروط الدفع" full>
          <Input value={tmForm.payment_terms || ""} onChange={(e) => setTmForm({ ...tmForm, payment_terms: e.target.value })} data-testid="input-template-terms" />
        </Field>
        <Field label="ملاحظات النموذج" full>
          <Textarea value={tmForm.notes || ""} onChange={(e) => setTmForm({ ...tmForm, notes: e.target.value })} />
        </Field>
        <Field label="نص التذييل" full>
          <Textarea value={tmForm.footer_text || ""} onChange={(e) => setTmForm({ ...tmForm, footer_text: e.target.value })} />
        </Field>
        <Field label="العميل الافتراضي" full>
          <Select value={tmForm.default_client_id ? String(tmForm.default_client_id) : ""} onValueChange={(v) => setTmForm({ ...tmForm, default_client_id: +v })}>
            <SelectTrigger data-testid="select-template-client"><SelectValue placeholder="بدون عميل افتراضي" /></SelectTrigger>
            <SelectContent>{(clients.data || []).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <div className="flex items-center gap-6 sm:col-span-2">
          <label className="flex items-center gap-2 text-xs font-medium">
            <Switch checked={!!tmForm.show_taxes} onCheckedChange={(v) => setTmForm({ ...tmForm, show_taxes: v ? 1 : 0 })} data-testid="switch-template-taxes" />
            إظهار الرسوم في الفاتورة
          </label>
          <label className="flex items-center gap-2 text-xs font-medium">
            <Switch checked={!!tmForm.active} onCheckedChange={(v) => setTmForm({ ...tmForm, active: v ? 1 : 0 })} />
            نموذج نشط
          </label>
        </div>

        <div className="sm:col-span-2">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">السطور الافتراضية (تُملأ آلياً عند اختيار النموذج)</p>
          <div className="space-y-2">
            {(tmForm.lines || []).map((l: any, i: number) => (
              <div key={i} className="grid grid-cols-2 items-end gap-2 rounded-md border border-border p-2 sm:grid-cols-4">
                <div className="col-span-2">
                  <Select
                    value={l.product_id ? String(l.product_id) : ""}
                    onValueChange={(v) => {
                      const p = products.data?.find((x) => x.id === +v);
                      const lines = [...tmForm.lines];
                      lines[i] = { ...l, product_id: +v, description: p?.name, unit_price: p?.sale_price ?? 0, tva_rate: tmForm.show_taxes ? tmForm.tva_rate : 0 };
                      setTmForm({ ...tmForm, lines });
                    }}
                  >
                    <SelectTrigger data-testid={`select-template-line-${i}`}><SelectValue placeholder="المنتج" /></SelectTrigger>
                    <SelectContent>{(products.data || []).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.ref} — {p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Input type="number" min={1} value={l.quantity ?? 1} placeholder="الكمية"
                  onChange={(e) => { const lines = [...tmForm.lines]; lines[i] = { ...l, quantity: +e.target.value }; setTmForm({ ...tmForm, lines }); }} />
                <div className="flex items-center gap-1">
                  <Input type="number" value={l.unit_price ?? 0} placeholder="السعر"
                    onChange={(e) => { const lines = [...tmForm.lines]; lines[i] = { ...l, unit_price: +e.target.value }; setTmForm({ ...tmForm, lines }); }} />
                  <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 text-destructive"
                    onClick={() => setTmForm({ ...tmForm, lines: tmForm.lines.filter((_: any, j: number) => j !== i) })}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" className="mt-2"
            onClick={() => setTmForm({ ...tmForm, lines: [...(tmForm.lines || []), { quantity: 1, unit_price: 0, tva_rate: tmForm.tva_rate }] })}
            data-testid="button-template-add-line">
            <Plus className="me-1.5 h-4 w-4" /> إضافة سطر افتراضي
          </Button>
        </div>
      </ModalForm>

      {printId && printInv.data && (
        <InvoicePrint inv={printInv.data} company={company.data} onClose={() => setPrintId(null)} />
      )}
    </AppShell>
  );
}
