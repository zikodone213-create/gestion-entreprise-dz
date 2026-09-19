# النور ERP — نظام تسيير مؤسسة جزائرية (عربي / RTL)

تطبيق ويب متكامل: موارد بشرية ورواتب، تسبيقات، مخزون ومبيعات، فوترة ومحاسبة، الوحدة الجبائية (G50 + البيلان)، CRM، مشاريع ومهام، لوحة تحكم، صلاحيات، سجل عمليات، ونسخ احتياطي.

## التقنيات

| الطبقة | التقنية |
|---|---|
| الواجهة | React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui (Radix) + Recharts + wouter + TanStack Query |
| الخادم | Node.js + Express + TypeScript (tsx) |
| قاعدة البيانات | SQLite (better-sqlite3) — ملف واحد `data.db` مشترك بين كل الوحدات |
| الخطوط | IBM Plex Sans Arabic + Cairo + IBM Plex Mono (Google Fonts) |

## التشغيل محلياً

المتطلبات: Node.js 20 أو أحدث.

```bash
npm install
npm run dev          # يشغّل الخادم + الواجهة على http://localhost:5000
```

على Windows، إذا لم يعمل `npm run dev` بسبب `NODE_ENV=development`:

```bash
npx cross-env NODE_ENV=development tsx server/index.ts
```

### بناء نسخة الإنتاج

```bash
npm run build        # ينتج dist/public (الواجهة) و dist/index.cjs (الخادم)
npm start            # يشغّل الإنتاج على المنفذ 5000
```

المنفذ قابل للتغيير عبر متغير البيئة `PORT`.

## حسابات الدخول التجريبية

| المستخدم | كلمة المرور | الدور | الوصول |
|---|---|---|---|
| `admin` | `admin123` | مدير | كل الوحدات + الإعدادات + السجلات |
| `compta` | `compta123` | محاسب | المحاسبة، الفوترة، الجباية، التقارير |
| `rh` | `rh123` | موارد بشرية | الموظفون، الحضور، الرواتب، التسبيقات |
| `ventes` | `ventes123` | مبيعات | المخزون، الفوترة، العملاء |

> تنبيه أمني: كلمات المرور مخزنة كنص عادي في قاعدة البيانات (نسخة تجريبية). قبل الاستعمال الحقيقي استبدلها بتشفير `bcrypt` في `server/routes.ts` (مسار `/api/auth/login`) و`server/db.ts` (البذر).

## قاعدة البيانات

- الملف: `data.db` في جذر المشروع (مرفق مع بيانات تجريبية جزائرية: 12 موظفاً، 12 شهراً من الفواتير والمصاريف، كشوف رواتب، أرشيف G50، بيلان 2025...).
- لبدء قاعدة فارغة: احذف `data.db` وأعد تشغيل الخادم — يُنشئ الجدول والبذر تلقائياً (`server/db.ts`).
- النسخ الاحتياطي: تلقائي كل 6 ساعات إلى مجلد `backups/`، وأيضاً يدوياً من صفحة «النسخ الاحتياطي».

## هيكل المشروع

```
erp/
├── package.json              # المكتبات والسكريبتات
├── vite.config.ts            # إعداد بناء الواجهة (alias @ → client/src)
├── tailwind.config.ts        # الثيم والألوان والخطوط
├── postcss.config.js
├── tsconfig.json
├── drizzle.config.ts
├── data.db                   # قاعدة البيانات SQLite (مشتركة بين كل الوحدات)
├── script/
│   └── build.ts              # سكريبت البناء (Vite + esbuild للخادم)
├── shared/
│   └── schema.ts             # الأنواع/المخطط المشترك بين الواجهة والخادم
├── server/
│   ├── index.ts              # نقطة انطلاق Express + Vite middleware
│   ├── db.ts                 # إنشاء 28 جدولاً + البيانات التجريبية
│   ├── routes.ts             # كل مسارات REST API
│   ├── permissions.ts        # مصفوفة الصلاحيات لكل دور
│   ├── payroll.ts            # حساب CNAS + IRG بالشرائح + خصم التسبيقات
│   ├── fiscal.ts             # تجميع G50 والبيلان و TCR
│   ├── backup.ts             # النسخ الاحتياطي والاستعادة
│   └── vite.ts               # ربط Vite في وضع التطوير
└── client/
    ├── index.html
    ├── public/favicon.png
    └── src/
        ├── main.tsx          # نقطة انطلاق React
        ├── App.tsx           # المسارات + المصادقة + التخطيط العام
        ├── index.css         # متغيرات الثيم + RTL + أنماط الطباعة A4
        ├── pages/            # صفحة لكل وحدة
        │   ├── dashboard.tsx  hr.tsx        payroll.tsx   advances.tsx
        │   ├── inventory.tsx  invoicing.tsx accounting.tsx fiscal.tsx
        │   ├── crm.tsx        projects.tsx  calendar.tsx  reports.tsx
        │   ├── settings.tsx   audit.tsx     backups.tsx   login.tsx
        ├── components/
        │   ├── kit.tsx        # DataTable, ModalForm, KpiCard, StatusBadge, PrintLayout,
        │   │                  #  حالات فارغة/تحميل/خطأ، أزرار التصدير
        │   ├── shell.tsx      # التخطيط العام: القائمة الجانبية RTL + الترويسة + الوضع الليلي
        │   └── ui/            # مكونات shadcn/ui (Radix)
        ├── hooks/            # use-toast, use-mobile
        └── lib/
            ├── erp.tsx        # سياق المصادقة والصلاحيات، تنسيق الأرقام/الدينار،
            │                  #  التفقيط بالحروف، تصدير CSV/Excel، أدوات الطباعة
            ├── queryClient.ts # إعداد TanStack Query + رمز الجلسة
            └── utils.ts
```

## ملاحظات تقنية

- **الترقيم التسلسلي للفواتير** بدون فراغات يتم داخل معاملة SQLite في `server/routes.ts` (جدول `invoice_counters`)، والحذف يحوّل الفاتورة إلى «ملغاة» بدل حذف الرقم.
- **نسب الضرائب** (TVA، شرائح IRG، TAP، CNAS) مخزنة في جدول `tax_settings` حسب سنة السريان وتُعدّل من صفحة الإعدادات — غير مثبتة في الكود.
- **PDF** يتم عبر `window.print()` مع قوالب A4 مخصصة (`PrintLayout` + أنماط `@media print` في `index.css`): كشف الراتب، الفاتورة، G50، البيلان، التقارير.
- **Excel** يُصدَّر حالياً كملف `.xls` (جدول HTML) و CSV بترميز UTF-8 BOM؛ للحصول على `.xlsx` أصلي أضف مكتبة `xlsx`.
- **سجل العمليات** يُكتب تلقائياً في كل عمليات الإنشاء/التعديل/الحذف (المستخدم، الوحدة، القيم قبل/بعد، التاريخ).

## النشر

- **VPS / خادم خاص:** `npm install && npm run build && npm start` مع `pm2` أو `systemd`، وخلفه Nginx كوكيل عكسي. احرص على نسخ `data.db` احتياطياً.
- **Docker:** صورة `node:20-alpine`، انسخ المشروع، `npm ci`، `npm run build`، `CMD ["npm","start"]`، واربط `data.db` و`backups/` بـ volume دائم.
- **منصات مثل Railway / Render / Fly.io:** تعمل مباشرة (خادم Node واحد) مع قرص دائم لملف SQLite. Vercel/Netlify غير مناسبة لأن SQLite تحتاج نظام ملفات دائم.
