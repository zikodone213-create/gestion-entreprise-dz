import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { BarChart3, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AppShell } from "@/components/shell";
import { DataTable, KpiCard, PrintHeader, PrintLayout, PrintTable, SectionTitle } from "@/components/kit";
import { fmtDZD, fmtDate, fmtNum, monthLabel } from "@/lib/erp";

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function ReportsPage() {
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [printMode, setPrintMode] = useState<"" | "monthly" | "annual" | "aging">("");

  const report = useQuery<any>({ queryKey: [`/api/reports/summary/${year}`] });
  const aging = useQuery<any[]>({ queryKey: ["/api/reports/aging"] });
  const company = useQuery<any>({ queryKey: ["/api/settings"] });

  const rows = report.data?.rows || [];
  const totals = report.data?.totals || {};
  const chartRows = rows.map((r: any) => ({
    الشهر: monthLabel(r.month),
    "رقم الأعمال": r.revenue,
    "المصاريف": r.expenses,
    "كتلة الأجور": r.payroll_cost,
    "النتيجة": r.net,
  }));

  const agingRows = (aging.data || []).map((d) => ({ ...d, remaining: d.amount - d.paid }));
  const agingBuckets = [
    { name: "لم يحل أجلها", value: agingRows.filter((d) => (d.days_late ?? 0) <= 0).reduce((a, d) => a + d.remaining, 0) },
    { name: "1 — 30 يوماً", value: agingRows.filter((d) => (d.days_late ?? 0) > 0 && (d.days_late ?? 0) <= 30).reduce((a, d) => a + d.remaining, 0) },
    { name: "31 — 90 يوماً", value: agingRows.filter((d) => (d.days_late ?? 0) > 30 && (d.days_late ?? 0) <= 90).reduce((a, d) => a + d.remaining, 0) },
    { name: "أكثر من 90 يوماً", value: agingRows.filter((d) => (d.days_late ?? 0) > 90).reduce((a, d) => a + d.remaining, 0) },
  ];

  const monthlyColumns = [
    { key: "month_label", label: "الشهر" },
    { key: "invoices_count", label: "عدد الفواتير", align: "end" as const },
    { key: "revenue", label: "رقم الأعمال (HT)", align: "end" as const },
    { key: "tva_collected", label: "TVA محصلة", align: "end" as const },
    { key: "expenses", label: "المصاريف", align: "end" as const },
    { key: "tva_deductible", label: "TVA مسترجعة", align: "end" as const },
    { key: "payroll_cost", label: "كتلة الأجور", align: "end" as const },
    { key: "charges", label: "مجموع الأعباء", align: "end" as const },
    { key: "net", label: "النتيجة", align: "end" as const },
  ];
  const monthlyRows = rows.map((r: any) => ({ ...r, month_label: `${monthLabel(r.month)} ${year}` }));

  return (
    <AppShell
      title="التقارير المالية"
      subtitle="تقارير شهرية وسنوية برسوم بيانية، قابلة للتصدير CSV / Excel وللطباعة PDF"
      actions={
        <div className="flex items-center gap-2">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-[110px]" data-testid="select-report-year"><SelectValue /></SelectTrigger>
            <SelectContent>{["2024", "2025", "2026"].map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Button size="sm" onClick={() => setPrintMode("annual")} data-testid="button-print-annual">
            <Printer className="me-1.5 h-4 w-4" /> التقرير السنوي
          </Button>
        </div>
      }
    >
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard label="رقم الأعمال (HT)" value={fmtDZD(totals.revenue)} tone="positive" icon={<BarChart3 className="h-4 w-4" />} testId="kpi-rep-revenue" />
        <KpiCard label="المصاريف" value={fmtDZD(totals.expenses)} testId="kpi-rep-expenses" />
        <KpiCard label="كتلة الأجور (بالتكلفة)" value={fmtDZD(totals.payroll_cost)} testId="kpi-rep-payroll" />
        <KpiCard label="النتيجة الصافية" value={fmtDZD(totals.net)} tone={(totals.net || 0) >= 0 ? "positive" : "danger"} testId="kpi-rep-net" />
        <KpiCard label="TVA محصلة − مسترجعة" value={fmtDZD((totals.tva_collected || 0) - (totals.tva_deductible || 0))} testId="kpi-rep-tva" />
        <KpiCard label="مجموع G50 المصرَّح" value={fmtDZD(totals.g50_total)} testId="kpi-rep-g50" />
      </div>

      <Tabs defaultValue="monthly">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="monthly" data-testid="tab-rep-monthly">التقرير الشهري</TabsTrigger>
          <TabsTrigger value="annual" data-testid="tab-rep-annual">التقرير السنوي</TabsTrigger>
          <TabsTrigger value="aging" data-testid="tab-rep-aging">أعمار الديون</TabsTrigger>
        </TabsList>

        <TabsContent value="monthly">
          <Card className="mb-4 p-4">
            <SectionTitle title={`المداخيل مقابل الأعباء — ${year}`} subtitle="بالدينار الجزائري خارج الرسم" />
            <div className="h-[300px]" data-testid="chart-monthly">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartRows} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="الشهر" tick={{ fontSize: 11 }} reversed />
                  <YAxis tick={{ fontSize: 10 }} orientation="right" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v: any) => fmtDZD(v)} contentStyle={{ direction: "rtl", fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="رقم الأعمال" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="المصاريف" fill="hsl(var(--chart-4))" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="كتلة الأجور" fill="hsl(var(--chart-2))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <DataTable
            testId="table-rep-monthly"
            rows={monthlyRows}
            isLoading={report.isLoading}
            error={report.error}
            onRetry={report.refetch}
            pageSize={12}
            exportName={`التقرير-الشهري-${year}`}
            onPrint={() => setPrintMode("monthly")}
            columns={monthlyColumns.map((c) => ({
              ...c,
              render: c.key === "month_label"
                ? (r: any) => <span className="font-medium">{r.month_label}</span>
                : (r: any) => <span className={`num ${c.key === "net" ? "font-semibold" : ""}`}>{fmtNum(r[c.key])}</span>,
            }))}
          />
        </TabsContent>

        <TabsContent value="annual">
          <div className="mb-4 grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <SectionTitle title="تطور النتيجة الصافية" subtitle="شهرياً (د.ج)" />
              <div className="h-[260px]" data-testid="chart-net">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartRows}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="الشهر" tick={{ fontSize: 11 }} reversed />
                    <YAxis tick={{ fontSize: 10 }} orientation="right" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                    <Tooltip formatter={(v: any) => fmtDZD(v)} contentStyle={{ direction: "rtl", fontSize: 12 }} />
                    <Line type="monotone" dataKey="النتيجة" stroke="hsl(var(--chart-1))" strokeWidth={2.2} dot={{ r: 2.5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card className="p-4">
              <SectionTitle title="توزيع المصاريف حسب الطبيعة" subtitle={`سنة ${year}`} />
              <div className="h-[260px]" data-testid="chart-expense-categories">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={(report.data?.expense_categories || []).map((c: any) => ({ name: c.category, value: c.amount }))}
                      dataKey="value" nameKey="name" outerRadius={90} innerRadius={45}
                    >
                      {(report.data?.expense_categories || []).map((_: any, i: number) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: any) => fmtDZD(v)} contentStyle={{ direction: "rtl", fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <DataTable
              testId="table-top-clients"
              rows={report.data?.top_clients}
              isLoading={report.isLoading}
              pageSize={8}
              exportName={`أفضل-العملاء-${year}`}
              columns={[
                { key: "name", label: "العميل", render: (r) => <span className="font-medium">{r.name}</span> },
                { key: "invoices", label: "عدد الفواتير", align: "end", render: (r) => <span className="num">{fmtNum(r.invoices)}</span> },
                { key: "amount", label: "رقم الأعمال (HT)", align: "end", render: (r) => <span className="num font-semibold">{fmtNum(r.amount)}</span> },
              ]}
            />
            <DataTable
              testId="table-top-products"
              rows={report.data?.top_products}
              isLoading={report.isLoading}
              pageSize={8}
              exportName={`أفضل-المنتجات-${year}`}
              columns={[
                { key: "ref", label: "المرجع", render: (r) => <span className="num text-xs">{r.ref}</span> },
                { key: "name", label: "المنتج", render: (r) => <span className="font-medium">{r.name}</span> },
                { key: "qty", label: "الكمية المبيعة", align: "end", render: (r) => <span className="num">{fmtNum(r.qty)}</span> },
                { key: "amount", label: "المبيعات (HT)", align: "end", render: (r) => <span className="num font-semibold">{fmtNum(r.amount)}</span> },
              ]}
            />
          </div>
        </TabsContent>

        <TabsContent value="aging">
          <Card className="mb-4 p-4">
            <SectionTitle title="توزيع الأرصدة المفتوحة" subtitle="حسب فترة التأخير" />
            <div className="h-[260px]" data-testid="chart-aging">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={agingBuckets}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} reversed />
                  <YAxis tick={{ fontSize: 10 }} orientation="right" tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip formatter={(v: any) => fmtDZD(v)} contentStyle={{ direction: "rtl", fontSize: 12 }} />
                  <Bar dataKey="value" name="الرصيد" radius={[3, 3, 0, 0]}>
                    {agingBuckets.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          <DataTable
            testId="table-rep-aging"
            rows={agingRows}
            isLoading={aging.isLoading}
            error={aging.error}
            onRetry={aging.refetch}
            searchKeys={["party_name", "party_type"]}
            exportName="أعمار-الديون"
            pageSize={12}
            onPrint={() => setPrintMode("aging")}
            columns={[
              { key: "party_type", label: "الطرف" },
              { key: "party_name", label: "الاسم", render: (r) => <span className="font-medium">{r.party_name}</span> },
              { key: "amount", label: "المبلغ", align: "end", render: (r) => <span className="num">{fmtNum(r.amount)}</span> },
              { key: "paid", label: "المسدَّد", align: "end", render: (r) => <span className="num">{fmtNum(r.paid)}</span> },
              { key: "remaining", label: "الباقي", align: "end", render: (r) => <span className="num font-semibold">{fmtNum(r.remaining)}</span> },
              { key: "due_date", label: "أجل السداد", render: (r) => <span className="num">{fmtDate(r.due_date)}</span> },
              {
                key: "days_late", label: "التأخير (يوم)", align: "end",
                render: (r) => <span className={`num ${r.days_late > 90 ? "font-bold text-destructive" : r.days_late > 0 ? "text-amber-600 dark:text-amber-400" : ""}`}>{r.days_late > 0 ? fmtNum(r.days_late) : "—"}</span>,
              },
            ]}
          />
        </TabsContent>
      </Tabs>

      {/* ---------------- printable reports ---------------- */}
      {printMode === "monthly" && (
        <PrintLayout title={`التقرير الشهري ${year}`} onClose={() => setPrintMode("")}>
          <PrintHeader company={company.data} docTitle="التقرير المالي الشهري" meta={[{ label: "السنة المالية", value: year }, { label: "تاريخ الإصدار", value: fmtDate(new Date().toISOString()) }]} />
          <PrintTable
            columns={monthlyColumns.map((c) => ({
              ...c,
              render: c.key === "month_label" ? undefined : (r: any) => fmtNum(r[c.key]),
            }))}
            rows={monthlyRows}
            totalRow={{
              label: "المجموع السنوي",
              values: {
                invoices_count: fmtNum(totals.invoices_count),
                revenue: fmtNum(totals.revenue),
                tva_collected: fmtNum(totals.tva_collected),
                expenses: fmtNum(totals.expenses),
                tva_deductible: fmtNum(totals.tva_deductible),
                payroll_cost: fmtNum(totals.payroll_cost),
                charges: fmtNum(totals.charges),
                net: fmtNum(totals.net),
              },
            }}
          />
          <p className="mt-6 text-center text-[10px] text-neutral-500">وثيقة مُصدرة آلياً من نظام النور ERP — المبالغ بالدينار الجزائري خارج الرسم</p>
        </PrintLayout>
      )}

      {printMode === "annual" && (
        <PrintLayout title={`التقرير السنوي ${year}`} onClose={() => setPrintMode("")}>
          <PrintHeader company={company.data} docTitle="التقرير المالي السنوي" meta={[{ label: "السنة المالية", value: year }]} />
          <table className="mb-4 w-full border-collapse text-[12px]">
            <tbody>
              {[
                ["رقم الأعمال خارج الرسم (HT)", totals.revenue],
                ["رقم الأعمال بالرسم (TTC)", totals.revenue_ttc],
                ["الرسم على القيمة المضافة المحصَّل", totals.tva_collected],
                ["الرسم على القيمة المضافة القابل للاسترداد", totals.tva_deductible],
                ["المصاريف والأعباء الخارجية", totals.expenses],
                ["أعباء المستخدمين (أجور + CNAS مستخدم)", totals.payroll_cost],
                ["IRG المقتطع على الأجور", totals.irg],
                ["مجموع الأعباء", totals.charges],
              ].map(([label, v]) => (
                <tr key={String(label)}>
                  <td className="border border-neutral-300 px-2 py-1.5">{label}</td>
                  <td className="numfont border border-neutral-300 px-2 py-1.5 text-end">{fmtDZD(v as number)}</td>
                </tr>
              ))}
              <tr className="bg-neutral-100 font-bold">
                <td className="border border-neutral-300 px-2 py-1.5">النتيجة الصافية للسنة المالية</td>
                <td className="numfont border border-neutral-300 px-2 py-1.5 text-end">{fmtDZD(totals.net)}</td>
              </tr>
            </tbody>
          </table>

          <p className="mb-1 text-[12px] font-bold">التفصيل الشهري</p>
          <PrintTable
            columns={[
              { key: "month_label", label: "الشهر" },
              { key: "revenue", label: "رقم الأعمال", align: "end", render: (r: any) => fmtNum(r.revenue) },
              { key: "expenses", label: "المصاريف", align: "end", render: (r: any) => fmtNum(r.expenses) },
              { key: "payroll_cost", label: "الأجور", align: "end", render: (r: any) => fmtNum(r.payroll_cost) },
              { key: "net", label: "النتيجة", align: "end", render: (r: any) => fmtNum(r.net) },
            ]}
            rows={monthlyRows}
            totalRow={{
              label: "المجموع",
              values: {
                revenue: fmtNum(totals.revenue), expenses: fmtNum(totals.expenses),
                payroll_cost: fmtNum(totals.payroll_cost), net: fmtNum(totals.net),
              },
            }}
          />

          <p className="mb-1 mt-4 text-[12px] font-bold">أفضل العملاء</p>
          <PrintTable
            columns={[
              { key: "name", label: "العميل" },
              { key: "invoices", label: "عدد الفواتير", align: "end", render: (r: any) => fmtNum(r.invoices) },
              { key: "amount", label: "رقم الأعمال", align: "end", render: (r: any) => fmtNum(r.amount) },
            ]}
            rows={report.data?.top_clients || []}
          />
          <p className="mt-6 text-center text-[10px] text-neutral-500">وثيقة مُصدرة آلياً من نظام النور ERP</p>
        </PrintLayout>
      )}

      {printMode === "aging" && (
        <PrintLayout title="تقرير أعمار الديون" onClose={() => setPrintMode("")}>
          <PrintHeader company={company.data} docTitle="تقرير أعمار الديون" meta={[{ label: "تاريخ الإصدار", value: fmtDate(new Date().toISOString()) }]} />
          <PrintTable
            columns={[
              { key: "party_type", label: "الطرف" },
              { key: "party_name", label: "الاسم" },
              { key: "due_date", label: "أجل السداد", render: (r: any) => fmtDate(r.due_date) },
              { key: "amount", label: "المبلغ", align: "end", render: (r: any) => fmtNum(r.amount) },
              { key: "paid", label: "المسدَّد", align: "end", render: (r: any) => fmtNum(r.paid) },
              { key: "remaining", label: "الباقي", align: "end", render: (r: any) => fmtNum(r.remaining) },
              { key: "days_late", label: "التأخير", align: "end", render: (r: any) => (r.days_late > 0 ? fmtNum(r.days_late) : "—") },
            ]}
            rows={agingRows}
            totalRow={{
              label: "المجموع",
              values: {
                amount: fmtNum(agingRows.reduce((a, d) => a + d.amount, 0)),
                paid: fmtNum(agingRows.reduce((a, d) => a + d.paid, 0)),
                remaining: fmtNum(agingRows.reduce((a, d) => a + d.remaining, 0)),
              },
            }}
          />
          <div className="mt-4 grid grid-cols-4 gap-2 text-[11px]">
            {agingBuckets.map((b) => (
              <div key={b.name} className="border border-neutral-300 p-2 text-center">
                <p className="font-bold">{b.name}</p>
                <p className="numfont">{fmtDZD(b.value)}</p>
              </div>
            ))}
          </div>
        </PrintLayout>
      )}
    </AppShell>
  );
}
