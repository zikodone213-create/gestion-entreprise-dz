import Database from "better-sqlite3";
import { computePayslip, type TaxConfig } from "./payroll";
import fs from "node:fs";
import path from "node:path";

export const DB_PATH = path.resolve("data.db");
export const BACKUP_DIR = path.resolve("backups");
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

export const db: any = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);
CREATE TABLE IF NOT EXISTS tax_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL UNIQUE,
  tva_normal REAL NOT NULL DEFAULT 19,
  tva_reduced REAL NOT NULL DEFAULT 9,
  tap REAL NOT NULL DEFAULT 2,
  cnas_employee REAL NOT NULL DEFAULT 9,
  cnas_employer REAL NOT NULL DEFAULT 26,
  irg_brackets TEXT NOT NULL,
  timbre_rate REAL NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  matricule TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  national_id TEXT,
  birth_date TEXT,
  position TEXT,
  department TEXT,
  hire_date TEXT,
  base_salary REAL NOT NULL DEFAULT 0,
  allowances REAL NOT NULL DEFAULT 0,
  cnas_number TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  contract_type TEXT DEFAULT 'دائم',
  status TEXT NOT NULL DEFAULT 'نشط',
  bank_account TEXT
);
CREATE TABLE IF NOT EXISTS attendance (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  check_in TEXT,
  check_out TEXT,
  hours REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'حاضر',
  notes TEXT
);
CREATE TABLE IF NOT EXISTS leaves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'سنوية',
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days REAL NOT NULL DEFAULT 1,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'قيد الانتظار',
  approved_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS performance_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  criteria TEXT NOT NULL,
  total_score REAL NOT NULL DEFAULT 0,
  notes TEXT,
  reviewer TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS advances (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  request_date TEXT NOT NULL,
  reason TEXT,
  installments INTEGER NOT NULL DEFAULT 1,
  monthly_deduction REAL NOT NULL DEFAULT 0,
  deducted REAL NOT NULL DEFAULT 0,
  remaining REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'قيد الانتظار',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS payslips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref TEXT,
  employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  base_salary REAL NOT NULL DEFAULT 0,
  allowances REAL NOT NULL DEFAULT 0,
  bonus REAL NOT NULL DEFAULT 0,
  gross REAL NOT NULL DEFAULT 0,
  cnas_employee REAL NOT NULL DEFAULT 0,
  cnas_employer REAL NOT NULL DEFAULT 0,
  taxable REAL NOT NULL DEFAULT 0,
  irg REAL NOT NULL DEFAULT 0,
  advance_deduction REAL NOT NULL DEFAULT 0,
  other_deductions REAL NOT NULL DEFAULT 0,
  net REAL NOT NULL DEFAULT 0,
  days_worked REAL DEFAULT 22,
  generated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(employee_id, year, month)
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'منتج',
  category TEXT,
  unit TEXT DEFAULT 'وحدة',
  purchase_price REAL NOT NULL DEFAULT 0,
  sale_price REAL NOT NULL DEFAULT 0,
  quantity REAL NOT NULL DEFAULT 0,
  min_quantity REAL NOT NULL DEFAULT 0,
  tva_rate REAL NOT NULL DEFAULT 19
);
CREATE TABLE IF NOT EXISTS stock_moves (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  quantity REAL NOT NULL,
  reason TEXT,
  ref TEXT,
  date TEXT NOT NULL,
  user_id INTEGER
);
CREATE TABLE IF NOT EXISTS suppliers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  nif TEXT, nis TEXT, rc TEXT,
  address TEXT, city TEXT, phone TEXT, email TEXT, contact TEXT
);
CREATE TABLE IF NOT EXISTS purchase_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ref TEXT NOT NULL UNIQUE,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  date TEXT NOT NULL,
  expected_date TEXT,
  status TEXT NOT NULL DEFAULT 'مسودة',
  total_ht REAL DEFAULT 0, total_tva REAL DEFAULT 0, total_ttc REAL DEFAULT 0,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS purchase_order_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  description TEXT,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  tva_rate REAL NOT NULL DEFAULT 19
);
CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT DEFAULT 'شركة',
  nif TEXT, nis TEXT, rc TEXT, ai TEXT,
  address TEXT, city TEXT, phone TEXT, email TEXT, contact TEXT,
  credit_limit REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS interactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'مكالمة',
  date TEXT NOT NULL,
  subject TEXT,
  notes TEXT,
  user_id INTEGER
);
CREATE TABLE IF NOT EXISTS complaints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  description TEXT,
  date TEXT NOT NULL,
  priority TEXT DEFAULT 'متوسطة',
  status TEXT NOT NULL DEFAULT 'جديدة',
  resolution TEXT
);
CREATE TABLE IF NOT EXISTS invoice_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'قياسي',
  header_text TEXT,
  payment_terms TEXT,
  tva_rate REAL NOT NULL DEFAULT 19,
  has_installments INTEGER NOT NULL DEFAULT 0,
  installments_count INTEGER DEFAULT 0,
  show_taxes INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  footer_text TEXT,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS invoices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  number TEXT NOT NULL UNIQUE,
  template_id INTEGER REFERENCES invoice_templates(id) ON DELETE SET NULL,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'قياسي',
  date TEXT NOT NULL,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'غير مدفوعة',
  total_ht REAL DEFAULT 0,
  total_tva REAL DEFAULT 0,
  timbre REAL DEFAULT 0,
  total_ttc REAL DEFAULT 0,
  paid_amount REAL DEFAULT 0,
  notes TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS invoice_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  description TEXT,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  tva_rate REAL NOT NULL DEFAULT 19,
  total_ht REAL NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS invoice_counters (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  direction TEXT NOT NULL DEFAULT 'مدخول',
  date TEXT NOT NULL,
  amount REAL NOT NULL,
  method TEXT DEFAULT 'تحويل بنكي',
  ref TEXT,
  notes TEXT
);
CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
  amount_ht REAL NOT NULL DEFAULT 0,
  tva_rate REAL NOT NULL DEFAULT 19,
  tva_amount REAL NOT NULL DEFAULT 0,
  amount_ttc REAL NOT NULL DEFAULT 0,
  payment_method TEXT DEFAULT 'تحويل بنكي',
  ref TEXT
);
CREATE TABLE IF NOT EXISTS debts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  party_type TEXT NOT NULL DEFAULT 'عميل',
  party_id INTEGER,
  party_name TEXT,
  invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL,
  amount REAL NOT NULL DEFAULT 0,
  paid REAL NOT NULL DEFAULT 0,
  due_date TEXT,
  status TEXT NOT NULL DEFAULT 'مفتوح',
  notes TEXT
);
CREATE TABLE IF NOT EXISTS g50_declarations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  turnover REAL DEFAULT 0,
  tva_collected REAL DEFAULT 0,
  tva_deductible REAL DEFAULT 0,
  tva_due REAL DEFAULT 0,
  irg_salaries REAL DEFAULT 0,
  tap REAL DEFAULT 0,
  total REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'مسودة',
  declared_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(year, month)
);
CREATE TABLE IF NOT EXISTS balance_sheets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  year INTEGER NOT NULL UNIQUE,
  assets TEXT, liabilities TEXT, tcr TEXT,
  revenue REAL DEFAULT 0,
  expenses_total REAL DEFAULT 0,
  net_result REAL DEFAULT 0,
  status TEXT DEFAULT 'مسودة',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL,
  manager_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  start_date TEXT, end_date TEXT,
  budget REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'قيد التنفيذ',
  progress REAL DEFAULT 0,
  description TEXT
);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  assignee_id INTEGER REFERENCES employees(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'جديدة',
  priority TEXT DEFAULT 'متوسطة',
  due_date TEXT,
  progress REAL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS calendar_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  kind TEXT DEFAULT 'موعد',
  description TEXT,
  related_module TEXT,
  related_id INTEGER
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  username TEXT,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  record_id TEXT,
  before_value TEXT,
  after_value TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS backups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  size INTEGER DEFAULT 0,
  kind TEXT DEFAULT 'يدوي',
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
`;

db.exec(SCHEMA);

/* --------------------------------------------------- migrations (المرحلة 2) */

function addColumn(table: string, column: string, ddl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map((c: any) => c.name);
  if (!cols.includes(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${ddl}`);
}

