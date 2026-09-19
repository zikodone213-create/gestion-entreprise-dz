import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ScrollText } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AppShell } from "@/components/shell";
import { DataTable, KpiCard, SectionTitle } from "@/components/kit";
import { fmtNum } from "@/lib/erp";

function JsonBlock({ title, value }: { title: string; value: any }) {
  return (
    <div>
      <p className="mb-1 text-xs font-semibold text-muted-foreground">{title}</p>
      <pre dir="ltr" className="max-h-[40vh] overflow-auto rounded-md border border-border bg-muted/40 p-3 text-[11px] leading-relaxed">
        {value ? JSON.stringify(JSON.parse(value), null, 2) : "—"}
      </pre>
    </div>
  );
}

export default function AuditPage() {
  const [module, setModule] = useState("all");
  const [action, setAction] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [detail, setDetail] = useState<any>(null);

  const qs = `?module=${module}&action=${action}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}&limit=1000`;
  const logs = useQuery<any[]>({ queryKey: ["/api/audit" + qs] });
  const meta = useQuery<any>({ queryKey: ["/api/audit/meta"] });

  return (
    <AppShell title="سجل العمليات (Audit Log)" subtitle="كل عمليات الإنشاء والتعديل والحذف مع القيم قبل وبعد">
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="مجموع العمليات المسجلة" value={fmtNum(meta.data?.total)} icon={<ScrollText className="h-4 w-4" />} testId="kpi-audit-total" />
        <KpiCard label="العمليات المعروضة" value={fmtNum(logs.data?.length)} testId="kpi-audit-shown" />
        <KpiCard label="عدد الوحدات" value={fmtNum(meta.data?.modules?.length)} testId="kpi-audit-modules" />
        <KpiCard label="أنواع العمليات" value={fmtNum(meta.data?.actions?.length)} testId="kpi-audit-actions" />
      </div>

      <Card className="mb-4 p-4">
        <SectionTitle title="فلترة بالتاريخ" subtitle="حدّد مجالاً زمنياً لعرض العمليات" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">من تاريخ</span>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} data-testid="input-audit-from" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-medium text-muted-foreground">إلى تاريخ</span>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} data-testid="input-audit-to" />
          </label>
          <div className="flex items-end">
            <Button variant="outline" size="sm" onClick={() => { setFrom(""); setTo(""); setModule("all"); setAction("all"); }} data-testid="button-clear-audit-filters">
              مسح الفلاتر
            </Button>
          </div>
        </div>
      </Card>

      <DataTable
        testId="table-audit"
        rows={logs.data}
        isLoading={logs.isLoading}
        error={logs.error}
        onRetry={logs.refetch}
        searchKeys={["username", "module", "action", "record_id"]}
        exportName="سجل-العمليات"
        pageSize={15}
        filters={[
          { key: "module", label: "الوحدة", value: module, onChange: setModule, options: [{ value: "all", label: "كل الوحدات" }, ...(meta.data?.modules || []).map((m: string) => ({ value: m, label: m }))] },
          { key: "action", label: "العملية", value: action, onChange: setAction, options: [{ value: "all", label: "كل العمليات" }, ...(meta.data?.actions || []).map((a: string) => ({ value: a, label: a }))] },
        ]}
        columns={[
          { key: "created_at", label: "التاريخ والساعة", render: (r) => <span className="num text-xs">{r.created_at}</span> },
          { key: "username", label: "المستخدم" },
          { key: "action", label: "العملية" },
          { key: "module", label: "الوحدة" },
          { key: "record_id", label: "السجل", align: "center", render: (r) => <span className="num">{r.record_id || "—"}</span> },
          {
            key: "details", label: "القيم", align: "end",
            render: (r) => (
              <Button variant="outline" size="sm" className="h-8" onClick={() => setDetail(r)} data-testid={`button-audit-detail-${r.id}`}>
                قبل / بعد
              </Button>
            ),
          },
        ]}
      />

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent dir="rtl" className="sm:max-w-2xl">
          <DialogHeader className="text-start">
            <DialogTitle>
              {detail?.action} — {detail?.module} {detail?.record_id ? `#${detail.record_id}` : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              المستخدم: <span className="font-semibold">{detail?.username}</span> · التاريخ: <span className="num">{detail?.created_at}</span>
            </p>
            <JsonBlock title="القيم قبل" value={detail?.before_value} />
            <JsonBlock title="القيم بعد" value={detail?.after_value} />
          </div>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
