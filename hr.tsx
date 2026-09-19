import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarCheck, Pencil, Plus, Star, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppShell } from "@/components/shell";
import { DataTable, Field, KpiCard, ModalForm, SectionTitle, StatusBadge } from "@/components/kit";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { fmtDZD, fmtDate, fmtNum, useAuth } from "@/lib/erp";
import { useToast } from "@/hooks/use-toast";

const DEPTS = ["الإدارة", "المالية والمحاسبة", "الموارد البشرية", "المبيعات", "المخزون واللوجستيك", "التقني"];

export default function HrPage() {
  const { can } = useAuth();
  const { toast } = useToast();
  const writable = can("hr", "write");

  const employees = useQuery<any[]>({ queryKey: ["/api/employees"] });
  const attendance = useQuery<any[]>({ queryKey: ["/api/attendance"] });
  const leaves = useQuery<any[]>({ queryKey: ["/api/leaves"] });
  const perf = useQuery<any[]>({ queryKey: ["/api/performance"] });
  const summary = useQuery<any>({ queryKey: ["/api/hr/summary"] });

  const empName = (id: number) => {
    const e = employees.data?.find((x) => x.id === id);
    return e ? `${e.first_name} ${e.last_name}` : "—";
  };

  const invalidate = (keys: string[]) => keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));

  /* ---------------- employee modal ---------------- */
  const [empOpen, setEmpOpen] = useState(false);
  const [empForm, setEmpForm] = useState<any>({});
  const openEmp = (row?: any) => {
    setEmpForm(row ? { ...row } : { status: "نشط", contract_type: "دائم", base_salary: 50000, allowances: 5000, department: DEPTS[0] });
    setEmpOpen(true);
  };
  const empSave = useMutation({
    mutationFn: async (data: any) => {
      const res = data.id
        ? await apiRequest("PATCH", `/api/employees/${data.id}`, data)
        : await apiRequest("POST", "/api/employees", data);
      return res.json();
    },
    onSuccess: () => {
      setEmpOpen(false);
      invalidate(["/api/employees", "/api/hr/summary"]);
      toast({ title: "تم الحفظ", description: "تم تحديث ملف الموظف" });
    },
    onError: (e: any) => toast({ title: "تعذّر الحفظ", description: String(e.message), variant: "destructive" }),
  });
  const empDelete = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/employees/${id}`)).json(),
    onSuccess: () => { invalidate(["/api/employees", "/api/hr/summary"]); toast({ title: "تم الحذف" }); },
    onError: (e: any) => toast({ title: "تعذّر الحذف", description: String(e.message), variant: "destructive" }),
  });

  /* ---------------- attendance modal ---------------- */
  const [attOpen, setAttOpen] = useState(false);
  const [attForm, setAttForm] = useState<any>({});
  const attSave = useMutation({
    mutationFn: async (data: any) => {
      const hours =
        data.check_in && data.check_out
          ? Math.max(0, (+data.check_out.slice(0, 2) + +data.check_out.slice(3) / 60) - (+data.check_in.slice(0, 2) + +data.check_in.slice(3) / 60))
          : 0;
      return (await apiRequest("POST", "/api/attendance", { ...data, hours: +hours.toFixed(2) })).json();
    },
    onSuccess: () => { setAttOpen(false); invalidate(["/api/attendance", "/api/hr/summary"]); toast({ title: "تم تسجيل الحضور" }); },
    onError: (e: any) => toast({ title: "تعذّر التسجيل", description: String(e.message), variant: "destructive" }),
  });

  /* ---------------- leave modal ---------------- */
  const [lvOpen, setLvOpen] = useState(false);
  const [lvForm, setLvForm] = useState<any>({});
  const lvSave = useMutation({
    mutationFn: async (data: any) => {
      const days = data.start_date && data.end_date
        ? Math.max(1, (new Date(data.end_date).getTime() - new Date(data.start_date).getTime()) / 86400000 + 1)
        : 1;
      return (await apiRequest("POST", "/api/leaves", { ...data, days })).json();
    },
    onSuccess: () => { setLvOpen(false); invalidate(["/api/leaves", "/api/hr/summary"]); toast({ title: "تم إرسال طلب الإجازة" }); },
    onError: (e: any) => toast({ title: "تعذّر الحفظ", description: String(e.message), variant: "destructive" }),
  });
  const lvStatus = useMutation({
    mutationFn: async ({ id, status }: any) => (await apiRequest("PATCH", `/api/leaves/${id}`, { status, approved_by: "المسؤول" })).json(),
    onSuccess: () => { invalidate(["/api/leaves", "/api/hr/summary"]); toast({ title: "تم تحديث حالة الطلب" }); },
  });

  /* ---------------- performance modal ---------------- */
  const CRIT = ["الالتزام بالمواعيد", "جودة العمل", "العمل الجماعي", "المبادرة والإبتكار", "احترام الإجراءات"];
  const [prOpen, setPrOpen] = useState(false);
  const [prForm, setPrForm] = useState<any>({ scores: {} });
  const prSave = useMutation({
    mutationFn: async (data: any) => {
      const criteria = CRIT.map((name) => ({ name, score: +(data.scores?.[name] || 0) }));
      const total = +(criteria.reduce((a, b) => a + b.score, 0) / criteria.length).toFixed(2);
      return (await apiRequest("POST", "/api/performance", {
        employee_id: data.employee_id, period: data.period, notes: data.notes || "",
        reviewer: data.reviewer || "الإدارة", criteria: JSON.stringify(criteria), total_score: total,
      })).json();
    },
    onSuccess: () => { setPrOpen(false); invalidate(["/api/performance", "/api/hr/summary"]); toast({ title: "تم تسجيل التقييم" }); },
    onError: (e: any) => toast({ title: "تعذّر الحفظ", description: String(e.message), variant: "destructive" }),
  });

  const perfChart = (employees.data || []).map((e) => {
    const rows = (perf.data || []).filter((p) => p.employee_id === e.id);
    const avg = rows.length ? rows.reduce((a, b) => a + b.total_score, 0) / rows.length : 0;
    return { name: `${e.first_name}`, علامة: +avg.toFixed(2) };
  });

  const empSelect = (value: any, onChange: (v: string) => void) => (
    <Select value={value ? String(value) : ""} onValueChange={onChange}>
      <SelectTrigger data-testid="select-employee"><SelectValue placeholder="اختر الموظف" /></SelectTrigger>
      <SelectContent>
        {(employees.data || []).map((e) => (
          <SelectItem key={e.id} value={String(e.id)}>{e.matricule} — {e.first_name} {e.last_name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  return (
    <AppShell
      title="الموارد البشرية"
      subtitle="ملفات الموظفين، الحضور والانصراف، الإجازات، وتقييم الأداء"
      actions={writable ? (
        <Button size="sm" onClick={() => openEmp()} data-testid="button-add-employee">
          <UserPlus className="me-1.5 h-4 w-4" /> موظف جديد
        </Button>
      ) : null}
    >
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="الموظفون النشطون" value={fmtNum(summary.data?.total)} testId="kpi-hr-total" />
        <KpiCard label="كتلة الأجور الأساسية" value={fmtDZD((employees.data || []).reduce((a, e) => a + e.base_salary + e.allowances, 0))} testId="kpi-hr-payroll" />
        <KpiCard label="طلبات إجازة معلّقة" value={fmtNum(summary.data?.pendingLeaves)} tone="warning" testId="kpi-hr-leaves" />
        <KpiCard label="متوسط علامة الأداء" value={`${summary.data?.avgScore ?? "—"} / 20`} testId="kpi-hr-score" />
      </div>

      <Tabs defaultValue="employees">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="employees" data-testid="tab-employees">الموظفون</TabsTrigger>
          <TabsTrigger value="attendance" data-testid="tab-attendance">الحضور والانصراف</TabsTrigger>
          <TabsTrigger value="leaves" data-testid="tab-leaves">الإجازات والغيابات</TabsTrigger>
          <TabsTrigger value="performance" data-testid="tab-performance">تقييم الأداء</TabsTrigger>
        </TabsList>

        <TabsContent value="employees">
          <DataTable
            testId="table-employees"
            rows={employees.data}
            isLoading={employees.isLoading}
            error={employees.error}
            onRetry={employees.refetch}
            searchKeys={["first_name", "last_name", "matricule", "position", "department"]}
            exportName="قائمة-الموظفين"
            emptyHint="أضف أول موظف للبدء"
            columns={[
              { key: "matricule", label: "الرقم", render: (r) => <span className="num">{r.matricule}</span> },
              { key: "name", label: "الاسم واللقب", render: (r) => <span className="font-medium">{r.first_name} {r.last_name}</span> },
              { key: "position", label: "المنصب" },
              { key: "department", label: "القسم", hideOnMobile: true },
              { key: "hire_date", label: "تاريخ التوظيف", hideOnMobile: true, render: (r) => <span className="num">{fmtDate(r.hire_date)}</span> },
              { key: "base_salary", label: "الراتب الأساسي", align: "end", render: (r) => <span className="num">{fmtDZD(r.base_salary)}</span> },
              { key: "cnas_number", label: "رقم CNAS", hideOnMobile: true, render: (r) => <span className="num text-xs">{r.cnas_number}</span> },
              { key: "status", label: "الحالة", render: (r) => <StatusBadge value={r.status} /> },
              ...(writable ? [{
                key: "actions", label: "إجراءات", align: "end" as const,
                render: (r: any) => (
                  <div className="flex justify-end gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openEmp(r)} data-testid={`button-edit-employee-${r.id}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 text-destructive"
                      onClick={() => { if (confirm(`حذف الموظف ${r.first_name} ${r.last_name}؟`)) empDelete.mutate(r.id); }}
                      data-testid={`button-delete-employee-${r.id}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ),
              }] : []),
            ]}
          />
        </TabsContent>

        <TabsContent value="attendance">
          <DataTable
            testId="table-attendance"
            rows={(attendance.data || []).map((a) => ({ ...a, employee: empName(a.employee_id) }))}
            isLoading={attendance.isLoading}
            error={attendance.error}
            onRetry={attendance.refetch}
            searchKeys={["employee", "date", "status"]}
            exportName="سجل-الحضور"
            pageSize={12}
            toolbar={writable ? (
              <Button size="sm" onClick={() => { setAttForm({ date: new Date().toISOString().slice(0, 10), status: "حاضر", check_in: "08:00", check_out: "16:30" }); setAttOpen(true); }} data-testid="button-add-attendance">
                <CalendarCheck className="me-1.5 h-4 w-4" /> تسجيل حضور
              </Button>
            ) : null}
            columns={[
              { key: "date", label: "التاريخ", render: (r) => <span className="num">{fmtDate(r.date)}</span> },
              { key: "employee", label: "الموظف" },
              { key: "check_in", label: "الدخول", render: (r) => <span className="num">{r.check_in || "—"}</span> },
              { key: "check_out", label: "الخروج", render: (r) => <span className="num">{r.check_out || "—"}</span> },
              { key: "hours", label: "الساعات", align: "end", render: (r) => <span className="num">{fmtNum(r.hours, 1)}</span> },
              { key: "status", label: "الحالة", render: (r) => <StatusBadge value={r.status} /> },
              { key: "notes", label: "ملاحظات", hideOnMobile: true },
            ]}
          />
        </TabsContent>

        <TabsContent value="leaves">
          <DataTable
            testId="table-leaves"
            rows={(leaves.data || []).map((l) => ({ ...l, employee: empName(l.employee_id) }))}
            isLoading={leaves.isLoading}
            error={leaves.error}
            onRetry={leaves.refetch}
            searchKeys={["employee", "type", "status", "reason"]}
            exportName="الإجازات"
            toolbar={writable ? (
              <Button size="sm" onClick={() => { setLvForm({ type: "سنوية", status: "قيد الانتظار", start_date: new Date().toISOString().slice(0, 10), end_date: new Date().toISOString().slice(0, 10) }); setLvOpen(true); }} data-testid="button-add-leave">
                <Plus className="me-1.5 h-4 w-4" /> طلب إجازة
              </Button>
            ) : null}
            columns={[
              { key: "employee", label: "الموظف" },
              { key: "type", label: "النوع" },
              { key: "start_date", label: "من", render: (r) => <span className="num">{fmtDate(r.start_date)}</span> },
              { key: "end_date", label: "إلى", render: (r) => <span className="num">{fmtDate(r.end_date)}</span> },
              { key: "days", label: "الأيام", align: "end", render: (r) => <span className="num">{fmtNum(r.days)}</span> },
              { key: "reason", label: "السبب", hideOnMobile: true },
              { key: "status", label: "الحالة", render: (r) => <StatusBadge value={r.status} /> },
              ...(writable ? [{
                key: "actions", label: "قرار", align: "end" as const,
                render: (r: any) => r.status === "قيد الانتظار" ? (
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" className="h-8" onClick={() => lvStatus.mutate({ id: r.id, status: "مقبولة" })} data-testid={`button-approve-leave-${r.id}`}>موافقة</Button>
                    <Button size="sm" variant="outline" className="h-8 text-destructive" onClick={() => lvStatus.mutate({ id: r.id, status: "مرفوضة" })} data-testid={`button-reject-leave-${r.id}`}>رفض</Button>
                  </div>
                ) : <span className="text-xs text-muted-foreground">{r.approved_by || "—"}</span>,
              }] : []),
            ]}
          />
        </TabsContent>

        <TabsContent value="performance">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <SectionTitle title="متوسط علامات الأداء" subtitle="من 20 لكل موظف" />
              <div className="h-[280px]" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={perfChart} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} interval={0} angle={-30} height={50} textAnchor="end" />
                    <YAxis domain={[0, 20]} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={30} />
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12, direction: "rtl" }} />
                    <Bar dataKey="علامة" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <div>
              <DataTable
                testId="table-performance"
                rows={(perf.data || []).map((p) => ({ ...p, employee: empName(p.employee_id) }))}
                isLoading={perf.isLoading}
                error={perf.error}
                onRetry={perf.refetch}
                searchKeys={["employee", "period"]}
                exportName="تقييم-الأداء"
                pageSize={8}
                toolbar={writable ? (
                  <Button size="sm" onClick={() => { setPrForm({ period: "2026-S2", scores: {} }); setPrOpen(true); }} data-testid="button-add-review">
                    <Star className="me-1.5 h-4 w-4" /> تقييم جديد
                  </Button>
                ) : null}
                columns={[
                  { key: "employee", label: "الموظف" },
                  { key: "period", label: "الفترة", render: (r) => <span className="num">{r.period}</span> },
                  { key: "total_score", label: "العلامة", align: "end", render: (r) => <span className="num font-semibold">{fmtNum(r.total_score, 2)} / 20</span> },
                  { key: "reviewer", label: "المُقيِّم", hideOnMobile: true },
                  { key: "notes", label: "ملاحظات", hideOnMobile: true },
                ]}
              />
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* ------- employee modal ------- */}
      <ModalForm
        open={empOpen} onOpenChange={setEmpOpen} wide
        title={empForm.id ? "تعديل ملف موظف" : "موظف جديد"}
        description="المعلومات الإدارية وبيانات الراتب و CNAS"
        submitting={empSave.isPending}
        onSubmit={() => empSave.mutate(empForm)}
      >
        <Field label="الرقم (المصفوفة)"><Input value={empForm.matricule || ""} onChange={(e) => setEmpForm({ ...empForm, matricule: e.target.value })} data-testid="input-matricule" required /></Field>
        <Field label="الاسم"><Input value={empForm.first_name || ""} onChange={(e) => setEmpForm({ ...empForm, first_name: e.target.value })} data-testid="input-firstname" required /></Field>
        <Field label="اللقب"><Input value={empForm.last_name || ""} onChange={(e) => setEmpForm({ ...empForm, last_name: e.target.value })} data-testid="input-lastname" required /></Field>
        <Field label="رقم التعريف الوطني"><Input value={empForm.national_id || ""} onChange={(e) => setEmpForm({ ...empForm, national_id: e.target.value })} /></Field>
        <Field label="المنصب"><Input value={empForm.position || ""} onChange={(e) => setEmpForm({ ...empForm, position: e.target.value })} data-testid="input-position" /></Field>
        <Field label="القسم">
          <Select value={empForm.department || ""} onValueChange={(v) => setEmpForm({ ...empForm, department: v })}>
            <SelectTrigger data-testid="select-department"><SelectValue placeholder="اختر القسم" /></SelectTrigger>
            <SelectContent>{DEPTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="تاريخ التوظيف"><Input type="date" value={empForm.hire_date || ""} onChange={(e) => setEmpForm({ ...empForm, hire_date: e.target.value })} /></Field>
        <Field label="نوع العقد">
          <Select value={empForm.contract_type || "دائم"} onValueChange={(v) => setEmpForm({ ...empForm, contract_type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="دائم">دائم</SelectItem><SelectItem value="محدد المدة">محدد المدة</SelectItem><SelectItem value="تدريب">تدريب</SelectItem></SelectContent>
          </Select>
        </Field>
        <Field label="الراتب الأساسي (د.ج)"><Input type="number" value={empForm.base_salary ?? ""} onChange={(e) => setEmpForm({ ...empForm, base_salary: +e.target.value })} data-testid="input-base-salary" /></Field>
        <Field label="المنح والعلاوات (د.ج)"><Input type="number" value={empForm.allowances ?? ""} onChange={(e) => setEmpForm({ ...empForm, allowances: +e.target.value })} /></Field>
        <Field label="رقم CNAS"><Input value={empForm.cnas_number || ""} onChange={(e) => setEmpForm({ ...empForm, cnas_number: e.target.value })} /></Field>
        <Field label="الهاتف"><Input value={empForm.phone || ""} onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })} /></Field>
        <Field label="البريد الإلكتروني"><Input value={empForm.email || ""} onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })} /></Field>
        <Field label="الحساب البنكي (RIB)"><Input value={empForm.bank_account || ""} onChange={(e) => setEmpForm({ ...empForm, bank_account: e.target.value })} /></Field>
        <Field label="الحالة">
          <Select value={empForm.status || "نشط"} onValueChange={(v) => setEmpForm({ ...empForm, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="نشط">نشط</SelectItem><SelectItem value="موقوف">موقوف</SelectItem><SelectItem value="مُنتهي">مُنتهي</SelectItem></SelectContent>
          </Select>
        </Field>
        <Field label="العنوان" full><Input value={empForm.address || ""} onChange={(e) => setEmpForm({ ...empForm, address: e.target.value })} /></Field>
      </ModalForm>

      {/* ------- attendance modal ------- */}
      <ModalForm
        open={attOpen} onOpenChange={setAttOpen} title="تسجيل حضور يومي"
        submitting={attSave.isPending} onSubmit={() => attSave.mutate(attForm)}
      >
        <Field label="الموظف" full>{empSelect(attForm.employee_id, (v) => setAttForm({ ...attForm, employee_id: +v }))}</Field>
        <Field label="التاريخ"><Input type="date" value={attForm.date || ""} onChange={(e) => setAttForm({ ...attForm, date: e.target.value })} required /></Field>
        <Field label="الحالة">
          <Select value={attForm.status || "حاضر"} onValueChange={(v) => setAttForm({ ...attForm, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="حاضر">حاضر</SelectItem><SelectItem value="متأخر">متأخر</SelectItem><SelectItem value="غائب">غائب</SelectItem><SelectItem value="مهمة">مهمة</SelectItem></SelectContent>
          </Select>
        </Field>
        <Field label="ساعة الدخول"><Input type="time" value={attForm.check_in || ""} onChange={(e) => setAttForm({ ...attForm, check_in: e.target.value })} /></Field>
        <Field label="ساعة الخروج"><Input type="time" value={attForm.check_out || ""} onChange={(e) => setAttForm({ ...attForm, check_out: e.target.value })} /></Field>
        <Field label="ملاحظات" full><Input value={attForm.notes || ""} onChange={(e) => setAttForm({ ...attForm, notes: e.target.value })} /></Field>
      </ModalForm>

      {/* ------- leave modal ------- */}
      <ModalForm
        open={lvOpen} onOpenChange={setLvOpen} title="طلب إجازة / غياب"
        submitting={lvSave.isPending} onSubmit={() => lvSave.mutate(lvForm)}
      >
        <Field label="الموظف" full>{empSelect(lvForm.employee_id, (v) => setLvForm({ ...lvForm, employee_id: +v }))}</Field>
        <Field label="النوع">
          <Select value={lvForm.type || "سنوية"} onValueChange={(v) => setLvForm({ ...lvForm, type: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["سنوية", "مرضية", "استثنائية", "بدون أجر", "أمومة"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="الحالة">
          <Select value={lvForm.status || "قيد الانتظار"} onValueChange={(v) => setLvForm({ ...lvForm, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["قيد الانتظار", "مقبولة", "مرفوضة"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="من تاريخ"><Input type="date" value={lvForm.start_date || ""} onChange={(e) => setLvForm({ ...lvForm, start_date: e.target.value })} required /></Field>
        <Field label="إلى تاريخ"><Input type="date" value={lvForm.end_date || ""} onChange={(e) => setLvForm({ ...lvForm, end_date: e.target.value })} required /></Field>
        <Field label="السبب" full><Textarea value={lvForm.reason || ""} onChange={(e) => setLvForm({ ...lvForm, reason: e.target.value })} /></Field>
      </ModalForm>

      {/* ------- performance modal ------- */}
      <ModalForm
        open={prOpen} onOpenChange={setPrOpen} title="تقييم أداء" wide
        submitting={prSave.isPending} onSubmit={() => prSave.mutate(prForm)}
      >
        <Field label="الموظف">{empSelect(prForm.employee_id, (v) => setPrForm({ ...prForm, employee_id: +v }))}</Field>
        <Field label="الفترة"><Input value={prForm.period || ""} onChange={(e) => setPrForm({ ...prForm, period: e.target.value })} placeholder="2026-S2" /></Field>
        {CRIT.map((c) => (
          <Field key={c} label={`${c} (من 20)`}>
            <Input type="number" min={0} max={20} value={prForm.scores?.[c] ?? ""} onChange={(e) => setPrForm({ ...prForm, scores: { ...prForm.scores, [c]: +e.target.value } })} />
          </Field>
        ))}
        <Field label="ملاحظات" full><Textarea value={prForm.notes || ""} onChange={(e) => setPrForm({ ...prForm, notes: e.target.value })} /></Field>
      </ModalForm>
    </AppShell>
  );
}
