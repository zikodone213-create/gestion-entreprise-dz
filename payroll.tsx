import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Banknote, FileSpreadsheet, Printer, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppShell } from "@/components/shell";
import { DataTable, KpiCard, PrintLayout, SectionTitle, Logo } from "@/components/kit";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MONTHS_AR, fmtDZD, fmtDate, fmtNum, monthLabel, useAuth } from "@/lib/erp";
import { useToast } from "@/hooks/use-toast";

/* ------------------------------------------------ printable payslip */

function Payslip({ p, company, onClose }: { p: any; company: any; onClose: () => void }) {
  const row = (label: string, value: any, bold = false) => (
    <tr className={bold ? "font-bold" : ""}>
      <td className="border border-neutral-300 px-2 py-1.5">{label}</td>
      <td className="numfont border border-neutral-300 px-2 py-1.5 text-end">{value}</td>
    </tr>
  );
  return (
    <PrintLayout title={`كشف راتب — ${p.first_name} ${p.last_name} — ${monthLabel(p.month)} ${p.year}`} onClose={onClose}>
      <div className="mb-5 flex items-start justify-between gap-4 border-b-2 border-neutral-800 pb-4">
        <div className="flex items-start gap-3">
          <span className="text-neutral-900"><Logo className="h-12 w-12" /></span>
          <div>
            <p className="text-[15px] font-bold">{company?.company_name}</p>
            <p className="text-[11px]">{company?.company_address}</p>
            <p className="text-[11px]">هاتف: <span dir="ltr" className="num">{company?.company_phone}</span> · <span dir="ltr" className="num">{company?.company_email}</span></p>
            <p className="text-[11px]">
              السجل التجاري: <span dir="ltr" className="num">{company?.company_rc}</span> · NIF: <span dir="ltr" className="num">{company?.company_nif}</span>
            </p>
            <p className="text-[11px]">
              NIS: <span dir="ltr" className="num">{company?.company_nis}</span> · رقم الانتساب CNAS: <span dir="ltr" className="num">{company?.company_cnas}</span>
            </p>
          </div>
        </div>
        <div className="text-end">
          <p className="text-base font-bold">كشف الراتب</p>
          <p className="text-[11px]">المرجع: <span dir="ltr" className="num">{p.ref}</span></p>
          <p className="text-[11px]">شهر: {monthLabel(p.month)} {p.year}</p>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 text-[12px]">
        <div className="space-y-0.5">
          <p><span className="font-semibold">الاسم واللقب:</span> {p.first_name} {p.last_name}</p>
          <p><span className="font-semibold">رقم المصفوفة:</span> <span dir="ltr" className="num">{p.matricule}</span></p>
          <p><span className="font-semibold">المنصب:</span> {p.position}</p>
          <p><span className="font-semibold">القسم:</span> {p.department}</p>
        </div>
        <div className="space-y-0.5">
          <p><span className="font-semibold">رقم CNAS:</span> <span dir="ltr" className="num">{p.cnas_number}</span></p>
          <p><span className="font-semibold">تاريخ التوظيف:</span> <span dir="ltr" className="num">{fmtDate(p.hire_date)}</span></p>
          <p><span className="font-semibold">نوع العقد:</span> {p.contract_type || "دائم"}</p>
          <p className="num"><span className="font-semibold">أيام العمل:</span> {fmtNum(p.days_worked)}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-neutral-100">
              <th className="border border-neutral-300 px-2 py-1.5 text-start" colSpan={2}>عناصر الأجر</th>
            </tr>
          </thead>
          <tbody>
            {row("الراتب الأساسي", fmtDZD(p.base_salary))}
            {row("المنح والعلاوات", fmtDZD(p.allowances))}
            {row("المكافآت", fmtDZD(p.bonus))}
            {row("الأجر الإجمالي (Brut)", fmtDZD(p.gross), true)}
          </tbody>
        </table>

        <table className="w-full border-collapse text-[12px]">
          <thead>
            <tr className="bg-neutral-100">
              <th className="border border-neutral-300 px-2 py-1.5 text-start" colSpan={2}>الاقتطاعات</th>
            </tr>
          </thead>
          <tbody>
            {row("الضمان الاجتماعي CNAS (حصة الأجير)", fmtDZD(p.cnas_employee))}
            {row("الأجر الخاضع للضريبة", fmtDZD(p.taxable))}
            {row("الضريبة على الدخل الإجمالي IRG", fmtDZD(p.irg))}
            {row("خصم التسبيقات", fmtDZD(p.advance_deduction))}
            {row("اقتطاعات أخرى", fmtDZD(p.other_deductions))}
            {row("مجموع الاقتطاعات", fmtDZD(p.cnas_employee + p.irg + p.advance_deduction + p.other_deductions), true)}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between border-2 border-neutral-800 bg-neutral-100 px-4 py-3">
        <span className="text-[13px] font-bold">الصافي المستحق للدفع</span>
        <span className="numfont text-base font-bold">{fmtDZD(p.net)}</span>
      </div>

      <div className="mt-2 space-y-0.5 text-[11px] text-neutral-600">
        <p>حصة المستخدم في CNAS (لا تُخصم من الأجير): <span dir="ltr" className="num">{fmtDZD(p.cnas_employer)}</span></p>
        <p>الحساب البنكي (RIB): <span dir="ltr" className="num">{p.bank_account}</span></p>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-8 text-[12px]">
        <div className="border-t border-neutral-400 pt-2 text-center">توقيع الأجير</div>
        <div className="border-t border-neutral-400 pt-2 text-center">توقيع وختم المستخدم</div>
      </div>
      <p className="mt-6 text-center text-[10px] text-neutral-500">
        وثيقة مُصدرة آلياً من نظام النور ERP — تحفظ لمدة 10 سنوات وفقاً للتشريع الجزائري للعمل
      </p>
    </PrintLayout>
  );
}

