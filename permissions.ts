/** خريطة الصلاحيات حسب الدور — تُطبَّق في الباك-إند وتُرسل للواجهة */

export const ROLES = ["مدير", "محاسب", "موارد بشرية", "مبيعات"] as const;
export type Role = (typeof ROLES)[number];

export type ModulePerm = { read: Role[]; write: Role[] };

const ALL: Role[] = ["مدير", "محاسب", "موارد بشرية", "مبيعات"];

export const PERMISSIONS: Record<string, ModulePerm> = {
  dashboard: { read: ALL, write: ["مدير"] },
  hr: { read: ["مدير", "موارد بشرية"], write: ["مدير", "موارد بشرية"] },
  payroll: { read: ["مدير", "موارد بشرية", "محاسب"], write: ["مدير", "موارد بشرية"] },
  advances: { read: ["مدير", "موارد بشرية", "محاسب"], write: ["مدير", "موارد بشرية"] },
  inventory: { read: ["مدير", "مبيعات", "محاسب"], write: ["مدير", "مبيعات"] },
  invoicing: { read: ["مدير", "محاسب", "مبيعات"], write: ["مدير", "محاسب", "مبيعات"] },
  accounting: { read: ["مدير", "محاسب"], write: ["مدير", "محاسب"] },
  fiscal: { read: ["مدير", "محاسب"], write: ["مدير", "محاسب"] },
  crm: { read: ["مدير", "مبيعات", "محاسب"], write: ["مدير", "مبيعات"] },
  projects: { read: ALL, write: ["مدير", "مبيعات", "موارد بشرية"] },
  settings: { read: ["مدير"], write: ["مدير"] },
  audit: { read: ["مدير"], write: ["مدير"] },
  backups: { read: ["مدير"], write: ["مدير"] },
};

export function canRead(role: string, mod: string) {
  return (PERMISSIONS[mod]?.read as string[])?.includes(role) ?? false;
}
export function canWrite(role: string, mod: string) {
  return (PERMISSIONS[mod]?.write as string[])?.includes(role) ?? false;
}

export function permissionsFor(role: string) {
  const out: Record<string, { read: boolean; write: boolean }> = {};
  for (const m of Object.keys(PERMISSIONS)) out[m] = { read: canRead(role, m), write: canWrite(role, m) };
  return out;
}
