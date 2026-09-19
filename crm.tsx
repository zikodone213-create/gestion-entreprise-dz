import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Building2, MessageSquarePlus, Pencil, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppShell } from "@/components/shell";
import { DataTable, Field, KpiCard, ModalForm, SectionTitle, StatusBadge, TableReport } from "@/components/kit";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { fmtDZD, fmtDate, fmtNum, useAuth } from "@/lib/erp";
import { useToast } from "@/hooks/use-toast";

const INTERACTION_KINDS = ["مكالمة", "زيارة", "بريد إلكتروني", "اجتماع", "عرض سعر"];
const COMPLAINT_STATUS = ["جديدة", "قيد المعالجة", "محلولة", "مرفوضة"];
const PRIORITIES = ["منخفضة", "متوسطة", "عالية"];
const CLIENT_TYPES = ["شركة", "إدارة عمومية", "خاص"];

export default function CrmPage() {
  const { can } = useAuth();
  const { toast } = useToast();
  const writable = can("crm", "write");

  const clients = useQuery<any[]>({ queryKey: ["/api/clients"] });
  const complaints = useQuery<any[]>({ queryKey: ["/api/complaints"] });
  const interactions = useQuery<any[]>({ queryKey: ["/api/interactions"] });
  const company = useQuery<any>({ queryKey: ["/api/settings"] });
  const [printClients, setPrintClients] = useState(false);

  const [detailId, setDetailId] = useState<number | null>(null);
  const detail = useQuery<any>({ queryKey: [`/api/crm/clients/${detailId}/history`], enabled: !!detailId });

  const invalidate = (keys: string[]) => keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  const err = (e: any) => toast({ title: "تعذّر تنفيذ العملية", description: String(e.message), variant: "destructive" });
  const clientName = (id: number) => clients.data?.find((c) => c.id === id)?.name || "—";

  /* ---------------- client modal ---------------- */
  const [clOpen, setClOpen] = useState(false);
  const [clForm, setClForm] = useState<any>({});
  const openClient = (row?: any) => { setClForm(row ? { ...row } : { type: "شركة", credit_limit: 0 }); setClOpen(true); };
  const clSave = useMutation({
    mutationFn: async (d: any) =>
      (d.id ? await apiRequest("PATCH", `/api/clients/${d.id}`, d) : await apiRequest("POST", "/api/clients", d)).json(),
    onSuccess: () => { setClOpen(false); invalidate(["/api/clients"]); toast({ title: "تم حفظ بطاقة العميل" }); },
    onError: err,
  });
  const clDelete = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/clients/${id}`)).json(),
    onSuccess: () => { invalidate(["/api/clients"]); setDetailId(null); toast({ title: "تم حذف العميل" }); },
    onError: err,
  });

  /* ---------------- interaction modal ---------------- */
  const [itOpen, setItOpen] = useState(false);
  const [itForm, setItForm] = useState<any>({});
  const openInteraction = (clientId?: number) => {
    setItForm({ client_id: clientId, kind: INTERACTION_KINDS[0], date: new Date().toISOString().slice(0, 10) });
    setItOpen(true);
  };
  const itSave = useMutation({
    mutationFn: async (d: any) => (await apiRequest("POST", "/api/interactions", d)).json(),
    onSuccess: () => {
      setItOpen(false);
      invalidate(["/api/interactions", `/api/crm/clients/${detailId}/history`]);
      toast({ title: "تم تسجيل التعامل" });
    },
    onError: err,
  });

  /* ---------------- complaint modal ---------------- */
  const [cpOpen, setCpOpen] = useState(false);
  const [cpForm, setCpForm] = useState<any>({});
  const openComplaint = (row?: any, clientId?: number) => {
    setCpForm(row ? { ...row } : { client_id: clientId, status: "جديدة", priority: "متوسطة", date: new Date().toISOString().slice(0, 10) });
    setCpOpen(true);
  };
  const cpSave = useMutation({
    mutationFn: async (d: any) =>
      (d.id ? await apiRequest("PATCH", `/api/complaints/${d.id}`, d) : await apiRequest("POST", "/api/complaints", d)).json(),
    onSuccess: () => {
      setCpOpen(false);
      invalidate(["/api/complaints", `/api/crm/clients/${detailId}/history`]);
      toast({ title: "تم حفظ الشكوى" });
    },
    onError: err,
  });
  const cpStatus = useMutation({
    mutationFn: async ({ id, status }: any) => (await apiRequest("PATCH", `/api/complaints/${id}`, { status })).json(),
    onSuccess: () => { invalidate(["/api/complaints", `/api/crm/clients/${detailId}/history`]); toast({ title: "تم تحديث حالة الشكوى" }); },
    onError: err,
  });

  /* ---------------- client detail view ---------------- */
  if (detailId) {
    const d = detail.data;
    const c = d?.client;
    return (
      <AppShell
        title={c ? `ملف العميل — ${c.name}` : "ملف العميل"}
        subtitle="تاريخ التعاملات: الفواتير، المدفوعات، الاتصالات، والشكاوى"
        actions={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setDetailId(null)} data-testid="button-back-clients">
              <ArrowRight className="me-1.5 h-4 w-4" /> رجوع للقائمة
            </Button>
            {writable && (
              <>
                <Button size="sm" variant="outline" onClick={() => openInteraction(detailId)} data-testid="button-add-interaction-detail">
                  <MessageSquarePlus className="me-1.5 h-4 w-4" /> تعامل جديد
                </Button>
                <Button size="sm" onClick={() => openComplaint(undefined, detailId)} data-testid="button-add-complaint-detail">
                  <Plus className="me-1.5 h-4 w-4" /> شكوى
                </Button>
              </>
            )}
          </div>
        }
      >
        <div className="mb-5 grid gap-4 lg:grid-cols-3">
          <Card className="p-4 lg:col-span-1">
            <SectionTitle title="البيانات الجبائية والتجارية" />
            <dl className="space-y-1.5 text-sm">
              {[
                ["نوع العميل", c?.type],
                ["NIF", c?.nif],
                ["NIS", c?.nis],
                ["السجل التجاري RC", c?.rc],
                ["رقم المادة AI", c?.ai],
                ["العنوان", c?.address],
                ["الولاية", c?.city],
                ["الهاتف", c?.phone],
                ["البريد الإلكتروني", c?.email],
                ["جهة الاتصال", c?.contact],
                ["سقف الائتمان", c ? fmtDZD(c.credit_limit) : ""],
              ].map(([k, v]) => (
                <div key={String(k)} className="flex items-start justify-between gap-3 border-b border-border pb-1.5">
                  <dt className="text-xs text-muted-foreground">{k}</dt>
                  <dd className="num text-end text-xs font-medium">{v || "—"}</dd>
                </div>
              ))}
            </dl>
            {writable && (
              <Button size="sm" variant="outline" className="mt-3" onClick={() => openClient(c)} data-testid="button-edit-client-detail">
                <Pencil className="me-1.5 h-4 w-4" /> تعديل البطاقة
              </Button>
            )}
          </Card>

          <div className="grid grid-cols-2 gap-3 lg:col-span-2 lg:grid-cols-3">
            <KpiCard label="عدد الفواتير" value={fmtNum(d?.totals?.invoices_count)} testId="kpi-client-invoices" />
            <KpiCard label="رقم الأعمال (HT)" value={fmtDZD(d?.totals?.revenue_ht)} tone="positive" testId="kpi-client-revenue" />
            <KpiCard label="بالرسم (TTC)" value={fmtDZD(d?.totals?.revenue_ttc)} testId="kpi-client-ttc" />
            <KpiCard label="المحصَّل" value={fmtDZD(d?.totals?.paid)} testId="kpi-client-paid" />
            <KpiCard label="الرصيد المستحق" value={fmtDZD(d?.totals?.outstanding)} tone="warning" testId="kpi-client-outstanding" />
            <KpiCard label="شكاوى مفتوحة" value={fmtNum(d?.totals?.open_complaints)} tone={d?.totals?.open_complaints ? "danger" : "default"} testId="kpi-client-complaints" />
          </div>
        </div>

        <Tabs key="client-detail" defaultValue="invoices">
          <TabsList className="mb-4 flex-wrap">
            <TabsTrigger value="invoices" data-testid="tab-client-invoices">الفواتير</TabsTrigger>
            <TabsTrigger value="payments" data-testid="tab-client-payments">المدفوعات</TabsTrigger>
            <TabsTrigger value="interactions" data-testid="tab-client-interactions">التعاملات</TabsTrigger>
            <TabsTrigger value="complaints" data-testid="tab-client-complaints">الشكاوى</TabsTrigger>
          </TabsList>

          <TabsContent value="invoices">
            <DataTable
              testId="table-client-invoices"
              rows={d?.invoices}
              isLoading={detail.isLoading}
              error={detail.error}
              searchKeys={["number", "status"]}
              exportName={`فواتير-${c?.name || ""}`}
              pageSize={10}
              columns={[
                { key: "number", label: "الرقم", render: (r) => <span className="num text-xs font-semibold">{r.number}</span> },
                { key: "date", label: "التاريخ", render: (r) => <span className="num">{fmtDate(r.date)}</span> },
                { key: "kind", label: "النوع", hideOnMobile: true },
                { key: "total_ht", label: "خارج الرسم", align: "end", render: (r) => <span className="num">{fmtNum(r.total_ht)}</span> },
                { key: "total_ttc", label: "الإجمالي", align: "end", render: (r) => <span className="num font-semibold">{fmtNum(r.total_ttc)}</span> },
                { key: "paid_amount", label: "المدفوع", align: "end", render: (r) => <span className="num">{fmtNum(r.paid_amount)}</span> },
                { key: "status", label: "الحالة", render: (r) => <StatusBadge value={r.status} /> },
              ]}
            />
          </TabsContent>

          <TabsContent value="payments">
            <DataTable
              testId="table-client-payments"
              rows={d?.payments}
              isLoading={detail.isLoading}
              searchKeys={["invoice_number", "method", "ref"]}
              exportName={`مدفوعات-${c?.name || ""}`}
              pageSize={10}
              columns={[
                { key: "date", label: "التاريخ", render: (r) => <span className="num">{fmtDate(r.date)}</span> },
                { key: "invoice_number", label: "الفاتورة", render: (r) => <span className="num text-xs">{r.invoice_number || "—"}</span> },
                { key: "amount", label: "المبلغ", align: "end", render: (r) => <span className="num font-semibold">{fmtNum(r.amount)}</span> },
                { key: "method", label: "الطريقة" },
                { key: "ref", label: "المرجع", hideOnMobile: true, render: (r) => <span className="num text-xs">{r.ref || "—"}</span> },
              ]}
            />
          </TabsContent>

          <TabsContent value="interactions">
            <DataTable
              testId="table-client-interactions"
              rows={d?.interactions}
              isLoading={detail.isLoading}
              searchKeys={["subject", "kind"]}
              exportName={`تعاملات-${c?.name || ""}`}
              pageSize={10}
              columns={[
                { key: "date", label: "التاريخ", render: (r) => <span className="num">{fmtDate(r.date)}</span> },
                { key: "kind", label: "النوع", render: (r) => <StatusBadge value={r.kind} /> },
                { key: "subject", label: "الموضوع", render: (r) => <span className="font-medium">{r.subject}</span> },
                { key: "notes", label: "الملاحظات" },
              ]}
              emptyHint="سجّل مكالمات وزيارات العميل لمتابعة العلاقة التجارية"
            />
          </TabsContent>

          <TabsContent value="complaints">
            <DataTable
              testId="table-client-complaints"
              rows={d?.complaints}
              isLoading={detail.isLoading}
              searchKeys={["subject", "status"]}
              exportName={`شكاوى-${c?.name || ""}`}
              pageSize={10}
              columns={[
                { key: "date", label: "التاريخ", render: (r) => <span className="num">{fmtDate(r.date)}</span> },
                { key: "subject", label: "الموضوع", render: (r) => <span className="font-medium">{r.subject}</span> },
                { key: "priority", label: "الأولوية" },
                { key: "status", label: "الحالة", render: (r) => <StatusBadge value={r.status} /> },
                { key: "resolution", label: "المعالجة", hideOnMobile: true },
                ...(writable ? [{
                  key: "actions", label: "إجراء", align: "end" as const,
                  render: (r: any) => (
                    <Button variant="outline" size="sm" className="h-8" onClick={() => openComplaint(r)} data-testid={`button-edit-complaint-detail-${r.id}`}>
                      <Pencil className="me-1 h-3.5 w-3.5" /> معالجة
                    </Button>
                  ),
                }] : []),
              ]}
            />
          </TabsContent>
        </Tabs>

        {/* modals shared */}
        {renderModals()}
      </AppShell>
    );
  }

  /* ---------------- modals renderer (shared between views) ---------------- */
  function renderModals() {
    return (
      <>
        <ModalForm
          open={clOpen} onOpenChange={setClOpen}
          title={clForm.id ? `تعديل العميل ${clForm.name || ""}` : "عميل جديد"}
          description="البيانات الجبائية (NIF / NIS / RC) إلزامية في الفواتير الجزائرية"
          submitting={clSave.isPending}
          onSubmit={() => clSave.mutate(clForm)}
          wide
        >
          <Field label="اسم العميل" full>
            <Input value={clForm.name || ""} onChange={(e) => setClForm({ ...clForm, name: e.target.value })} required data-testid="input-client-name" />
          </Field>
          <Field label="نوع العميل">
            <Select value={clForm.type || "شركة"} onValueChange={(v) => setClForm({ ...clForm, type: v })}>
              <SelectTrigger data-testid="select-client-type"><SelectValue /></SelectTrigger>
              <SelectContent>{CLIENT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="NIF">
            <Input value={clForm.nif || ""} onChange={(e) => setClForm({ ...clForm, nif: e.target.value })} data-testid="input-client-nif" />
          </Field>
          <Field label="NIS">
            <Input value={clForm.nis || ""} onChange={(e) => setClForm({ ...clForm, nis: e.target.value })} data-testid="input-client-nis" />
          </Field>
          <Field label="السجل التجاري RC">
            <Input value={clForm.rc || ""} onChange={(e) => setClForm({ ...clForm, rc: e.target.value })} data-testid="input-client-rc" />
          </Field>
          <Field label="رقم المادة AI">
            <Input value={clForm.ai || ""} onChange={(e) => setClForm({ ...clForm, ai: e.target.value })} />
          </Field>
          <Field label="الولاية">
            <Input value={clForm.city || ""} onChange={(e) => setClForm({ ...clForm, city: e.target.value })} />
          </Field>
          <Field label="الهاتف">
            <Input value={clForm.phone || ""} onChange={(e) => setClForm({ ...clForm, phone: e.target.value })} data-testid="input-client-phone" />
          </Field>
          <Field label="البريد الإلكتروني">
            <Input value={clForm.email || ""} onChange={(e) => setClForm({ ...clForm, email: e.target.value })} />
          </Field>
          <Field label="جهة الاتصال">
            <Input value={clForm.contact || ""} onChange={(e) => setClForm({ ...clForm, contact: e.target.value })} />
          </Field>
          <Field label="سقف الائتمان (د.ج)">
            <Input type="number" value={clForm.credit_limit ?? 0} onChange={(e) => setClForm({ ...clForm, credit_limit: +e.target.value })} />
          </Field>
          <Field label="العنوان" full>
            <Textarea value={clForm.address || ""} onChange={(e) => setClForm({ ...clForm, address: e.target.value })} />
          </Field>
        </ModalForm>

        <ModalForm
          open={itOpen} onOpenChange={setItOpen}
          title="تسجيل تعامل مع العميل"
          submitting={itSave.isPending}
          onSubmit={() => itSave.mutate(itForm)}
        >
          <Field label="العميل" full>
            <Select value={itForm.client_id ? String(itForm.client_id) : ""} onValueChange={(v) => setItForm({ ...itForm, client_id: +v })}>
              <SelectTrigger data-testid="select-interaction-client"><SelectValue placeholder="اختر العميل" /></SelectTrigger>
              <SelectContent>{(clients.data || []).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="النوع">
            <Select value={itForm.kind || INTERACTION_KINDS[0]} onValueChange={(v) => setItForm({ ...itForm, kind: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{INTERACTION_KINDS.map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="التاريخ">
            <Input type="date" value={itForm.date || ""} onChange={(e) => setItForm({ ...itForm, date: e.target.value })} required />
          </Field>
          <Field label="الموضوع" full>
            <Input value={itForm.subject || ""} onChange={(e) => setItForm({ ...itForm, subject: e.target.value })} required data-testid="input-interaction-subject" />
          </Field>
          <Field label="الملاحظات" full>
            <Textarea value={itForm.notes || ""} onChange={(e) => setItForm({ ...itForm, notes: e.target.value })} />
          </Field>
        </ModalForm>

        <ModalForm
          open={cpOpen} onOpenChange={setCpOpen}
          title={cpForm.id ? "معالجة شكوى" : "شكوى جديدة"}
          submitting={cpSave.isPending}
          onSubmit={() => cpSave.mutate(cpForm)}
          wide
        >
          <Field label="العميل" full>
            <Select value={cpForm.client_id ? String(cpForm.client_id) : ""} onValueChange={(v) => setCpForm({ ...cpForm, client_id: +v })}>
              <SelectTrigger data-testid="select-complaint-client"><SelectValue placeholder="اختر العميل" /></SelectTrigger>
              <SelectContent>{(clients.data || []).map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="الموضوع" full>
            <Input value={cpForm.subject || ""} onChange={(e) => setCpForm({ ...cpForm, subject: e.target.value })} required data-testid="input-complaint-subject" />
          </Field>
          <Field label="التاريخ">
            <Input type="date" value={cpForm.date || ""} onChange={(e) => setCpForm({ ...cpForm, date: e.target.value })} required />
          </Field>
          <Field label="الأولوية">
            <Select value={cpForm.priority || "متوسطة"} onValueChange={(v) => setCpForm({ ...cpForm, priority: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{PRIORITIES.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="الحالة">
            <Select value={cpForm.status || "جديدة"} onValueChange={(v) => setCpForm({ ...cpForm, status: v })}>
              <SelectTrigger data-testid="select-complaint-status"><SelectValue /></SelectTrigger>
              <SelectContent>{COMPLAINT_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="الوصف" full>
            <Textarea value={cpForm.description || ""} onChange={(e) => setCpForm({ ...cpForm, description: e.target.value })} />
          </Field>
          <Field label="المعالجة / الحل" full>
            <Textarea value={cpForm.resolution || ""} onChange={(e) => setCpForm({ ...cpForm, resolution: e.target.value })} data-testid="input-complaint-resolution" />
          </Field>
        </ModalForm>
      </>
    );
  }

  const openComplaints = (complaints.data || []).filter((c) => c.status !== "محلولة" && c.status !== "مرفوضة");

  return (
    <AppShell
      title="العملاء (CRM)"
      subtitle="قاعدة العملاء بالبيانات الجبائية، ملف كل عميل بتاريخ تعاملاته، ومتابعة الشكاوى"
      actions={writable ? (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => openInteraction()} data-testid="button-add-interaction">
            <MessageSquarePlus className="me-1.5 h-4 w-4" /> تعامل
          </Button>
          <Button size="sm" onClick={() => openClient()} data-testid="button-add-client">
            <Plus className="me-1.5 h-4 w-4" /> عميل جديد
          </Button>
        </div>
      ) : null}
    >
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="عدد العملاء" value={fmtNum(clients.data?.length || 0)} icon={<Users className="h-4 w-4" />} testId="kpi-crm-clients" />
        <KpiCard label="شركات" value={fmtNum((clients.data || []).filter((c) => c.type === "شركة").length)} icon={<Building2 className="h-4 w-4" />} testId="kpi-crm-companies" />
        <KpiCard label="التعاملات المسجّلة" value={fmtNum(interactions.data?.length || 0)} testId="kpi-crm-interactions" />
        <KpiCard label="شكاوى مفتوحة" value={fmtNum(openComplaints.length)} tone={openComplaints.length ? "warning" : "default"} testId="kpi-crm-complaints" />
      </div>

      <Tabs key="crm-list" defaultValue="clients">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="clients" data-testid="tab-clients">قاعدة العملاء</TabsTrigger>
          <TabsTrigger value="interactions" data-testid="tab-interactions">التعاملات</TabsTrigger>
          <TabsTrigger value="complaints" data-testid="tab-complaints">الشكاوى</TabsTrigger>
        </TabsList>

        <TabsContent value="clients">
          <DataTable
            testId="table-clients"
            rows={clients.data}
            isLoading={clients.isLoading}
            error={clients.error}
            onRetry={clients.refetch}
            searchKeys={["name", "nif", "rc", "city", "phone"]}
            exportName="العملاء"
            pageSize={12}
            onPrint={() => setPrintClients(true)}
            onRowClick={(r) => setDetailId(r.id)}
            emptyHint="أضف عميلاً لتتمكن من إصدار الفواتير"
            columns={[
              { key: "name", label: "العميل", render: (r) => <span className="font-medium">{r.name}</span> },
              { key: "type", label: "النوع", hideOnMobile: true },
              { key: "nif", label: "NIF", render: (r) => <span className="num text-xs">{r.nif || "—"}</span> },
              { key: "nis", label: "NIS", hideOnMobile: true, render: (r) => <span className="num text-xs">{r.nis || "—"}</span> },
              { key: "rc", label: "السجل التجاري", hideOnMobile: true, render: (r) => <span className="num text-xs">{r.rc || "—"}</span> },
              { key: "city", label: "الولاية" },
              { key: "phone", label: "الهاتف", render: (r) => <span className="num text-xs">{r.phone || "—"}</span> },
              { key: "credit_limit", label: "سقف الائتمان", align: "end", hideOnMobile: true, render: (r) => <span className="num">{fmtNum(r.credit_limit)}</span> },
              {
                key: "actions", label: "إجراءات", align: "end",
                render: (r: any) => (
                  <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="outline" size="sm" className="h-8" onClick={() => setDetailId(r.id)} data-testid={`button-open-client-${r.id}`}>
                      الملف
                    </Button>
                    {writable && (
                      <>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openClient(r)} data-testid={`button-edit-client-${r.id}`}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="outline" size="icon" className="h-8 w-8 text-destructive"
                          onClick={() => { if (confirm(`حذف العميل ${r.name}؟ ستُحذف تعاملاته وشكاويه.`)) clDelete.mutate(r.id); }}
                          data-testid={`button-delete-client-${r.id}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                  </div>
                ),
              },
            ]}
          />
        </TabsContent>

        <TabsContent value="interactions">
          <DataTable
            testId="table-interactions"
            rows={(interactions.data || []).map((i) => ({ ...i, client: clientName(i.client_id) }))}
            isLoading={interactions.isLoading}
            error={interactions.error}
            onRetry={interactions.refetch}
            searchKeys={["client", "subject", "kind"]}
            exportName="التعاملات"
            pageSize={12}
            columns={[
              { key: "date", label: "التاريخ", render: (r) => <span className="num">{fmtDate(r.date)}</span> },
              { key: "client", label: "العميل", render: (r) => <span className="font-medium">{r.client}</span> },
              { key: "kind", label: "النوع", render: (r) => <StatusBadge value={r.kind} /> },
              { key: "subject", label: "الموضوع" },
              { key: "notes", label: "الملاحظات", hideOnMobile: true },
            ]}
            toolbar={writable ? (
              <Button size="sm" onClick={() => openInteraction()} data-testid="button-add-interaction-tab">
                <Plus className="me-1.5 h-4 w-4" /> تعامل جديد
              </Button>
            ) : null}
          />
        </TabsContent>

        <TabsContent value="complaints">
          <DataTable
            testId="table-complaints"
            rows={(complaints.data || []).map((c) => ({ ...c, client: clientName(c.client_id) }))}
            isLoading={complaints.isLoading}
            error={complaints.error}
            onRetry={complaints.refetch}
            searchKeys={["client", "subject", "status", "priority"]}
            exportName="الشكاوى"
            pageSize={12}
            columns={[
              { key: "date", label: "التاريخ", render: (r) => <span className="num">{fmtDate(r.date)}</span> },
              { key: "client", label: "العميل", render: (r) => <span className="font-medium">{r.client}</span> },
              { key: "subject", label: "الموضوع" },
              { key: "priority", label: "الأولوية", render: (r) => <StatusBadge value={r.priority} /> },
              { key: "status", label: "الحالة", render: (r) => <StatusBadge value={r.status} /> },
              { key: "resolution", label: "المعالجة", hideOnMobile: true },
              ...(writable ? [{
                key: "actions", label: "إجراءات", align: "end" as const,
                render: (r: any) => (
                  <div className="flex justify-end gap-1">
                    <Select value={r.status} onValueChange={(v) => cpStatus.mutate({ id: r.id, status: v })}>
                      <SelectTrigger className="h-8 w-[130px]" data-testid={`select-complaint-status-${r.id}`}><SelectValue /></SelectTrigger>
                      <SelectContent>{COMPLAINT_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openComplaint(r)} data-testid={`button-edit-complaint-${r.id}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ),
              }] : []),
            ]}
            toolbar={writable ? (
              <Button size="sm" onClick={() => openComplaint()} data-testid="button-add-complaint">
                <Plus className="me-1.5 h-4 w-4" /> شكوى جديدة
              </Button>
            ) : null}
          />
        </TabsContent>
      </Tabs>

      {printClients && (
        <TableReport
          title="قاعدة العملاء"
          company={company.data}
          rows={clients.data || []}
          onClose={() => setPrintClients(false)}
          columns={[
            { key: "name", label: "العميل" },
            { key: "type", label: "النوع" },
            { key: "nif", label: "NIF" },
            { key: "nis", label: "NIS" },
            { key: "rc", label: "السجل التجاري" },
            { key: "city", label: "الولاية" },
            { key: "phone", label: "الهاتف" },
          ]}
        />
      )}

      {renderModals()}
    </AppShell>
  );
}
