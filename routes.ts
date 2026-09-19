import type { Express, Request, Response, NextFunction } from "express";
import type { Server } from "node:http";
import fs from "node:fs";
import path from "node:path";
import { db, BACKUP_DIR, DB_PATH, getTaxConfig } from "./db";
import { computePayslip } from "./payroll";
import { canRead, canWrite, permissionsFor, PERMISSIONS } from "./permissions";

/* ------------------------------------------------------------- auth store */

type SessionUser = { id: number; username: string; name: string; role: string };
const sessions = new Map<string, SessionUser>();

function newToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

declare global {
  namespace Express {
    interface Request {
      user?: SessionUser;
    }
  }
}

function auth(req: Request, res: Response, next: NextFunction) {
  const token = (req.headers["x-auth-token"] as string) || (req.query.token as string);
  const user = token ? sessions.get(token) : undefined;
  if (!user) return res.status(401).json({ message: "غير مصرح — يرجى تسجيل الدخول" });
  req.user = user;
  next();
}

function guard(mod: string, mode: "read" | "write") {
  return (req: Request, res: Response, next: NextFunction) => {
    const role = req.user!.role;
    const ok = mode === "read" ? canRead(role, mod) : canWrite(role, mod);
    if (!ok) return res.status(403).json({ message: `ممنوع — الدور «${role}» لا يملك صلاحية ${mode === "read" ? "الاطلاع على" : "التعديل في"} هذه الوحدة` });
    next();
  };
}

/* ------------------------------------------------------------- audit log */

function logAudit(
  user: SessionUser | undefined,
  action: string,
  module: string,
  recordId: any,
  before: any,
  after: any,
) {
  db.prepare(
    "INSERT INTO audit_log (user_id,username,action,module,record_id,before_value,after_value) VALUES (?,?,?,?,?,?,?)",
  ).run(
    user?.id ?? null,
    user?.name ?? user?.username ?? "نظام",
    action,
    module,
    recordId == null ? null : String(recordId),
    before ? JSON.stringify(before) : null,
    after ? JSON.stringify(after) : null,
  );
}

/* ------------------------------------------------------------- helpers */

function columnsOf(table: string): string[] {
  return db.prepare(`PRAGMA table_info(${table})`).all().map((c: any) => c.name);
}

function pickCols(table: string, body: any) {
  const cols = columnsOf(table).filter((c) => c !== "id");
  const out: Record<string, any> = {};
  for (const c of cols) if (body[c] !== undefined) out[c] = body[c] === "" ? null : body[c];
  return out;
}

type CrudOpts = {
  module: string;
  arLabel: string;
  orderBy?: string;
  filters?: string[];
  search?: string[];
  beforeInsert?: (data: any, req: Request) => void;
  afterInsert?: (row: any, req: Request) => void;
  afterUpdate?: (row: any, before: any, req: Request) => void;
};

function crud(app: Express, route: string, table: string, opts: CrudOpts) {
  const base = `/api/${route}`;

  app.get(base, auth, guard(opts.module, "read"), (req, res) => {
    const where: string[] = [];
    const params: any[] = [];
    for (const f of opts.filters || []) {
      const v = req.query[f];
      if (v !== undefined && v !== "" && v !== "all") {
        if (f.endsWith("_month") || f === "month_key") {
          where.push(`substr(date,1,7) = ?`);
        } else {
          where.push(`${f} = ?`);
        }
        params.push(v);
      }
    }
    const q = (req.query.q as string)?.trim();
    if (q && opts.search?.length) {
      where.push("(" + opts.search.map((s) => `${s} LIKE ?`).join(" OR ") + ")");
      opts.search.forEach(() => params.push(`%${q}%`));
    }
    const sql = `SELECT * FROM ${table} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY ${opts.orderBy || "id DESC"}`;
    res.json(db.prepare(sql).all(...params));
  });

  app.get(`${base}/:id`, auth, guard(opts.module, "read"), (req, res) => {
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    if (!row) return res.status(404).json({ message: "السجل غير موجود" });
    res.json(row);
  });

  app.post(base, auth, guard(opts.module, "write"), (req, res) => {
    const data = pickCols(table, req.body);
    opts.beforeInsert?.(data, req);
    const keys = Object.keys(data);
    if (!keys.length) return res.status(400).json({ message: "لا توجد بيانات صالحة" });
    const info = db
      .prepare(`INSERT INTO ${table} (${keys.join(",")}) VALUES (${keys.map(() => "?").join(",")})`)
      .run(...keys.map((k) => data[k]));
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(info.lastInsertRowid);
    logAudit(req.user, "إنشاء", opts.arLabel, row.id, null, row);
    opts.afterInsert?.(row, req);
    res.status(201).json(row);
  });

  app.patch(`${base}/:id`, auth, guard(opts.module, "write"), (req, res) => {
    const before = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    if (!before) return res.status(404).json({ message: "السجل غير موجود" });
    const data = pickCols(table, req.body);
    const keys = Object.keys(data);
    if (keys.length)
      db.prepare(`UPDATE ${table} SET ${keys.map((k) => `${k} = ?`).join(",")} WHERE id = ?`).run(
        ...keys.map((k) => data[k]),
        req.params.id,
      );
    const row = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    logAudit(req.user, "تعديل", opts.arLabel, row.id, before, row);
    opts.afterUpdate?.(row, before, req);
    res.json(row);
  });

  app.delete(`${base}/:id`, auth, guard(opts.module, "write"), (req, res) => {
    const before = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(req.params.id);
    if (!before) return res.status(404).json({ message: "السجل غير موجود" });
    db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(req.params.id);
    logAudit(req.user, "حذف", opts.arLabel, req.params.id, before, null);
    res.json({ ok: true });
  });
}

const MONTH_KEY = (y: any, m: any) => `${y}-${String(m).padStart(2, "0")}`;

