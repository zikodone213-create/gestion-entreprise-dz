import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  AlertTriangle, ChevronLeft, ChevronRight, Download, FileSpreadsheet, Inbox, Loader2, Printer, Search, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { exportCSV, exportExcel, fmtNum } from "@/lib/erp";

/* ------------------------------------------------------------ logo */

export function Logo({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" aria-label="شعار النور للتجهيزات" role="img">
      <rect x="1.25" y="1.25" width="29.5" height="29.5" rx="7.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M9 22V10l14 12V10" stroke="currentColor" strokeWidth="2.4" strokeLinecap="square" />
      <circle cx="23" cy="9.5" r="2.6" fill="currentColor" />
    </svg>
  );
}

/* ------------------------------------------------------------ states */

export function LoadingState({ label = "جارٍ التحميل…", rows = 5 }: { label?: string; rows?: number }) {
  return (
    <div className="space-y-3 p-4" data-testid="state-loading">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {label}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

export function EmptyState({ title = "لا توجد بيانات", hint, action }: { title?: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center" data-testid="state-empty">
      <div className="rounded-full border border-border bg-muted/40 p-3 text-muted-foreground">
        <Inbox className="h-6 w-6" />
      </div>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: any; onRetry?: () => void }) {
  const msg = String(error?.message || error || "خطأ غير متوقع");
  const forbidden = msg.includes("403") || msg.includes("ممنوع");
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center" data-testid="state-error">
      <AlertTriangle className="h-6 w-6 text-destructive" />
      <p className="text-sm font-semibold">{forbidden ? "لا تملك صلاحية الاطلاع على هذه البيانات" : "تعذّر تحميل البيانات"}</p>
      <p dir="auto" className="max-w-md text-xs text-muted-foreground">{msg}</p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} data-testid="button-retry">
          إعادة المحاولة
        </Button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------ KPI card */

export function KpiCard({
  label, value, hint, icon, tone = "default", testId,
}: {
  label: string; value: ReactNode; hint?: string; icon?: ReactNode;
  tone?: "default" | "positive" | "warning" | "danger"; testId?: string;
}) {
  const tones: Record<string, string> = {
    default: "text-foreground",
    positive: "text-[hsl(var(--chart-1))]",
    warning: "text-[hsl(var(--chart-4))]",
    danger: "text-destructive",
  };
  return (
    <Card className="p-4" data-testid={testId}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <p className={cn("mt-2 truncate text-[15px] font-bold numfont sm:text-lg", tones[tone])} title={String(value)}>{value}</p>
      {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}

export function SectionTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-base font-bold">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatusBadge({ value }: { value?: string | null }) {
  const v = String(value || "—");
  const map: Record<string, string> = {
    "مدفوعة": "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    "مسددة": "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    "مسدد": "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    "مقبولة": "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    "حاضر": "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    "منجزة": "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    "مودع": "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    "نشط": "bg-emerald-500/12 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
    "قيد الانتظار": "bg-amber-500/12 text-amber-700 dark:text-amber-400 border-amber-500/30",
    "مدفوعة جزئياً": "bg-amber-500/12 text-amber-700 dark:text-amber-400 border-amber-500/30",
    "متأخر": "bg-amber-500/12 text-amber-700 dark:text-amber-400 border-amber-500/30",
    "قيد المعالجة": "bg-amber-500/12 text-amber-700 dark:text-amber-400 border-amber-500/30",
    "مسودة": "bg-muted text-muted-foreground border-border",
    "غير مدفوعة": "bg-destructive/10 text-destructive border-destructive/30",
    "مرفوضة": "bg-destructive/10 text-destructive border-destructive/30",
    "غائب": "bg-destructive/10 text-destructive border-destructive/30",
    "ملغاة": "bg-destructive/10 text-destructive border-destructive/30",
  };
  return (
    <span className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap", map[v] || "bg-muted text-muted-foreground border-border")}>
      {v}
    </span>
  );
}

/* ------------------------------------------------------------ DataTable */

export type Column<T = any> = {
  key: string;
  label: string;
  render?: (row: T) => ReactNode;
  align?: "start" | "end" | "center";
  className?: string;
  hideOnMobile?: boolean;
};

export function DataTable<T extends Record<string, any>>({
  columns, rows, isLoading, error, onRetry, searchKeys, filters, pageSize = 10,
  exportName, toolbar, emptyHint, testId = "table", onPrint, onRowClick,
}: {
  columns: Column<T>[];
  rows: T[] | undefined;
  isLoading?: boolean;
  error?: any;
  onRetry?: () => void;
  searchKeys?: string[];
  filters?: { key: string; label: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void }[];
  pageSize?: number;
  exportName?: string;
  toolbar?: ReactNode;
  emptyHint?: string;
  testId?: string;
  onPrint?: () => void;
  onRowClick?: (row: T) => void;
}) {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    let out = rows || [];
    if (q && searchKeys?.length) {
      const s = q.toLowerCase();
      out = out.filter((r) => searchKeys.some((k) => String(r[k] ?? "").toLowerCase().includes(s)));
    }
    return out;
  }, [rows, q, searchKeys]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages);
  const slice = filtered.slice((current - 1) * pageSize, current * pageSize);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        {searchKeys?.length ? (
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute end-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => { setQ(e.target.value); setPage(1); }}
              placeholder="بحث…"
              className="pe-9"
              data-testid={`input-search-${testId}`}
            />
          </div>
        ) : null}
        {filters?.map((f) => (
          <Select key={f.key} value={f.value} onValueChange={(v) => { f.onChange(v); setPage(1); }}>
            <SelectTrigger className="w-auto min-w-[130px]" data-testid={`select-${f.key}`}>
              <SelectValue placeholder={f.label} />
            </SelectTrigger>
            <SelectContent>
              {f.options.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ))}
        <div className="flex flex-wrap items-center gap-2 ms-auto">
          {toolbar}
          {exportName && (
            <>
              <Button
                variant="outline" size="sm"
                onClick={() => exportCSV(exportName, columns.map((c) => ({ key: c.key, label: c.label })), filtered)}
                data-testid={`button-export-${testId}`}
              >
                <Download className="me-1.5 h-4 w-4" /> CSV
              </Button>
              <Button
                variant="outline" size="sm"
                onClick={() => exportExcel(exportName, columns.map((c) => ({ key: c.key, label: c.label })), filtered, exportName)}
                data-testid={`button-excel-${testId}`}
              >
                <FileSpreadsheet className="me-1.5 h-4 w-4" /> Excel
              </Button>
            </>
          )}
          {onPrint && (
            <Button variant="outline" size="sm" onClick={onPrint} data-testid={`button-print-${testId}`}>
              <Printer className="me-1.5 h-4 w-4" /> طباعة / PDF
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={onRetry} />
      ) : !filtered.length ? (
        <EmptyState hint={emptyHint} />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid={testId}>
              <thead className="bg-muted/50 text-xs">
                <tr>
                  {columns.map((c) => (
                    <th
                      key={c.key}
                      className={cn(
                        "whitespace-nowrap px-3 py-2.5 font-semibold text-muted-foreground",
                        c.align === "end" ? "text-end" : c.align === "center" ? "text-center" : "text-start",
                        c.hideOnMobile && "hidden md:table-cell",
                      )}
                    >
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {slice.map((r, i) => (
                  <tr
                    key={r.id ?? i}
                    className={cn("border-t border-border hover:bg-muted/40", onRowClick && "cursor-pointer")}
                    onClick={onRowClick ? () => onRowClick(r) : undefined}
                    data-testid={`row-${testId}-${r.id ?? i}`}
                  >
                    {columns.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          "px-3 py-2.5 align-middle",
                          c.align === "end" ? "text-end" : c.align === "center" ? "text-center" : "text-start",
                          c.hideOnMobile && "hidden md:table-cell",
                          c.className,
                        )}
                      >
                        {c.render ? c.render(r) : (r[c.key] ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs text-muted-foreground">
            <span className="flex flex-wrap items-center gap-x-3">
              <span>عدد السجلات: <span className="num">{fmtNum(filtered.length)}</span></span>
              <span>الصفحة: <span className="num">{current} / {pages}</span></span>
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={current <= 1}
                onClick={() => setPage(current - 1)} data-testid={`button-prev-${testId}`}>
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={current >= pages}
                onClick={() => setPage(current + 1)} data-testid={`button-next-${testId}`}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </Card>
  );
}

/* ------------------------------------------------------------ Modal form */

export function ModalForm({
  open, onOpenChange, title, description, onSubmit, submitting, children, submitLabel = "حفظ", wide,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  onSubmit: () => void;
  submitting?: boolean;
  children: ReactNode;
  submitLabel?: string;
  wide?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className={cn("max-h-[88vh] overflow-y-auto", wide ? "sm:max-w-2xl" : "sm:max-w-lg")}>
        <DialogHeader className="text-start">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); onSubmit(); }}
          className="space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">{children}</div>
          <div className="flex justify-start gap-2 pt-2">
            <Button type="submit" disabled={submitting} data-testid="button-modal-submit">
              {submitting && <Loader2 className="me-1.5 h-4 w-4 animate-spin" />}
              {submitLabel}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-modal-cancel">
              إلغاء
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <label className={cn("block space-y-1.5", full && "sm:col-span-2")}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

/* ------------------------------------------------------------ print wrapper */

export function PrintLayout({
  children, title, onClose, actions,
}: { children: ReactNode; title: string; onClose?: () => void; actions?: ReactNode }) {
  useEffect(() => {
    document.body.classList.add("printing");
    return () => document.body.classList.remove("printing");
  }, []);

  return createPortal(
    <div className="print-portal fixed inset-0 z-50 overflow-y-auto bg-background/95 p-4 print:static print:bg-white print:p-0">
      <div className="mx-auto max-w-[820px]">
        <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold">{title}</h3>
          <div className="flex gap-2">
            {actions}
            <Button size="sm" onClick={() => window.print()} data-testid="button-print">
              <Printer className="me-1.5 h-4 w-4" /> طباعة / PDF
            </Button>
            {onClose && (
              <Button size="sm" variant="outline" onClick={onClose} data-testid="button-close-print">
                <X className="me-1.5 h-4 w-4" /> إغلاق
              </Button>
            )}
          </div>
        </div>
        <div className="print-sheet mx-auto w-full rounded-lg border border-border bg-white p-8 text-[13px] leading-relaxed text-black shadow-sm">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ------------------------------------------------------------ alert banner */

export function AlertBanner({
  tone = "warning", title, children, icon, action, testId,
}: {
  tone?: "warning" | "danger" | "info" | "success";
  title: ReactNode;
  children?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  testId?: string;
}) {
  const tones: Record<string, string> = {
    warning: "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200",
    danger: "border-destructive/40 bg-destructive/10 text-destructive",
    info: "border-primary/30 bg-primary/10 text-foreground",
    success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
  };
  return (
    <div className={cn("mb-4 flex flex-wrap items-start gap-3 rounded-lg border px-4 py-3", tones[tone])} data-testid={testId}>
      <span className="mt-0.5 shrink-0">{icon || <AlertTriangle className="h-4 w-4" />}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">{title}</p>
        {children && <div className="mt-0.5 text-xs leading-relaxed">{children}</div>}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------ printable simple table */

export function PrintTable({
  columns, rows, totalRow,
}: {
  columns: { key: string; label: string; align?: "start" | "end"; render?: (r: any) => ReactNode }[];
  rows: any[];
  totalRow?: { label: string; values: Record<string, ReactNode> };
}) {
  return (
    <table className="w-full border-collapse text-[11.5px]">
      <thead>
        <tr className="bg-neutral-100">
          {columns.map((c) => (
            <th key={c.key} className={cn("border border-neutral-300 px-2 py-1.5 font-bold", c.align === "end" ? "text-end" : "text-start")}>
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.id ?? i}>
            {columns.map((c) => (
              <td
                key={c.key}
                dir={c.align === "end" ? "ltr" : undefined}
                className={cn("border border-neutral-300 px-2 py-1", c.align === "end" ? "numfont text-end" : "text-start")}
              >
                {c.render ? c.render(r) : (r[c.key] ?? "—")}
              </td>
            ))}
          </tr>
        ))}
        {totalRow && (
          <tr className="bg-neutral-100 font-bold">
            {columns.map((c, idx) => (
              <td
                key={c.key}
                dir={c.align === "end" && idx > 0 ? "ltr" : undefined}
                className={cn("border border-neutral-300 px-2 py-1.5", c.align === "end" ? "numfont text-end" : "text-start")}
              >
                {idx === 0 ? totalRow.label : totalRow.values[c.key] ?? ""}
              </td>
            ))}
          </tr>
        )}
      </tbody>
    </table>
  );
}

/* ------------------------------------------------------------ print letterhead */

export function PrintHeader({
  company, docTitle, meta,
}: { company: any; docTitle: string; meta?: { label: string; value: ReactNode }[] }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4 border-b-2 border-neutral-800 pb-4">
      <div className="flex items-start gap-3">
        <span className="text-neutral-900"><Logo className="h-12 w-12" /></span>
        <div>
          <p className="text-[15px] font-bold">{company?.company_name}</p>
          <p className="text-[11px]">{company?.company_address}</p>
          <p className="text-[11px]">هاتف: <span dir="ltr" className="num">{company?.company_phone}</span> · <span dir="ltr" className="num">{company?.company_email}</span></p>
          <p className="text-[11px]">
            السجل التجاري: <span dir="ltr" className="num">{company?.company_rc}</span> · NIF: <span dir="ltr" className="num">{company?.company_nif}</span>
          </p>
          <p className="text-[11px]">
            NIS: <span dir="ltr" className="num">{company?.company_nis}</span> · رقم المادة (AI): <span dir="ltr" className="num">{company?.company_ai || "—"}</span>
          </p>
        </div>
      </div>
      <div className="text-end">
        <p className="text-base font-bold">{docTitle}</p>
        {meta?.map((m) => (
          <p key={m.label} className="text-[11px]">{m.label}: <span className="num">{m.value}</span></p>
        ))}
      </div>
    </div>
  );
}

/** تقرير طباعة عام لأي جدول (A4 مع ترويسة المؤسسة) */
export function TableReport({
  title, subtitle, company, columns, rows, totalRow, onClose,
}: {
  title: string;
  subtitle?: ReactNode;
  company: any;
  columns: { key: string; label: string; align?: "start" | "end"; render?: (r: any) => ReactNode }[];
  rows: any[];
  totalRow?: { label: string; values: Record<string, ReactNode> };
  onClose: () => void;
}) {
  return (
    <PrintLayout title={title} onClose={onClose}>
      <PrintHeader
        company={company}
        docTitle={title}
        meta={[
          { label: "تاريخ الإصدار", value: new Date().toLocaleDateString("fr-FR") },
          { label: "عدد السجلات", value: fmtNum(rows.length) },
        ]}
      />
      {subtitle && <p className="mb-2 text-[11.5px] text-neutral-600">{subtitle}</p>}
      <PrintTable columns={columns} rows={rows} totalRow={totalRow} />
      <p className="mt-6 text-center text-[10px] text-neutral-500">وثيقة مُصدرة آلياً من نظام النور ERP — المبالغ بالدينار الجزائري</p>
    </PrintLayout>
  );
}

export function StubPanel({ title, note, items }: { title: string; note?: string; items?: string[] }) {
  return (
    <Card className="p-8 text-center" data-testid="panel-stub">
      <div className="mx-auto max-w-lg space-y-3">
        <span className="inline-flex items-center rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400">
          قيد الإنجاز
        </span>
        <h2 className="text-lg font-bold">{title}</h2>
        <p className="text-sm text-muted-foreground">
          {note || "هذه الوحدة مبرمجة في المرحلة الثانية. واجهة برمجة التطبيقات (API) وقاعدة البيانات جاهزتان بالكامل."}
        </p>
        {items?.length ? (
          <ul className="mx-auto inline-block space-y-1 text-start text-xs text-muted-foreground">
            {items.map((i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-primary" /> {i}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Card>
  );
}
