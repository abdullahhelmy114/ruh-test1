import Link from 'next/link';
import { XCircle } from 'lucide-react';
import { T } from '@/components/TranslatedText';

export default function CancelPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="bg-card p-10 rounded-3xl shadow-elegant text-center max-w-md border border-gray-200 space-y-4">
        <XCircle className="h-16 w-16 text-gray-500 mx-auto" />
        <h1 className="text-3xl font-bold text-gray-900"><T>تم الإلغاء</T></h1>
        <p className="text-gray-500"><T>يمكنك المحاولة مرة أخرى في أي وقت.</T></p>
        <Link
          href="/marketplace"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700"
        >
          <T>العودة إلى السوق</T>
        </Link>
      </div>
    </div>
  );
}