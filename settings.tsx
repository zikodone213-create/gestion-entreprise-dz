import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Building2, Percent, Plus, Save, Trash2, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppShell } from "@/components/shell";
import { DataTable, Field, ModalForm, SectionTitle } from "@/components/kit";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { fmtNum } from "@/lib/erp";
import { useToast } from "@/hooks/use-toast";

const COMPANY_FIELDS: { key: string; label: string }[] = [
  { key: "company_name", label: "التسمية الاجتماعية" },
  { key: "company_short", label: "الاسم المختصر" },
  { key: "company_activity", label: "النشاط" },
  { key: "company_address", label: "العنوان" },
  { key: "company_city", label: "المدينة" },
  { key: "company_phone", label: "الهاتف" },
  { key: "company_email", label: "البريد الإلكتروني" },
  { key: "company_nif", label: "رقم التعريف الجبائي NIF" },
  { key: "company_nis", label: "رقم التعريف الإحصائي NIS" },
  { key: "company_rc", label: "السجل التجاري RC" },
  { key: "company_ai", label: "رقم المادة AI" },
  { key: "company_cnas", label: "رقم الانتساب CNAS" },
  { key: "company_capital", label: "رأس المال (د.ج)" },
  { key: "company_bank", label: "البنك" },
  { key: "company_rib", label: "الحساب البنكي RIB" },
  { key: "invoice_prefix", label: "بادئة أرقام الفواتير" },
  { key: "fiscal_year", label: "السنة المالية الجارية" },
];

const ROLES = ["مدير", "محاسب", "موارد بشرية", "مبيعات"];

