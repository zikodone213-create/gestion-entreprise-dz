import { useMutation, useQuery } from "@tanstack/react-query";
import { Database, DatabaseBackup, Download, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AppShell } from "@/components/shell";
import { DataTable, KpiCard, SectionTitle, StatusBadge } from "@/components/kit";
import { apiRequest, getAuthToken, queryClient } from "@/lib/queryClient";
import { fmtNum } from "@/lib/erp";
import { useToast } from "@/hooks/use-toast";

export default function BackupsPage() {
  const { toast } = useToast();
  const backups = useQuery<any[]>({ queryKey: ["/api/backups"] });
  const settings = useQuery<any>({ queryKey: ["/api/settings"] });

  const create = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/backups", { kind: "يدوي" })).json(),
    onSuccess: (d: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/backups"] });
      toast({ title: "تم إنشاء نسخة احتياطية", description: d.filename });
    },
    onError: (e: any) => toast({ title: "تعذّر إنشاء النسخة", description: String(e.message), variant: "destructive" }),
  });

  const restore = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/backups/${id}/restore`)).json(),
    onSuccess: (d: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/backups"] });
      toast({ title: "تم تحضير الاستعادة", description: d.message });
    },
    onError: (e: any) => toast({ title: "تعذّرت الاستعادة", description: String(e.message), variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/backups/${id}`)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/backups"] }); toast({ title: "تم حذف النسخة" }); },
  });

  const rows = backups.data || [];
  const totalSize = rows.reduce((a, r) => a + (r.size || 0), 0);

  return (
    <AppShell
      title="النسخ الاحتياطي"
      subtitle="نسخ فورية أو مجدولة لقاعدة البيانات data.db مع إمكانية التنزيل والاستعادة"
      actions={
        <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending} data-testid="button-create-backup">
          <DatabaseBackup className="me-1.5 h-4 w-4" /> نسخة احتياطية الآن
        </Button>
      }
    >
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="عدد النسخ" value={fmtNum(rows.length)} icon={<Database className="h-4 w-4" />} testId="kpi-backup-count" />
        <KpiCard label="الحجم الإجمالي" value={`${fmtNum(totalSize / 1024 / 1024, 2)} ميغابايت`} testId="kpi-backup-size" />
        <KpiCard label="آخر نسخة" value={rows[0]?.created_at?.slice(0, 16) || "—"} testId="kpi-backup-last" />
        <KpiCard
          label="النسخ التلقائي"
          value={settings.data?.auto_backup === "1" ? "مفعّل" : "معطّل"}
          hint="كل 6 ساعات — يُعدَّل من الإعدادات"
          tone={settings.data?.auto_backup === "1" ? "positive" : "warning"}
          testId="kpi-backup-auto"
        />
      </div>

      <Card className="mb-4 border-amber-500/30 bg-amber-500/5 p-4 text-xs leading-relaxed text-muted-foreground">
        الاستعادة تُنشئ أولاً نسخة أمان من القاعدة الحالية، ثم تُحضّر ملف النسخة المختارة داخل مجلد <span className="num">backups/</span>؛
        يكتمل الاستبدال بعد إعادة تشغيل الخادم لتحرير قاعدة البيانات المفتوحة.
      </Card>

      <SectionTitle title="قائمة النسخ" subtitle="مرتبة من الأحدث إلى الأقدم" />
      <DataTable
        testId="table-backups"
        rows={rows}
        isLoading={backups.isLoading}
        error={backups.error}
        onRetry={backups.refetch}
        searchKeys={["filename", "kind", "created_by"]}
        exportName="النسخ-الاحتياطية"
        pageSize={12}
        columns={[
          { key: "filename", label: "الملف", render: (r) => <span className="num text-xs">{r.filename}</span> },
          { key: "created_at", label: "التاريخ", render: (r) => <span className="num text-xs">{r.created_at}</span> },
          { key: "kind", label: "النوع", render: (r) => <StatusBadge value={r.kind} /> },
          { key: "created_by", label: "المُنشئ", hideOnMobile: true },
          { key: "size", label: "الحجم", align: "end", render: (r) => <span className="num">{fmtNum(r.size / 1024, 0)} كب</span> },
          {
            key: "actions", label: "إجراءات", align: "end",
            render: (r) => (
              <div className="flex flex-wrap justify-end gap-1">
                <a
                  href={`/api/backups/${r.id}/download?token=${getAuthToken() || ""}`}
                  className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs hover:bg-muted"
                  data-testid={`button-download-backup-${r.id}`}
                >
                  <Download className="h-3.5 w-3.5" /> تنزيل
                </a>
                <Button variant="outline" size="sm" className="h-8"
                  onClick={() => { if (confirm(`استعادة قاعدة البيانات من ${r.filename}؟`)) restore.mutate(r.id); }}
                  data-testid={`button-restore-backup-${r.id}`}>
                  <RotateCcw className="me-1 h-3.5 w-3.5" /> استعادة
                </Button>
                <Button variant="outline" size="icon" className="h-8 w-8 text-destructive"
                  onClick={() => { if (confirm("حذف هذه النسخة نهائياً؟")) remove.mutate(r.id); }}
                  data-testid={`button-delete-backup-${r.id}`}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ),
          },
        ]}
      />
    </AppShell>
  );
}
