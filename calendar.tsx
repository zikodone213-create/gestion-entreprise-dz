import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarClock, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppShell } from "@/components/shell";
import { DataTable, Field, KpiCard, ModalForm, SectionTitle, StatusBadge } from "@/components/kit";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { MONTHS_AR, fmtDate, fmtNum, monthLabel, useAuth } from "@/lib/erp";
import { useToast } from "@/hooks/use-toast";

const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const EVENT_KINDS = ["موعد", "استحقاق جبائي", "استحقاق اجتماعي", "اجتماع", "تسليم"];

const SOURCE_STYLE: Record<string, string> = {
  "جباية": "border-destructive/40 bg-destructive/10 text-destructive",
  "مهمة": "border-primary/30 bg-primary/10 text-foreground",
  "موعد": "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-300",
};

export default function CalendarPage() {
  const { can } = useAuth();
  const { toast } = useToast();
  const writable = can("projects", "write");

  const now = new Date();
  const [cursor, setCursor] = useState({ y: now.getFullYear(), m: now.getMonth() + 1 });
  const monthKey = `${cursor.y}-${String(cursor.m).padStart(2, "0")}`;

  const combined = useQuery<any>({ queryKey: [`/api/calendar/combined?month=${monthKey}`] });
  const events = useQuery<any[]>({ queryKey: ["/api/calendar-events"] });

  const err = (e: any) => toast({ title: "تعذّر تنفيذ العملية", description: String(e.message), variant: "destructive" });

  const [evOpen, setEvOpen] = useState(false);
  const [evForm, setEvForm] = useState<any>({});
  const openEvent = (date?: string) => {
    setEvForm({ kind: "موعد", date: date || `${monthKey}-01` });
    setEvOpen(true);
  };
  const evSave = useMutation({
    mutationFn: async (d: any) => (await apiRequest("POST", "/api/calendar-events", d)).json(),
    onSuccess: () => {
      setEvOpen(false);
      queryClient.invalidateQueries({ queryKey: [`/api/calendar/combined?month=${monthKey}`] });
      queryClient.invalidateQueries({ queryKey: ["/api/calendar-events"] });
      toast({ title: "تم إضافة الموعد للتقويم" });
    },
    onError: err,
  });

  const items: any[] = combined.data?.items || [];
  const byDay = useMemo(() => {
    const map: Record<number, any[]> = {};
    items.forEach((it) => {
      const d = +String(it.date).slice(8, 10);
      (map[d] = map[d] || []).push(it);
    });
    return map;
  }, [items]);

  const first = new Date(cursor.y, cursor.m - 1, 1);
  const daysInMonth = new Date(cursor.y, cursor.m, 0).getDate();
  const leading = first.getDay(); // 0 = الأحد
  const cells: (number | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const move = (delta: number) => {
    const d = new Date(cursor.y, cursor.m - 1 + delta, 1);
    setCursor({ y: d.getFullYear(), m: d.getMonth() + 1 });
  };

  const todayStr = new Date().toISOString().slice(0, 10);
  const fiscalCount = items.filter((i) => i.source === "جباية").length;
  const taskCount = items.filter((i) => i.source === "مهمة").length;

  return (
    <AppShell
      title="التقويم والاستحقاقات"
      subtitle="تقويم شهري يجمع آجال المهام والاستحقاقات الجبائية (G50، CNAS، البيلان) والمواعيد"
      actions={
        <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
          <Button variant="outline" size="icon" onClick={() => move(1)} aria-label="الشهر التالي" data-testid="button-next-month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Select value={String(cursor.m)} onValueChange={(v) => setCursor({ ...cursor, m: +v })}>
            <SelectTrigger className="w-[104px]" data-testid="select-cal-month"><SelectValue /></SelectTrigger>
            <SelectContent>{MONTHS_AR.map((m, i) => <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={String(cursor.y)} onValueChange={(v) => setCursor({ ...cursor, y: +v })}>
            <SelectTrigger className="w-[88px]" data-testid="select-cal-year"><SelectValue /></SelectTrigger>
            <SelectContent>{[2024, 2025, 2026, 2027].map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => move(-1)} aria-label="الشهر السابق" data-testid="button-prev-month">
            <ChevronRight className="h-4 w-4" />
          </Button>
          {writable && (
            <Button size="sm" onClick={() => openEvent()} data-testid="button-add-event">
              <Plus className="me-1.5 h-4 w-4" /> موعد
            </Button>
          )}
        </div>
      }
    >
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="مواعيد الشهر" value={fmtNum(items.length)} icon={<CalendarClock className="h-4 w-4" />} testId="kpi-cal-total" />
        <KpiCard label="استحقاقات جبائية" value={fmtNum(fiscalCount)} tone="danger" testId="kpi-cal-fiscal" />
        <KpiCard label="آجال مهام" value={fmtNum(taskCount)} tone="warning" testId="kpi-cal-tasks" />
        <KpiCard label="الشهر المعروض" value={`${monthLabel(cursor.m)} ${cursor.y}`} testId="kpi-cal-month" />
      </div>

      <Card className="mb-5 overflow-hidden p-0">
        <div className="overflow-x-auto">
        <div className="min-w-[620px]">
        <div className="grid grid-cols-7 border-b border-border bg-muted/50 text-center text-[11px] font-semibold text-muted-foreground">
          {WEEKDAYS.map((d) => <div key={d} className="px-1 py-2">{d}</div>)}
        </div>
        <div className="grid grid-cols-7" data-testid="calendar-grid">
          {cells.map((day, i) => {
            const dayStr = day ? `${monthKey}-${String(day).padStart(2, "0")}` : "";
            const isToday = dayStr === todayStr;
            return (
              <div
                key={i}
                className={`min-h-[104px] border-b border-e border-border p-1.5 ${!day ? "bg-muted/20" : ""} ${isToday ? "bg-primary/5" : ""}`}
                data-testid={day ? `calendar-day-${day}` : undefined}
              >
                {day && (
                  <>
                    <div className="mb-1 flex items-center justify-between">
                      <span className={`num text-xs ${isToday ? "rounded bg-primary px-1.5 py-0.5 font-bold text-primary-foreground" : "text-muted-foreground"}`}>{day}</span>
                      {writable && (
                        <button
                          type="button"
                          onClick={() => openEvent(dayStr)}
                          className="text-muted-foreground opacity-0 transition-opacity hover:text-foreground focus:opacity-100 group-hover:opacity-100 md:opacity-60"
                          aria-label={`إضافة موعد في ${day}`}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <div className="space-y-1">
                      {(byDay[day] || []).slice(0, 3).map((it) => (
                        <div
                          key={it.id}
                          title={`${it.title} — ${it.description || ""}`}
                          className={`truncate rounded border px-1.5 py-0.5 text-[10.5px] leading-tight ${SOURCE_STYLE[it.source] || SOURCE_STYLE["موعد"]}`}
                        >
                          {it.title}
                        </div>
                      ))}
                      {(byDay[day] || []).length > 3 && (
                        <p className="num px-1 text-[10px] text-muted-foreground">+{fmtNum((byDay[day] || []).length - 3)} أخرى</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
        </div>
        </div>
      </Card>

      <SectionTitle title={`قائمة مواعيد ${monthLabel(cursor.m)} ${cursor.y}`} subtitle="الاستحقاقات الجبائية وآجال المهام والمواعيد المسجّلة" />
      <DataTable
        testId="table-calendar"
        rows={items}
        isLoading={combined.isLoading}
        error={combined.error}
        onRetry={combined.refetch}
        searchKeys={["title", "kind", "description"]}
        exportName={`التقويم-${monthKey}`}
        pageSize={12}
        columns={[
          { key: "date", label: "التاريخ", render: (r) => <span className="num">{fmtDate(r.date)}</span> },
          { key: "source", label: "المصدر", render: (r) => <StatusBadge value={r.source} /> },
          { key: "title", label: "الموضوع", render: (r) => <span className="font-medium">{r.title}</span> },
          { key: "kind", label: "النوع", render: (r) => <StatusBadge value={r.kind} /> },
          { key: "description", label: "التفصيل", hideOnMobile: true },
        ]}
      />

      <div className="mt-5">
        <SectionTitle title="كل المواعيد المسجّلة" subtitle="جدول المواعيد المخزّنة في قاعدة البيانات" />
        <DataTable
          testId="table-events"
          rows={events.data}
          isLoading={events.isLoading}
          error={events.error}
          onRetry={events.refetch}
          searchKeys={["title", "kind"]}
          exportName="المواعيد"
          pageSize={10}
          columns={[
            { key: "date", label: "التاريخ", render: (r) => <span className="num">{fmtDate(r.date)}</span> },
            { key: "title", label: "الموضوع", render: (r) => <span className="font-medium">{r.title}</span> },
            { key: "kind", label: "النوع", render: (r) => <StatusBadge value={r.kind} /> },
            { key: "description", label: "التفصيل", hideOnMobile: true },
            { key: "related_module", label: "الوحدة المرتبطة", hideOnMobile: true },
          ]}
        />
      </div>

      <ModalForm
        open={evOpen} onOpenChange={setEvOpen}
        title="موعد جديد في التقويم"
        submitting={evSave.isPending}
        onSubmit={() => evSave.mutate(evForm)}
      >
        <Field label="الموضوع" full>
          <Input value={evForm.title || ""} onChange={(e) => setEvForm({ ...evForm, title: e.target.value })} required data-testid="input-event-title" />
        </Field>
        <Field label="التاريخ">
          <Input type="date" value={evForm.date || ""} onChange={(e) => setEvForm({ ...evForm, date: e.target.value })} required data-testid="input-event-date" />
        </Field>
        <Field label="النوع">
          <Select value={evForm.kind || "موعد"} onValueChange={(v) => setEvForm({ ...evForm, kind: v })}>
            <SelectTrigger data-testid="select-event-kind"><SelectValue /></SelectTrigger>
            <SelectContent>{EVENT_KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="التفصيل" full>
          <Textarea value={evForm.description || ""} onChange={(e) => setEvForm({ ...evForm, description: e.target.value })} />
        </Field>
      </ModalForm>
    </AppShell>
  );
}
