import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiRequest, queryClient, setAuthToken } from "./queryClient";

/* ----------------------------------------------------------- formatting */

export const MONTHS_AR = [
  "جانفي", "فيفري", "مارس", "أفريل", "ماي", "جوان",
  "جويلية", "أوت", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export function fmtNum(v: any, digits = 0) {
  const n = Number(v || 0);
  return n.toLocaleString("fr-FR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}
export function fmtDZD(v: any, digits = 0) {
  return `${fmtNum(v, digits)} د.ج`;
}
export function fmtShortDZD(v: any) {
  const n = Number(v || 0);
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)} مليون د.ج`;
  if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(0)} ألف د.ج`;
  return fmtDZD(n);
}
export function fmtDate(v?: string | null) {
  if (!v) return "—";
  return String(v).slice(0, 10).split("-").reverse().join("/");
}
export function monthLabel(m: number | string) {
  return MONTHS_AR[Number(m) - 1] || String(m);
}

/* ----------------------------------------------------------- CSV export */

export function exportCSV(filename: string, columns: { key: string; label: string }[], rows: any[]) {
  const head = columns.map((c) => `"${c.label}"`).join(";");
  const body = rows
    .map((r) =>
      columns
        .map((c) => {
          const v = typeof c.key === "string" && c.key.includes(".")
            ? c.key.split(".").reduce((a: any, k) => a?.[k], r)
            : r[c.key];
          return `"${String(v ?? "").replace(/"/g, '""')}"`;
        })
        .join(";"),
    )
    .join("\n");
  const blob = new Blob(["\uFEFF" + head + "\n" + body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** تصدير Excel — ملف .xls (جدول HTML بترميز UTF-8) يفتح مباشرة في Excel و LibreOffice */
export function exportExcel(filename: string, columns: { key: string; label: string }[], rows: any[], title?: string) {
  const esc = (v: any) =>
    String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const get = (r: any, key: string) =>
    key.includes(".") ? key.split(".").reduce((a: any, k) => a?.[k], r) : r[key];
  const head = `<tr>${columns.map((c) => `<th style="background:#e8f0ee;border:1px solid #999;font-weight:bold">${esc(c.label)}</th>`).join("")}</tr>`;
  const body = rows
    .map((r) => `<tr>${columns.map((c) => {
      const v = get(r, c.key);
      const isNum = typeof v === "number";
      return `<td style="border:1px solid #ccc"${isNum ? ' x:num' : ""}>${esc(v)}</td>`;
    }).join("")}</tr>`)
    .join("");
  const html =
    `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8" /></head>` +
    `<body dir="rtl"><table border="1" style="font-family:Arial,sans-serif;font-size:12px">` +
    (title ? `<tr><th colspan="${columns.length}" style="font-size:14px">${esc(title)}</th></tr>` : "") +
    `${head}${body}</table></body></html>`;
  const blob = new Blob(["\uFEFF" + html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ----------------------------------------------------------- المبلغ بالحروف (تفقيط) */

const ONES = ["", "واحد", "اثنان", "ثلاثة", "أربعة", "خمسة", "ستة", "سبعة", "ثمانية", "تسعة", "عشرة",
  "أحد عشر", "اثنا عشر", "ثلاثة عشر", "أربعة عشر", "خمسة عشر", "ستة عشر", "سبعة عشر", "ثمانية عشر", "تسعة عشر"];
const TENS = ["", "عشر", "عشرون", "ثلاثون", "أربعون", "خمسون", "ستون", "سبعون", "ثمانون", "تسعون"];
const HUNDREDS = ["", "مائة", "مائتان", "ثلاثمائة", "أربعمائة", "خمسمائة", "ستمائة", "سبعمائة", "ثمانمائة", "تسعمائة"];

function under1000(n: number): string {
  const parts: string[] = [];
  const h = Math.floor(n / 100);
  const rest = n % 100;
  if (h) parts.push(HUNDREDS[h]);
  if (rest) {
    if (rest < 20) parts.push(ONES[rest]);
    else {
      const u = rest % 10;
      const t = Math.floor(rest / 10);
      parts.push(u ? `${ONES[u]} و${TENS[t]}` : TENS[t]);
    }
  }
  return parts.join(" و");
}

function groupWord(n: number, singular: string, dual: string, plural: string, genitive: string) {
  if (n === 1) return singular;
  if (n === 2) return dual;
  if (n >= 3 && n <= 10) return `${under1000(n)} ${plural}`;
  return `${under1000(n)} ${genitive}`;
}

/** تحويل عدد صحيح إلى حروف عربية */
export function numberToArabicWords(value: number): string {
  let n = Math.floor(Math.abs(Number(value) || 0));
  if (n === 0) return "صفر";
  const chunks: string[] = [];
  const milliards = Math.floor(n / 1_000_000_000);
  n %= 1_000_000_000;
  const millions = Math.floor(n / 1_000_000);
  n %= 1_000_000;
  const thousands = Math.floor(n / 1000);
  const units = n % 1000;
  if (milliards) chunks.push(groupWord(milliards, "مليار", "ملياران", "ملايير", "مليار"));
  if (millions) chunks.push(groupWord(millions, "مليون", "مليونان", "ملايين", "مليون"));
  if (thousands) chunks.push(groupWord(thousands, "ألف", "ألفان", "آلاف", "ألف"));
  if (units) chunks.push(under1000(units));
  return chunks.join(" و");
}

/** المبلغ بالحروف بالدينار الجزائري والسنتيم */
export function amountInArabicWords(value: number): string {
  const v = Math.abs(Number(value) || 0);
  const dinars = Math.floor(v);
  const cents = Math.round((v - dinars) * 100);
  let out = `${numberToArabicWords(dinars)} دينار جزائري`;
  if (cents) out += ` و${numberToArabicWords(cents)} سنتيم`;
  return `${out} لا غير`;
}

/** عدد الأيام حتى تاريخ (موجب = ما زال في المستقبل) */
export function daysUntil(date: string) {
  const target = new Date(`${String(date).slice(0, 10)}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 86400000);
}

/* ----------------------------------------------------------- auth ctx */

export type User = { id: number; username: string; name: string; role: string };
export type Perms = Record<string, { read: boolean; write: boolean }>;

type AuthCtx = {
  user: User | null;
  perms: Perms;
  login: (u: string, p: string) => Promise<void>;
  logout: () => void;
  can: (mod: string, mode?: "read" | "write") => boolean;
};

const Ctx = createContext<AuthCtx>({} as AuthCtx);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [perms, setPerms] = useState<Perms>({});

  const login = async (username: string, password: string) => {
    const res = await apiRequest("POST", "/api/auth/login", { username, password });
    const data = await res.json();
    setAuthToken(data.token);
    setUser(data.user);
    setPerms(data.permissions);
    queryClient.clear();
  };

  const logout = () => {
    apiRequest("POST", "/api/auth/logout").catch(() => {});
    setAuthToken(null);
    setUser(null);
    setPerms({});
    queryClient.clear();
    window.location.hash = "#/";
  };

  const can = (mod: string, mode: "read" | "write" = "read") => !!perms[mod]?.[mode];

  return <Ctx.Provider value={{ user, perms, login, logout, can }}>{children}</Ctx.Provider>;
}

/* ----------------------------------------------------------- theme ctx */

const ThemeCtx = createContext<{ dark: boolean; toggle: () => void }>({ dark: false, toggle: () => {} });
export const useTheme = () => useContext(ThemeCtx);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)").matches : false,
  );
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  const value = useMemo(() => ({ dark, toggle: () => setDark((d) => !d) }), [dark]);
  return <ThemeCtx.Provider value={value}>{children}</ThemeCtx.Provider>;
}