/* ------------------------------------------------ page */

export default function PayrollPage() {
  const { can } = useAuth();
  const { toast } = useToast();
  const writable = can("payroll", "write");
  const [year, setYear] = useState(2026);
  const [month, setMonth] = useState<string>("all");
  const [genMonth, setGenMonth] = useState(String(new Date().getMonth() + 1));
  const [printed, setPrinted] = useState<any>(null);

  const payslips = useQuery<any[]>({ queryKey: ["/api/payslips?year=" + year + "&month=" + month] });
  const company = useQuery<any>({ queryKey: ["/api/settings"] });
  const summary = useQuery<any[]>({ queryKey: ["/api/payroll/summary/" + year] });

  const generate = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/payroll/generate", { year, month: +genMonth })).json(),
    onSuccess: (d: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/payslips?year=" + year + "&month=" + month] });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/summary/" + year] });
      queryClient.invalidateQueries({ queryKey: ["/api/advances"] });
      toast({
        title: "تم توليد كشوف الرواتب",
        description: `${d.created} كشف جديد · ${d.skipped} موجود مسبقاً — الصافي الإجمالي ${fmtDZD(d.summary?.net)}`,
      });
    },
    onError: (e: any) => toast({ title: "تعذّر التوليد", description: String(e.message), variant: "destructive" }),
  });

  const removeMonth = useMutation({
    mutationFn: async (m: number) => (await apiRequest("DELETE", `/api/payroll/${year}/${m}`)).json(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payslips?year=" + year + "&month=" + month] });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll/summary/" + year] });
      toast({ title: "تم حذف كشوف الشهر" });
    },
  });

  const rows = payslips.data || [];
  const totals = rows.reduce(
    (a, r) => ({ gross: a.gross + r.gross, net: a.net + r.net, irg: a.irg + r.irg, cnas: a.cnas + r.cnas_employee, adv: a.adv + r.advance_deduction }),
    { gross: 0, net: 0, irg: 0, cnas: 0, adv: 0 },
  );

  return (
    <AppShell
      title="الرواتب وكشوفها"
      subtitle="توليد شهري للأجور مع اقتطاع CNAS و IRG وخصم التسبيقات — النسب مقروءة من الإعدادات الجبائية"
      actions={
        writable ? (
          <div className="flex items-center gap-2">
            <Select value={genMonth} onValueChange={setGenMonth}>
              <SelectTrigger className="w-[120px]" data-testid="select-gen-month"><SelectValue /></SelectTrigger>
              <SelectContent>{MONTHS_AR.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" onClick={() => generate.mutate()} disabled={generate.isPending} data-testid="button-generate-payroll">
              <Banknote className="me-1.5 h-4 w-4" /> توليد كشوف الشهر
            </Button>
          </div>
        ) : null
      }
    >
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="عدد الكشوف المعروضة" value={fmtNum(rows.length)} testId="kpi-payslips-count" />
        <KpiCard label="الأجر الإجمالي" value={fmtDZD(totals.gross)} testId="kpi-payslips-gross" />
        <KpiCard label="الصافي المدفوع" value={fmtDZD(totals.net)} tone="positive" testId="kpi-payslips-net" />
        <KpiCard label="IRG المُقتطع" value={fmtDZD(totals.irg)} hint="يُصرَّح به في G50" testId="kpi-payslips-irg" />
        <KpiCard label="CNAS (حصة الأجير)" value={fmtDZD(totals.cnas)} hint={`خصم التسبيقات: ${fmtDZD(totals.adv)}`} testId="kpi-payslips-cnas" />
      </div>

      <Card className="mb-5 p-4">
        <SectionTitle title={`ملخص كتلة الأجور — ${year}`} subtitle="حسب الشهر (د.ج)" />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs">
              <tr>
                <th className="px-3 py-2 text-start font-semibold text-muted-foreground">الشهر</th>
                <th className="px-3 py-2 text-end font-semibold text-muted-foreground">عدد الكشوف</th>
                <th className="px-3 py-2 text-end font-semibold text-muted-foreground">الإجمالي</th>
                <th className="px-3 py-2 text-end font-semibold text-muted-foreground">CNAS أجير</th>
                <th className="px-3 py-2 text-end font-semibold text-muted-foreground">CNAS مستخدم</th>
                <th className="px-3 py-2 text-end font-semibold text-muted-foreground">IRG</th>
                <th className="px-3 py-2 text-end font-semibold text-muted-foreground">تسبيقات</th>
                <th className="px-3 py-2 text-end font-semibold text-muted-foreground">الصافي</th>
                {writable && <th className="px-3 py-2 text-end font-semibold text-muted-foreground">إجراء</th>}
              </tr>
            </thead>
            <tbody>
              {(summary.data || []).map((s) => (
                <tr key={s.month} className="border-t border-border hover:bg-muted/40" data-testid={`row-payroll-summary-${s.month}`}>
                  <td className="px-3 py-2 font-medium">{monthLabel(s.month)}</td>
                  <td className="num px-3 py-2 text-end">{fmtNum(s.count)}</td>
                  <td className="num px-3 py-2 text-end">{fmtNum(s.gross)}</td>
                  <td className="num px-3 py-2 text-end">{fmtNum(s.cnas_employee)}</td>
                  <td className="num px-3 py-2 text-end">{fmtNum(s.cnas_employer)}</td>
                  <td className="num px-3 py-2 text-end">{fmtNum(s.irg)}</td>
                  <td className="num px-3 py-2 text-end">{fmtNum(s.advances)}</td>
                  <td className="num px-3 py-2 text-end font-semibold">{fmtNum(s.net)}</td>
                  {writable && (
                    <td className="px-3 py-2 text-end">
                      <Button variant="outline" size="icon" className="h-8 w-8 text-destructive"
                        onClick={() => { if (confirm(`حذف كل كشوف ${monthLabel(s.month)} ${year}؟`)) removeMonth.mutate(s.month); }}
                        data-testid={`button-delete-month-${s.month}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
              {!summary.data?.length && (
                <tr><td colSpan={9} className="px-3 py-6 text-center text-sm text-muted-foreground">لا توجد كشوف لهذه السنة</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <SectionTitle title="أرشيف كشوف الرواتب" subtitle="بحث وفلترة بالشهر والسنة، مع طباعة أي كشف" />
      <DataTable
        testId="table-payslips"
        rows={rows.map((r) => ({ ...r, employee: `${r.first_name} ${r.last_name}` }))}
        isLoading={payslips.isLoading}
        error={payslips.error}
        onRetry={payslips.refetch}
        searchKeys={["employee", "matricule", "ref"]}
        exportName={`كشوف-الرواتب-${year}`}
        pageSize={12}
        filters={[
          { key: "year", label: "السنة", value: String(year), onChange: (v) => setYear(+v), options: [2024, 2025, 2026].map((y) => ({ value: String(y), label: String(y) })) },
          { key: "month", label: "الشهر", value: month, onChange: setMonth, options: [{ value: "all", label: "كل الأشهر" }, ...MONTHS_AR.map((m, i) => ({ value: String(i + 1), label: m }))] },
        ]}
        columns={[
          { key: "ref", label: "المرجع", render: (r) => <span className="num text-xs">{r.ref}</span> },
          { key: "employee", label: "الموظف", render: (r) => <span className="font-medium">{r.employee}</span> },
          { key: "month", label: "الشهر", render: (r) => `${monthLabel(r.month)} ${r.year}` },
          { key: "gross", label: "الإجمالي", align: "end", render: (r) => <span className="num">{fmtNum(r.gross)}</span> },
          { key: "cnas_employee", label: "CNAS", align: "end", hideOnMobile: true, render: (r) => <span className="num">{fmtNum(r.cnas_employee)}</span> },
          { key: "irg", label: "IRG", align: "end", hideOnMobile: true, render: (r) => <span className="num">{fmtNum(r.irg)}</span> },
          { key: "advance_deduction", label: "تسبيقات", align: "end", hideOnMobile: true, render: (r) => <span className="num">{fmtNum(r.advance_deduction)}</span> },
          { key: "net", label: "الصافي", align: "end", render: (r) => <span className="num font-semibold">{fmtNum(r.net)}</span> },
          {
            key: "print", label: "كشف", align: "end",
            render: (r: any) => (
              <Button variant="outline" size="sm" className="h-8" onClick={() => setPrinted(r)} data-testid={`button-print-payslip-${r.id}`}>
                <Printer className="me-1 h-3.5 w-3.5" /> طباعة
              </Button>
            ),
          },
        ]}
        toolbar={
          <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
            <FileSpreadsheet className="h-3.5 w-3.5" /> التصدير بصيغة CSV متوافق مع Excel (UTF-8)
          </span>
        }
      />

      {printed && <Payslip p={printed} company={company.data} onClose={() => setPrinted(null)} />}
    </AppShell>
  );
}
