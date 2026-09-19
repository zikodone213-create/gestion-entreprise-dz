import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlarmClock, FileCheck2, Printer, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppShell } from "@/components/shell";
import {
  AlertBanner, DataTable, KpiCard, PrintHeader, PrintLayout, SectionTitle, StatusBadge,
} from "@/components/kit";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MONTHS_AR, amountInArabicWords, daysUntil, fmtDZD, fmtDate, fmtNum, monthLabel, useAuth } from "@/lib/erp";
import { useToast } from "@/hooks/use-toast";

/* ------------------------------------------------ printable G50 */

function G50Print({ g, company, cfg, onClose }: { g: any; company: any; cfg: any; onClose: () => void }) {
  const row = (code: string, label: string, base: any, rate: any, amount: any, bold = false) => (
    <tr className={bold ? "bg-neutral-100 font-bold" : ""}>
      <td className="numfont border border-neutral-400 px-2 py-1.5 text-center">{code}</td>
      <td className="border border-neutral-400 px-2 py-1.5">{label}</td>
      <td className="numfont border border-neutral-400 px-2 py-1.5 text-end">{base === null ? "" : fmtNum(base)}</td>
      <td className="numfont border border-neutral-400 px-2 py-1.5 text-center">{rate === null ? "" : `${fmtNum(rate)}%`}</td>
      <td className="numfont border border-neutral-400 px-2 py-1.5 text-end">{amount === null ? "" : fmtNum(amount)}</td>
    </tr>
  );
  return (
    <PrintLayout title={`تصريح G50 — ${monthLabel(g.month)} ${g.year}`} onClose={onClose}>
      <div className="mb-3 text-center">
        <p className="text-[11px] font-semibold">الجمهورية الجزائرية الديمقراطية الشعبية</p>
        <p className="text-[11px]">وزارة المالية — المديرية العامة للضرائب</p>
        <div className="mx-auto mt-2 inline-block border-2 border-neutral-800 px-4 py-1">
          <p className="text-[15px] font-bold">تصريح شهري — سلسلة G n°50</p>
        </div>
        <p className="mt-1 text-[11px]">الحقوق والرسوم المحصّلة على رقم الأعمال والأجور</p>
      </div>

      <PrintHeader
        company={company}
        docTitle="المكلَّف بالضريبة"
        meta={[
          { label: "الشهر المصرَّح به", value: `${monthLabel(g.month)} ${g.year}` },
          { label: "آخر أجل للإيداع", value: fmtDate(`${g.year}-${String(g.month === 12 ? 1 : g.month + 1).padStart(2, "0")}-20`) },
          { label: "المفتشية", value: company?.company_tax_office || "مفتشية الضرائب — البليدة" },
        ]}
      />

      <table className="w-full border-collapse text-[11.5px]">
        <thead>
          <tr className="bg-neutral-200">
            <th className="border border-neutral-400 px-2 py-1.5 text-center">الرمز</th>
            <th className="border border-neutral-400 px-2 py-1.5 text-start">طبيعة الحقوق والرسوم</th>
            <th className="border border-neutral-400 px-2 py-1.5 text-end">الأساس الخاضع (د.ج)</th>
            <th className="border border-neutral-400 px-2 py-1.5 text-center">النسبة</th>
            <th className="border border-neutral-400 px-2 py-1.5 text-end">المبلغ المستحق (د.ج)</th>
          </tr>
        </thead>
        <tbody>
          <tr className="bg-neutral-50">
            <td className="border border-neutral-400 px-2 py-1 font-bold" colSpan={5}>أ — الرسم على النشاط المهني (TAP)</td>
          </tr>
          {row("15", "رقم الأعمال المحقَّق خارج الرسم", g.turnover, cfg?.tap ?? 2, g.tap)}
          <tr className="bg-neutral-50">
            <td className="border border-neutral-400 px-2 py-1 font-bold" colSpan={5}>ب — الرسم على القيمة المضافة (TVA)</td>
          </tr>
          {row("17", "الرسم المحصَّل على المبيعات والخدمات", g.turnover, cfg?.tva_normal ?? 19, g.tva_collected)}
          {row("18", "الرسم القابل للخصم على المشتريات والأعباء", g.tva_deductible ? Math.round((g.tva_deductible * 100) / (cfg?.tva_normal ?? 19)) : 0, cfg?.tva_normal ?? 19, -g.tva_deductible)}
          {row("19", "الرسم على القيمة المضافة المستحق الدفع", null, null, g.tva_due, true)}
          {g.tva_credit ? row("20", "رصيد الرسم القابل للترحيل (créditde TVA)", null, null, g.tva_credit) : null}
          <tr className="bg-neutral-50">
            <td className="border border-neutral-400 px-2 py-1 font-bold" colSpan={5}>ج — الضريبة على الدخل الإجمالي (IRG) — قسم الأجور والرواتب</td>
          </tr>
          {row("30", "الاقتطاعات من المصدر على الأجور المدفوعة", null, null, g.irg_salaries)}
          <tr className="bg-neutral-200 font-bold">
            <td className="border border-neutral-400 px-2 py-2 text-center">—</td>
            <td className="border border-neutral-400 px-2 py-2" colSpan={3}>المجموع العام للحقوق والرسوم المستحقة</td>
            <td className="numfont border border-neutral-400 px-2 py-2 text-end">{fmtNum(g.total)}</td>
          </tr>
        </tbody>
      </table>

      <div className="mt-3 rounded border border-neutral-300 bg-neutral-50 p-2 text-[11.5px]">
        <span className="font-bold">المبلغ الإجمالي بالحروف: </span>{amountInArabicWords(g.total)}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
        <div className="border border-neutral-300 p-2">
          <p className="font-bold">عدد الفواتير</p>
          <p className="numfont">{fmtNum(g.invoices_count ?? 0)}</p>
        </div>
        <div className="border border-neutral-300 p-2">
          <p className="font-bold">رقم الأعمال خارج الرسم</p>
          <p className="numfont">{fmtDZD(g.turnover)}</p>
        </div>
        <div className="border border-neutral-300 p-2">
          <p className="font-bold">حالة التصريح</p>
          <p>{g.status || g.existing?.status || "مسودة"}</p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-8 text-[12px]">
        <div>
          <p>حُرِّر بـ: {company?.company_city} في {fmtDate(new Date().toISOString())}</p>
          <div className="mt-8 border-t border-neutral-400 pt-2 text-center">توقيع وختم المكلَّف بالضريبة</div>
        </div>
        <div className="mt-[26px] border-t border-neutral-400 pt-2 text-center">إطار مخصص لمصالح الضرائب</div>
      </div>
      <p className="mt-5 text-center text-[10px] text-neutral-500">
        يُودع هذا التصريح ويُسدَّد قبل الـ 20 من الشهر الموالي لدى قابض الضرائب المختص — نظام النور ERP
      </p>
    </PrintLayout>
  );
}

