import Link from 'next/link';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { T } from '@/components/TranslatedText';

export default function SuccessPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="bg-card p-10 rounded-3xl shadow-lg text-center max-w-md border border-border space-y-4">
        <CheckCircle className="h-16 w-16 text-primary mx-auto" />
        <h1 className="text-3xl font-bold text-foreground"><T>تم الدفع بنجاح!</T></h1>
        <p className="text-muted-foreground"><T>شكراً لثقتك، يمكنك الآن الوصول إلى محتواك.</T></p>
        <div className="flex flex-col gap-2 pt-2">
          <Link
            href="/dashboard/student/courses"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <T>الذهاب إلى كورساتي</T> <ArrowRight size={16} />
          </Link>
          <Link
            href="/marketplace"
            className="text-sm text-muted-foreground hover:text-foreground underline"
          >
            <T>تصفح المزيد من الكورسات</T>
          </Link>
        </div>
      </div>
    </div>
  );
}