/* ------------------------------------------------------------- routes */

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  /* ---------- auth ---------- */
  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body || {};
    const u = db
      .prepare("SELECT * FROM users WHERE username = ? AND password = ? AND active = 1")
      .get(String(username || "").trim(), String(password || ""));
    if (!u) return res.status(401).json({ message: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    const token = newToken();
    const su: SessionUser = { id: u.id, username: u.username, name: u.name, role: u.role };
    sessions.set(token, su);
    logAudit(su, "دخول", "المستخدمون", u.id, null, { username: u.username });
    res.json({ token, user: su, permissions: permissionsFor(u.role) });
  });

  app.get("/api/auth/me", auth, (req, res) => {
    res.json({ user: req.user, permissions: permissionsFor(req.user!.role) });
  });

  app.post("/api/auth/logout", auth, (req, res) => {
    const token = (req.headers["x-auth-token"] as string) || "";
    sessions.delete(token);
    res.json({ ok: true });
  });

  app.get("/api/permissions", (_req, res) => res.json(PERMISSIONS));

  /* ---------- generic CRUD for every table ---------- */
  crud(app, "employees", "employees", {
    module: "hr", arLabel: "الموظفون", orderBy: "matricule ASC",
    filters: ["department", "status"], search: ["first_name", "last_name", "matricule", "position", "department"],
  });
  crud(app, "attendance", "attendance", {
    module: "hr", arLabel: "الحضور", orderBy: "date DESC, id DESC",
    filters: ["employee_id", "date", "status"],
  });
  crud(app, "leaves", "leaves", {
    module: "hr", arLabel: "الإجازات", filters: ["employee_id", "status", "type"],
  });
  crud(app, "performance", "performance_reviews", {
    module: "hr", arLabel: "تقييم الأداء", filters: ["employee_id", "period"],
  });
  crud(app, "advances", "advances", {
    module: "advances", arLabel: "التسبيقات", filters: ["employee_id", "status"],
    beforeInsert: (d) => {
      const amount = +d.amount || 0;
      const inst = Math.max(1, +d.installments || 1);
      d.installments = inst;
      d.monthly_deduction = Math.round(amount / inst);
      d.deducted = d.deducted ?? 0;
      d.remaining = amount - (d.deducted || 0);
      d.status = d.status || "قيد الانتظار";
    },
  });
  crud(app, "products", "products", {
    module: "inventory", arLabel: "المنتجات", orderBy: "ref ASC",
    filters: ["category", "type"], search: ["name", "ref", "category"],
  });
  crud(app, "stock-moves", "stock_moves", {
    module: "inventory", arLabel: "حركة المخزون", orderBy: "date DESC, id DESC",
    filters: ["product_id", "kind"],
    afterInsert: (row) => {
      const delta = row.kind === "دخول" ? row.quantity : -row.quantity;
      db.prepare("UPDATE products SET quantity = quantity + ? WHERE id = ?").run(delta, row.product_id);
    },
  });
  crud(app, "suppliers", "suppliers", {
    module: "inventory", arLabel: "الموردون", orderBy: "name ASC", search: ["name", "nif", "rc", "city"],
  });
  crud(app, "purchase-orders", "purchase_orders", {
    module: "inventory", arLabel: "طلبيات الشراء", orderBy: "date DESC", filters: ["supplier_id", "status"], search: ["ref"],
  });
  crud(app, "purchase-order-lines", "purchase_order_lines", {
    module: "inventory", arLabel: "سطور طلبية الشراء", orderBy: "id ASC", filters: ["order_id"],
    afterInsert: (row) => recalcPurchaseOrder(row.order_id),
    afterUpdate: (row) => recalcPurchaseOrder(row.order_id),
  });
  crud(app, "clients", "clients", {
    module: "crm", arLabel: "العملاء", orderBy: "name ASC", filters: ["city", "type"], search: ["name", "nif", "rc", "city", "phone"],
  });
  crud(app, "interactions", "interactions", {
    module: "crm", arLabel: "التعاملات", orderBy: "date DESC", filters: ["client_id", "kind"],
  });
  crud(app, "complaints", "complaints", {
    module: "crm", arLabel: "الشكاوى", orderBy: "date DESC", filters: ["client_id", "status", "priority"], search: ["subject"],
  });
  crud(app, "invoice-templates", "invoice_templates", {
    module: "invoicing", arLabel: "نماذج الفواتير", orderBy: "id ASC",
  });
  crud(app, "invoice-lines", "invoice_lines", {
    module: "invoicing", arLabel: "سطور الفاتورة", orderBy: "id ASC", filters: ["invoice_id"],
  });
  crud(app, "payments", "payments", {
    module: "accounting", arLabel: "المدفوعات", orderBy: "date DESC", filters: ["invoice_id", "client_id", "direction"],
    afterInsert: (row) => {
      if (row.invoice_id) recalcInvoice(row.invoice_id);
    },
  });
  crud(app, "expenses", "expenses", {
    module: "accounting", arLabel: "المصاريف", orderBy: "date DESC", filters: ["category", "supplier_id"], search: ["description", "category", "ref"],
    beforeInsert: (d) => {
      const ht = +d.amount_ht || 0;
      const rate = d.tva_rate === undefined ? 19 : +d.tva_rate;
      d.tva_rate = rate;
      d.tva_amount = Math.round((ht * rate) / 100);
      d.amount_ttc = ht + d.tva_amount;
    },
  });
  crud(app, "debts", "debts", {
    module: "accounting", arLabel: "الديون", orderBy: "due_date ASC", filters: ["party_type", "status"], search: ["party_name"],
  });
  crud(app, "projects", "projects", {
    module: "projects", arLabel: "المشاريع", orderBy: "id DESC", filters: ["status", "client_id"], search: ["name", "code"],
  });
  crud(app, "tasks", "tasks", {
    module: "projects", arLabel: "المهام", orderBy: "id DESC", filters: ["project_id", "status", "assignee_id"], search: ["title"],
  });
  crud(app, "calendar-events", "calendar_events", {
    module: "projects", arLabel: "التقويم", orderBy: "date ASC", filters: ["kind"],
  });
  crud(app, "users", "users", {
    module: "settings", arLabel: "المستخدمون", orderBy: "id ASC",
  });
  crud(app, "tax-settings", "tax_settings", {
    module: "settings", arLabel: "الإعدادات الجبائية", orderBy: "year DESC",
  });
  crud(app, "g50", "g50_declarations", {
    module: "fiscal", arLabel: "تصريحات G50", orderBy: "year DESC, month DESC", filters: ["year", "status"],
  });
  crud(app, "balance-sheets", "balance_sheets", {
    module: "fiscal", arLabel: "الميزانيات السنوية", orderBy: "year DESC", filters: ["year"],
  });

  /* ---------- invoices (gapless numbering) ---------- */
  function recalcInvoice(invoiceId: number) {
    const paid = db
      .prepare("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE invoice_id = ?")
      .get(invoiceId).s;
    const inv = db.prepare("SELECT * FROM invoices WHERE id = ?").get(invoiceId);
    if (!inv) return;
    const status = paid >= inv.total_ttc - 0.5 ? "مدفوعة" : paid > 0 ? "مدفوعة جزئياً" : "غير مدفوعة";
    db.prepare("UPDATE invoices SET paid_amount = ?, status = ? WHERE id = ?").run(paid, status, invoiceId);
    db.prepare("UPDATE debts SET paid = ?, status = ? WHERE invoice_id = ?").run(
      paid, paid >= inv.total_ttc - 0.5 ? "مسدد" : "مفتوح", invoiceId,
    );
  }

  const nextInvoiceNumber = db.transaction((year: number) => {
    const prefix = (db.prepare("SELECT value FROM settings WHERE key='invoice_prefix'").get()?.value) || "FA";
    db.prepare("INSERT INTO invoice_counters (year,last_number) VALUES (?,0) ON CONFLICT(year) DO NOTHING").run(year);
    db.prepare("UPDATE invoice_counters SET last_number = last_number + 1 WHERE year = ?").run(year);
    const n = db.prepare("SELECT last_number FROM invoice_counters WHERE year = ?").get(year).last_number;
    return `${prefix}-${year}-${String(n).padStart(5, "0")}`;
  });

  app.get("/api/invoices", auth, guard("invoicing", "read"), (req, res) => {
    const where: string[] = [];
    const params: any[] = [];
    if (req.query.status && req.query.status !== "all") { where.push("i.status = ?"); params.push(req.query.status); }
    if (req.query.client_id) { where.push("i.client_id = ?"); params.push(req.query.client_id); }
    if (req.query.year) { where.push("substr(i.date,1,4) = ?"); params.push(String(req.query.year)); }
    if (req.query.month) { where.push("substr(i.date,1,7) = ?"); params.push(String(req.query.month)); }
    const q = (req.query.q as string)?.trim();
    if (q) { where.push("(i.number LIKE ? OR c.name LIKE ?)"); params.push(`%${q}%`, `%${q}%`); }
    res.json(
      db.prepare(
        `SELECT i.*, c.name client_name FROM invoices i LEFT JOIN clients c ON c.id = i.client_id
         ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY i.date DESC, i.id DESC`,
      ).all(...params),
    );
  });

  app.get("/api/invoices/:id", auth, guard("invoicing", "read"), (req, res) => {
    const inv = db
      .prepare("SELECT i.*, c.name client_name, c.nif client_nif, c.nis client_nis, c.rc client_rc, c.address client_address, c.city client_city, c.phone client_phone FROM invoices i LEFT JOIN clients c ON c.id=i.client_id WHERE i.id = ?")
      .get(req.params.id);
    if (!inv) return res.status(404).json({ message: "الفاتورة غير موجودة" });
    inv.lines = db.prepare("SELECT * FROM invoice_lines WHERE invoice_id = ?").all(inv.id);
    inv.payments = db.prepare("SELECT * FROM payments WHERE invoice_id = ?").all(inv.id);
    inv.template = inv.template_id ? db.prepare("SELECT * FROM invoice_templates WHERE id = ?").get(inv.template_id) : null;
    res.json(inv);
  });

  app.post("/api/invoices", auth, guard("invoicing", "write"), (req, res) => {
    const body = req.body || {};
    const lines: any[] = Array.isArray(body.lines) ? body.lines : [];
    if (!lines.length) return res.status(400).json({ message: "الفاتورة تحتاج سطراً واحداً على الأقل" });
    const date = body.date || new Date().toISOString().slice(0, 10);
    const year = +date.slice(0, 4);
    const cfg = getTaxConfig(year);
    const tmpl = body.template_id ? db.prepare("SELECT * FROM invoice_templates WHERE id = ?").get(body.template_id) : null;

    const result = db.transaction(() => {
      const number = nextInvoiceNumber(year);
      let ht = 0, tva = 0;
      const prepared = lines.map((l) => {
        const qty = +l.quantity || 1;
        const price = +l.unit_price || 0;
        const disc = +l.discount || 0;
        const rate = l.tva_rate !== undefined ? +l.tva_rate : (tmpl ? tmpl.tva_rate : cfg.tva_normal);
        const lineHt = qty * price * (1 - disc / 100);
        ht += lineHt;
        tva += (lineHt * rate) / 100;
        return { ...l, quantity: qty, unit_price: price, discount: disc, tva_rate: rate, total_ht: Math.round(lineHt) };
      });
      ht = Math.round(ht); tva = Math.round(tva);
      const timbre = body.payment_method === "نقداً" ? Math.round((ht + tva) * (cfg.timbre_rate / 100)) : 0;
      const ttc = ht + tva + timbre;
      // جدول الأقساط عند النماذج بالتقسيط
      const instCount = body.installments_count !== undefined ? +body.installments_count : (tmpl?.has_installments ? tmpl.installments_count : 0);
      let installments: any[] | null = null;
      if (instCount && instCount > 1) {
        const base = Math.floor(ttc / instCount);
        installments = Array.from({ length: instCount }, (_, i) => {
          const d = new Date(date);
          d.setMonth(d.getMonth() + i + 1);
          return {
            n: i + 1,
            due_date: d.toISOString().slice(0, 10),
            amount: i === instCount - 1 ? ttc - base * (instCount - 1) : base,
          };
        });
      }
      const info = db.prepare(
        `INSERT INTO invoices (number,template_id,client_id,kind,date,due_date,status,total_ht,total_tva,timbre,total_ttc,paid_amount,notes,created_by,installments_json,payment_method)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,0,?,?,?,?)`,
      ).run(
        number, body.template_id || null, body.client_id || null, tmpl?.kind || body.kind || "قياسي",
        date, body.due_date || null, "غير مدفوعة", ht, tva, timbre, ttc, body.notes || "", req.user!.name,
        installments ? JSON.stringify(installments) : null, body.payment_method || "تحويل بنكي",
      );
      const invId = Number(info.lastInsertRowid);
      const lineStmt = db.prepare(
        "INSERT INTO invoice_lines (invoice_id,product_id,description,quantity,unit_price,discount,tva_rate,total_ht) VALUES (?,?,?,?,?,?,?,?)",
      );
      for (const l of prepared) {
        lineStmt.run(invId, l.product_id || null, l.description || "", l.quantity, l.unit_price, l.discount, l.tva_rate, l.total_ht);
        if (l.product_id && tmpl?.kind !== "بريفورما") {
          db.prepare("INSERT INTO stock_moves (product_id,kind,quantity,reason,ref,date,user_id) VALUES (?,?,?,?,?,?,?)")
            .run(l.product_id, "خروج", l.quantity, `بيع - فاتورة ${number}`, number, date, req.user!.id);
          db.prepare("UPDATE products SET quantity = quantity - ? WHERE id = ? AND type = 'منتج'").run(l.quantity, l.product_id);
        }
      }
      const client = body.client_id ? db.prepare("SELECT name FROM clients WHERE id = ?").get(body.client_id) : null;
      db.prepare("INSERT INTO debts (party_type,party_id,party_name,invoice_id,amount,paid,due_date,status,notes) VALUES (?,?,?,?,?,0,?,?,?)")
        .run("عميل", body.client_id || null, client?.name || "", invId, ttc, body.due_date || null, "مفتوح", "");
      return db.prepare("SELECT * FROM invoices WHERE id = ?").get(invId);
    })();

    logAudit(req.user, "إنشاء", "الفواتير", result.id, null, result);
    res.status(201).json(result);
  });

  app.patch("/api/invoices/:id", auth, guard("invoicing", "write"), (req, res) => {
    const before = db.prepare("SELECT * FROM invoices WHERE id = ?").get(req.params.id);
    if (!before) return res.status(404).json({ message: "الفاتورة غير موجودة" });
    const data = pickCols("invoices", { ...req.body, number: undefined });
    const keys = Object.keys(data);
    if (keys.length)
      db.prepare(`UPDATE invoices SET ${keys.map((k) => `${k} = ?`).join(",")} WHERE id = ?`).run(...keys.map((k) => data[k]), req.params.id);
    const row = db.prepare("SELECT * FROM invoices WHERE id = ?").get(req.params.id);
    logAudit(req.user, "تعديل", "الفواتير", row.id, before, row);
    res.json(row);
  });

  app.delete("/api/invoices/:id", auth, guard("invoicing", "write"), (req, res) => {
    const before = db.prepare("SELECT * FROM invoices WHERE id = ?").get(req.params.id);
    if (!before) return res.status(404).json({ message: "الفاتورة غير موجودة" });
    // الترقيم يبقى بدون فراغات: تُلغى الفاتورة ولا يُحذف رقمها
    db.prepare("UPDATE invoices SET status = 'ملغاة' WHERE id = ?").run(req.params.id);
    const row = db.prepare("SELECT * FROM invoices WHERE id = ?").get(req.params.id);
    logAudit(req.user, "إلغاء", "الفواتير", row.id, before, row);
    res.json({ ok: true, cancelled: true, invoice: row });
  });

  /* ---------- settings ---------- */
  app.get("/api/settings", auth, (req, res) => {
    const rows = db.prepare("SELECT key, value FROM settings").all();
    const out: Record<string, string> = {};
    rows.forEach((r: any) => (out[r.key] = r.value));
    res.json(out);
  });

  app.put("/api/settings", auth, guard("settings", "write"), (req, res) => {
    const before: Record<string, string> = {};
    db.prepare("SELECT key,value FROM settings").all().forEach((r: any) => (before[r.key] = r.value));
    const stmt = db.prepare("INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value");
    Object.entries(req.body || {}).forEach(([k, v]) => stmt.run(k, String(v ?? "")));
    logAudit(req.user, "تعديل", "الإعدادات", null, before, req.body);
    res.json({ ok: true });
  });

  app.get("/api/tax-config/:year", auth, (req, res) => {
    res.json(getTaxConfig(+req.params.year));
  });

  /* ---------- payroll ---------- */
  app.get("/api/payslips", auth, guard("payroll", "read"), (req, res) => {
    const where: string[] = [];
    const params: any[] = [];
    if (req.query.year) { where.push("p.year = ?"); params.push(+(req.query.year as string)); }
    if (req.query.month && req.query.month !== "all") { where.push("p.month = ?"); params.push(+(req.query.month as string)); }
    if (req.query.employee_id) { where.push("p.employee_id = ?"); params.push(req.query.employee_id); }
    const q = (req.query.q as string)?.trim();
    if (q) { where.push("(e.first_name LIKE ? OR e.last_name LIKE ? OR e.matricule LIKE ? OR p.ref LIKE ?)"); params.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`); }
    res.json(
      db.prepare(
        `SELECT p.*, e.first_name, e.last_name, e.matricule, e.position, e.department, e.cnas_number,
                e.bank_account, e.hire_date, e.contract_type, e.national_id
         FROM payslips p JOIN employees e ON e.id = p.employee_id
         ${where.length ? "WHERE " + where.join(" AND ") : ""}
         ORDER BY p.year DESC, p.month DESC, e.matricule ASC`,
      ).all(...params),
    );
  });

  app.get("/api/payslips/:id", auth, guard("payroll", "read"), (req, res) => {
    const row = db.prepare(
      `SELECT p.*, e.first_name, e.last_name, e.matricule, e.position, e.department, e.cnas_number, e.bank_account, e.hire_date, e.national_id, e.contract_type
       FROM payslips p JOIN employees e ON e.id = p.employee_id WHERE p.id = ?`,
    ).get(req.params.id);
    if (!row) return res.status(404).json({ message: "كشف الراتب غير موجود" });
    res.json(row);
  });

  app.post("/api/payroll/generate", auth, guard("payroll", "write"), (req, res) => {
    const year = +(req.body?.year || new Date().getFullYear());
    const month = +(req.body?.month || new Date().getMonth() + 1);
    const bonuses: Record<string, number> = req.body?.bonuses || {};
    const cfg = getTaxConfig(year);
    const employees = db.prepare("SELECT * FROM employees WHERE status = 'نشط'").all();
    let created = 0, skipped = 0;

    const run = db.transaction(() => {
      for (const e of employees) {
        const exists = db.prepare("SELECT id FROM payslips WHERE employee_id = ? AND year = ? AND month = ?").get(e.id, year, month);
        if (exists) { skipped++; continue; }
        // الخصم التلقائي للتسبيقات المقبولة ذات رصيد متبقٍ
        const advances = db
          .prepare("SELECT * FROM advances WHERE employee_id = ? AND status = 'مقبولة' AND remaining > 0 ORDER BY id ASC")
          .all(e.id);
        let advTotal = 0;
        for (const a of advances) {
          const take = Math.min(a.monthly_deduction, a.remaining);
          if (take <= 0) continue;
          advTotal += take;
          const newDeducted = a.deducted + take;
          const newRemaining = a.remaining - take;
          db.prepare("UPDATE advances SET deducted = ?, remaining = ?, status = ? WHERE id = ?")
            .run(newDeducted, newRemaining, newRemaining <= 0 ? "مسددة" : "مقبولة", a.id);
          logAudit(req.user, "تعديل", "التسبيقات", a.id, a, { ...a, deducted: newDeducted, remaining: newRemaining });
          break; // قسط واحد شهرياً لكل موظف
        }
        const c = computePayslip(
          { base_salary: e.base_salary, allowances: e.allowances, bonus: +(bonuses[String(e.id)] || 0), advance_deduction: advTotal },
          cfg,
        );
        const info = db.prepare(
          `INSERT INTO payslips (ref,employee_id,year,month,base_salary,allowances,bonus,gross,cnas_employee,cnas_employer,taxable,irg,advance_deduction,other_deductions,net,days_worked)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        ).run(
          `BP-${year}${String(month).padStart(2, "0")}-${e.matricule}`, e.id, year, month,
          c.base_salary, c.allowances, c.bonus, c.gross, c.cnas_employee, c.cnas_employer,
          c.taxable, c.irg, c.advance_deduction, c.other_deductions, c.net, 22,
        );
        created++;
        logAudit(req.user, "إنشاء", "كشوف الرواتب", info.lastInsertRowid, null, { employee: e.matricule, year, month, net: c.net });
      }
    });
    run();
    const summary = db
      .prepare("SELECT COUNT(*) count, COALESCE(SUM(gross),0) gross, COALESCE(SUM(net),0) net, COALESCE(SUM(irg),0) irg, COALESCE(SUM(cnas_employee),0) cnas FROM payslips WHERE year = ? AND month = ?")
      .get(year, month);
    res.json({ created, skipped, year, month, summary });
  });

  app.delete("/api/payroll/:year/:month", auth, guard("payroll", "write"), (req, res) => {
    const { year, month } = req.params;
    const rows = db.prepare("SELECT * FROM payslips WHERE year = ? AND month = ?").all(+year, +month);
    db.prepare("DELETE FROM payslips WHERE year = ? AND month = ?").run(+year, +month);
    logAudit(req.user, "حذف", "كشوف الرواتب", `${year}-${month}`, { count: rows.length }, null);
    res.json({ deleted: rows.length });
  });

  app.get("/api/payroll/summary/:year", auth, guard("payroll", "read"), (req, res) => {
    res.json(
      db.prepare(
        `SELECT month, COUNT(*) count, SUM(gross) gross, SUM(net) net, SUM(irg) irg, SUM(cnas_employee) cnas_employee, SUM(cnas_employer) cnas_employer, SUM(advance_deduction) advances
         FROM payslips WHERE year = ? GROUP BY month ORDER BY month`,
      ).all(+req.params.year),
    );
  });

  /* ---------- advances extras ---------- */
  app.get("/api/advances-balances", auth, guard("advances", "read"), (_req, res) => {
    res.json(
      db.prepare(
        `SELECT e.id employee_id, e.matricule, e.first_name, e.last_name, e.base_salary,
                COALESCE(SUM(CASE WHEN a.status IN ('مقبولة','مسددة') THEN a.amount END),0) total,
                COALESCE(SUM(CASE WHEN a.status = 'مقبولة' THEN a.remaining END),0) remaining,
                COALESCE(SUM(CASE WHEN a.status IN ('مقبولة','مسددة') THEN a.deducted END),0) deducted
         FROM employees e LEFT JOIN advances a ON a.employee_id = e.id
         GROUP BY e.id ORDER BY remaining DESC, e.matricule`,
      ).all(),
    );
  });

  app.post("/api/advances/:id/status", auth, guard("advances", "write"), (req, res) => {
    const before = db.prepare("SELECT * FROM advances WHERE id = ?").get(req.params.id);
    if (!before) return res.status(404).json({ message: "الطلب غير موجود" });
    const status = req.body?.status;
    db.prepare("UPDATE advances SET status = ? WHERE id = ?").run(status, req.params.id);
    const row = db.prepare("SELECT * FROM advances WHERE id = ?").get(req.params.id);
    logAudit(req.user, "تعديل", "التسبيقات", row.id, before, row);
    res.json(row);
  });

  /* ---------- HR extras ---------- */
  app.get("/api/hr/summary", auth, guard("hr", "read"), (_req, res) => {
    const total = db.prepare("SELECT COUNT(*) c FROM employees WHERE status='نشط'").get().c;
    const byDept = db.prepare("SELECT department, COUNT(*) count, SUM(base_salary) payroll FROM employees GROUP BY department").all();
    const today = new Date().toISOString().slice(0, 10);
    const attendanceToday = db.prepare("SELECT status, COUNT(*) count FROM attendance WHERE date = ? GROUP BY status").all(today);
    const pendingLeaves = db.prepare("SELECT COUNT(*) c FROM leaves WHERE status='قيد الانتظار'").get().c;
    const avgScore = db.prepare("SELECT ROUND(AVG(total_score),2) s FROM performance_reviews").get().s;
    res.json({ total, byDept, attendanceToday, pendingLeaves, avgScore });
  });

  app.get("/api/hr/attendance-stats", auth, guard("hr", "read"), (req, res) => {
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    res.json(
      db.prepare(
        `SELECT e.id, e.matricule, e.first_name, e.last_name,
           SUM(CASE WHEN a.status='حاضر' THEN 1 ELSE 0 END) present,
           SUM(CASE WHEN a.status='غائب' THEN 1 ELSE 0 END) absent,
           SUM(CASE WHEN a.status='متأخر' THEN 1 ELSE 0 END) late,
           COALESCE(SUM(a.hours),0) hours
         FROM employees e LEFT JOIN attendance a ON a.employee_id = e.id AND substr(a.date,1,7) = ?
         GROUP BY e.id ORDER BY e.matricule`,
      ).all(month),
    );
  });

  /* ---------- fiscal: G50 aggregation ---------- */
  app.get("/api/fiscal/g50/compute", auth, guard("fiscal", "read"), (req, res) => {
    const year = +(req.query.year || new Date().getFullYear());
    const month = +(req.query.month || new Date().getMonth() + 1);
    const key = MONTH_KEY(year, month);
    const cfg = getTaxConfig(year);
    const inv = db.prepare(
      "SELECT COALESCE(SUM(total_ht),0) ht, COALESCE(SUM(total_tva),0) tva, COUNT(*) count FROM invoices WHERE substr(date,1,7) = ? AND status != 'ملغاة'",
    ).get(key);
    const exp = db.prepare("SELECT COALESCE(SUM(tva_amount),0) tva, COALESCE(SUM(amount_ht),0) ht FROM expenses WHERE substr(date,1,7) = ?").get(key);
    const irg = db.prepare("SELECT COALESCE(SUM(irg),0) s FROM payslips WHERE year = ? AND month = ?").get(year, month).s;
    const tvaDue = Math.round(inv.tva - exp.tva);
    const tap = Math.round((inv.ht * cfg.tap) / 100);
    const existing = db.prepare("SELECT * FROM g50_declarations WHERE year = ? AND month = ?").get(year, month);
    res.json({
      year, month,
      turnover: inv.ht,
      invoices_count: inv.count,
      tva_collected: inv.tva,
      tva_deductible: exp.tva,
      tva_due: Math.max(0, tvaDue),
      tva_credit: tvaDue < 0 ? Math.abs(tvaDue) : 0,
      irg_salaries: irg,
      tap,
      total: Math.max(0, tvaDue) + irg + tap,
      rates: { tva_normal: cfg.tva_normal, tva_reduced: cfg.tva_reduced, tap: cfg.tap },
      existing: existing || null,
      deadline: `${year}-${String(month === 12 ? 12 : month + 1).padStart(2, "0")}-20`,
    });
  });

  app.post("/api/fiscal/g50", auth, guard("fiscal", "write"), (req, res) => {
    const b = req.body || {};
    const before = db.prepare("SELECT * FROM g50_declarations WHERE year = ? AND month = ?").get(+b.year, +b.month);
    db.prepare(
      `INSERT INTO g50_declarations (year,month,turnover,tva_collected,tva_deductible,tva_due,irg_salaries,tap,total,status,declared_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(year,month) DO UPDATE SET turnover=excluded.turnover, tva_collected=excluded.tva_collected,
         tva_deductible=excluded.tva_deductible, tva_due=excluded.tva_due, irg_salaries=excluded.irg_salaries,
         tap=excluded.tap, total=excluded.total, status=excluded.status, declared_at=excluded.declared_at`,
    ).run(
      +b.year, +b.month, b.turnover || 0, b.tva_collected || 0, b.tva_deductible || 0, b.tva_due || 0,
      b.irg_salaries || 0, b.tap || 0, b.total || 0, b.status || "مودع", b.declared_at || new Date().toISOString().slice(0, 10),
    );
    const row = db.prepare("SELECT * FROM g50_declarations WHERE year = ? AND month = ?").get(+b.year, +b.month);
    logAudit(req.user, before ? "تعديل" : "إنشاء", "تصريحات G50", row.id, before, row);
    res.status(before ? 200 : 201).json(row);
  });

  /* ---------- fiscal: annual bilan / TCR ---------- */
  app.get("/api/fiscal/bilan/compute", auth, guard("fiscal", "read"), (req, res) => {
    const year = +(req.query.year || new Date().getFullYear());
    const y = String(year);
    const revenue = db.prepare("SELECT COALESCE(SUM(total_ht),0) s FROM invoices WHERE substr(date,1,4) = ? AND status != 'ملغاة'").get(y).s;
    const purchases = db.prepare("SELECT COALESCE(SUM(amount_ht),0) s FROM expenses WHERE substr(date,1,4) = ? AND category = 'مشتريات'").get(y).s;
    const services = db.prepare("SELECT COALESCE(SUM(amount_ht),0) s FROM expenses WHERE substr(date,1,4) = ? AND category IN ('إيجار','كهرباء وماء','نقل وشحن','اتصالات','صيانة','تأمينات','مصاريف إدارية')").get(y).s;
    const payroll = db.prepare("SELECT COALESCE(SUM(gross + cnas_employer),0) s FROM payslips WHERE year = ?").get(year).s;
    const taxes = db.prepare("SELECT COALESCE(SUM(tap + tva_due),0) s FROM g50_declarations WHERE year = ?").get(year).s;
    const stockValue = db.prepare("SELECT COALESCE(SUM(quantity * purchase_price),0) s FROM products").get().s;
    const clientsDebt = db.prepare("SELECT COALESCE(SUM(amount - paid),0) s FROM debts WHERE status='مفتوح' AND party_type='عميل'").get().s;
    const cash = db.prepare("SELECT COALESCE(SUM(amount),0) s FROM payments WHERE direction='مدخول' AND substr(date,1,4) = ?").get(y).s;
    const expensesTotal = purchases + services + payroll + taxes;
    const net = revenue - expensesTotal;
    const capital = +(db.prepare("SELECT value FROM settings WHERE key='company_capital'").get()?.value || 0);
    const bilan = {
      year,
      assets: [
        { label: "مخزونات (بسعر التكلفة)", amount: Math.round(stockValue) },
        { label: "حسابات العملاء (ديون مفتوحة)", amount: Math.round(clientsDebt) },
        { label: "الخزينة (تحصيلات السنة)", amount: Math.round(cash) },
      ],
      liabilities: [
        { label: "رأس المال الاجتماعي", amount: capital },
        { label: "نتيجة السنة المالية", amount: Math.round(net) },
        { label: "ديون جبائية (G50 السنة)", amount: Math.round(taxes) },
      ],
      tcr: [
        { label: "رقم الأعمال (خارج الرسم)", amount: Math.round(revenue) },
        { label: "مشتريات مستهلكة", amount: Math.round(purchases) },
        { label: "خدمات خارجية وأعباء أخرى", amount: Math.round(services) },
        { label: "أعباء المستخدمين (الأجور + CNAS مستخدم)", amount: Math.round(payroll) },
        { label: "الضرائب والرسوم (TAP + TVA)", amount: Math.round(taxes) },
        { label: "النتيجة الصافية للسنة المالية", amount: Math.round(net) },
      ],
      revenue: Math.round(revenue),
      expenses_total: Math.round(expensesTotal),
      net_result: Math.round(net),
      existing: db.prepare("SELECT * FROM balance_sheets WHERE year = ?").get(year) || null,
    };
    res.json(bilan);
  });

  app.post("/api/fiscal/bilan", auth, guard("fiscal", "write"), (req, res) => {
    const b = req.body || {};
    const before = db.prepare("SELECT * FROM balance_sheets WHERE year = ?").get(+b.year);
    db.prepare(
      `INSERT INTO balance_sheets (year,assets,liabilities,tcr,revenue,expenses_total,net_result,status)
       VALUES (?,?,?,?,?,?,?,?)
       ON CONFLICT(year) DO UPDATE SET assets=excluded.assets, liabilities=excluded.liabilities, tcr=excluded.tcr,
         revenue=excluded.revenue, expenses_total=excluded.expenses_total, net_result=excluded.net_result, status=excluded.status`,
    ).run(
      +b.year, JSON.stringify(b.assets || []), JSON.stringify(b.liabilities || []), JSON.stringify(b.tcr || []),
      b.revenue || 0, b.expenses_total || 0, b.net_result || 0, b.status || "مسودة",
    );
    const row = db.prepare("SELECT * FROM balance_sheets WHERE year = ?").get(+b.year);
    logAudit(req.user, before ? "تعديل" : "إنشاء", "الميزانية السنوية", row.id, before, row);
    res.status(before ? 200 : 201).json(row);
  });

  /* ---------- dashboard ---------- */
  app.get("/api/dashboard", auth, (req, res) => {
    const role = req.user!.role;
    const year = +(req.query.year || new Date().getFullYear());
    const y = String(year);
    const revenue = db.prepare("SELECT COALESCE(SUM(total_ht),0) s FROM invoices WHERE substr(date,1,4)=? AND status!='ملغاة'").get(y).s;
    const revenueTtc = db.prepare("SELECT COALESCE(SUM(total_ttc),0) s FROM invoices WHERE substr(date,1,4)=? AND status!='ملغاة'").get(y).s;
    const expenses = db.prepare("SELECT COALESCE(SUM(amount_ht),0) s FROM expenses WHERE substr(date,1,4)=?").get(y).s;
    const payroll = db.prepare("SELECT COALESCE(SUM(net),0) s FROM payslips WHERE year=?").get(year).s;
    const employees = db.prepare("SELECT COUNT(*) c FROM employees WHERE status='نشط'").get().c;
    const stockValue = db.prepare("SELECT COALESCE(SUM(quantity*purchase_price),0) s FROM products").get().s;
    const lowStock = db.prepare("SELECT id, ref, name, quantity, min_quantity FROM products WHERE type='منتج' AND quantity <= min_quantity ORDER BY quantity ASC").all();
    const unpaid = db.prepare("SELECT COUNT(*) c, COALESCE(SUM(total_ttc-paid_amount),0) s FROM invoices WHERE status IN ('غير مدفوعة','مدفوعة جزئياً')").get();
    const clients = db.prepare("SELECT COUNT(*) c FROM clients").get().c;
    const products = db.prepare("SELECT COUNT(*) c FROM products").get().c;
    const projects = db.prepare("SELECT COUNT(*) c FROM projects WHERE status='قيد التنفيذ'").get().c;
    const openTasks = db.prepare("SELECT COUNT(*) c FROM tasks WHERE status != 'منجزة'").get().c;
    const complaintsOpen = db.prepare("SELECT COUNT(*) c FROM complaints WHERE status != 'محلولة'").get().c;
    const pendingLeaves = db.prepare("SELECT COUNT(*) c FROM leaves WHERE status='قيد الانتظار'").get().c;
    const advancesRemaining = db.prepare("SELECT COALESCE(SUM(remaining),0) s FROM advances WHERE status='مقبولة'").get().s;

    const monthlySales = db.prepare(
      `SELECT substr(date,1,7) month, SUM(total_ht) ht, SUM(total_ttc) ttc, COUNT(*) count
       FROM invoices WHERE substr(date,1,4)=? AND status!='ملغاة' GROUP BY month ORDER BY month`,
    ).all(y);
    const monthlyExpenses = db.prepare(
      `SELECT substr(date,1,7) month, SUM(amount_ht) ht FROM expenses WHERE substr(date,1,4)=? GROUP BY month ORDER BY month`,
    ).all(y);
    const expenseByCategory = db.prepare(
      `SELECT category, SUM(amount_ht) amount FROM expenses WHERE substr(date,1,4)=? GROUP BY category ORDER BY amount DESC`,
    ).all(y);
    const topClients = db.prepare(
      `SELECT c.name, SUM(i.total_ht) amount, COUNT(i.id) invoices FROM invoices i JOIN clients c ON c.id=i.client_id
       WHERE substr(i.date,1,4)=? AND i.status!='ملغاة' GROUP BY c.id ORDER BY amount DESC LIMIT 6`,
    ).all(y);
    const payrollByMonth = db.prepare("SELECT month, SUM(net) net, SUM(gross) gross FROM payslips WHERE year=? GROUP BY month ORDER BY month").all(year);

    // موعد G50: قبل 20 من الشهر
    const now = new Date();
    const g50Deadline = new Date(now.getFullYear(), now.getMonth(), 20);
    if (g50Deadline < now) g50Deadline.setMonth(g50Deadline.getMonth() + 1);
    const daysToG50 = Math.ceil((g50Deadline.getTime() - now.getTime()) / 86400000);

    res.json({
      role, year,
      kpis: {
        revenue: Math.round(revenue), revenue_ttc: Math.round(revenueTtc),
        expenses: Math.round(expenses), payroll: Math.round(payroll),
        net_result: Math.round(revenue - expenses - 0),
        employees, stock_value: Math.round(stockValue),
        unpaid_count: unpaid.c, unpaid_amount: Math.round(unpaid.s),
        low_stock_count: lowStock.length, clients, products, projects, open_tasks: openTasks,
        complaints_open: complaintsOpen, pending_leaves: pendingLeaves,
        advances_remaining: Math.round(advancesRemaining),
        days_to_g50: daysToG50, g50_deadline: g50Deadline.toISOString().slice(0, 10),
      },
      charts: { monthlySales, monthlyExpenses, expenseByCategory, topClients, payrollByMonth },
      lowStock: lowStock.slice(0, 6),
      upcoming: db.prepare("SELECT * FROM calendar_events WHERE date >= date('now') ORDER BY date ASC LIMIT 6").all(),
    });
  });

  /* ---------- directory (أسماء فقط — لكل من يملك جلسة، دون بيانات حساسة) ---------- */
  app.get("/api/directory", auth, (_req, res) => {
    res.json({
      employees: db.prepare("SELECT id, matricule, first_name, last_name, position, department FROM employees WHERE status='نشط' ORDER BY matricule").all(),
      clients: db.prepare("SELECT id, name, city FROM clients ORDER BY name").all(),
      projects: db.prepare("SELECT id, code, name FROM projects ORDER BY id DESC").all(),
    });
  });

  /* ---------- purchase orders: totals + reception ---------- */
  function recalcPurchaseOrder(orderId: number) {
    const lines = db.prepare("SELECT * FROM purchase_order_lines WHERE order_id = ?").all(orderId);
    let ht = 0, tva = 0;
    for (const l of lines) {
      const lineHt = (+l.quantity || 0) * (+l.unit_price || 0);
      ht += lineHt;
      tva += (lineHt * (+l.tva_rate || 0)) / 100;
    }
    ht = Math.round(ht); tva = Math.round(tva);
    db.prepare("UPDATE purchase_orders SET total_ht = ?, total_tva = ?, total_ttc = ? WHERE id = ?").run(ht, tva, ht + tva, orderId);
    return db.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(orderId);
  }

  app.post("/api/purchase-orders/:id/recalc", auth, guard("inventory", "write"), (req, res) => {
    const row = db.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ message: "الطلبية غير موجودة" });
    res.json(recalcPurchaseOrder(row.id));
  });

  /** استلام طلبية شراء: حركات دخول للمخزون + تحديث الحالة */
  app.post("/api/purchase-orders/:id/receive", auth, guard("inventory", "write"), (req, res) => {
    const before = db.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(req.params.id);
    if (!before) return res.status(404).json({ message: "الطلبية غير موجودة" });
    if (before.status === "مستلمة") return res.status(400).json({ message: "الطلبية مستلمة مسبقاً" });
    const lines = db.prepare("SELECT * FROM purchase_order_lines WHERE order_id = ?").all(before.id);
    if (!lines.length) return res.status(400).json({ message: "لا توجد سطور في الطلبية" });
    const date = req.body?.date || new Date().toISOString().slice(0, 10);
    db.transaction(() => {
      for (const l of lines) {
        if (!l.product_id) continue;
        db.prepare("INSERT INTO stock_moves (product_id,kind,quantity,reason,ref,date,user_id) VALUES (?,?,?,?,?,?,?)")
          .run(l.product_id, "دخول", l.quantity, `استلام طلبية ${before.ref}`, before.ref, date, req.user!.id);
        db.prepare("UPDATE products SET quantity = quantity + ? WHERE id = ?").run(l.quantity, l.product_id);
      }
      db.prepare("UPDATE purchase_orders SET status = 'مستلمة' WHERE id = ?").run(before.id);
    })();
    const row = db.prepare("SELECT * FROM purchase_orders WHERE id = ?").get(before.id);
    logAudit(req.user, "استلام", "طلبيات الشراء", row.id, before, row);
    res.json(row);
  });

  /* ---------- CRM: client history ---------- */
  app.get("/api/crm/clients/:id/history", auth, guard("crm", "read"), (req, res) => {
    const id = +req.params.id;
    const client = db.prepare("SELECT * FROM clients WHERE id = ?").get(id);
    if (!client) return res.status(404).json({ message: "العميل غير موجود" });
    const invoices = db.prepare("SELECT * FROM invoices WHERE client_id = ? ORDER BY date DESC").all(id);
    const payments = db.prepare(
      "SELECT p.*, i.number invoice_number FROM payments p LEFT JOIN invoices i ON i.id = p.invoice_id WHERE p.client_id = ? OR p.invoice_id IN (SELECT id FROM invoices WHERE client_id = ?) ORDER BY p.date DESC",
    ).all(id, id);
    const interactions = db.prepare("SELECT * FROM interactions WHERE client_id = ? ORDER BY date DESC").all(id);
    const complaints = db.prepare("SELECT * FROM complaints WHERE client_id = ? ORDER BY date DESC").all(id);
    const debts = db.prepare("SELECT * FROM debts WHERE party_type='عميل' AND party_id = ? ORDER BY due_date").all(id);
    const totals = {
      invoices_count: invoices.length,
      revenue_ht: Math.round(invoices.filter((i: any) => i.status !== "ملغاة").reduce((a: number, b: any) => a + b.total_ht, 0)),
      revenue_ttc: Math.round(invoices.filter((i: any) => i.status !== "ملغاة").reduce((a: number, b: any) => a + b.total_ttc, 0)),
      paid: Math.round(payments.reduce((a: number, b: any) => a + b.amount, 0)),
      outstanding: Math.round(debts.filter((d: any) => d.status === "مفتوح").reduce((a: number, b: any) => a + (b.amount - b.paid), 0)),
      open_complaints: complaints.filter((c: any) => c.status !== "محلولة").length,
    };
    res.json({ client, invoices, payments, interactions, complaints, debts, totals });
  });

  /* ---------- calendar: tasks + events + fiscal deadlines ---------- */
  app.get("/api/calendar/combined", auth, guard("projects", "read"), (req, res) => {
    const month = (req.query.month as string) || new Date().toISOString().slice(0, 7);
    const [y, m] = month.split("-").map(Number);
    const events = db.prepare("SELECT * FROM calendar_events WHERE substr(date,1,7) = ? ORDER BY date").all(month)
      .map((e: any) => ({ id: `ev-${e.id}`, date: e.date, title: e.title, kind: e.kind || "موعد", source: "موعد", description: e.description }));
    const tasks = db.prepare(
      `SELECT t.*, p.name project_name, e.first_name, e.last_name FROM tasks t
       LEFT JOIN projects p ON p.id = t.project_id LEFT JOIN employees e ON e.id = t.assignee_id
       WHERE t.due_date IS NOT NULL AND substr(t.due_date,1,7) = ? ORDER BY t.due_date`,
    ).all(month).map((t: any) => ({
      id: `tk-${t.id}`, date: t.due_date, title: t.title, kind: t.status, source: "مهمة",
      description: [t.project_name, t.first_name ? `${t.first_name} ${t.last_name}` : null].filter(Boolean).join(" · "),
    }));
    const fiscal = [
      { id: `g50-${month}`, date: `${month}-20`, title: `آخر أجل إيداع تصريح G50 لشهر ${m === 1 ? 12 : m - 1}`, kind: "استحقاق جبائي", source: "جباية", description: "TVA + IRG على الأجور + TAP" },
      { id: `cnas-${month}`, date: `${month}-30`, title: "التصريح الشهري لدى CNAS", kind: "استحقاق اجتماعي", source: "جباية", description: "اشتراكات الضمان الاجتماعي" },
    ];
    if (m === 4) fiscal.push({ id: `bilan-${y}`, date: `${y}-04-30`, title: `آخر أجل إيداع الميزانية (البيلان) لسنة ${y - 1}`, kind: "استحقاق جبائي", source: "جباية", description: "الحصيلة السنوية + TCR" });
    // إزالة التكرار: لا تُضاف الاستحقاقات المولّدة إن كان موعد مسجّل بنفس التاريخ والطبيعة
    const dedupedFiscal = fiscal.filter(
      (f) => !events.some((e: any) => e.date === f.date && String(e.kind).startsWith("استحقاق")),
    );
    res.json({ month, items: [...dedupedFiscal, ...events, ...tasks].sort((a, b) => a.date.localeCompare(b.date)) });
  });

  /* ---------- reports ---------- */
  app.get("/api/reports/summary/:year", auth, guard("accounting", "read"), (req, res) => {
    const year = +req.params.year;
    const y = String(year);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const rows = months.map((m) => {
      const key = MONTH_KEY(year, m);
      const inv = db.prepare("SELECT COALESCE(SUM(total_ht),0) ht, COALESCE(SUM(total_tva),0) tva, COALESCE(SUM(total_ttc),0) ttc, COUNT(*) count FROM invoices WHERE substr(date,1,7)=? AND status!='ملغاة'").get(key);
      const exp = db.prepare("SELECT COALESCE(SUM(amount_ht),0) ht, COALESCE(SUM(tva_amount),0) tva FROM expenses WHERE substr(date,1,7)=?").get(key);
      const pay = db.prepare("SELECT COALESCE(SUM(net),0) net, COALESCE(SUM(gross+cnas_employer),0) cost, COALESCE(SUM(irg),0) irg FROM payslips WHERE year=? AND month=?").get(year, m);
      const cash = db.prepare("SELECT COALESCE(SUM(CASE WHEN direction='مدخول' THEN amount END),0) inflow, COALESCE(SUM(CASE WHEN direction='مصروف' THEN amount END),0) outflow FROM payments WHERE substr(date,1,7)=?").get(key);
      const g = db.prepare("SELECT * FROM g50_declarations WHERE year=? AND month=?").get(year, m);
      const revenue = Math.round(inv.ht);
      const charges = Math.round(exp.ht + pay.cost);
      return {
        month: m, month_key: key, invoices_count: inv.count,
        revenue, revenue_ttc: Math.round(inv.ttc), tva_collected: Math.round(inv.tva),
        expenses: Math.round(exp.ht), tva_deductible: Math.round(exp.tva),
        payroll_cost: Math.round(pay.cost), payroll_net: Math.round(pay.net), irg: Math.round(pay.irg),
        inflow: Math.round(cash.inflow), outflow: Math.round(cash.outflow),
        g50_total: g ? Math.round(g.total) : 0, g50_status: g ? g.status : "غير مودع",
        charges, net: revenue - charges,
      };
    });
    const sum = (k: string) => Math.round(rows.reduce((a, r: any) => a + (r[k] || 0), 0));
    res.json({
      year, rows,
      totals: {
        revenue: sum("revenue"), revenue_ttc: sum("revenue_ttc"), expenses: sum("expenses"),
        payroll_cost: sum("payroll_cost"), charges: sum("charges"), net: sum("net"),
        tva_collected: sum("tva_collected"), tva_deductible: sum("tva_deductible"),
        irg: sum("irg"), inflow: sum("inflow"), outflow: sum("outflow"), g50_total: sum("g50_total"),
        invoices_count: sum("invoices_count"),
      },
      expense_categories: db.prepare("SELECT category, SUM(amount_ht) amount, COUNT(*) count FROM expenses WHERE substr(date,1,4)=? GROUP BY category ORDER BY amount DESC").all(y),
      top_clients: db.prepare(
        `SELECT c.name, SUM(i.total_ht) amount, COUNT(i.id) invoices FROM invoices i JOIN clients c ON c.id=i.client_id
         WHERE substr(i.date,1,4)=? AND i.status!='ملغاة' GROUP BY c.id ORDER BY amount DESC LIMIT 8`,
      ).all(y),
      top_products: db.prepare(
        `SELECT p.name, p.ref, SUM(l.quantity) qty, SUM(l.total_ht) amount FROM invoice_lines l
         JOIN invoices i ON i.id=l.invoice_id LEFT JOIN products p ON p.id=l.product_id
         WHERE substr(i.date,1,4)=? AND i.status!='ملغاة' AND p.id IS NOT NULL GROUP BY p.id ORDER BY amount DESC LIMIT 8`,
      ).all(y),
    });
  });

  app.get("/api/reports/financial/:year", auth, guard("accounting", "read"), (req, res) => {
    const y = req.params.year;
    const rows = db.prepare(
      `SELECT m.month,
        (SELECT COALESCE(SUM(total_ht),0) FROM invoices WHERE substr(date,1,7)=m.month AND status!='ملغاة') revenue,
        (SELECT COALESCE(SUM(amount_ht),0) FROM expenses WHERE substr(date,1,7)=m.month) expenses
       FROM (SELECT DISTINCT substr(date,1,7) month FROM invoices WHERE substr(date,1,4)=?
             UNION SELECT DISTINCT substr(date,1,7) FROM expenses WHERE substr(date,1,4)=?) m ORDER BY m.month`,
    ).all(y, y);
    res.json(rows);
  });

  app.get("/api/reports/aging", auth, guard("accounting", "read"), (_req, res) => {
    res.json(
      db.prepare(
        `SELECT d.*, CAST(julianday('now') - julianday(d.due_date) AS INTEGER) days_late
         FROM debts d WHERE d.status='مفتوح' ORDER BY days_late DESC`,
      ).all(),
    );
  });

  /* ---------- audit log ---------- */
  app.get("/api/audit", auth, guard("audit", "read"), (req, res) => {
    const where: string[] = [];
    const params: any[] = [];
    if (req.query.module && req.query.module !== "all") { where.push("module = ?"); params.push(req.query.module); }
    if (req.query.action && req.query.action !== "all") { where.push("action = ?"); params.push(req.query.action); }
    if (req.query.username) { where.push("username LIKE ?"); params.push(`%${req.query.username}%`); }
    if (req.query.from) { where.push("created_at >= ?"); params.push(req.query.from); }
    if (req.query.to) { where.push("created_at <= ?"); params.push(`${req.query.to} 23:59:59`); }
    const limit = Math.min(+(req.query.limit || 500), 5000);
    res.json(
      db.prepare(`SELECT * FROM audit_log ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY id DESC LIMIT ?`).all(...params, limit),
    );
  });

  app.get("/api/audit/meta", auth, guard("audit", "read"), (_req, res) => {
    res.json({
      modules: db.prepare("SELECT DISTINCT module FROM audit_log ORDER BY module").all().map((r: any) => r.module),
      actions: db.prepare("SELECT DISTINCT action FROM audit_log ORDER BY action").all().map((r: any) => r.action),
      total: db.prepare("SELECT COUNT(*) c FROM audit_log").get().c,
    });
  });

  /* ---------- backups ---------- */
  function createBackup(kind: string, user?: SessionUser) {
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const filename = `data-${stamp}.db`;
    const target = path.join(BACKUP_DIR, filename);
    db.pragma("wal_checkpoint(TRUNCATE)");
    fs.copyFileSync(DB_PATH, target);
    const size = fs.statSync(target).size;
    const info = db.prepare("INSERT INTO backups (filename,size,kind,created_by) VALUES (?,?,?,?)").run(filename, size, kind, user?.name || "النظام");
    const row = db.prepare("SELECT * FROM backups WHERE id = ?").get(info.lastInsertRowid);
    logAudit(user, "إنشاء", "النسخ الاحتياطي", row.id, null, row);
    return row;
  }

  app.get("/api/backups", auth, guard("backups", "read"), (_req, res) => {
    const rows = db.prepare("SELECT * FROM backups ORDER BY id DESC").all();
    res.json(rows.map((r: any) => ({ ...r, exists: fs.existsSync(path.join(BACKUP_DIR, r.filename)) })));
  });

  app.post("/api/backups", auth, guard("backups", "write"), (req, res) => {
    res.status(201).json(createBackup(req.body?.kind || "يدوي", req.user));
  });

  app.get("/api/backups/:id/download", auth, guard("backups", "read"), (req, res) => {
    const row = db.prepare("SELECT * FROM backups WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ message: "النسخة غير موجودة" });
    const p = path.join(BACKUP_DIR, row.filename);
    if (!fs.existsSync(p)) return res.status(404).json({ message: "ملف النسخة مفقود" });
    res.download(p, row.filename);
  });

  app.post("/api/backups/:id/restore", auth, guard("backups", "write"), (req, res) => {
    const row = db.prepare("SELECT * FROM backups WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ message: "النسخة غير موجودة" });
    const src = path.join(BACKUP_DIR, row.filename);
    if (!fs.existsSync(src)) return res.status(404).json({ message: "ملف النسخة مفقود" });
    // نسخة أمان قبل الاستعادة
    createBackup("قبل الاستعادة", req.user);
    const staging = path.join(BACKUP_DIR, `restore-pending-${Date.now()}.db`);
    fs.copyFileSync(src, staging);
    logAudit(req.user, "استعادة", "النسخ الاحتياطي", row.id, null, { filename: row.filename, staged: path.basename(staging) });
    res.json({
      ok: true,
      message: `تم تحضير استعادة النسخة ${row.filename}. أعد تشغيل الخادم لإتمام الاستعادة.`,
      staged: path.basename(staging),
    });
  });

  app.delete("/api/backups/:id", auth, guard("backups", "write"), (req, res) => {
    const row = db.prepare("SELECT * FROM backups WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ message: "النسخة غير موجودة" });
    const p = path.join(BACKUP_DIR, row.filename);
    if (fs.existsSync(p)) fs.unlinkSync(p);
    db.prepare("DELETE FROM backups WHERE id = ?").run(req.params.id);
    logAudit(req.user, "حذف", "النسخ الاحتياطي", row.id, row, null);
    res.json({ ok: true });
  });

  // نسخ احتياطي تلقائي مجدول (كل 6 ساعات) إذا كان مفعّلاً في الإعدادات
  setInterval(() => {
    const on = db.prepare("SELECT value FROM settings WHERE key='auto_backup'").get()?.value;
    if (on === "1") {
      try { createBackup("تلقائي"); } catch (e) { console.error("auto backup failed", e); }
    }
  }, 6 * 60 * 60 * 1000);

  return httpServer;
}
