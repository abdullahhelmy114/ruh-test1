import Link from 'next/link'

export default function NotFound() {
  return (
    <html>
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center bg-background">
          <h2 className="font-serif text-2xl">الصفحة غير موجودة</h2>
          <p className="mt-2 text-gray-500">404 - لم يتم العثور على الصفحة</p>
          <Link href="/" className="mt-4 text-amber-700 hover:underline">
            العودة للرئيسية
          </Link>
        </div>
      </body>
    </html>
  )
}