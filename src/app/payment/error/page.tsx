import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { T } from '@/components/TranslatedText';

export default function ErrorPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="bg-card p-10 rounded-3xl shadow-lg text-center max-w-md border border-border space-y-4">
        <AlertTriangle className="h-16 w-16 text-destructive mx-auto" />
        <h1 className="text-3xl font-bold text-destructive"><T>حدث خطأ</T></h1>
        <p className="text-muted-foreground"><T>لم نتمكن من إتمام العملية.</T></p>
        <Link
          href="/marketplace"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <T>العودة إلى السوق</T>
        </Link>
      </div>
    </div>
  );
}