function migrate() {
  // نماذج الفواتير: عميل افتراضي وسطور افتراضية تُملأ آلياً عند اختيار النموذج
  addColumn("invoice_templates", "default_client_id", "INTEGER");
  addColumn("invoice_templates", "default_lines", "TEXT");
  addColumn("invoice_templates", "due_days", "INTEGER DEFAULT 30");
  // الفواتير: جدول الأقساط وطريقة الدفع (طابع الدمغة)
  addColumn("invoices", "installments_json", "TEXT");
  addColumn("invoices", "payment_method", "TEXT DEFAULT 'تحويل بنكي'");
}
migrate();

/** تعبئة القيم الافتراضية للنماذج المبذورة (مرة واحدة) */
function backfillTemplates() {
  const tmpls = db.prepare("SELECT * FROM invoice_templates WHERE default_lines IS NULL").all();
  if (!tmpls.length) return;
  const clients = db.prepare("SELECT id FROM clients ORDER BY id").all();
  const products = db.prepare("SELECT * FROM products ORDER BY id").all();
  if (!clients.length || !products.length) return;
  tmpls.forEach((t: any, i: number) => {
    const c = clients[i % clients.length];
    const p1 = products[(i * 2) % products.length];
    const p2 = products[(i * 2 + 1) % products.length];
    const lines = [p1, p2].map((p: any) => ({
      product_id: p.id,
      description: p.name,
      quantity: 2,
      unit_price: p.sale_price,
      discount: 0,
      tva_rate: t.show_taxes ? t.tva_rate : 0,
    }));
    db.prepare("UPDATE invoice_templates SET default_client_id = ?, default_lines = ?, due_days = ? WHERE id = ?")
      .run(c.id, JSON.stringify(lines), t.kind === "بريفورما" ? 15 : 30, t.id);
  });
}

/* ------------------------------------------------------------------ seed */

const IRG_BRACKETS = JSON.stringify([
  { from: 0, to: 30000, rate: 0 },
  { from: 30000, to: 45000, rate: 23 },
  { from: 45000, to: 60000, rate: 27 },
  { from: 60000, to: 80000, rate: 30 },
  { from: 80000, to: 160000, rate: 33 },
  { from: 160000, to: 320000, rate: 35 },
  { from: 320000, to: null, rate: 37 },
]);

const YEAR = 2026;

