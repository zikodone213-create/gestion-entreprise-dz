import { Link } from "wouter";
import { AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-background p-4 text-foreground">
      <Card className="w-full max-w-md p-6 text-center">
        <AlertCircle className="mx-auto h-8 w-8 text-destructive" />
        <h1 className="mt-3 text-lg font-bold">الصفحة غير موجودة</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          الرابط المطلوب غير متاح أو تم نقله. يمكنك العودة إلى لوحة التحكم.
        </p>
        <Link href="/">
          <Button className="mt-4" data-testid="button-back-home">العودة إلى لوحة التحكم</Button>
        </Link>
      </Card>
    </div>
  );
}
