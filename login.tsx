import { useState } from "react";
import { Loader2, LogIn, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/erp";
import { Logo } from "@/components/kit";
import { useToast } from "@/hooks/use-toast";

const DEMO = [
  { username: "admin", password: "admin123", role: "مدير", desc: "كل الوحدات والإعدادات والسجلات" },
  { username: "compta", password: "compta123", role: "محاسب", desc: "المحاسبة، الجباية، التقارير" },
  { username: "rh", password: "rh123", role: "موارد بشرية", desc: "الموظفون، الرواتب، الحضور، التسبيقات" },
  { username: "ventes", password: "ventes123", role: "مبيعات", desc: "المخزون، الفوترة، العملاء" },
];

export default function LoginPage() {
  const { login } = useAuth();
  const { toast } = useToast();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [busy, setBusy] = useState(false);

  const submit = async (u = username, p = password) => {
    setBusy(true);
    try {
      await login(String(u).trim(), String(p).trim());
      toast({ title: "مرحباً بك", description: "تم تسجيل الدخول بنجاح" });
    } catch (e: any) {
      toast({ title: "فشل تسجيل الدخول", description: "اسم المستخدم أو كلمة المرور غير صحيحة", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10 text-foreground">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <span className="text-primary"><Logo className="h-10 w-10" /></span>
            <div>
              <p className="text-lg font-bold leading-tight">النور ERP</p>
              <p className="text-xs text-muted-foreground">نظام تسيير المؤسسة — شركة النور للتجهيزات الصناعية ش.ذ.م.م</p>
            </div>
          </div>
          <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
            نظام متكامل للتسيير: الموارد البشرية والرواتب (CNAS و IRG)، المخزون والمبيعات، الفوترة والمحاسبة،
            التصريحات الجبائية G50 والبيلان السنوي، متابعة العملاء والمشاريع — مع سجل عمليات ونسخ احتياطي.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {DEMO.map((d) => (
              <button
                key={d.username}
                onClick={() => { setUsername(d.username); setPassword(d.password); submit(d.username, d.password); }}
                className="rounded-lg border border-border bg-card p-3 text-start transition-colors hover:border-primary/50 hover:bg-muted/50"
                data-testid={`button-demo-${d.username}`}
                disabled={busy}
              >
                <p className="text-sm font-semibold">{d.role}</p>
                <p className="mt-0.5 text-[11px] text-muted-foreground">{d.desc}</p>
                <p className="num mt-1.5 text-[11px] text-primary">{d.username} / {d.password}</p>
              </button>
            ))}
          </div>
        </div>

        <Card className="p-6">
          <div className="mb-5 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h1 className="text-base font-bold">تسجيل الدخول</h1>
          </div>
          <form
            className="space-y-4"
            onSubmit={(e) => { e.preventDefault(); submit(); }}
          >
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">اسم المستخدم</span>
              <Input name="erp-username" dir="ltr" className="text-start" value={username} onChange={(e) => setUsername(e.target.value)} data-testid="input-username" autoComplete="off" autoCapitalize="none" spellCheck={false} />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">كلمة المرور</span>
              <Input type="password" name="erp-password" dir="ltr" className="text-start" value={password} onChange={(e) => setPassword(e.target.value)} data-testid="input-password" autoComplete="off" spellCheck={false} />
            </label>
            <Button type="submit" className="w-full" disabled={busy} data-testid="button-login">
              {busy ? <Loader2 className="me-1.5 h-4 w-4 animate-spin" /> : <LogIn className="me-1.5 h-4 w-4" />}
              دخول
            </Button>
          </form>
          <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
            حسابات تجريبية: <span className="num">admin/admin123</span> · <span className="num">compta/compta123</span> ·{" "}
            <span className="num">rh/rh123</span> · <span className="num">ventes/ventes123</span>
          </p>
        </Card>
      </div>
    </div>
  );
}
