import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowDownToLine, ArrowUpFromLine, Boxes, PackageCheck, Pencil, Plus, Trash2, TriangleAlert, Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppShell } from "@/components/shell";
import { AlertBanner, DataTable, Field, KpiCard, ModalForm, SectionTitle, StatusBadge, TableReport } from "@/components/kit";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { fmtDZD, fmtDate, fmtNum, useAuth } from "@/lib/erp";
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = ["مضخات ومحركات", "كهرباء صناعية", "أدوات وعدة", "قطع غيار", "خدمات", "أخرى"];
const UNITS = ["وحدة", "قطعة", "علبة", "متر", "كلغ", "لتر", "ساعة", "خدمة"];
const MOVE_REASONS_IN = ["شراء", "استلام طلبية", "إرجاع من عميل", "جرد تصحيحي"];
const MOVE_REASONS_OUT = ["بيع", "استهلاك داخلي", "تالف / كسر", "إرجاع لمورد", "جرد تصحيحي"];
const PO_STATUS = ["مسودة", "مُرسلة", "مستلمة", "ملغاة"];

export default function InventoryPage() {
  const { can } = useAuth();
  const { toast } = useToast();
  const writable = can("inventory", "write");

  const products = useQuery<any[]>({ queryKey: ["/api/products"] });
  const moves = useQuery<any[]>({ queryKey: ["/api/stock-moves"] });
  const suppliers = useQuery<any[]>({ queryKey: ["/api/suppliers"] });
  const orders = useQuery<any[]>({ queryKey: ["/api/purchase-orders"] });
  const company = useQuery<any>({ queryKey: ["/api/settings"] });
  const [printStock, setPrintStock] = useState(false);

  const invalidate = (keys: string[]) => keys.forEach((k) => queryClient.invalidateQueries({ queryKey: [k] }));
  const err = (e: any) => toast({ title: "تعذّر تنفيذ العملية", description: String(e.message), variant: "destructive" });

  const productName = (id: number) => products.data?.find((p) => p.id === id)?.name || `#${id}`;
  const productRef = (id: number) => products.data?.find((p) => p.id === id)?.ref || "—";
  const supplierName = (id: number) => suppliers.data?.find((s) => s.id === id)?.name || "—";

  const lowStock = useMemo(
    () => (products.data || []).filter((p) => p.type === "منتج" && p.quantity <= p.min_quantity),
    [products.data],
  );
  const [onlyLow, setOnlyLow] = useState("all");

  const stockValue = (products.data || []).reduce((a, p) => a + p.quantity * p.purchase_price, 0);
  const saleValue = (products.data || []).reduce((a, p) => a + p.quantity * p.sale_price, 0);

  /* ---------------- product modal ---------------- */
  const [prOpen, setPrOpen] = useState(false);
  const [prForm, setPrForm] = useState<any>({});
  const openProduct = (row?: any) => {
    setPrForm(row ? { ...row } : { type: "منتج", unit: "وحدة", category: CATEGORIES[0], tva_rate: 19, quantity: 0, min_quantity: 5 });
    setPrOpen(true);
  };
  const prSave = useMutation({
    mutationFn: async (d: any) =>
      (d.id ? await apiRequest("PATCH", `/api/products/${d.id}`, d) : await apiRequest("POST", "/api/products", d)).json(),
    onSuccess: () => { setPrOpen(false); invalidate(["/api/products"]); toast({ title: "تم حفظ المنتج" }); },
    onError: err,
  });
  const prDelete = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/products/${id}`)).json(),
    onSuccess: () => { invalidate(["/api/products"]); toast({ title: "تم حذف المنتج" }); },
    onError: err,
  });

  /* ---------------- stock move modal ---------------- */
  const [mvOpen, setMvOpen] = useState(false);
  const [mvForm, setMvForm] = useState<any>({});
  const openMove = (kind: string, productId?: number) => {
    setMvForm({ kind, date: new Date().toISOString().slice(0, 10), quantity: 1, product_id: productId, reason: kind === "دخول" ? MOVE_REASONS_IN[0] : MOVE_REASONS_OUT[0] });
    setMvOpen(true);
  };
  const mvSave = useMutation({
    mutationFn: async (d: any) => (await apiRequest("POST", "/api/stock-moves", d)).json(),
    onSuccess: () => { setMvOpen(false); invalidate(["/api/stock-moves", "/api/products"]); toast({ title: "تم تسجيل حركة المخزون" }); },
    onError: err,
  });

  /* ---------------- supplier modal ---------------- */
  const [spOpen, setSpOpen] = useState(false);
  const [spForm, setSpForm] = useState<any>({});
  const openSupplier = (row?: any) => { setSpForm(row ? { ...row } : {}); setSpOpen(true); };
  const spSave = useMutation({
    mutationFn: async (d: any) =>
      (d.id ? await apiRequest("PATCH", `/api/suppliers/${d.id}`, d) : await apiRequest("POST", "/api/suppliers", d)).json(),
    onSuccess: () => { setSpOpen(false); invalidate(["/api/suppliers"]); toast({ title: "تم حفظ المورد" }); },
    onError: err,
  });
  const spDelete = useMutation({
    mutationFn: async (id: number) => (await apiRequest("DELETE", `/api/suppliers/${id}`)).json(),
    onSuccess: () => { invalidate(["/api/suppliers"]); toast({ title: "تم حذف المورد" }); },
    onError: err,
  });

  /* ---------------- purchase order ---------------- */
  const [poOpen, setPoOpen] = useState(false);
  const [poForm, setPoForm] = useState<any>({ lines: [] });
  const openPo = () => {
    const y = new Date().getFullYear();
    const n = (orders.data?.length || 0) + 1;
    setPoForm({
      ref: `BC-${y}-${String(n).padStart(4, "0")}`,
      date: new Date().toISOString().slice(0, 10),
      status: "مسودة",
      lines: [{ product_id: undefined, quantity: 1, unit_price: 0, tva_rate: 19, description: "" }],
    });
    setPoOpen(true);
  };
  const poTotals = useMemo(() => {
    const ht = (poForm.lines || []).reduce((a: number, l: any) => a + (+l.quantity || 0) * (+l.unit_price || 0), 0);
    const tva = (poForm.lines || []).reduce((a: number, l: any) => a + ((+l.quantity || 0) * (+l.unit_price || 0) * (+l.tva_rate || 0)) / 100, 0);
    return { ht: Math.round(ht), tva: Math.round(tva), ttc: Math.round(ht + tva) };
  }, [poForm]);

  const poSave = useMutation({
    mutationFn: async (d: any) => {
      const lines = (d.lines || []).filter((l: any) => l.product_id || l.description);
      if (!lines.length) throw new Error("الطلبية تحتاج سطراً واحداً على الأقل");
      const order = await (await apiRequest("POST", "/api/purchase-orders", {
        ref: d.ref, supplier_id: d.supplier_id, date: d.date, expected_date: d.expected_date,
        status: d.status, notes: d.notes, total_ht: poTotals.ht, total_tva: poTotals.tva, total_ttc: poTotals.ttc,
      })).json();
      for (const l of lines) {
        await apiRequest("POST", "/api/purchase-order-lines", {
          order_id: order.id, product_id: l.product_id || null,
          description: l.description || productName(l.product_id),
          quantity: +l.quantity || 1, unit_price: +l.unit_price || 0, tva_rate: +l.tva_rate || 0,
        });
      }
      return order;
    },
    onSuccess: () => { setPoOpen(false); invalidate(["/api/purchase-orders", "/api/purchase-order-lines"]); toast({ title: "تم إنشاء طلبية الشراء" }); },
    onError: err,
  });
  const poStatus = useMutation({
    mutationFn: async ({ id, status }: any) => (await apiRequest("PATCH", `/api/purchase-orders/${id}`, { status })).json(),
    onSuccess: () => { invalidate(["/api/purchase-orders"]); toast({ title: "تم تحديث حالة الطلبية" }); },
    onError: err,
  });
  const poReceive = useMutation({
    mutationFn: async (id: number) => (await apiRequest("POST", `/api/purchase-orders/${id}/receive`, {})).json(),
    onSuccess: () => { invalidate(["/api/purchase-orders", "/api/products", "/api/stock-moves"]); toast({ title: "تم استلام الطلبية وإدخالها للمخزون" }); },
    onError: err,
  });

  const [openOrder, setOpenOrder] = useState<any>(null);
  const orderLines = useQuery<any[]>({
    queryKey: [`/api/purchase-order-lines?order_id=${openOrder?.id}`],
    enabled: !!openOrder,
  });

  const filteredProducts = (products.data || []).filter((p) =>
    onlyLow === "low" ? p.type === "منتج" && p.quantity <= p.min_quantity : true,
  );

  return (
    <AppShell
      title="المخزون والمبيعات"
      subtitle="المنتجات والخدمات، حركة المخزون، الموردون وطلبيات الشراء"
      actions={writable ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => openMove("دخول")} data-testid="button-move-in">
            <ArrowDownToLine className="me-1.5 h-4 w-4" /> دخول
          </Button>
          <Button size="sm" variant="outline" onClick={() => openMove("خروج")} data-testid="button-move-out">
            <ArrowUpFromLine className="me-1.5 h-4 w-4" /> خروج
          </Button>
          <Button size="sm" onClick={() => openProduct()} data-testid="button-add-product">
            <Plus className="me-1.5 h-4 w-4" /> منتج جديد
          </Button>
        </div>
      ) : null}
    >
      {lowStock.length > 0 && (
        <AlertBanner
          tone="danger"
          title={<span>تنبيه نقص المخزون — <span className="num">{fmtNum(lowStock.length)}</span> منتج تحت الحد الأدنى</span>}
          testId="banner-low-stock"
          action={
            <Button size="sm" variant="outline" onClick={() => setOnlyLow(onlyLow === "low" ? "all" : "low")} data-testid="button-filter-low">
              {onlyLow === "low" ? "عرض كل المنتجات" : "عرض النواقص فقط"}
            </Button>
          }
        >
          {lowStock.slice(0, 6).map((p) => (
            <span key={p.id} className="me-3 inline-block">
              <span className="num">{p.ref}</span> — {p.name}: <span className="num font-semibold">{fmtNum(p.quantity)}</span> / الحد الأدنى <span className="num">{fmtNum(p.min_quantity)}</span>
            </span>
          ))}
          {lowStock.length > 6 && <span>و{fmtNum(lowStock.length - 6)} منتجاً آخر…</span>}
        </AlertBanner>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <KpiCard label="عدد المنتجات والخدمات" value={fmtNum(products.data?.length || 0)} icon={<Boxes className="h-4 w-4" />} testId="kpi-products" />
        <KpiCard label="قيمة المخزون (تكلفة)" value={fmtDZD(stockValue)} testId="kpi-stock-value" />
        <KpiCard label="قيمة المخزون (بيع)" value={fmtDZD(saleValue)} tone="positive" testId="kpi-stock-sale" />
        <KpiCard label="نواقص المخزون" value={fmtNum(lowStock.length)} tone={lowStock.length ? "danger" : "default"} testId="kpi-low-stock" />
        <KpiCard label="طلبيات الشراء" value={fmtNum(orders.data?.length || 0)} hint={`${fmtNum((orders.data || []).filter((o) => o.status === "مُرسلة").length)} قيد الاستلام`} testId="kpi-orders" />
      </div>

      <Tabs defaultValue="products">
        <TabsList className="mb-4 flex-wrap">
          <TabsTrigger value="products" data-testid="tab-products">المنتجات والخدمات</TabsTrigger>
          <TabsTrigger value="moves" data-testid="tab-moves">حركة المخزون</TabsTrigger>
          <TabsTrigger value="suppliers" data-testid="tab-suppliers">الموردون</TabsTrigger>
          <TabsTrigger value="orders" data-testid="tab-orders">طلبيات الشراء</TabsTrigger>
        </TabsList>

        {/* ---------------- products ---------------- */}
        <TabsContent value="products">
          <DataTable
            testId="table-products"
            rows={filteredProducts}
            isLoading={products.isLoading}
            error={products.error}
            onRetry={products.refetch}
            searchKeys={["ref", "name", "category"]}
            exportName="المنتجات-والخدمات"
            pageSize={12}
            onPrint={() => setPrintStock(true)}
            filters={[{
              key: "low", label: "الحالة", value: onlyLow, onChange: setOnlyLow,
              options: [{ value: "all", label: "كل المنتجات" }, { value: "low", label: "تحت الحد الأدنى" }],
            }]}
            columns={[
              { key: "ref", label: "المرجع", render: (r) => <span className="num text-xs">{r.ref}</span> },
              { key: "name", label: "التسمية", render: (r) => <span className="font-medium">{r.name}</span> },
              { key: "type", label: "النوع", hideOnMobile: true },
              { key: "category", label: "الصنف", hideOnMobile: true },
              { key: "purchase_price", label: "سعر الشراء", align: "end", render: (r) => <span className="num">{fmtNum(r.purchase_price)}</span> },
              { key: "sale_price", label: "سعر البيع", align: "end", render: (r) => <span className="num">{fmtNum(r.sale_price)}</span> },
              {
                key: "quantity", label: "الكمية", align: "end",
                render: (r) => (
                  <span className={`num font-semibold ${r.type === "منتج" && r.quantity <= r.min_quantity ? "text-destructive" : ""}`}>
                    {fmtNum(r.quantity)} {r.type === "منتج" && r.quantity <= r.min_quantity && <TriangleAlert className="inline h-3.5 w-3.5" />}
                  </span>
                ),
              },
              { key: "min_quantity", label: "الحد الأدنى", align: "end", hideOnMobile: true, render: (r) => <span className="num">{fmtNum(r.min_quantity)}</span> },
              { key: "tva_rate", label: "TVA %", align: "center", hideOnMobile: true, render: (r) => <span className="num">{fmtNum(r.tva_rate)}</span> },
              ...(writable ? [{
                key: "actions", label: "إجراءات", align: "end" as const,
                render: (r: any) => (
                  <div className="flex justify-end gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openMove("دخول", r.id)} title="حركة دخول" data-testid={`button-in-${r.id}`}>
                      <ArrowDownToLine className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openProduct(r)} data-testid={`button-edit-product-${r.id}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 text-destructive"
                      onClick={() => { if (confirm(`حذف المنتج ${r.name}؟`)) prDelete.mutate(r.id); }}
                      data-testid={`button-delete-product-${r.id}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ),
              }] : []),
            ]}
          />
        </TabsContent>

        {/* ---------------- stock moves ---------------- */}
        <TabsContent value="moves">
          <DataTable
            testId="table-moves"
            rows={(moves.data || []).map((m) => ({ ...m, product: productName(m.product_id), product_ref: productRef(m.product_id) }))}
            isLoading={moves.isLoading}
            error={moves.error}
            onRetry={moves.refetch}
            searchKeys={["product", "product_ref", "reason", "ref"]}
            exportName="حركة-المخزون"
            pageSize={12}
            columns={[
              { key: "date", label: "التاريخ", render: (r) => <span className="num">{fmtDate(r.date)}</span> },
              { key: "product_ref", label: "المرجع", hideOnMobile: true, render: (r) => <span className="num text-xs">{r.product_ref}</span> },
              { key: "product", label: "المنتج", render: (r) => <span className="font-medium">{r.product}</span> },
              {
                key: "kind", label: "النوع",
                render: (r) => (
                  <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium ${r.kind === "دخول" ? "border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-400" : "border-amber-500/30 bg-amber-500/12 text-amber-700 dark:text-amber-400"}`}>
                    {r.kind === "دخول" ? <ArrowDownToLine className="h-3 w-3" /> : <ArrowUpFromLine className="h-3 w-3" />} {r.kind}
                  </span>
                ),
              },
              { key: "quantity", label: "الكمية", align: "end", render: (r) => <span className="num font-semibold">{fmtNum(r.quantity)}</span> },
              { key: "reason", label: "السبب" },
              { key: "ref", label: "المرجع/الوثيقة", hideOnMobile: true, render: (r) => <span className="num text-xs">{r.ref || "—"}</span> },
            ]}
            toolbar={writable ? (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => openMove("دخول")} data-testid="button-move-in-tab">
                  <ArrowDownToLine className="me-1.5 h-4 w-4" /> دخول
                </Button>
                <Button size="sm" variant="outline" onClick={() => openMove("خروج")} data-testid="button-move-out-tab">
                  <ArrowUpFromLine className="me-1.5 h-4 w-4" /> خروج
                </Button>
              </div>
            ) : null}
          />
        </TabsContent>

        {/* ---------------- suppliers ---------------- */}
        <TabsContent value="suppliers">
          <DataTable
            testId="table-suppliers"
            rows={suppliers.data}
            isLoading={suppliers.isLoading}
            error={suppliers.error}
            onRetry={suppliers.refetch}
            searchKeys={["name", "nif", "rc", "city", "contact"]}
            exportName="الموردون"
            pageSize={12}
            columns={[
              { key: "name", label: "المورد", render: (r) => <span className="font-medium">{r.name}</span> },
              { key: "nif", label: "NIF", render: (r) => <span className="num text-xs">{r.nif || "—"}</span> },
              { key: "nis", label: "NIS", hideOnMobile: true, render: (r) => <span className="num text-xs">{r.nis || "—"}</span> },
              { key: "rc", label: "السجل التجاري", hideOnMobile: true, render: (r) => <span className="num text-xs">{r.rc || "—"}</span> },
              { key: "city", label: "الولاية" },
              { key: "phone", label: "الهاتف", render: (r) => <span className="num text-xs">{r.phone || "—"}</span> },
              { key: "contact", label: "جهة الاتصال", hideOnMobile: true },
              ...(writable ? [{
                key: "actions", label: "إجراءات", align: "end" as const,
                render: (r: any) => (
                  <div className="flex justify-end gap-1">
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => openSupplier(r)} data-testid={`button-edit-supplier-${r.id}`}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="outline" size="icon" className="h-8 w-8 text-destructive"
                      onClick={() => { if (confirm(`حذف المورد ${r.name}؟`)) spDelete.mutate(r.id); }}
                      data-testid={`button-delete-supplier-${r.id}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ),
              }] : []),
            ]}
            toolbar={writable ? (
              <Button size="sm" onClick={() => openSupplier()} data-testid="button-add-supplier">
                <Plus className="me-1.5 h-4 w-4" /> مورد جديد
              </Button>
            ) : null}
          />
        </TabsContent>

        {/* ---------------- purchase orders ---------------- */}
        <TabsContent value="orders">
          <DataTable
            testId="table-orders"
            rows={(orders.data || []).map((o) => ({ ...o, supplier: supplierName(o.supplier_id) }))}
            isLoading={orders.isLoading}
            error={orders.error}
            onRetry={orders.refetch}
            searchKeys={["ref", "supplier", "status"]}
            exportName="طلبيات-الشراء"
            pageSize={10}
            onRowClick={(r) => setOpenOrder(r)}
            columns={[
              { key: "ref", label: "المرجع", render: (r) => <span className="num text-xs font-semibold">{r.ref}</span> },
              { key: "supplier", label: "المورد" },
              { key: "date", label: "التاريخ", render: (r) => <span className="num">{fmtDate(r.date)}</span> },
              { key: "expected_date", label: "الاستلام المتوقع", hideOnMobile: true, render: (r) => <span className="num">{fmtDate(r.expected_date)}</span> },
              { key: "total_ht", label: "المبلغ خارج الرسم", align: "end", render: (r) => <span className="num">{fmtNum(r.total_ht)}</span> },
              { key: "total_ttc", label: "الإجمالي بالرسم", align: "end", render: (r) => <span className="num font-semibold">{fmtNum(r.total_ttc)}</span> },
              { key: "status", label: "الحالة", render: (r) => <StatusBadge value={r.status} /> },
              ...(writable ? [{
                key: "actions", label: "إجراءات", align: "end" as const,
                render: (r: any) => (
                  <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                    {r.status !== "مستلمة" && r.status !== "ملغاة" && (
                      <Button variant="outline" size="sm" className="h-8" onClick={() => poReceive.mutate(r.id)} data-testid={`button-receive-order-${r.id}`}>
                        <PackageCheck className="me-1 h-3.5 w-3.5" /> استلام
                      </Button>
                    )}
                    <Select value={r.status} onValueChange={(v) => poStatus.mutate({ id: r.id, status: v })}>
                      <SelectTrigger className="h-8 w-[110px]" data-testid={`select-order-status-${r.id}`}><SelectValue /></SelectTrigger>
                      <SelectContent>{PO_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                ),
              }] : []),
            ]}
            toolbar={writable ? (
              <Button size="sm" onClick={openPo} data-testid="button-add-order">
                <Truck className="me-1.5 h-4 w-4" /> طلبية شراء جديدة
              </Button>
            ) : null}
            emptyHint="أنشئ طلبية شراء لتتبع التوريدات وإدخالها آلياً للمخزون عند الاستلام"
          />

          {openOrder && (
            <Card className="mt-4 p-4" data-testid="panel-order-lines">
              <SectionTitle
                title={`سطور الطلبية ${openOrder.ref}`}
                subtitle={`${supplierName(openOrder.supplier_id)} · ${fmtDate(openOrder.date)}`}
                action={<Button size="sm" variant="outline" onClick={() => setOpenOrder(null)}>إغلاق</Button>}
              />
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs">
                    <tr>
                      <th className="px-3 py-2 text-start font-semibold text-muted-foreground">المنتج</th>
                      <th className="px-3 py-2 text-end font-semibold text-muted-foreground">الكمية</th>
                      <th className="px-3 py-2 text-end font-semibold text-muted-foreground">سعر الوحدة</th>
                      <th className="px-3 py-2 text-center font-semibold text-muted-foreground">TVA %</th>
                      <th className="px-3 py-2 text-end font-semibold text-muted-foreground">المجموع خارج الرسم</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(orderLines.data || []).map((l) => (
                      <tr key={l.id} className="border-t border-border">
                        <td className="px-3 py-2">{l.description || productName(l.product_id)}</td>
                        <td className="num px-3 py-2 text-end">{fmtNum(l.quantity)}</td>
                        <td className="num px-3 py-2 text-end">{fmtNum(l.unit_price)}</td>
                        <td className="num px-3 py-2 text-center">{fmtNum(l.tva_rate)}</td>
                        <td className="num px-3 py-2 text-end font-semibold">{fmtNum(l.quantity * l.unit_price)}</td>
                      </tr>
                    ))}
                    {!orderLines.data?.length && (
                      <tr><td colSpan={5} className="px-3 py-6 text-center text-sm text-muted-foreground">لا توجد سطور</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* ---------------- modals ---------------- */}
      {printStock && (
        <TableReport
          title="حالة المخزون"
          subtitle={<span>قيمة المخزون بسعر التكلفة: <span className="num">{fmtDZD(stockValue)}</span> · عدد النواقص: <span className="num">{fmtNum(lowStock.length)}</span></span>}
          company={company.data}
          rows={filteredProducts}
          onClose={() => setPrintStock(false)}
          columns={[
            { key: "ref", label: "المرجع" },
            { key: "name", label: "التسمية" },
            { key: "type", label: "النوع" },
            { key: "category", label: "الصنف" },
            { key: "purchase_price", label: "سعر الشراء", align: "end", render: (r: any) => fmtNum(r.purchase_price) },
            { key: "sale_price", label: "سعر البيع", align: "end", render: (r: any) => fmtNum(r.sale_price) },
            { key: "quantity", label: "الكمية", align: "end", render: (r: any) => fmtNum(r.quantity) },
            { key: "min_quantity", label: "الحد الأدنى", align: "end", render: (r: any) => fmtNum(r.min_quantity) },
            { key: "value", label: "القيمة (تكلفة)", align: "end", render: (r: any) => fmtNum(r.quantity * r.purchase_price) },
          ]}
          totalRow={{ label: "المجموع", values: { value: fmtNum(stockValue) } }}
        />
      )}

      <ModalForm
        open={prOpen} onOpenChange={setPrOpen}
        title={prForm.id ? `تعديل المنتج ${prForm.ref || ""}` : "منتج / خدمة جديدة"}
        description="المرجع فريد. الحد الأدنى يُستعمل في تنبيهات نقص المخزون."
        submitting={prSave.isPending}
        onSubmit={() => prSave.mutate(prForm)}
        wide
      >
        <Field label="المرجع">
          <Input value={prForm.ref || ""} onChange={(e) => setPrForm({ ...prForm, ref: e.target.value })} required data-testid="input-product-ref" />
        </Field>
        <Field label="التسمية">
          <Input value={prForm.name || ""} onChange={(e) => setPrForm({ ...prForm, name: e.target.value })} required data-testid="input-product-name" />
        </Field>
        <Field label="النوع">
          <Select value={prForm.type || "منتج"} onValueChange={(v) => setPrForm({ ...prForm, type: v })}>
            <SelectTrigger data-testid="select-product-type"><SelectValue /></SelectTrigger>
            <SelectContent>{["منتج", "خدمة"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="الصنف">
          <Select value={prForm.category || CATEGORIES[0]} onValueChange={(v) => setPrForm({ ...prForm, category: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="وحدة القياس">
          <Select value={prForm.unit || "وحدة"} onValueChange={(v) => setPrForm({ ...prForm, unit: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{UNITS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="نسبة TVA %">
          <Input type="number" value={prForm.tva_rate ?? 19} onChange={(e) => setPrForm({ ...prForm, tva_rate: +e.target.value })} />
        </Field>
        <Field label="سعر الشراء (د.ج)">
          <Input type="number" value={prForm.purchase_price ?? 0} onChange={(e) => setPrForm({ ...prForm, purchase_price: +e.target.value })} data-testid="input-product-purchase" />
        </Field>
        <Field label="سعر البيع (د.ج)">
          <Input type="number" value={prForm.sale_price ?? 0} onChange={(e) => setPrForm({ ...prForm, sale_price: +e.target.value })} data-testid="input-product-sale" />
        </Field>
        <Field label="الكمية الحالية">
          <Input type="number" value={prForm.quantity ?? 0} onChange={(e) => setPrForm({ ...prForm, quantity: +e.target.value })} data-testid="input-product-qty" />
        </Field>
        <Field label="الحد الأدنى للتنبيه">
          <Input type="number" value={prForm.min_quantity ?? 0} onChange={(e) => setPrForm({ ...prForm, min_quantity: +e.target.value })} data-testid="input-product-min" />
        </Field>
      </ModalForm>

      <ModalForm
        open={mvOpen} onOpenChange={setMvOpen}
        title={`حركة مخزون — ${mvForm.kind || ""}`}
        description="تُحدَّث كمية المنتج آلياً وتُسجَّل العملية في سجل العمليات"
        submitting={mvSave.isPending}
        onSubmit={() => mvSave.mutate(mvForm)}
      >
        <Field label="المنتج" full>
          <Select value={mvForm.product_id ? String(mvForm.product_id) : ""} onValueChange={(v) => setMvForm({ ...mvForm, product_id: +v })}>
            <SelectTrigger data-testid="select-move-product"><SelectValue placeholder="اختر المنتج" /></SelectTrigger>
            <SelectContent>
              {(products.data || []).map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>{p.ref} — {p.name} (المتوفر: {fmtNum(p.quantity)})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="نوع الحركة">
          <Select value={mvForm.kind || "دخول"} onValueChange={(v) => setMvForm({ ...mvForm, kind: v, reason: v === "دخول" ? MOVE_REASONS_IN[0] : MOVE_REASONS_OUT[0] })}>
            <SelectTrigger data-testid="select-move-kind"><SelectValue /></SelectTrigger>
            <SelectContent>{["دخول", "خروج"].map((k) => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="الكمية">
          <Input type="number" min={1} value={mvForm.quantity ?? 1} onChange={(e) => setMvForm({ ...mvForm, quantity: +e.target.value })} data-testid="input-move-qty" required />
        </Field>
        <Field label="السبب">
          <Select value={mvForm.reason || ""} onValueChange={(v) => setMvForm({ ...mvForm, reason: v })}>
            <SelectTrigger data-testid="select-move-reason"><SelectValue placeholder="اختر السبب" /></SelectTrigger>
            <SelectContent>
              {(mvForm.kind === "دخول" ? MOVE_REASONS_IN : MOVE_REASONS_OUT).map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
        <Field label="المرجع / الوثيقة">
          <Input value={mvForm.ref || ""} onChange={(e) => setMvForm({ ...mvForm, ref: e.target.value })} placeholder="رقم الفاتورة أو وصل التسليم" data-testid="input-move-ref" />
        </Field>
        <Field label="التاريخ">
          <Input type="date" value={mvForm.date || ""} onChange={(e) => setMvForm({ ...mvForm, date: e.target.value })} required />
        </Field>
      </ModalForm>

      <ModalForm
        open={spOpen} onOpenChange={setSpOpen}
        title={spForm.id ? `تعديل المورد` : "مورد جديد"}
        submitting={spSave.isPending}
        onSubmit={() => spSave.mutate(spForm)}
        wide
      >
        <Field label="اسم المورد" full>
          <Input value={spForm.name || ""} onChange={(e) => setSpForm({ ...spForm, name: e.target.value })} required data-testid="input-supplier-name" />
        </Field>
        <Field label="NIF"><Input value={spForm.nif || ""} onChange={(e) => setSpForm({ ...spForm, nif: e.target.value })} /></Field>
        <Field label="NIS"><Input value={spForm.nis || ""} onChange={(e) => setSpForm({ ...spForm, nis: e.target.value })} /></Field>
        <Field label="السجل التجاري RC"><Input value={spForm.rc || ""} onChange={(e) => setSpForm({ ...spForm, rc: e.target.value })} /></Field>
        <Field label="الولاية"><Input value={spForm.city || ""} onChange={(e) => setSpForm({ ...spForm, city: e.target.value })} /></Field>
        <Field label="الهاتف"><Input value={spForm.phone || ""} onChange={(e) => setSpForm({ ...spForm, phone: e.target.value })} /></Field>
        <Field label="البريد الإلكتروني"><Input value={spForm.email || ""} onChange={(e) => setSpForm({ ...spForm, email: e.target.value })} /></Field>
        <Field label="جهة الاتصال"><Input value={spForm.contact || ""} onChange={(e) => setSpForm({ ...spForm, contact: e.target.value })} /></Field>
        <Field label="العنوان" full><Textarea value={spForm.address || ""} onChange={(e) => setSpForm({ ...spForm, address: e.target.value })} /></Field>
      </ModalForm>

      <ModalForm
        open={poOpen} onOpenChange={setPoOpen}
        title="طلبية شراء جديدة"
        description="عند الاستلام تُنشأ حركات دخول للمخزون آلياً وتُحدَّث الكميات"
        submitting={poSave.isPending}
        onSubmit={() => poSave.mutate(poForm)}
        wide
      >
        <Field label="المرجع">
          <Input value={poForm.ref || ""} onChange={(e) => setPoForm({ ...poForm, ref: e.target.value })} required data-testid="input-po-ref" />
        </Field>
        <Field label="المورد">
          <Select value={poForm.supplier_id ? String(poForm.supplier_id) : ""} onValueChange={(v) => setPoForm({ ...poForm, supplier_id: +v })}>
            <SelectTrigger data-testid="select-po-supplier"><SelectValue placeholder="اختر المورد" /></SelectTrigger>
            <SelectContent>{(suppliers.data || []).map((s) => <SelectItem key={s.id} value={String(s.id)}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="التاريخ">
          <Input type="date" value={poForm.date || ""} onChange={(e) => setPoForm({ ...poForm, date: e.target.value })} required />
        </Field>
        <Field label="الاستلام المتوقع">
          <Input type="date" value={poForm.expected_date || ""} onChange={(e) => setPoForm({ ...poForm, expected_date: e.target.value })} />
        </Field>
        <Field label="الحالة">
          <Select value={poForm.status || "مسودة"} onValueChange={(v) => setPoForm({ ...poForm, status: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PO_STATUS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="ملاحظات">
          <Input value={poForm.notes || ""} onChange={(e) => setPoForm({ ...poForm, notes: e.target.value })} />
        </Field>

        <div className="sm:col-span-2">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">سطور الطلبية</p>
          <div className="space-y-2">
            {(poForm.lines || []).map((l: any, i: number) => (
              <div key={i} className="grid grid-cols-2 items-end gap-2 rounded-md border border-border p-2 sm:grid-cols-5">
                <div className="col-span-2">
                  <Select
                    value={l.product_id ? String(l.product_id) : ""}
                    onValueChange={(v) => {
                      const p = products.data?.find((x) => x.id === +v);
                      const lines = [...poForm.lines];
                      lines[i] = { ...l, product_id: +v, unit_price: p?.purchase_price ?? l.unit_price, tva_rate: p?.tva_rate ?? 19, description: p?.name };
                      setPoForm({ ...poForm, lines });
                    }}
                  >
                    <SelectTrigger data-testid={`select-po-line-product-${i}`}><SelectValue placeholder="المنتج" /></SelectTrigger>
                    <SelectContent>{(products.data || []).map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.ref} — {p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <Input type="number" min={1} value={l.quantity} placeholder="الكمية"
                  onChange={(e) => { const lines = [...poForm.lines]; lines[i] = { ...l, quantity: +e.target.value }; setPoForm({ ...poForm, lines }); }}
                  data-testid={`input-po-line-qty-${i}`} />
                <Input type="number" value={l.unit_price} placeholder="سعر الوحدة"
                  onChange={(e) => { const lines = [...poForm.lines]; lines[i] = { ...l, unit_price: +e.target.value }; setPoForm({ ...poForm, lines }); }} />
                <div className="flex items-center gap-1">
                  <Input type="number" value={l.tva_rate} placeholder="TVA"
                    onChange={(e) => { const lines = [...poForm.lines]; lines[i] = { ...l, tva_rate: +e.target.value }; setPoForm({ ...poForm, lines }); }} />
                  <Button type="button" variant="outline" size="icon" className="h-9 w-9 shrink-0 text-destructive"
                    onClick={() => setPoForm({ ...poForm, lines: poForm.lines.filter((_: any, j: number) => j !== i) })}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="outline" size="sm"
              onClick={() => setPoForm({ ...poForm, lines: [...(poForm.lines || []), { quantity: 1, unit_price: 0, tva_rate: 19 }] })}
              data-testid="button-po-add-line">
              <Plus className="me-1.5 h-4 w-4" /> إضافة سطر
            </Button>
            <p className="num text-xs text-muted-foreground">
              خارج الرسم: {fmtNum(poTotals.ht)} · الرسم: {fmtNum(poTotals.tva)} · الإجمالي: <span className="font-bold">{fmtNum(poTotals.ttc)}</span> د.ج
            </p>
          </div>
        </div>
      </ModalForm>
    </AppShell>
  );
}
