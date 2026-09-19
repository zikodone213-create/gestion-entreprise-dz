import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CalendarDays, ClipboardList, GripVertical, Pencil, Plus, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppShell } from "@/components/shell";
import { DataTable, Field, KpiCard, ModalForm, SectionTitle, StatusBadge } from "@/components/kit";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { fmtDZD, fmtDate, fmtNum, useAuth } from "@/lib/erp";
import { useToast } from "@/hooks/use-toast";

const TASK_STATUS = ["جديدة", "قيد التنفيذ", "متوقفة", "منجزة"];
const PROJECT_STATUS = ["مخطط", "قيد التنفيذ", "منجز", "متوقف"];
const PRIORITIES = ["منخفضة", "متوسطة", "عالية"];

const COLUMN_TONE: Record<string, string> = {
  "جديدة": "border-t-slate-400",
  "قيد التنفيذ": "border-t-[hsl(var(--chart-2))]",
  "متوقفة": "border-t-amber-500",
  "منجزة": "border-t-[hsl(var(--chart-1))]",
};

export default function ProjectsPage() {
  const { can } = useAuth();
  const { toast } = useToast();
  const writable = can("projects", "write");

  const projects = useQuery<any[]>({ queryKey: ["/api/projects"] });
  const tasks = useQuery<any[]>({ queryKey: ["/api/tasks"] });
  // دليل الأسماء (بدون بيانات حساسة) — متاح لكل الأدوار التي تصل للمشاريع
  const directory = useQuery<any>({ queryKey: ["/api/directory"] });
  const employees = { data: directory.data?.employees as any[] | undefined };
  const clients = { data: directory.data?.clients as any[] | undefined };

  const invalidate = (keys: string[]) => keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  const err = (e: any) => toast({ title: "تعذّر تنفيذ العملية", description: String(e.message), variant: "destructive" });

  const empName = (id: number) => {
    const e = employees.data?.find((x) => x.id === id);
    return e ? `${e.first_name} ${e.last_name}` : "—";
  };
  const clientName = (id: number) => clients.data?.find((c) => c.id === id)?.name || "—";
  const projectName = (id: number) => projects.data?.find((p) => p.id === id)?.name || "—";

  const [projectFilter, setProjectFilter] = useState("all");
  const [dragId, setDragId] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  /* ---------------- project modal ---------------- */
  const [prOpen, setPrOpen] = useState(false);
  const [prForm, setPrForm] = useState<any>({});
  const openProject = (row?: any) => {
    const n = (projects.data?.length || 0) + 1;
    setPrForm(row ? { ...row } : {
      code: `PRJ-${String(n).padStart(3, "0")}`, status: "مخطط", progress: 0, budget: 0,
      start_date: new Date().toISOString().slice(0, 10),
    });
    setPrOpen(true);
  };
  const prSave = useMutation({
    mutationFn: async (d: any) =>
      (d.id ? await apiRequest("PATCH", `/api/projects/${d.id}`, d) : await apiRequest("POST", "/api/projects", d)).json(),
    onSuccess: () => { setPrOpen(false); invalidate(["/api/projects"]); toast({ title: "تم حفظ المشروع" }); },
    onError: err,
  });
  const prDelete = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/projects/${id}`)).json(),
    onSuccess: () => { invalidate(["/api/projects", "/api/tasks"]); toast({ title: "تم حذف المشروع" }); },
    onError: err,
  });

  /* ---------------- task modal ---------------- */
  const [tkOpen, setTkOpen] = useState(false);
  const [tkForm, setTkForm] = useState<any>({});
  const openTask = (row?: any, status?: string) => {
    setTkForm(row ? { ...row } : {
      status: status || "جديدة", priority: "متوسطة", progress: 0,
      due_date: new Date().toISOString().slice(0, 10),
      project_id: projectFilter !== "all" ? +projectFilter : undefined,
    });
    setTkOpen(true);
  };
  const tkSave = useMutation({
    mutationFn: async (d: any) =>
      (d.id ? await apiRequest("PATCH", `/api/tasks/${d.id}`, d) : await apiRequest("POST", "/api/tasks", d)).json(),
    onSuccess: () => { setTkOpen(false); invalidate(["/api/tasks", "/api/projects"]); toast({ title: "تم حفظ المهمة" }); },
    onError: err,
  });
  const tkDelete = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/tasks/${id}`)).json(),
    onSuccess: () => { invalidate(["/api/tasks"]); toast({ title: "تم حذف المهمة" }); },
    onError: err,
  });
  const tkStatus = useMutation({
    mutationFn: async ({ id, status }: any) =>
      (await apiRequest("PATCH", `/api/tasks/${id}`, { status, progress: status === "منجزة" ? 100 : undefined })).json(),
    onSuccess: () => { invalidate(["/api/tasks"]); },
    onError: err,
  });

  /* ---------------- derived ---------------- */
  const filteredTasks = (tasks.data || []).filter((t) => (projectFilter === "all" ? true : t.project_id === +projectFilter));
  const byStatus = useMemo(() => {
    const map: Record<string, any[]> = {};
    TASK_STATUS.forEach((s) => (map[s] = []));
    filteredTasks.forEach((t) => { (map[t.status] = map[t.status] || []).push(t); });
    return map;
  }, [filteredTasks]);

  const projectRows = (projects.data || []).map((p) => {
    const pt = (tasks.data || []).filter((t) => t.project_id === p.id);
    const done = pt.filter((t) => t.status === "منجزة").length;
    const computed = pt.length ? Math.round((done / pt.length) * 100) : p.progress;
    return { ...p, client: clientName(p.client_id), manager: empName(p.manager_id), tasks_count: pt.length, tasks_done: done, computed_progress: computed };
  });

  const totals = {
    active: (projects.data || []).filter((p) => p.status === "قيد التنفيذ").length,
    budget: (projects.data || []).reduce((a, p) => a + p.budget, 0),
    open: (tasks.data || []).filter((t) => t.status !== "منجزة").length,
    late: (tasks.data || []).filter((t) => t.status !== "منجزة" && t.due_date && new Date(t.due_date) < new Date()).length,
  };

  const onDrop = (status: string) => {
    if (dragId == null) return;
    const t = (tasks.data || []).find((x) => x.id === dragId);
    setDragOver(null);
    setDragId(null);
    if (!t || t.status === status) return;
    tkStatus.mutate({ id: t.id, status });
    toast({ title: `تم نقل المهمة إلى «${status}»` });
  };

  return (
    <AppShell
      title="المشاريع والمهام"
      subtitle="المشاريع مع الميزانية ونسبة التقدم، ولوحة كانبان للمهام الموزّعة على الموظفين"
      actions={writable ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => openTask()} data-testid="button-add-task">
            <Plus className="me-1.5 h-4 w-4" /> مهمة
          </Button>
          <Button size="sm" onClick={() => openProject()} data-testid="button-add-project">
            <ClipboardList className="me-1.5 h-4 w-4" /> مشروع جديد
          </Button>
        </div>
      ) : null}
    >
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="مشاريع قيد التنفيذ" value={fmtNum(totals.active)} icon={<ClipboardList className="h-4 w-4" />} testId="kpi-projects-active" />
        <KpiCard label="مجموع الميزانيات" value={fmtDZD(totals.budget)} testId="kpi-projects-budget" />
        <KpiCard label="مهام غير منجزة" value={fmtNum(totals.open)} tone="warning" testId="kpi-tasks-open" />
        <KpiCard label="مهام متأخرة عن الأجل" value={fmtNum(totals.late)} tone={totals.late ? "danger" : "default"} testId="kpi-tasks-late" />
      </div>

      <Tabs defaultValue="kanban">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="kanban" data-testid="tab-kanban">لوحة كانبان</TabsTrigger>
          <TabsTrigger value="projects" data-testid="tab-projects">المشاريع</TabsTrigger>
          <TabsTrigger value="tasks" data-testid="tab-tasks">جدول المهام</TabsTrigger>
        </TabsList>

        {/* ---------------- kanban ---------------- */}
        <TabsContent value="kanban">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">تصفية بالمشروع:</span>
            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-[240px]" data-testid="select-kanban-project"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المشاريع</SelectItem>
                {(projects.data || []).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.code} — {p.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">
              {writable ? "اسحب البطاقة بين الأعمدة أو استخدم قائمة الحالة داخل البطاقة." : "العرض فقط — لا تملك صلاحية التعديل."}
            </span>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4" data-testid="board-kanban">
            {TASK_STATUS.map((status) => (
              <div
                key={status}
                onDragOver={(e) => { if (writable) { e.preventDefault(); setDragOver(status); } }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => writable && onDrop(status)}
                data-testid={`kanban-column-${status}`}
                className={`rounded-lg border border-t-4 bg-card p-2.5 transition-colors ${COLUMN_TONE[status]} ${dragOver === status ? "bg-primary/5 ring-2 ring-primary/40" : ""}`}
              >
                <div className="mb-2 flex items-center justify-between gap-2 px-1">
                  <p className="text-sm font-bold">{status}</p>
                  <span className="num rounded-md bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">{fmtNum(byStatus[status]?.length || 0)}</span>
                </div>
                <div className="space-y-2">
                  {(byStatus[status] || []).map((t) => {
                    const late = t.status !== "منجزة" && t.due_date && new Date(t.due_date) < new Date();
                    return (
                      <Card
                        key={t.id}
                        draggable={writable}
                        onDragStart={() => setDragId(t.id)}
                        onDragEnd={() => { setDragId(null); setDragOver(null); }}
                        className={`p-2.5 ${writable ? "cursor-grab active:cursor-grabbing" : ""} ${dragId === t.id ? "opacity-50" : ""}`}
                        data-testid={`task-card-${t.id}`}
                      >
                        <div className="flex items-start gap-1.5">
                          {writable && <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
                          <p className="min-w-0 flex-1 break-words text-sm font-semibold">{t.title}</p>
                        </div>
                        <p className="mt-1 truncate text-[11px] text-muted-foreground">{projectName(t.project_id)}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <User className="h-3 w-3" /> {empName(t.assignee_id)}
                          </span>
                          <span className={`num inline-flex items-center gap-1 ${late ? "font-semibold text-destructive" : "text-muted-foreground"}`}>
                            <CalendarDays className="h-3 w-3" /> {fmtDate(t.due_date)}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <Progress value={t.progress} className="h-1.5" />
                          <span className="num text-[11px] text-muted-foreground">{fmtNum(t.progress)}%</span>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-1">
                          <StatusBadge value={t.priority} />
                          {writable && (
                            <div className="flex items-center gap-1">
                              <Select value={t.status} onValueChange={(v) => tkStatus.mutate({ id: t.id, status: v })}>
                                <SelectTrigger className="h-7 w-[105px] text-[11px]" data-testid={`select-task-status-${t.id}`}><SelectValue /></SelectTrigger>
                                <SelectContent>{TASK_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                              </Select>
                              <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => openTask(t)} data-testid={`button-edit-task-${t.id}`}>
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                  {!byStatus[status]?.length && (
                    <p className="px-1 py-6 text-center text-xs text-muted-foreground">لا توجد مهام</p>
                  )}
                  {writable && (
                    <Button variant="ghost" size="sm" className="w-full justify-start text-xs" onClick={() => openTask(undefined, status)} data-testid={`button-add-task-${status}`}>
                      <Plus className="me-1 h-3.5 w-3.5" /> إضافة مهمة
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ---------------- projects ---------------- */}
        <TabsContent value="projects">
          <DataTable
            testId="table-projects"
            rows={projectRows}
            isLoading={projects.isLoading}
            error={projects.error}
            onRetry={projects.refetch}
            searchKeys={["code", "name", "client", "manager"]}
            exportName="المشاريع"
            pageSize={10}
            columns={[
              { key: "code", label: "الرمز", render: (r) => <span className="num text-xs font-semibold">{r.code}</span> },
              { key: "name", label: "المشروع", render: (r) => <span className="font-medium">{r.name}</span> },
              { key: "client", label: "العميل", hideOnMobile: true },
              { key: "manager", label: "المسؤول", hideOnMobile: true },
              { key: "start_date", label: "البداية", render: (r) => <span className="num">{fmtDate(r.start_date)}</span> },
              { key: "end_date", label: "النهاية", hideOnMobile: true, render: (r) => <span className="num">{fmtDate(r.end_date)}</span> },
              { key: "budget", label: "الميزانية", align: "end", render: (r) => <span className="num">{fmtNum(r.budget)}</span> },
              {
                key: "computed_progress", label: "التقدم", align: "end",
                render: (r) => (
                  <div className="flex items-center justify-end gap-2">
                    <Progress value={r.computed_progress} className="h-1.5 w-16" />
                    <span className="num text-xs font-semibold">{fmtNum(r.computed_progress)}%</span>
                  </div>
                ),
              },
              { key: "tasks_count", label: "المهام", align: "center", render: (r) => <span className="num">{fmtNum(r.tasks_done)}/{fmtNum(r.tasks_count)}</span> },
              { key: "status", label: "الحالة", render: (r) => <StatusBadge value={r.status} /> },
              ...(writable ? [{
                key: "actions", label: "إجراءات", align: "end" as const,
                render: (r: any) => (
                  <div className="flex justify-end gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openProject(r)} data-testid={`button-edit-project-${r.id}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 text-destructive"
                      onClick={() => { if (confirm(`حذف المشروع ${r.name}؟ ستُحذف مهامه.`)) prDelete.mutate(r.id); }}
                      data-testid={`button-delete-project-${r.id}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ),
              }] : []),
            ]}
          />
        </TabsContent>

        {/* ---------------- tasks table ---------------- */}
        <TabsContent value="tasks">
          <DataTable
            testId="table-tasks"
            rows={(tasks.data || []).map((t) => ({ ...t, project: projectName(t.project_id), assignee: empName(t.assignee_id) }))}
            isLoading={tasks.isLoading}
            error={tasks.error}
            onRetry={tasks.refetch}
            searchKeys={["title", "project", "assignee", "status"]}
            exportName="المهام"
            pageSize={12}
            columns={[
              { key: "title", label: "المهمة", render: (r) => <span className="font-medium">{r.title}</span> },
              { key: "project", label: "المشروع", hideOnMobile: true },
              { key: "assignee", label: "المكلَّف" },
              { key: "due_date", label: "الأجل", render: (r) => <span className={`num ${r.status !== "منجزة" && r.due_date && new Date(r.due_date) < new Date() ? "font-semibold text-destructive" : ""}`}>{fmtDate(r.due_date)}</span> },
              { key: "priority", label: "الأولوية", render: (r) => <StatusBadge value={r.priority} /> },
              { key: "progress", label: "التقدم", align: "end", render: (r) => <span className="num">{fmtNum(r.progress)}%</span> },
              { key: "status", label: "الحالة", render: (r) => <StatusBadge value={r.status} /> },
              ...(writable ? [{
                key: "actions", label: "إجراءات", align: "end" as const,
                render: (r: any) => (
                  <div className="flex justify-end gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openTask(r)} data-testid={`button-edit-task-row-${r.id}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 text-destructive"
                      onClick={() => { if (confirm("حذف المهمة؟")) tkDelete.mutate(r.id); }}
                      data-testid={`button-delete-task-${r.id}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ),
              }] : []),
            ]}
          />
        </TabsContent>
      </Tabs>

      {/* ---------------- modals ---------------- */}
      <ModalForm
        open={prOpen} onOpenChange={setPrOpen}
        title={prForm.id ? `تعديل المشروع ${prForm.code || ""}` : "مشروع جديد"}
        submitting={prSave.isPending}
        onSubmit={() => prSave.mutate(prForm)}
        wide
      >
        <Field label="الرمز">
          <Input value={prForm.code || ""} onChange={(e) => setPrForm({ ...prForm, code: e.target.value })} required data-testid="input-project-code" />
        </Field>
        <Field label="اسم المشروع">
          <Input value={prForm.name || ""} onChange={(e) => setPrForm({ ...prForm, name: e.target.value })} required data-testid="input-project-name" />
        </Field>
        <Field label="العميل">
          <Select value={prForm.client_id ? String(prForm.client_id) : ""} onValueChange={(v) => setPrForm({ ...prForm, client_id: +v })}>
            <SelectTrigger data-testid="select-project-client"><SelectValue placeholder="بدون عميل" /></SelectTrigger>
            <SelectContent>{(clients.data || []).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="المسؤول عن المشروع">
          <Select value={prForm.manager_id ? String(prForm.manager_id) : ""} onValueChange={(v) => setPrForm({ ...prForm, manager_id: +v })}>
            <SelectTrigger data-testid="select-project-manager"><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
            <SelectContent>{(employees.data || []).map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.first_name} {e.last_name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="تاريخ البداية">
          <Input type="date" value={prForm.start_date || ""} onChange={(e) => setPrForm({ ...prForm, start_date: e.target.value })} />
        </Field>
        <Field label="تاريخ النهاية">
          <Input type="date" value={prForm.end_date || ""} onChange={(e) => setPrForm({ ...prForm, end_date: e.target.value })} />
        </Field>
        <Field label="الميزانية (د.ج)">
          <Input type="number" value={prForm.budget ?? 0} onChange={(e) => setPrForm({ ...prForm, budget: +e.target.value })} />
        </Field>
        <Field label="نسبة التقدم %">
          <Input type="number" min={0} max={100} value={prForm.progress ?? 0} onChange={(e) => setPrForm({ ...prForm, progress: +e.target.value })} />
        </Field>
        <Field label="الحالة">
          <Select value={prForm.status || "مخطط"} onValueChange={(v) => setPrForm({ ...prForm, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PROJECT_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="الوصف" full>
          <Textarea value={prForm.description || ""} onChange={(e) => setPrForm({ ...prForm, description: e.target.value })} />
        </Field>
      </ModalForm>

      <ModalForm
        open={tkOpen} onOpenChange={setTkOpen}
        title={tkForm.id ? "تعديل مهمة" : "مهمة جديدة"}
        description="المهام تظهر في لوحة كانبان وفي التقويم حسب تاريخ الاستحقاق"
        submitting={tkSave.isPending}
        onSubmit={() => tkSave.mutate(tkForm)}
        wide
      >
        <Field label="عنوان المهمة" full>
          <Input value={tkForm.title || ""} onChange={(e) => setTkForm({ ...tkForm, title: e.target.value })} required data-testid="input-task-title" />
        </Field>
        <Field label="المشروع">
          <Select value={tkForm.project_id ? String(tkForm.project_id) : ""} onValueChange={(v) => setTkForm({ ...tkForm, project_id: +v })}>
            <SelectTrigger data-testid="select-task-project"><SelectValue placeholder="اختر المشروع" /></SelectTrigger>
            <SelectContent>{(projects.data || []).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.code} — {p.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="المكلَّف بالمهمة">
          <Select value={tkForm.assignee_id ? String(tkForm.assignee_id) : ""} onValueChange={(v) => setTkForm({ ...tkForm, assignee_id: +v })}>
            <SelectTrigger data-testid="select-task-assignee"><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
            <SelectContent>{(employees.data || []).map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.first_name} {e.last_name} — {e.position}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="تاريخ الاستحقاق">
          <Input type="date" value={tkForm.due_date || ""} onChange={(e) => setTkForm({ ...tkForm, due_date: e.target.value })} data-testid="input-task-due" />
        </Field>
        <Field label="الأولوية">
          <Select value={tkForm.priority || "متوسطة"} onValueChange={(v) => setTkForm({ ...tkForm, priority: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="الحالة">
          <Select value={tkForm.status || "جديدة"} onValueChange={(v) => setTkForm({ ...tkForm, status: v })}>
            <SelectTrigger data-testid="select-task-status-modal"><SelectValue /></SelectTrigger>
            <SelectContent>{TASK_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="نسبة التقدم %">
          <Input type="number" min={0} max={100} value={tkForm.progress ?? 0} onChange={(e) => setTkForm({ ...tkForm, progress: +e.target.value })} />
        </Field>
        <Field label="الوصف" full>
          <Textarea value={tkForm.description || ""} onChange={(e) => setTkForm({ ...tkForm, description: e.target.value })} />
        </Field>
      </ModalForm>
    </AppShell>
  );
}