function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
function d(y: number, m: number, day: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function seed() {
  const count = db.prepare("SELECT COUNT(*) c FROM employees").get().c;
  if (count > 0) return;

  const ins = (sql: string) => db.prepare(sql);

  // users
  const users = [
    ["admin", "admin123", "سفيان بلقاسم", "مدير"],
    ["compta", "compta123", "أمينة حدّاد", "محاسب"],
    ["rh", "rh123", "ياسين مرابط", "موارد بشرية"],
    ["ventes", "ventes123", "نبيلة زروقي", "مبيعات"],
  ];
  const uStmt = ins("INSERT INTO users (username,password,name,role) VALUES (?,?,?,?)");
  users.forEach((u) => uStmt.run(u as any));

  // settings (company)
  const company: Record<string, string> = {
    company_name: "شركة النور للتجهيزات الصناعية ش.ذ.م.م",
    company_short: "النور للتجهيزات",
    company_address: "حي 200 مسكن، شارع الأمير عبد القادر، البليدة",
    company_city: "البليدة",
    company_phone: "+213 25 41 22 08",
    company_email: "contact@ennour-dz.com",
    company_nif: "099816254783012",
    company_nis: "000916025478301",
    company_rc: "16/00-1024587B09",
    company_ai: "16025478301",
    company_capital: "5000000",
    company_bank: "بنك التنمية المحلية - وكالة البليدة",
    company_rib: "005 00123 4567891234 56",
    company_cnas: "16-0125478-92",
    company_activity: "استيراد وتوزيع التجهيزات الصناعية",
    currency: "د.ج",
    invoice_prefix: "FA",
    fiscal_year: String(YEAR),
    auto_backup: "1",
  };
  const sStmt = ins("INSERT OR REPLACE INTO settings (key,value) VALUES (?,?)");
  Object.entries(company).forEach(([k, v]) => sStmt.run(k, v));

  // tax settings 2024-2026
  const tStmt = ins(
    "INSERT INTO tax_settings (year,tva_normal,tva_reduced,tap,cnas_employee,cnas_employer,irg_brackets,timbre_rate) VALUES (?,?,?,?,?,?,?,?)",
  );
  [2024, 2025, 2026].forEach((y) => tStmt.run(y, 19, 9, 2, 9, 26, IRG_BRACKETS, 1));

  // employees
  const emps: any[] = [
    ["EMP-001", "سفيان", "بلقاسم", "مدير عام", "الإدارة", "2016-03-01", 180000, 25000],
    ["EMP-002", "أمينة", "حدّاد", "رئيسة قسم المحاسبة", "المالية والمحاسبة", "2017-09-15", 120000, 18000],
    ["EMP-003", "ياسين", "مرابط", "مسؤول الموارد البشرية", "الموارد البشرية", "2018-01-10", 95000, 12000],
    ["EMP-004", "نبيلة", "زروقي", "مديرة المبيعات", "المبيعات", "2018-06-01", 110000, 20000],
    ["EMP-005", "كريم", "بوعلام", "محاسب", "المالية والمحاسبة", "2019-02-18", 72000, 8000],
    ["EMP-006", "فاطمة الزهراء", "شريف", "مساعدة إدارية", "الإدارة", "2019-11-04", 52000, 6000],
    ["EMP-007", "عبد الرحمان", "لعمامري", "مسؤول المخزون", "المخزون واللوجستيك", "2020-04-20", 65000, 9000],
    ["EMP-008", "هدى", "بن عيسى", "مكلفة بالزبائن", "المبيعات", "2020-09-01", 58000, 7500],
    ["EMP-009", "مراد", "تواتي", "تقني صيانة", "التقني", "2021-03-15", 61000, 8500],
    ["EMP-010", "سمية", "قاسمي", "مكلفة بالفوترة", "المالية والمحاسبة", "2022-01-05", 55000, 6500],
    ["EMP-011", "الطاهر", "بوزيدي", "سائق موزع", "المخزون واللوجستيك", "2022-08-22", 46000, 9500],
    ["EMP-012", "ليلى", "عمراني", "مهندسة مشاريع", "التقني", "2023-05-02", 98000, 14000],
  ];
  const eStmt = ins(`INSERT INTO employees
    (matricule,first_name,last_name,national_id,birth_date,position,department,hire_date,base_salary,allowances,cnas_number,phone,email,address,contract_type,status,bank_account)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  emps.forEach((e, i) => {
    eStmt.run(
      e[0], e[1], e[2],
      `10${rnd(100000000, 999999999)}`,
      d(rnd(1972, 1995), rnd(1, 12), rnd(1, 28)),
      e[3], e[4], e[5], e[6], e[7],
      `16-${rnd(1000000, 9999999)}-${rnd(10, 99)}`,
      `+213 6${rnd(60000000, 99999999)}`,
      `${["s","a","y","n","k","f","abd","h","m","so","t","l"][i]}.${["belkacem","haddad","merabet","zerrouki","boualem","cherif","laamamri","benaissa","touati","kasmi","bouzidi","amrani"][i]}@ennour-dz.com`,
      pick(["البليدة", "الجزائر الوسطى", "بوفاريك", "العفرون", "الأربعاء"]),
      pick(["دائم", "دائم", "دائم", "محدد المدة"]),
      "نشط",
      `005 00123 ${rnd(1000000000, 9999999999)} ${rnd(10, 99)}`,
    );
  });

  // products
  const prods = [
    ["PRD-001", "مضخة مياه صناعية 5.5 كيلوواط", "منتج", "مضخات", "وحدة", 68000, 92000, 24, 5],
    ["PRD-002", "محرك كهربائي ثلاثي الطور 7.5 ك.و", "منتج", "محركات", "وحدة", 84000, 115000, 12, 4],
    ["PRD-003", "مولد كهربائي 10 ك.ف.أ", "منتج", "مولدات", "وحدة", 195000, 265000, 6, 2],
    ["PRD-004", "ضاغط هواء 200 لتر", "منتج", "ضواغط", "وحدة", 112000, 148000, 9, 3],
    ["PRD-005", "لوحة توزيع كهربائية", "منتج", "كهرباء", "وحدة", 34000, 49000, 31, 10],
    ["PRD-006", "كابل نحاسي 4×16 مم (لفة 50م)", "منتج", "كهرباء", "لفة", 22000, 31500, 3, 8],
    ["PRD-007", "صمام حلزوني 3 بوصة", "منتج", "صمامات", "وحدة", 7800, 11500, 64, 20],
    ["PRD-008", "خزان مياه بلاستيكي 1000 ل", "منتج", "خزانات", "وحدة", 18500, 26000, 17, 6],
    ["PRD-009", "مقياس ضغط رقمي", "منتج", "قياس", "وحدة", 5400, 8900, 42, 15],
    ["PRD-010", "زيت هيدروليكي 20 ل", "منتج", "مستهلكات", "برميل", 6900, 10200, 2, 10],
    ["SRV-001", "تركيب وتشغيل تجهيزات", "خدمة", "خدمات", "خدمة", 0, 45000, 0, 0],
    ["SRV-002", "عقد صيانة سنوي", "خدمة", "خدمات", "خدمة", 0, 120000, 0, 0],
  ];
  const pStmt = ins(
    "INSERT INTO products (ref,name,type,category,unit,purchase_price,sale_price,quantity,min_quantity,tva_rate) VALUES (?,?,?,?,?,?,?,?,?,19)",
  );
  prods.forEach((p) => pStmt.run(p as any));

  // suppliers
  const sups = [
    ["مؤسسة الحياة لتوريد المعدات", "099816254001122", "000916025400112", "16/00-887451B09", "زون صناعية، رغاية، الجزائر", "الجزائر", "+213 21 85 44 12", "contact@elhayat-dz.com", "بلال حمداوي"],
    ["شركة سيماك للتجهيزات", "099316254775533", "000316025477553", "31/00-556122B10", "حي النصر، وهران", "وهران", "+213 41 32 76 90", "info@simac.dz", "رضا بوقرة"],
    ["الجزائرية للكوابل", "099116254889900", "000116025488990", "16/00-114577B08", "المنطقة الصناعية بجاية", "بجاية", "+213 34 21 55 03", "cables@algcab.dz", "سعيد أوراغ"],
    ["مجمع تيزي للنقل واللوجستيك", "099516254112233", "000516025411223", "15/00-778955B11", "وسط المدينة، تيزي وزو", "تيزي وزو", "+213 26 12 44 78", "logistic@tizi.dz", "كمال أيت علي"],
  ];
  const supStmt = ins("INSERT INTO suppliers (name,nif,nis,rc,address,city,phone,email,contact) VALUES (?,?,?,?,?,?,?,?,?)");
  sups.forEach((s) => supStmt.run(s as any));

  // clients
  const clis = [
    ["مؤسسة الأمل للبناء والأشغال", "شركة", "099816254663311", "000916025466331", "16/00-441255B09", "حي بن عكنون، الجزائر", "الجزائر"],
    ["شركة سونا للصناعات الغذائية", "شركة", "099216254554422", "000216025455442", "02/00-663214B07", "المنطقة الصناعية، الشلف", "الشلف"],
    ["ديوان الترقية والتسيير العقاري - البليدة", "مؤسسة عمومية", "099016254221133", "000016025422113", "09/00-112233B06", "شارع أول نوفمبر، البليدة", "البليدة"],
    ["مؤسسة النخيل للفلاحة", "شركة", "099716254998877", "000716025499887", "07/00-998877B12", "طريق تقرت، بسكرة", "بسكرة"],
    ["شركة الوئام للنقل", "شركة", "099416254334455", "000416025433445", "04/00-334455B10", "حي 5 جويلية، سطيف", "سطيف"],
    ["مطاحن الهضاب العليا", "شركة", "099516254776655", "000516025477665", "05/00-776655B09", "المنطقة الصناعية، باتنة", "باتنة"],
    ["مؤسسة بن يحيى للأشغال العمومية", "شركة", "099316254887766", "000316025488776", "31/00-887766B11", "حي المقري، وهران", "وهران"],
    ["الشركة الجزائرية للمياه - وحدة البليدة", "مؤسسة عمومية", "099916254112200", "000916025411220", "09/00-556677B05", "شارع العقيد عميروش، البليدة", "البليدة"],
  ];
  const cStmt = ins("INSERT INTO clients (name,type,nif,nis,rc,address,city,phone,email,contact,credit_limit) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
  clis.forEach((c, i) =>
    cStmt.run(
      c[0], c[1], c[2], c[3], c[4], c[5], c[6],
      `+213 ${rnd(20, 49)} ${rnd(10, 99)} ${rnd(10, 99)} ${rnd(10, 99)}`,
      `contact${i + 1}@client-dz.com`,
      pick(["محمد شعباني", "زهية بلحاج", "عمر دحمان", "سميرة قندوز", "توفيق مزيان"]),
      pick([500000, 1000000, 2000000, 0]),
    ),
  );

  // invoice templates
  const tmplStmt = ins(
    "INSERT INTO invoice_templates (name,kind,header_text,payment_terms,tva_rate,has_installments,installments_count,show_taxes,notes,footer_text) VALUES (?,?,?,?,?,?,?,?,?,?)",
  );
  tmplStmt.run("فاتورة قياسية", "قياسي", "فاتورة", "الدفع خلال 30 يوماً من تاريخ الفاتورة", 19, 0, 0, 1, "", "شكراً لتعاملكم معنا — الشركة معتمدة لدى مصالح الضرائب");
  tmplStmt.run("فاتورة بالتقسيط", "بالتقسيط", "فاتورة بالتقسيط", "الدفع على أقساط شهرية متساوية", 19, 1, 3, 1, "يُدفع القسط في نهاية كل شهر", "كل تأخير في السداد يعرض للغرامات القانونية");
  tmplStmt.run("فاتورة بريفورما", "بريفورما", "فاتورة أولية (Proforma)", "صالحة لمدة 15 يوماً", 19, 0, 0, 1, "هذه الوثيقة ليست فاتورة نهائية", "وثيقة غير مُلزمة جبائياً");
  tmplStmt.run("فاتورة بدون رسوم", "بدون رسوم", "فاتورة بدون رسوم (إعفاء)", "الدفع نقداً عند التسليم", 0, 0, 0, 0, "إعفاء من الرسوم بموجب المادة 42 من قانون الرسوم", "معفاة من الرسم على القيمة المضافة");

  // invoices across 12 months + lines + payments + debts
  const invStmt = ins(`INSERT INTO invoices
    (number,template_id,client_id,kind,date,due_date,status,total_ht,total_tva,timbre,total_ttc,paid_amount,notes,created_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const lineStmt = ins(
    "INSERT INTO invoice_lines (invoice_id,product_id,description,quantity,unit_price,discount,tva_rate,total_ht) VALUES (?,?,?,?,?,?,?,?)",
  );
  const payStmt = ins("INSERT INTO payments (invoice_id,client_id,direction,date,amount,method,ref,notes) VALUES (?,?,?,?,?,?,?,?)");
  const debtStmt = ins("INSERT INTO debts (party_type,party_id,party_name,invoice_id,amount,paid,due_date,status,notes) VALUES (?,?,?,?,?,?,?,?,?)");
  const moveStmt = ins("INSERT INTO stock_moves (product_id,kind,quantity,reason,ref,date,user_id) VALUES (?,?,?,?,?,?,?)");

  let counter = 0;
  const months = Array.from({ length: 12 }, (_, i) => i + 1);
  for (const m of months) {
    const nInv = rnd(4, 7);
    for (let k = 0; k < nInv; k++) {
      counter++;
      const number = `FA-${YEAR}-${String(counter).padStart(5, "0")}`;
      const day = rnd(2, 27);
      const date = d(YEAR, m, day);
      const clientId = rnd(1, clis.length);
      const nLines = rnd(1, 4);
      let ht = 0;
      const lines: any[] = [];
      for (let l = 0; l < nLines; l++) {
        const pid = rnd(1, prods.length);
        const p = prods[pid - 1];
        const qty = p[2] === "خدمة" ? 1 : rnd(1, 6);
        const price = p[6] as number;
        const total = qty * price;
        ht += total;
        lines.push([pid, p[1], qty, price, 0, 19, total]);
      }
      const tva = Math.round(ht * 0.19);
      const timbre = 0;
      const ttc = ht + tva + timbre;
      const isPaid = m < 11 ? Math.random() < 0.82 : Math.random() < 0.45;
      const partial = !isPaid && Math.random() < 0.35;
      const paid = isPaid ? ttc : partial ? Math.round(ttc * 0.4) : 0;
      const status = isPaid ? "مدفوعة" : partial ? "مدفوعة جزئياً" : "غير مدفوعة";
      const dueDay = Math.min(day + 3, 28);
      const dueMonth = m === 12 ? 1 : m + 1;
      const dueYear = m === 12 ? YEAR + 1 : YEAR;
      const res = invStmt.run(
        number, 1, clientId, "قياسي", date, d(dueYear, dueMonth, dueDay), status,
        ht, tva, timbre, ttc, paid, "", "admin",
      );
      const invId = Number(res.lastInsertRowid);
      lines.forEach((l) => {
        lineStmt.run(invId, l[0], l[1], l[2], l[3], l[4], l[5], l[6]);
        moveStmt.run(l[0], "خروج", l[2], `بيع - فاتورة ${number}`, number, date, 1);
      });
      if (paid > 0)
        payStmt.run(invId, clientId, "مدخول", date, paid, pick(["تحويل بنكي", "صك", "نقداً"]), `REC-${YEAR}-${counter}`, "");
      if (paid < ttc)
        debtStmt.run("عميل", clientId, clis[clientId - 1][0], invId, ttc, paid, d(dueYear, dueMonth, dueDay), "مفتوح", "");
    }
  }
  db.prepare("INSERT OR REPLACE INTO invoice_counters (year,last_number) VALUES (?,?)").run(YEAR, counter);

  // expenses 12 months
  const expStmt = ins(
    "INSERT INTO expenses (date,category,description,supplier_id,amount_ht,tva_rate,tva_amount,amount_ttc,payment_method,ref) VALUES (?,?,?,?,?,?,?,?,?,?)",
  );
  const cats = [
    ["مشتريات", "شراء تجهيزات للمخزون", 400000, 1200000],
    ["إيجار", "إيجار المستودع والمكاتب", 120000, 120000],
    ["كهرباء وماء", "فاتورة سونلغاز والمياه", 35000, 90000],
    ["نقل وشحن", "مصاريف نقل الطلبيات", 40000, 150000],
    ["اتصالات", "هاتف وأنترنت", 12000, 25000],
    ["صيانة", "صيانة العتاد والسيارات", 25000, 110000],
    ["مصاريف إدارية", "لوازم مكتبية ووثائق", 8000, 40000],
    ["تأمينات", "تأمين المستودع والأسطول", 30000, 75000],
  ];
  for (const m of months) {
    for (const c of cats) {
      if (Math.random() < 0.25 && c[0] !== "إيجار") continue;
      const ht = rnd(c[2] as number, c[3] as number);
      const rate = c[0] === "إيجار" ? 19 : pick([19, 19, 9]);
      const tva = Math.round((ht * rate) / 100);
      expStmt.run(d(YEAR, m, rnd(1, 28)), c[0], c[1], rnd(1, sups.length), ht, rate, tva, ht + tva, pick(["تحويل بنكي", "صك", "نقداً"]), `DEP-${YEAR}-${m}-${rnd(100, 999)}`);
    }
  }

  // purchase orders
  const poStmt = ins("INSERT INTO purchase_orders (ref,supplier_id,date,expected_date,status,total_ht,total_tva,total_ttc,notes) VALUES (?,?,?,?,?,?,?,?,?)");
  const polStmt = ins("INSERT INTO purchase_order_lines (order_id,product_id,description,quantity,unit_price,tva_rate) VALUES (?,?,?,?,?,?)");
  for (let i = 1; i <= 8; i++) {
    const m = rnd(1, 12);
    const pid = rnd(1, 10);
    const p = prods[pid - 1];
    const qty = rnd(3, 15);
    const ht = qty * (p[5] as number);
    const tva = Math.round(ht * 0.19);
    const r = poStmt.run(
      `BC-${YEAR}-${String(i).padStart(4, "0")}`, rnd(1, sups.length), d(YEAR, m, rnd(1, 27)), d(YEAR, Math.min(m + 1, 12), rnd(1, 27)),
      pick(["مستلمة", "مستلمة", "مؤكدة", "مسودة"]), ht, tva, ht + tva, "",
    );
    polStmt.run(Number(r.lastInsertRowid), pid, p[1], qty, p[5], 19);
    moveStmt.run(pid, "دخول", qty, "شراء - طلبية", `BC-${YEAR}-${String(i).padStart(4, "0")}`, d(YEAR, m, rnd(1, 27)), 1);
  }

  // attendance: last 30 days for all employees
  const attStmt = ins("INSERT INTO attendance (employee_id,date,check_in,check_out,hours,status,notes) VALUES (?,?,?,?,?,?,?)");
  const today = new Date("2026-08-16");
  for (let dayOffset = 30; dayOffset >= 0; dayOffset--) {
    const dt = new Date(today.getTime() - dayOffset * 86400000);
    const iso = dt.toISOString().slice(0, 10);
    if (dt.getDay() === 5 || dt.getDay() === 6) continue;
    for (let e = 1; e <= emps.length; e++) {
      const r = Math.random();
      if (r < 0.05) {
        attStmt.run(e, iso, null, null, 0, "غائب", "غياب غير مبرر");
      } else if (r < 0.1) {
        attStmt.run(e, iso, "09:30", "16:30", 7, "متأخر", "تأخر في الحضور");
      } else {
        attStmt.run(e, iso, "08:00", "16:30", 8.5, "حاضر", "");
      }
    }
  }

  // leaves
  const lvStmt = ins("INSERT INTO leaves (employee_id,type,start_date,end_date,days,reason,status,approved_by) VALUES (?,?,?,?,?,?,?,?)");
  for (let i = 0; i < 16; i++) {
    const e = rnd(1, emps.length);
    const m = rnd(1, 8);
    const day = rnd(1, 20);
    const days = rnd(2, 12);
    lvStmt.run(
      e, pick(["سنوية", "سنوية", "مرضية", "استثنائية", "بدون أجر"]),
      d(YEAR, m, day), d(YEAR, m, Math.min(day + days, 28)), days,
      pick(["عطلة عائلية", "سبب صحي", "مناسبة عائلية", "سفر"]),
      pick(["مقبولة", "مقبولة", "قيد الانتظار", "مرفوضة"]), "ياسين مرابط",
    );
  }

  // performance reviews
  const prStmt = ins("INSERT INTO performance_reviews (employee_id,period,criteria,total_score,notes,reviewer) VALUES (?,?,?,?,?,?)");
  for (let e = 1; e <= emps.length; e++) {
    for (const period of [`${YEAR - 1}-S2`, `${YEAR}-S1`]) {
      const crit = [
        { name: "الالتزام بالمواعيد", score: rnd(12, 20) },
        { name: "جودة العمل", score: rnd(11, 20) },
        { name: "العمل الجماعي", score: rnd(12, 20) },
        { name: "المبادرة والإبتكار", score: rnd(9, 20) },
        { name: "احترام الإجراءات", score: rnd(13, 20) },
      ];
      const total = +(crit.reduce((a, b) => a + b.score, 0) / crit.length).toFixed(2);
      prStmt.run(e, period, JSON.stringify(crit), total, pick(["أداء مرضٍ", "أداء جيد جداً", "يحتاج تحسينا في التنظيم", ""]), "سفيان بلقاسم");
    }
  }

  // advances
  const advStmt = ins(
    "INSERT INTO advances (employee_id,amount,request_date,reason,installments,monthly_deduction,deducted,remaining,status) VALUES (?,?,?,?,?,?,?,?,?)",
  );
  const advSeed = [
    [3, 80000, d(YEAR, 2, 10), "مصاريف علاج", 4, "مقبولة"],
    [5, 50000, d(YEAR, 3, 5), "تجهيز منزل", 5, "مقبولة"],
    [7, 120000, d(YEAR, 1, 20), "شراء سيارة", 6, "مقبولة"],
    [9, 40000, d(YEAR, 5, 12), "مصاريف دراسية", 4, "مقبولة"],
    [11, 30000, d(YEAR, 6, 3), "مناسبة عائلية", 3, "مقبولة"],
    [6, 25000, d(YEAR, 7, 15), "مصاريف طارئة", 2, "قيد الانتظار"],
    [12, 60000, d(YEAR, 4, 8), "ترميم منزل", 6, "مقبولة"],
  ];
  advSeed.forEach((a) => {
    const amount = a[1] as number;
    const inst = a[4] as number;
    const monthly = Math.round(amount / inst);
    const status = a[5] as string;
    const deducted = status === "مقبولة" ? Math.min(amount, monthly * rnd(0, inst - 1)) : 0;
    advStmt.run(a[0], amount, a[2], a[3], inst, monthly, deducted, amount - deducted, status);
  });

  // projects & tasks
  const prjStmt = ins("INSERT INTO projects (code,name,client_id,manager_id,start_date,end_date,budget,status,progress,description) VALUES (?,?,?,?,?,?,?,?,?,?)");
  const projects = [
    ["PRJ-001", "تجهيز محطة ضخ - ديوان الترقية البليدة", 3, 12, "2026-02-01", "2026-09-30", 4500000, "قيد التنفيذ", 65],
    ["PRJ-002", "تركيب مولدات - مطاحن الهضاب", 6, 12, "2026-04-15", "2026-10-15", 2800000, "قيد التنفيذ", 40],
    ["PRJ-003", "صيانة شبكة كهربائية - سونا الغذائية", 2, 9, "2026-01-10", "2026-05-20", 1200000, "منجز", 100],
    ["PRJ-004", "توريد تجهيزات ري - النخيل للفلاحة", 4, 7, "2026-06-01", "2026-12-20", 3600000, "قيد التنفيذ", 22],
    ["PRJ-005", "دراسة تجديد أسطول - الوئام للنقل", 5, 12, "2026-08-01", "2027-01-31", 900000, "مخطط", 5],
  ];
  projects.forEach((p) => prjStmt.run(p[0], p[1], p[2], p[3], p[4], p[5], p[6], p[7], p[8], ""));
  const tkStmt = ins("INSERT INTO tasks (project_id,title,description,assignee_id,status,priority,due_date,progress) VALUES (?,?,?,?,?,?,?,?)");
  const taskTitles = [
    "إعداد دفتر الشروط التقني", "معاينة الموقع", "طلب التجهيزات من المورد", "تركيب المضخات",
    "اختبار التشغيل", "تسليم مؤقت", "إعداد محضر التسليم النهائي", "تكوين مستخدمي العميل",
    "متابعة الفاتورة والتحصيل", "تحديث مخطط الصيانة",
  ];
  for (let p = 1; p <= projects.length; p++) {
    for (let t = 0; t < rnd(4, 7); t++) {
      tkStmt.run(
        p, pick(taskTitles), "", rnd(1, emps.length),
        pick(["جديدة", "قيد التنفيذ", "قيد التنفيذ", "منجزة", "متوقفة"]),
        pick(["عالية", "متوسطة", "متوسطة", "منخفضة"]),
        d(YEAR, rnd(8, 12), rnd(1, 28)), rnd(0, 100),
      );
    }
  }

  // interactions & complaints
  const intStmt = ins("INSERT INTO interactions (client_id,kind,date,subject,notes,user_id) VALUES (?,?,?,?,?,?)");
  for (let i = 0; i < 24; i++)
    intStmt.run(
      rnd(1, clis.length), pick(["مكالمة", "زيارة", "بريد إلكتروني", "اجتماع"]),
      d(YEAR, rnd(1, 8), rnd(1, 28)),
      pick(["متابعة عرض سعر", "تسوية فاتورة متأخرة", "طلب عرض جديد", "شكوى تقنية", "زيارة تجارية"]),
      "", 4,
    );
  const cmpStmt = ins("INSERT INTO complaints (client_id,subject,description,date,priority,status,resolution) VALUES (?,?,?,?,?,?,?)");
  const cmp = [
    [1, "تأخر في التسليم", "تأخر تسليم الطلبية أسبوعين عن الأجل", "عالية", "قيد المعالجة"],
    [2, "عطب في مضخة", "مضخة توقفت بعد أسبوع من التركيب", "عالية", "محلولة"],
    [4, "خطأ في الفاتورة", "مبلغ الرسم على القيمة المضافة غير صحيح", "متوسطة", "محلولة"],
    [6, "نقص في الوثائق", "لم تُسلَّم شهادة الضمان", "منخفضة", "جديدة"],
    [7, "خدمة ما بعد البيع", "طلب تدخل تقني مستعجل", "عالية", "قيد المعالجة"],
  ];
  cmp.forEach((c) => cmpStmt.run(c[0], c[1], c[2], d(YEAR, rnd(3, 8), rnd(1, 28)), c[3], c[4], c[4] === "محلولة" ? "تمت المعالجة وإبلاغ العميل" : ""));

  // calendar events
  const evStmt = ins("INSERT INTO calendar_events (title,date,kind,description,related_module,related_id) VALUES (?,?,?,?,?,?)");
  for (let m = 1; m <= 12; m++)
    evStmt.run(`آخر أجل إيداع تصريح G50 لشهر ${m}`, d(YEAR, m === 12 ? 12 : m + 1, 20), "استحقاق جبائي", "إيداع G50 لدى مفتشية الضرائب", "fiscal", null);
  evStmt.run("إيداع البيلان السنوي 2025", "2026-04-30", "استحقاق جبائي", "إيداع الميزانية والحسابات السنوية", "fiscal", null);
  evStmt.run("تصريح CNAS الثلاثي", "2026-10-30", "استحقاق اجتماعي", "تصريح الأجور لدى CNAS", "hr", null);
  evStmt.run("اجتماع مجلس الإدارة", "2026-09-05", "موعد", "مراجعة نتائج السداسي الأول", "admin", null);

  // g50 archive for past months + balance sheet 2025
  db.prepare("INSERT INTO balance_sheets (year,assets,liabilities,tcr,revenue,expenses_total,net_result,status) VALUES (?,?,?,?,?,?,?,?)").run(
    2025,
    JSON.stringify([
      { label: "تثبيتات عينية", amount: 12500000 },
      { label: "مخزونات", amount: 4200000 },
      { label: "حسابات العملاء", amount: 3100000 },
      { label: "الخزينة (بنك وصندوق)", amount: 2650000 },
    ]),
    JSON.stringify([
      { label: "رأس المال الاجتماعي", amount: 5000000 },
      { label: "الاحتياطات والنتائج المرحلة", amount: 6400000 },
      { label: "ديون الموردين", amount: 2900000 },
      { label: "ديون جبائية واجتماعية", amount: 1850000 },
    ]),
    JSON.stringify([
      { label: "رقم الأعمال", amount: 41200000 },
      { label: "مشتريات مستهلكة", amount: 24800000 },
      { label: "خدمات خارجية", amount: 3900000 },
      { label: "أعباء المستخدمين", amount: 9100000 },
      { label: "الضرائب والرسوم", amount: 1100000 },
      { label: "النتيجة الصافية", amount: 2300000 },
    ]),
    41200000, 38900000, 2300000, "مودع",
  );

  // audit seed entry
  db.prepare("INSERT INTO audit_log (user_id,username,action,module,record_id,before_value,after_value) VALUES (?,?,?,?,?,?,?)").run(
    1, "admin", "تهيئة", "النظام", null, null, JSON.stringify({ message: "بذر قاعدة البيانات ببيانات تجريبية" }),
  );
}

export function getTaxConfig(year: number): TaxConfig {
  let row =
    db.prepare("SELECT * FROM tax_settings WHERE year = ?").get(year) ||
    db.prepare("SELECT * FROM tax_settings ORDER BY year DESC LIMIT 1").get();
  return { ...row, irg_brackets: JSON.parse(row.irg_brackets) };
}

/** بذر كشوف الرواتب لـ 12 شهر + تصريحات G50 الشهرية */
function seedPayroll() {
  if (db.prepare("SELECT COUNT(*) c FROM payslips").get().c > 0) return;
  const cfg = getTaxConfig(YEAR);
  const employees = db.prepare("SELECT * FROM employees").all();
  const psStmt = db.prepare(`INSERT INTO payslips
    (ref,employee_id,year,month,base_salary,allowances,bonus,gross,cnas_employee,cnas_employer,taxable,irg,advance_deduction,other_deductions,net,days_worked)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  for (let m = 1; m <= 8; m++) {
    for (const e of employees) {
      const advances = db
        .prepare("SELECT * FROM advances WHERE employee_id = ? AND status = 'مقبولة'")
        .all(e.id);
      const adv = advances.length ? Math.min(advances[0].monthly_deduction, advances[0].amount) : 0;
      const bonus = Math.random() < 0.3 ? rnd(5, 25) * 1000 : 0;
      const c = computePayslip(
        { base_salary: e.base_salary, allowances: e.allowances, bonus, advance_deduction: adv },
        cfg,
      );
      psStmt.run(
        `BP-${YEAR}${String(m).padStart(2, "0")}-${e.matricule}`, e.id, YEAR, m,
        c.base_salary, c.allowances, c.bonus, c.gross, c.cnas_employee, c.cnas_employer,
        c.taxable, c.irg, c.advance_deduction, c.other_deductions, c.net, rnd(20, 23),
      );
    }
  }

  // G50 للأشهر المنقضية
  const g50 = db.prepare(`INSERT OR REPLACE INTO g50_declarations
    (year,month,turnover,tva_collected,tva_deductible,tva_due,irg_salaries,tap,total,status,declared_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  const cfgTap = cfg.tap;
  for (let m = 1; m <= 7; m++) {
    const inv = db
      .prepare("SELECT COALESCE(SUM(total_ht),0) ht, COALESCE(SUM(total_tva),0) tva FROM invoices WHERE substr(date,1,7) = ?")
      .get(`${YEAR}-${String(m).padStart(2, "0")}`);
    const exp = db
      .prepare("SELECT COALESCE(SUM(tva_amount),0) tva FROM expenses WHERE substr(date,1,7) = ?")
      .get(`${YEAR}-${String(m).padStart(2, "0")}`);
    const irg = db
      .prepare("SELECT COALESCE(SUM(irg),0) s FROM payslips WHERE year = ? AND month = ?")
      .get(YEAR, m).s;
    const tvaDue = Math.max(0, Math.round(inv.tva - exp.tva));
    const tap = Math.round((inv.ht * cfgTap) / 100);
    g50.run(YEAR, m, inv.ht, inv.tva, exp.tva, tvaDue, irg, tap, tvaDue + irg + tap, "مودع", d(YEAR, m === 12 ? 12 : m + 1, 18));
  }
}

seed();
seedPayroll();
backfillTemplates();
