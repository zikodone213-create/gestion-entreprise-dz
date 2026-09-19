import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  AlertTriangle, ArrowLeft, Banknote, Boxes, Building2, ClipboardList, FileText, Package,
  ReceiptText, TrendingDown, TrendingUp, Users, Wallet,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { AppShell } from "@/components/shell";
import { DataTable, ErrorState, KpiCard, LoadingState, SectionTitle } from "@/components/kit";
import { fmtDZD, fmtNum, fmtShortDZD, monthLabel, useAuth } from "@/lib/erp";

const CHART = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(var(--muted-foreground))"];

const axis = { tick: { fontSize: 11, fill: "hsl(var(--muted-foreground))" }, stroke: "hsl(var(--border))" };

function ChartCard({ title, subtitle, children, testId }: any) {
  return (
    <Card className="p-4" data-testid={testId}>
      <div className="mb-3">
        <p className="text-sm font-semibold">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="h-[240px] w-full" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">{children}</ResponsiveContainer>
      </div>
    </Card>
  );
}

const tooltipStyle = {
  contentStyle: {
    background: "hsl(var(--popover))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    fontSize: 12,
    direction: "rtl" as const,
  },
  labelStyle: { color: "hsl(var(--foreground))" },
};

export default function DashboardPage() {
  const year = 2026;
  const { can } = useAuth();
  const { data, isLoading, error, refetch } = useQuery<any>({ queryKey: ["/api/dashboard?year=" + year] });

  const k = data?.kpis;
  const charts = data?.charts;

  const salesData = (charts?.monthlySales || []).map((r: any) => {
    const m = Number(r.month.slice(5));
    const exp = (charts?.monthlyExpenses || []).find((e: any) => e.month === r.month);
    return { name: monthLabel(m), مبيعات: r.ht, مصاريف: exp?.ht || 0, فواتير: r.count };
  });
  const pieData = (charts?.expenseByCategory || []).map((r: any) => ({ name: r.category, value: r.amount }));
  const topClients = (charts?.topClients || []).map((c: any) => ({ name: c.name.slice(0, 18), مبلغ: c.amount }));
  const payrollData = (charts?.payrollByMonth || []).map((p: any) => ({ name: monthLabel(p.month), صافي: p.net, إجمالي: p.gross }));

  const modules = [
    { href: "/hr", label: "الموارد البشرية", icon: Users, module: "hr", value: `${fmtNum(k?.employees)} موظف`, hint: `${fmtNum(k?.pending_leaves)} طلب إجازة معلّق` },
    { href: "/payroll", label: "الرواتب", icon: Banknote, module: "payroll", value: fmtShortDZD(k?.payroll), hint: "مجموع الصافي المدفوع هذه السنة" },
    { href: "/advances", label: "التسبيقات", icon: Wallet, module: "advances", value: fmtShortDZD(k?.advances_remaining), hint: "الرصيد المتبقي للاستقطاع" },
    { href: "/inventory", label: "المخزون", icon: Boxes, module: "inventory", value: fmtShortDZD(k?.stock_value), hint: `${fmtNum(k?.products)} مرجع · ${fmtNum(k?.low_stock_count)} تنبيه نقص` },
    { href: "/invoicing", label: "الفوترة", icon: ReceiptText, module: "invoicing", value: `${fmtNum(k?.unpaid_count)} فاتورة معلّقة`, hint: `بقيمة ${fmtShortDZD(k?.unpaid_amount)}` },
    { href: "/accounting", label: "المحاسبة", icon: FileText, module: "accounting", value: fmtShortDZD(k?.net_result), hint: "النتيجة التقديرية للسنة" },
    { href: "/crm", label: "العملاء", icon: Building2, module: "crm", value: `${fmtNum(k?.clients)} عميل`, hint: `${fmtNum(k?.complaints_open)} شكوى مفتوحة` },
    { href: "/projects", label: "المشاريع", icon: ClipboardList, module: "projects", value: `${fmtNum(k?.projects)} مشروع جارٍ`, hint: `${fmtNum(k?.open_tasks)} مهمة غير منجزة` },
  ].filter((m) => can(m.module, "read"));

  return (
    <AppShell title="لوحة التحكم" subtitle={`ملخص نشاط المؤسسة للسنة المالية ${year}`}>
      {isLoading ? (
        <LoadingState label="جارٍ تحميل المؤشرات…" rows={6} />
      ) : error ? (
        <ErrorState error={error} onRetry={refetch} />
      ) : (
        <div className="space-y-6">
          {k?.days_to_g50 <= 10 && can("fiscal") && (
            <Card className="flex flex-wrap items-center justify-between gap-3 border-amber-500/40 bg-amber-500/10 p-4" data-testid="alert-g50">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-400" />
                <div>
                  <p className="text-sm font-semibold">تنبيه: أجل إيداع تصريح G50</p>
                  <p className="text-xs text-muted-foreground">
                    بقي <span className="num font-semibold">{k.days_to_g50}</span> يوماً — آخر أجل {k.g50_deadline} (قبل 20 من الشهر)
                  </p>
                </div>
              </div>
              <Link href="/fiscal" className="text-xs font-semibold text-primary underline-offset-4 hover:underline" data-testid="link-g50-alert">
                فتح الوحدة الجبائية
              </Link>
            </Card>
          )}

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard label="رقم الأعمال (خارج الرسم)" value={fmtShortDZD(k?.revenue)} hint={`${fmtDZD(k?.revenue_ttc)} بالرسوم`} icon={<TrendingUp className="h-4 w-4" />} tone="positive" testId="kpi-revenue" />
            <KpiCard label="المصاريف" value={fmtShortDZD(k?.expenses)} hint="مصاريف مسجلة خارج الرسم" icon={<TrendingDown className="h-4 w-4" />} testId="kpi-expenses" />
            <KpiCard label="النتيجة التقديرية" value={fmtShortDZD(k?.net_result)} hint="رقم الأعمال − المصاريف" icon={<FileText className="h-4 w-4" />} tone={k?.net_result >= 0 ? "positive" : "danger"} testId="kpi-net" />
            <KpiCard label="عدد الموظفين" value={fmtNum(k?.employees)} hint={`كتلة الأجور: ${fmtShortDZD(k?.payroll)}`} icon={<Users className="h-4 w-4" />} testId="kpi-employees" />
            <KpiCard label="قيمة المخزون" value={fmtShortDZD(k?.stock_value)} hint={`${fmtNum(k?.products)} مرجع`} icon={<Package className="h-4 w-4" />} testId="kpi-stock" />
            <KpiCard label="فواتير معلّقة" value={fmtNum(k?.unpaid_count)} hint={fmtDZD(k?.unpaid_amount)} icon={<ReceiptText className="h-4 w-4" />} tone="warning" testId="kpi-unpaid" />
            <KpiCard label="تنبيهات نقص المخزون" value={fmtNum(k?.low_stock_count)} hint="منتجات تحت الحد الأدنى" icon={<AlertTriangle className="h-4 w-4" />} tone={k?.low_stock_count ? "danger" : "default"} testId="kpi-lowstock" />
            <KpiCard label="أجل G50" value={`${fmtNum(k?.days_to_g50)} يوم`} hint={`آخر أجل ${k?.g50_deadline}`} icon={<FileText className="h-4 w-4" />} tone="warning" testId="kpi-g50" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title="المبيعات شهرياً" subtitle="رقم الأعمال خارج الرسم (د.ج)" testId="chart-sales">
              <AreaChart data={salesData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="gSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART[0]} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={CHART[0]} stopOpacity={0.03} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" {...axis} />
                <YAxis {...axis} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={44} />
                <Tooltip formatter={(v: any) => fmtDZD(v)} {...tooltipStyle} />
                <Area type="monotone" dataKey="مبيعات" stroke={CHART[0]} strokeWidth={2} fill="url(#gSales)" />
              </AreaChart>
            </ChartCard>

            <ChartCard title="المداخيل مقابل المصاريف" subtitle="مقارنة شهرية (د.ج)" testId="chart-revexp">
              <BarChart data={salesData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" {...axis} />
                <YAxis {...axis} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={44} />
                <Tooltip formatter={(v: any) => fmtDZD(v)} {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="مبيعات" fill={CHART[0]} radius={[3, 3, 0, 0]} />
                <Bar dataKey="مصاريف" fill={CHART[3]} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ChartCard>

            <ChartCard title="توزيع المصاريف" subtitle="حسب الطبيعة (د.ج)" testId="chart-expenses-pie">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                  {pieData.map((_: any, i: number) => (
                    <Cell key={i} fill={CHART[i % CHART.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: any) => fmtDZD(v)} {...tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ChartCard>

            <ChartCard title="أفضل العملاء" subtitle="رقم الأعمال المحقق (د.ج)" testId="chart-top-clients">
              <BarChart data={topClients} layout="vertical" margin={{ top: 5, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" {...axis} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <YAxis type="category" dataKey="name" {...axis} width={120} />
                <Tooltip formatter={(v: any) => fmtDZD(v)} {...tooltipStyle} />
                <Bar dataKey="مبلغ" fill={CHART[1]} radius={[0, 3, 3, 0]} />
              </BarChart>
            </ChartCard>

            {can("payroll") && (
              <ChartCard title="كتلة الأجور شهرياً" subtitle="الإجمالي والصافي (د.ج)" testId="chart-payroll">
                <LineChart data={payrollData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" {...axis} />
                  <YAxis {...axis} tickFormatter={(v) => `${Math.round(v / 1000)}k`} width={44} />
                  <Tooltip formatter={(v: any) => fmtDZD(v)} {...tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="إجمالي" stroke={CHART[1]} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="صافي" stroke={CHART[0]} strokeWidth={2} dot={false} />
                </LineChart>
              </ChartCard>
            )}

            <Card className="p-4" data-testid="card-lowstock">
              <SectionTitle title="تنبيهات نقص المخزون" subtitle="منتجات وصلت أو نزلت عن الحد الأدنى" />
              {data?.lowStock?.length ? (
                <ul className="divide-y divide-border text-sm">
                  {data.lowStock.map((p: any) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{p.name}</p>
                        <p className="num text-xs text-muted-foreground">{p.ref}</p>
                      </div>
                      <span className="num shrink-0 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">
                        {fmtNum(p.quantity)} / {fmtNum(p.min_quantity)}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">لا توجد تنبيهات</p>
              )}
            </Card>
          </div>

          <div>
            <SectionTitle title="الوحدات" subtitle="ملخص سريع لكل وحدة متاحة لدورك" />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {modules.map((m) => {
                const Icon = m.icon;
                return (
                  <Link key={m.href} href={m.href} data-testid={`card-module-${m.href.replace("/", "")}`}>
                    <Card className="h-full p-4 transition-colors hover:border-primary/50 hover:bg-muted/40">
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2 text-sm font-semibold">
                          <Icon className="h-4 w-4 text-primary" /> {m.label}
                        </span>
                        <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="num mt-3 text-base font-bold">{m.value}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{m.hint}</p>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>

          <Card className="p-4" data-testid="card-upcoming">
            <SectionTitle title="المواعيد والاستحقاقات القادمة" />
            <DataTable
              testId="table-upcoming"
              rows={data?.upcoming || []}
              pageSize={5}
              columns={[
                { key: "date", label: "التاريخ", render: (r: any) => <span className="num">{r.date}</span> },
                { key: "title", label: "الموعد" },
                { key: "kind", label: "النوع", hideOnMobile: true },
                { key: "description", label: "تفاصيل", hideOnMobile: true },
              ]}
            />
          </Card>
        </div>
      )}
    </AppShell>
  );
}