export default function SettingsPage() {
  const { toast } = useToast();
  const settings = useQuery<any>({ queryKey: ["/api/settings"] });
  const taxes = useQuery<any[]>({ queryKey: ["/api/tax-settings"] });
  const users = useQuery<any[]>({ queryKey: ["/api/users"] });

  const [form, setForm] = useState<Record<string, string>>({});
  useEffect(() => { if (settings.data) setForm(settings.data); }, [settings.data]);

  const saveSettings = useMutation({
    mutationFn: async () => (await apiRequest("PUT", "/api/settings", form)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/settings"] }); toast({ title: "تم حفظ معلومات المؤسسة" }); },
    onError: (e: any) => toast({ title: "تعذّر الحفظ", description: String(e.message), variant: "destructive" }),
  });

  /* ---- tax settings ---- */
  const [taxOpen, setTaxOpen] = useState(false);
  const [taxForm, setTaxForm] = useState<any>({});
  const openTax = (row?: any) => {
    setTaxForm(
      row
        ? { ...row, brackets: JSON.parse(row.irg_brackets) }
        : {
            year: new Date().getFullYear() + 1, tva_normal: 19, tva_reduced: 9, tap: 2,
            cnas_employee: 9, cnas_employer: 26, timbre_rate: 1,
            brackets: [
              { from: 0, to: 30000, rate: 0 }, { from: 30000, to: 45000, rate: 23 },
              { from: 45000, to: 60000, rate: 27 }, { from: 60000, to: 80000, rate: 30 },
              { from: 80000, to: 160000, rate: 33 }, { from: 160000, to: 320000, rate: 35 },
              { from: 320000, to: null, rate: 37 },
            ],
          },
    );
    setTaxOpen(true);
  };
  const saveTax = useMutation({
    mutationFn: async (d: any) => {
      const payload = {
        year: +d.year, tva_normal: +d.tva_normal, tva_reduced: +d.tva_reduced, tap: +d.tap,
        cnas_employee: +d.cnas_employee, cnas_employer: +d.cnas_employer, timbre_rate: +d.timbre_rate,
        irg_brackets: JSON.stringify(d.brackets),
      };
      return d.id
        ? (await apiRequest("PATCH", `/api/tax-settings/${d.id}`, payload)).json()
        : (await apiRequest("POST", "/api/tax-settings", payload)).json();
    },
    onSuccess: () => { setTaxOpen(false); queryClient.invalidateQueries({ queryKey: ["/api/tax-settings"] }); toast({ title: "تم حفظ النسب الجبائية" }); },
    onError: (e: any) => toast({ title: "تعذّر الحفظ", description: String(e.message), variant: "destructive" }),
  });

  /* ---- users ---- */
  const [uOpen, setUOpen] = useState(false);
  const [uForm, setUForm] = useState<any>({});
  const saveUser = useMutation({
    mutationFn: async (d: any) =>
      d.id
        ? (await apiRequest("PATCH", `/api/users/${d.id}`, d)).json()
        : (await apiRequest("POST", "/api/users", d)).json(),
    onSuccess: () => { setUOpen(false); queryClient.invalidateQueries({ queryKey: ["/api/users"] }); toast({ title: "تم حفظ المستخدم" }); },
    onError: (e: any) => toast({ title: "تعذّر الحفظ", description: String(e.message), variant: "destructive" }),
  });
  const delUser = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/users/${id}`)).json(),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["/api/users"] }); toast({ title: "تم حذف المستخدم" }); },
  });

  return (
    <AppShell title="الإعدادات" subtitle="معلومات المؤسسة، النسب الجبائية حسب سنة السريان، والمستخدمون والأدوار">
      <Tabs defaultValue="company">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="company" data-testid="tab-company"><Building2 className="me-1.5 h-4 w-4" /> معلومات المؤسسة</TabsTrigger>
          <TabsTrigger value="tax" data-testid="tab-tax"><Percent className="me-1.5 h-4 w-4" /> النسب الجبائية</TabsTrigger>
          <TabsTrigger value="users" data-testid="tab-users"><UserCog className="me-1.5 h-4 w-4" /> المستخدمون والأدوار</TabsTrigger>
        </TabsList>

        <TabsContent value="company">
          <Card className="p-5">
            <SectionTitle
              title="معلومات المؤسسة" subtitle="تظهر في كشوف الرواتب والفواتير والنماذج الجبائية"
              action={
                <Button size="sm" onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending} data-testid="button-save-settings">
                  <Save className="me-1.5 h-4 w-4" /> حفظ
                </Button>
              }
            />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {COMPANY_FIELDS.map((f) => (
                <Field key={f.key} label={f.label}>
                  <Input
                    value={form[f.key] || ""}
                    onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                    data-testid={`input-${f.key}`}
                  />
                </Field>
              ))}
              <Field label="النسخ الاحتياطي التلقائي">
                <Select value={form.auto_backup || "1"} onValueChange={(v) => setForm({ ...form, auto_backup: v })}>
                  <SelectTrigger data-testid="select-auto-backup"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="1">مفعّل (كل 6 ساعات)</SelectItem><SelectItem value="0">معطّل</SelectItem></SelectContent>
                </Select>
              </Field>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="tax">
          <DataTable
            testId="table-tax-settings"
            rows={taxes.data}
            isLoading={taxes.isLoading}
            error={taxes.error}
            onRetry={taxes.refetch}
            exportName="النسب-الجبائية"
            toolbar={
              <Button size="sm" onClick={() => openTax()} data-testid="button-add-tax-year">
                <Plus className="me-1.5 h-4 w-4" /> سنة سريان جديدة
              </Button>
            }
            columns={[
              { key: "year", label: "سنة السريان", render: (r) => <span className="num font-semibold">{r.year}</span> },
              { key: "tva_normal", label: "TVA عادي %", align: "end", render: (r) => <span className="num">{r.tva_normal}</span> },
              { key: "tva_reduced", label: "TVA مخفض %", align: "end", render: (r) => <span className="num">{r.tva_reduced}</span> },
              { key: "tap", label: "TAP %", align: "end", render: (r) => <span className="num">{r.tap}</span> },
              { key: "cnas_employee", label: "CNAS أجير %", align: "end", render: (r) => <span className="num">{r.cnas_employee}</span> },
              { key: "cnas_employer", label: "CNAS مستخدم %", align: "end", render: (r) => <span className="num">{r.cnas_employer}</span> },
              { key: "timbre_rate", label: "طابع الدمغة %", align: "end", hideOnMobile: true, render: (r) => <span className="num">{r.timbre_rate}</span> },
              {
                key: "irg", label: "شرائح IRG", hideOnMobile: true,
                render: (r) => <span className="num text-xs text-muted-foreground">{JSON.parse(r.irg_brackets).length} شريحة</span>,
              },
              {
                key: "actions", label: "تعديل", align: "end",
                render: (r) => (
                  <Button variant="outline" size="sm" className="h-8" onClick={() => openTax(r)} data-testid={`button-edit-tax-${r.year}`}>تعديل</Button>
                ),
              },
            ]}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            كل الحسابات (كشوف الرواتب، G50، الفواتير) تقرأ هذه النسب من قاعدة البيانات حسب سنة السريان — لا شيء مثبّت في الكود.
          </p>
        </TabsContent>

        <TabsContent value="users">
          <DataTable
            testId="table-users"
            rows={users.data}
            isLoading={users.isLoading}
            error={users.error}
            onRetry={users.refetch}
            searchKeys={["username", "name", "role"]}
            exportName="المستخدمون"
            toolbar={
              <Button size="sm" onClick={() => { setUForm({ role: "مبيعات", active: 1 }); setUOpen(true); }} data-testid="button-add-user">
                <Plus className="me-1.5 h-4 w-4" /> مستخدم جديد
              </Button>
            }
            columns={[
              { key: "username", label: "اسم المستخدم", render: (r) => <span className="num">{r.username}</span> },
              { key: "name", label: "الاسم الكامل" },
              { key: "role", label: "الدور" },
              { key: "active", label: "الحالة", render: (r) => (r.active ? "نشط" : "موقوف") },
              {
                key: "actions", label: "إجراءات", align: "end",
                render: (r) => (
                  <div className="flex justify-end gap-1">
                    <Button variant="outline" size="sm" className="h-8" onClick={() => { setUForm({ ...r }); setUOpen(true); }} data-testid={`button-edit-user-${r.id}`}>تعديل</Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 text-destructive"
                      onClick={() => { if (confirm(`حذف المستخدم ${r.username}؟`)) delUser.mutate(r.id); }}
                      data-testid={`button-delete-user-${r.id}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </TabsContent>
      </Tabs>

      {/* tax modal */}
      <ModalForm
        open={taxOpen} onOpenChange={setTaxOpen} wide
        title={taxForm.id ? `تعديل نسب سنة ${taxForm.year}` : "نسب جبائية لسنة جديدة"}
        description="النسب وشرائح IRG التنازلية المعمول بها في الجزائر"
        submitting={saveTax.isPending}
        onSubmit={() => saveTax.mutate(taxForm)}
      >
        <Field label="سنة السريان"><Input type="number" value={taxForm.year ?? ""} onChange={(e) => setTaxForm({ ...taxForm, year: +e.target.value })} data-testid="input-tax-year" /></Field>
        <Field label="TVA النسبة العادية %"><Input type="number" step="0.01" value={taxForm.tva_normal ?? ""} onChange={(e) => setTaxForm({ ...taxForm, tva_normal: +e.target.value })} data-testid="input-tva-normal" /></Field>
        <Field label="TVA النسبة المخفضة %"><Input type="number" step="0.01" value={taxForm.tva_reduced ?? ""} onChange={(e) => setTaxForm({ ...taxForm, tva_reduced: +e.target.value })} /></Field>
        <Field label="TAP %"><Input type="number" step="0.01" value={taxForm.tap ?? ""} onChange={(e) => setTaxForm({ ...taxForm, tap: +e.target.value })} data-testid="input-tap" /></Field>
        <Field label="CNAS حصة الأجير %"><Input type="number" step="0.01" value={taxForm.cnas_employee ?? ""} onChange={(e) => setTaxForm({ ...taxForm, cnas_employee: +e.target.value })} data-testid="input-cnas-employee" /></Field>
        <Field label="CNAS حصة المستخدم %"><Input type="number" step="0.01" value={taxForm.cnas_employer ?? ""} onChange={(e) => setTaxForm({ ...taxForm, cnas_employer: +e.target.value })} /></Field>
        <Field label="طابع الدمغة %"><Input type="number" step="0.01" value={taxForm.timbre_rate ?? ""} onChange={(e) => setTaxForm({ ...taxForm, timbre_rate: +e.target.value })} /></Field>
        <div className="sm:col-span-2">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">شرائح IRG (من — إلى — النسبة %)</p>
          <div className="space-y-2">
            {(taxForm.brackets || []).map((b: any, i: number) => (
              <div key={i} className="grid grid-cols-3 gap-2">
                <Input type="number" value={b.from} onChange={(e) => {
                  const br = [...taxForm.brackets]; br[i] = { ...b, from: +e.target.value }; setTaxForm({ ...taxForm, brackets: br });
                }} />
                <Input type="number" value={b.to ?? ""} placeholder="ما فوق" onChange={(e) => {
                  const br = [...taxForm.brackets]; br[i] = { ...b, to: e.target.value === "" ? null : +e.target.value }; setTaxForm({ ...taxForm, brackets: br });
                }} />
                <Input type="number" value={b.rate} onChange={(e) => {
                  const br = [...taxForm.brackets]; br[i] = { ...b, rate: +e.target.value }; setTaxForm({ ...taxForm, brackets: br });
                }} data-testid={`input-irg-rate-${i}`} />
              </div>
            ))}
          </div>
          <Button type="button" variant="outline" size="sm" className="mt-2"
            onClick={() => setTaxForm({ ...taxForm, brackets: [...(taxForm.brackets || []), { from: 0, to: null, rate: 0 }] })}>
            <Plus className="me-1.5 h-4 w-4" /> إضافة شريحة
          </Button>
        </div>
      </ModalForm>

      {/* user modal */}
      <ModalForm
        open={uOpen} onOpenChange={setUOpen}
        title={uForm.id ? "تعديل مستخدم" : "مستخدم جديد"}
        submitting={saveUser.isPending}
        onSubmit={() => saveUser.mutate(uForm)}
      >
        <Field label="اسم المستخدم"><Input value={uForm.username || ""} onChange={(e) => setUForm({ ...uForm, username: e.target.value })} data-testid="input-new-username" required /></Field>
        <Field label="كلمة المرور"><Input value={uForm.password || ""} onChange={(e) => setUForm({ ...uForm, password: e.target.value })} data-testid="input-new-password" required /></Field>
        <Field label="الاسم الكامل"><Input value={uForm.name || ""} onChange={(e) => setUForm({ ...uForm, name: e.target.value })} required /></Field>
        <Field label="الدور">
          <Select value={uForm.role || "مبيعات"} onValueChange={(v) => setUForm({ ...uForm, role: v })}>
            <SelectTrigger data-testid="select-user-role"><SelectValue /></SelectTrigger>
            <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="الحالة">
          <Select value={String(uForm.active ?? 1)} onValueChange={(v) => setUForm({ ...uForm, active: +v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="1">نشط</SelectItem><SelectItem value="0">موقوف</SelectItem></SelectContent>
          </Select>
        </Field>
      </ModalForm>
    </AppShell>
  );
}