/* ------------------------------------------------ printable bilan + TCR */

function BilanPrint({ b, company, onClose }: { b: any; company: any; onClose: () => void }) {
  const assets = b.assets || [];
  const liabilities = b.liabilities || [];
  const tcr = b.tcr || [];
  const sum = (arr: any[]) => arr.reduce((a: number, x: any) => a + x.amount, 0);
  return (
    <PrintLayout title={`الميزانية السنوية ${b.year}`} onClose={onClose}>
      <PrintHeader
        company={company}
        docTitle="الميزانية المحاسبية (BILAN)"
        meta={[{ label: "السنة المالية", value: b.year }, { label: "تاريخ الإصدار", value: fmtDate(new Date().toISOString()) }]}
      />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="mb-1 text-[12px] font-bold">الأصول (ACTIF)</p>
          <table className="w-full border-collapse text-[11.5px]">
            <tbody>
              {assets.map((a: any) => (
                <tr key={a.label}>
                  <td className="border border-neutral-300 px-2 py-1.5">{a.label}</td>
                  <td className="numfont border border-neutral-300 px-2 py-1.5 text-end">{fmtNum(a.amount)}</td>
                </tr>
              ))}
              <tr className="bg-neutral-100 font-bold">
                <td className="border border-neutral-300 px-2 py-1.5">مجموع الأصول</td>
                <td className="numfont border border-neutral-300 px-2 py-1.5 text-end">{fmtNum(sum(assets))}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div>
          <p className="mb-1 text-[12px] font-bold">الخصوم (PASSIF)</p>
          <table className="w-full border-collapse text-[11.5px]">
            <tbody>
              {liabilities.map((l: any) => (
                <tr key={l.label}>
                  <td className="border border-neutral-300 px-2 py-1.5">{l.label}</td>
                  <td className="numfont border border-neutral-300 px-2 py-1.5 text-end">{fmtNum(l.amount)}</td>
                </tr>
              ))}
              <tr className="bg-neutral-100 font-bold">
                <td className="border border-neutral-300 px-2 py-1.5">مجموع الخصوم</td>
                <td className="numfont border border-neutral-300 px-2 py-1.5 text-end">{fmtNum(sum(liabilities))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p className="mb-1 mt-5 text-[12px] font-bold">جدول حسابات النتائج (TCR)</p>
      <table className="w-full border-collapse text-[11.5px]">
        <tbody>
          {tcr.map((t: any, i: number) => (
            <tr key={t.label} className={i === tcr.length - 1 ? "bg-neutral-100 font-bold" : ""}>
              <td className="border border-neutral-300 px-2 py-1.5">{t.label}</td>
              <td className="numfont border border-neutral-300 px-2 py-1.5 text-end">{fmtNum(t.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex items-center justify-between border-2 border-neutral-800 bg-neutral-100 px-4 py-3">
        <span className="text-[13px] font-bold">النتيجة الصافية للسنة المالية {b.year}</span>
        <span className="numfont text-base font-bold">{fmtDZD(b.net_result)}</span>
      </div>
      <div className="mt-2 rounded border border-neutral-300 bg-neutral-50 p-2 text-[11.5px]">
        <span className="font-bold">النتيجة بالحروف: </span>{amountInArabicWords(b.net_result)}
      </div>

      <div className="mt-8 grid grid-cols-2 gap-8 text-[12px]">
        <div className="border-t border-neutral-400 pt-2 text-center">المحاسب / محافظ الحسابات</div>
        <div className="border-t border-neutral-400 pt-2 text-center">توقيع وختم المسيّر</div>
      </div>
      <p className="mt-5 text-center text-[10px] text-neutral-500">
        تُودع الحصيلة السنوية قبل 30 أفريل من السنة الموالية — نظام النور ERP
      </p>
    </PrintLayout>
  );
}

/* ------------------------------------------------ page */

export default function FiscalPage() {
  const { can } = useAuth();
  const { toast } = useToast();
  const writable = can("fiscal", "write");

  const now = new Date();
  const [year, setYear] = useState(String(now.getFullYear()));
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [bilanYear, setBilanYear] = useState(String(now.getFullYear()));
  const [printG50, setPrintG50] = useState<any>(null);
  const [printBilan, setPrintBilan] = useState<any>(null);

  const g50 = useQuery<any>({ queryKey: [`/api/fiscal/g50/compute?year=${year}&month=${month}`] });
  const archive = useQuery<any[]>({ queryKey: ["/api/g50"] });
  const bilan = useQuery<any>({ queryKey: [`/api/fiscal/bilan/compute?year=${bilanYear}`] });
  const bilans = useQuery<any[]>({ queryKey: ["/api/balance-sheets"] });
  const cfg = useQuery<any>({ queryKey: [`/api/tax-config/${year}`] });
  const company = useQuery<any>({ queryKey: ["/api/settings"] });

  const err = (e: any) => toast({ title: "تعذّر تنفيذ العملية", description: String(e.message), variant: "destructive" });

  const saveG50 = useMutation({
    mutationFn: async (status: string) => (await apiRequest("POST", "/api/fiscal/g50", { ...g50.data, year: +year, month: +month, status })).json(),
    onSuccess: (_d, status) => {
      queryClient.invalidateQueries({ queryKey: [`/api/fiscal/g50/compute?year=${year}&month=${month}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/g50"] });
      toast({ title: status === "مودع" ? "تم إيداع التصريح وأرشفته" : "تم حفظ التصريح كمسودة" });
    },
    onError: err,
  });

  const saveBilan = useMutation({
    mutationFn: async (status: string) => (await apiRequest("POST", "/api/fiscal/bilan", { ...bilan.data, year: +bilanYear, status })).json(),
    onSuccess: (_d, status) => {
      queryClient.invalidateQueries({ queryKey: [`/api/fiscal/bilan/compute?year=${bilanYear}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/balance-sheets"] });
      toast({ title: status === "مودع" ? "تم إيداع الميزانية وأرشفتها" : "تم حفظ الميزانية كمسودة" });
    },
    onError: err,
  });

  /* ---------------- deadline countdown ---------------- */
  const deadlineDate = (() => {
    const d = new Date(now.getFullYear(), now.getMonth(), 20);
    if (d < now) d.setMonth(d.getMonth() + 1);
    return d.toISOString().slice(0, 10);
  })();
  const days = daysUntil(deadlineDate);
  const prevMonth = now.getDate() > 20 ? now.getMonth() + 1 : now.getMonth() || 12;
  const g = g50.data;

  const openArchived = (row: any) => setPrintG50({ ...row, invoices_count: undefined });

  return (
    <AppShell
      title="الوحدة الجبائية (G50 / البيلان)"
      subtitle="التصريح الشهري المجمّع آلياً، الميزانية السنوية وجدول حسابات النتائج، وأرشيف التصريحات"
      actions={
        <Button size="sm" variant="outline" onClick={() => g && setPrintG50({ ...g })} data-testid="button-print-g50-header">
          <Printer className="me-1.5 h-4 w-4" /> طباعة G50
        </Button>
      }
    >
      <AlertBanner
        tone={days <= 5 ? "danger" : days <= 10 ? "warning" : "info"}
        title={<span>باقي <span className="num">{fmtNum(days)}</span> {days === 1 ? "يوم" : "يوماً"} لآخر أجل إيداع تصريح G50 — <span className="num">{fmtDate(deadlineDate)}</span></span>}
        icon={<AlarmClock className="h-4 w-4" />}
        testId="banner-g50-deadline"
        action={
          <Button size="sm" variant="outline" onClick={() => { setMonth(String(prevMonth)); }} data-testid="button-goto-month">
            تجميع شهر {monthLabel(prevMonth)}
          </Button>
        }
      >
        يُودع تصريح G50 ويُسدَّد قبل الـ 20 من الشهر الموالي. النسب المعمول بها لسنة {year}: TVA{" "}
        <span className="num">{fmtNum(cfg.data?.tva_normal ?? 19)}%</span> / <span className="num">{fmtNum(cfg.data?.tva_reduced ?? 9)}%</span> · TAP{" "}
        <span className="num">{fmtNum(cfg.data?.tap ?? 2)}%</span> — كلها مقروءة من الإعدادات الجبائية.
      </AlertBanner>

      <Tabs defaultValue="g50">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="g50" data-testid="tab-g50">تصريح G50 الشهري</TabsTrigger>
          <TabsTrigger value="bilan" data-testid="tab-bilan">الميزانية السنوية (TCR)</TabsTrigger>
          <TabsTrigger value="archive" data-testid="tab-archive">الأرشيف</TabsTrigger>
        </TabsList>

        {/* ---------------- G50 ---------------- */}
        <TabsContent value="g50">
          <Card className="mb-4 p-4">
            <SectionTitle
              title="اختيار الشهر"
              subtitle="القيم مجمّعة آلياً من الفواتير والمصاريف وكشوف الرواتب"
              action={
                <div className="flex items-center gap-2">
                  <Select value={month} onValueChange={setMonth}>
                    <SelectTrigger className="w-[120px]" data-testid="select-g50-month"><SelectValue /></SelectTrigger>
                    <SelectContent>{MONTHS_AR.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                  </Select>
                  <Select value={year} onValueChange={setYear}>
                    <SelectTrigger className="w-[100px]" data-testid="select-g50-year"><SelectValue /></SelectTrigger>
                    <SelectContent>{["2024", "2025", "2026"].map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              }
            />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard label="رقم الأعمال خارج الرسم" value={fmtDZD(g?.turnover)} hint={`${fmtNum(g?.invoices_count ?? 0)} فاتورة`} testId="kpi-g50-turnover" />
              <KpiCard label="TVA مستحقة" value={fmtDZD(g?.tva_due)} hint={`محصلة ${fmtNum(g?.tva_collected)} − مسترجعة ${fmtNum(g?.tva_deductible)}`} testId="kpi-g50-tva" />
              <KpiCard label="IRG على الأجور" value={fmtDZD(g?.irg_salaries)} hint="من كشوف الرواتب" testId="kpi-g50-irg" />
              <KpiCard label="TAP على رقم الأعمال" value={fmtDZD(g?.tap)} hint={`النسبة ${fmtNum(cfg.data?.tap ?? 2)}%`} testId="kpi-g50-tap" />
            </div>
          </Card>

          <Card className="p-4">
            <SectionTitle
              title={`تفصيل التصريح — ${monthLabel(+month)} ${year}`}
              subtitle={g?.existing ? `مُؤرشف بحالة «${g.existing.status}» بتاريخ ${fmtDate(g.existing.declared_at)}` : "غير مؤرشف بعد"}
              action={
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => setPrintG50({ ...g })} data-testid="button-print-g50">
                    <Printer className="me-1.5 h-4 w-4" /> النموذج الرسمي
                  </Button>
                  {writable && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => saveG50.mutate("مسودة")} disabled={saveG50.isPending} data-testid="button-save-g50-draft">
                        <Save className="me-1.5 h-4 w-4" /> حفظ كمسودة
                      </Button>
                      <Button size="sm" onClick={() => saveG50.mutate("مودع")} disabled={saveG50.isPending} data-testid="button-deposit-g50">
                        <FileCheck2 className="me-1.5 h-4 w-4" /> إيداع وأرشفة
                      </Button>
                    </>
                  )}
                </div>
              }
            />
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-xs">
                  <tr>
                    <th className="px-3 py-2 text-center font-semibold text-muted-foreground">الرمز</th>
                    <th className="px-3 py-2 text-start font-semibold text-muted-foreground">طبيعة الحق أو الرسم</th>
                    <th className="px-3 py-2 text-end font-semibold text-muted-foreground">الأساس (د.ج)</th>
                    <th className="px-3 py-2 text-center font-semibold text-muted-foreground">النسبة</th>
                    <th className="px-3 py-2 text-end font-semibold text-muted-foreground">المبلغ (د.ج)</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["15", "الرسم على النشاط المهني TAP", g?.turnover, `${fmtNum(cfg.data?.tap ?? 2)}%`, g?.tap],
                    ["17", "TVA المحصَّلة على المبيعات", g?.turnover, `${fmtNum(cfg.data?.tva_normal ?? 19)}%`, g?.tva_collected],
                    ["18", "TVA القابلة للخصم على المشتريات", null, "—", -(g?.tva_deductible || 0)],
                    ["19", "TVA المستحقة الدفع", null, "—", g?.tva_due],
                    ["30", "IRG المقتطع على الأجور", null, "جدول تنازلي", g?.irg_salaries],
                  ].map(([code, label, base, rate, amount]: any) => (
                    <tr key={code} className="border-t border-border">
                      <td className="num px-3 py-2 text-center">{code}</td>
                      <td className="px-3 py-2">{label}</td>
                      <td className="num px-3 py-2 text-end">{base == null ? "—" : fmtNum(base)}</td>
                      <td className={`px-3 py-2 text-center${/[0-9]/.test(String(rate)) ? " num" : ""}`}>{rate}</td>
                      <td className="num px-3 py-2 text-end font-semibold">{fmtNum(amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border bg-muted/40">
                    <td className="px-3 py-2.5 text-center">—</td>
                    <td className="px-3 py-2.5 font-bold" colSpan={3}>المجموع العام المستحق</td>
                    <td className="num px-3 py-2.5 text-end font-bold">{fmtNum(g?.total)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            {g?.tva_credit ? (
              <p className="mt-3 text-xs text-muted-foreground">
                رصيد TVA قابل للترحيل إلى الشهر الموالي: <span className="num font-semibold">{fmtDZD(g.tva_credit)}</span>
              </p>
            ) : null}
            <p className="mt-3 rounded-md border border-border bg-muted/40 p-2.5 text-xs">
              المبلغ بالحروف: <span className="font-semibold">{amountInArabicWords(g?.total || 0)}</span>
            </p>
          </Card>
        </TabsContent>

        {/* ---------------- bilan ---------------- */}
        <TabsContent value="bilan">
          <Card className="mb-4 p-4">
            <SectionTitle
              title={`الميزانية السنوية ${bilanYear}`}
              subtitle={bilan.data?.existing ? `مُؤرشفة بحالة «${bilan.data.existing.status}»` : "غير مؤرشفة بعد"}
              action={
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={bilanYear} onValueChange={setBilanYear}>
                    <SelectTrigger className="w-[100px]" data-testid="select-bilan-year"><SelectValue /></SelectTrigger>
                    <SelectContent>{["2024", "2025", "2026"].map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={() => setPrintBilan(bilan.data)} data-testid="button-print-bilan">
                    <Printer className="me-1.5 h-4 w-4" /> طباعة البيلان
                  </Button>
                  {writable && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => saveBilan.mutate("مسودة")} disabled={saveBilan.isPending} data-testid="button-save-bilan-draft">
                        <Save className="me-1.5 h-4 w-4" /> حفظ كمسودة
                      </Button>
                      <Button size="sm" onClick={() => saveBilan.mutate("مودع")} disabled={saveBilan.isPending} data-testid="button-deposit-bilan">
                        <FileCheck2 className="me-1.5 h-4 w-4" /> إيداع وأرشفة
                      </Button>
                    </>
                  )}
                </div>
              }
            />
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <KpiCard label="رقم الأعمال" value={fmtDZD(bilan.data?.revenue)} tone="positive" testId="kpi-bilan-revenue" />
              <KpiCard label="مجموع الأعباء" value={fmtDZD(bilan.data?.expenses_total)} testId="kpi-bilan-charges" />
              <KpiCard
                label="النتيجة الصافية"
                value={fmtDZD(bilan.data?.net_result)}
                tone={(bilan.data?.net_result || 0) >= 0 ? "positive" : "danger"}
                testId="kpi-bilan-net"
              />
              <KpiCard label="مجموع الأصول" value={fmtDZD((bilan.data?.assets || []).reduce((a: number, x: any) => a + x.amount, 0))} testId="kpi-bilan-assets" />
            </div>
          </Card>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <SectionTitle title="الأصول (ACTIF)" />
              <table className="w-full text-sm">
                <tbody>
                  {(bilan.data?.assets || []).map((a: any) => (
                    <tr key={a.label} className="border-t border-border">
                      <td className="px-3 py-2">{a.label}</td>
                      <td className="num px-3 py-2 text-end">{fmtNum(a.amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border bg-muted/40">
                    <td className="px-3 py-2 font-bold">المجموع</td>
                    <td className="num px-3 py-2 text-end font-bold">{fmtNum((bilan.data?.assets || []).reduce((a: number, x: any) => a + x.amount, 0))}</td>
                  </tr>
                </tbody>
              </table>
            </Card>
            <Card className="p-4">
              <SectionTitle title="الخصوم (PASSIF)" />
              <table className="w-full text-sm">
                <tbody>
                  {(bilan.data?.liabilities || []).map((l: any) => (
                    <tr key={l.label} className="border-t border-border">
                      <td className="px-3 py-2">{l.label}</td>
                      <td className="num px-3 py-2 text-end">{fmtNum(l.amount)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-border bg-muted/40">
                    <td className="px-3 py-2 font-bold">المجموع</td>
                    <td className="num px-3 py-2 text-end font-bold">{fmtNum((bilan.data?.liabilities || []).reduce((a: number, x: any) => a + x.amount, 0))}</td>
                  </tr>
                </tbody>
              </table>
            </Card>
          </div>

          <Card className="mt-4 p-4">
            <SectionTitle title="جدول حسابات النتائج (TCR)" subtitle="حسب النظام المحاسبي المالي الجزائري (SCF)" />
            <table className="w-full text-sm">
              <tbody>
                {(bilan.data?.tcr || []).map((t: any, i: number) => (
                  <tr key={t.label} className={`border-t border-border ${i === (bilan.data?.tcr || []).length - 1 ? "bg-muted/40 font-bold" : ""}`}>
                    <td className="px-3 py-2">{t.label}</td>
                    <td className="num px-3 py-2 text-end">{fmtNum(t.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </TabsContent>

        {/* ---------------- archive ---------------- */}
        <TabsContent value="archive">
          <SectionTitle title="أرشيف تصريحات G50" subtitle="كل التصريحات الشهرية المحفوظة — قابلة للطباعة والتصدير" />
          <DataTable
            testId="table-g50-archive"
            rows={(archive.data || []).map((r) => ({ ...r, month_label: `${monthLabel(r.month)} ${r.year}` }))}
            isLoading={archive.isLoading}
            error={archive.error}
            onRetry={archive.refetch}
            searchKeys={["month_label", "status"]}
            exportName="أرشيف-تصريحات-G50"
            pageSize={12}
            columns={[
              { key: "month_label", label: "الشهر", render: (r) => <span className="font-medium">{r.month_label}</span> },
              { key: "turnover", label: "رقم الأعمال", align: "end", render: (r) => <span className="num">{fmtNum(r.turnover)}</span> },
              { key: "tva_collected", label: "TVA محصلة", align: "end", hideOnMobile: true, render: (r) => <span className="num">{fmtNum(r.tva_collected)}</span> },
              { key: "tva_deductible", label: "TVA مسترجعة", align: "end", hideOnMobile: true, render: (r) => <span className="num">{fmtNum(r.tva_deductible)}</span> },
              { key: "tva_due", label: "TVA مستحقة", align: "end", render: (r) => <span className="num">{fmtNum(r.tva_due)}</span> },
              { key: "irg_salaries", label: "IRG", align: "end", render: (r) => <span className="num">{fmtNum(r.irg_salaries)}</span> },
              { key: "tap", label: "TAP", align: "end", render: (r) => <span className="num">{fmtNum(r.tap)}</span> },
              { key: "total", label: "المجموع", align: "end", render: (r) => <span className="num font-semibold">{fmtNum(r.total)}</span> },
              { key: "declared_at", label: "تاريخ الإيداع", hideOnMobile: true, render: (r) => <span className="num">{fmtDate(r.declared_at)}</span> },
              { key: "status", label: "الحالة", render: (r) => <StatusBadge value={r.status} /> },
              {
                key: "actions", label: "النموذج", align: "end",
                render: (r: any) => (
                  <Button variant="outline" size="sm" className="h-8" onClick={() => openArchived(r)} data-testid={`button-print-archive-${r.id}`}>
                    <Printer className="me-1 h-3.5 w-3.5" /> طباعة
                  </Button>
                ),
              },
            ]}
          />

          <div className="mt-5">
            <SectionTitle title="أرشيف الميزانيات السنوية" subtitle="الحصائل المحفوظة مع جدول حسابات النتائج" />
            <DataTable
              testId="table-bilan-archive"
              rows={bilans.data}
              isLoading={bilans.isLoading}
              error={bilans.error}
              onRetry={bilans.refetch}
              searchKeys={["status"]}
              exportName="أرشيف-الميزانيات"
              columns={[
                { key: "year", label: "السنة المالية", render: (r) => <span className="num font-medium">{r.year}</span> },
                { key: "revenue", label: "رقم الأعمال", align: "end", render: (r) => <span className="num">{fmtNum(r.revenue)}</span> },
                { key: "expenses_total", label: "الأعباء", align: "end", render: (r) => <span className="num">{fmtNum(r.expenses_total)}</span> },
                { key: "net_result", label: "النتيجة الصافية", align: "end", render: (r) => <span className={`num font-semibold ${r.net_result < 0 ? "text-destructive" : ""}`}>{fmtNum(r.net_result)}</span> },
                { key: "status", label: "الحالة", render: (r) => <StatusBadge value={r.status} /> },
                { key: "created_at", label: "تاريخ الحفظ", hideOnMobile: true, render: (r) => <span className="num">{fmtDate(r.created_at)}</span> },
                {
                  key: "actions", label: "النموذج", align: "end",
                  render: (r: any) => (
                    <Button
                      variant="outline" size="sm" className="h-8"
                      onClick={() => setPrintBilan({
                        ...r,
                        assets: JSON.parse(r.assets || "[]"),
                        liabilities: JSON.parse(r.liabilities || "[]"),
                        tcr: JSON.parse(r.tcr || "[]"),
                      })}
                      data-testid={`button-print-bilan-${r.id}`}
                    >
                      <Printer className="me-1 h-3.5 w-3.5" /> طباعة
                    </Button>
                  ),
                },
              ]}
            />
          </div>
        </TabsContent>
      </Tabs>

      {printG50 && <G50Print g={printG50} company={company.data} cfg={cfg.data} onClose={() => setPrintG50(null)} />}
      {printBilan && <BilanPrint b={printBilan} company={company.data} onClose={() => setPrintBilan(null)} />}
    </AppShell>
  );
}
