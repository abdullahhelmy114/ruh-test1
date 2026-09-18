/**
 * Strings for the public academy pages in the three product locales.
 *
 * The locale comes from the existing `preferred-locale` cookie through
 * resolveLocale (unknown values fall back to English); the root layout
 * already sets lang and dir. Arabic and Turkish entries must exist for every
 * English key (enforced by tests).
 */
import type { ProductLocale } from "../domain/vocabulary.ts";

const en = {
  catalogTitle: "Programs and courses",
  catalogIntro: "Browse what the academy teaches.",
  programsHeading: "Programs",
  coursesHeading: "Courses",
  noCourses: "No courses are open yet. Please check back soon.",
  notAvailable: "This part of the academy is not available yet.",
  partOfProgram: "Part of",
  outlineHeading: "What you will learn",
  outlineEmpty: "The course outline will be published soon.",
  lessonsCount: "lessons",
  minutes: "min",
  classGroupsHeading: "Upcoming classes",
  classGroupsEmpty: "No classes are scheduled yet.",
  starts: "Starts",
  ends: "Ends",
  datesToBeAnnounced: "Dates to be announced",
  open: "Places available",
  full: "Full",
  courseNotFound: "We could not find this course.",
  backToCatalog: "Back to all courses",
  programCoursesHeading: "Courses in this program",
  programCoursesEmpty: "No courses in this program are open yet.",
  verifyTitle: "Verify a certificate",
  verifyIntro: "Enter the code printed on the certificate, for example RQ-XXXX-XXXX-XXXX.",
  verifyLabel: "Certificate code",
  verifyButton: "Verify",
  verifyValid: "This certificate is valid.",
  verifyRevoked: "This certificate has been revoked.",
  verifyNotFound: "No certificate matches this code.",
  verifyTooMany: "Too many attempts. Please wait a few minutes and try again.",
  certificateLearner: "Awarded to",
  certificateCourse: "Course",
  certificateIssued: "Issued on",
  certificateRevokedOn: "Revoked on",
  pageNotFoundTitle: "Page not found",
  pageNotFoundBody: "We could not find that page. It may have moved, or the address may be mistyped.",
  backToHome: "Back to the home page",
  errorTitle: "Something went wrong",
  errorBody: "This page could not be shown. Try again, or come back in a moment.",
  tryAgain: "Try again",
} as const;

export type PublicMessageKey = keyof typeof en;
export type PublicMessages = Readonly<Record<PublicMessageKey, string>>;

const ar: PublicMessages = {
  catalogTitle: "البرامج والمقررات",
  catalogIntro: "تعرّف على ما تدرّسه الأكاديمية.",
  programsHeading: "البرامج",
  coursesHeading: "المقررات",
  noCourses: "لا توجد مقررات متاحة بعد. يرجى المراجعة قريبًا.",
  notAvailable: "هذا القسم من الأكاديمية غير متاح بعد.",
  partOfProgram: "ضمن برنامج",
  outlineHeading: "ما ستتعلمه",
  outlineEmpty: "ستُنشر خطة المقرر قريبًا.",
  lessonsCount: "دروس",
  minutes: "دقيقة",
  classGroupsHeading: "الفصول القادمة",
  classGroupsEmpty: "لا توجد فصول مجدولة بعد.",
  starts: "يبدأ",
  ends: "ينتهي",
  datesToBeAnnounced: "المواعيد ستُعلن لاحقًا",
  open: "توجد مقاعد متاحة",
  full: "مكتمل",
  courseNotFound: "لم نعثر على هذا المقرر.",
  backToCatalog: "العودة إلى كل المقررات",
  programCoursesHeading: "مقررات هذا البرنامج",
  programCoursesEmpty: "لا توجد مقررات متاحة في هذا البرنامج بعد.",
  verifyTitle: "التحقق من شهادة",
  verifyIntro: "أدخل الرمز المطبوع على الشهادة، مثل RQ-XXXX-XXXX-XXXX.",
  verifyLabel: "رمز الشهادة",
  verifyButton: "تحقق",
  verifyValid: "هذه الشهادة صالحة.",
  verifyRevoked: "تم إلغاء هذه الشهادة.",
  verifyNotFound: "لا توجد شهادة بهذا الرمز.",
  verifyTooMany: "محاولات كثيرة. يرجى الانتظار بضع دقائق ثم المحاولة مرة أخرى.",
  certificateLearner: "مُنحت إلى",
  certificateCourse: "المقرر",
  certificateIssued: "تاريخ الإصدار",
  certificateRevokedOn: "تاريخ الإلغاء",
  pageNotFoundTitle: "الصفحة غير موجودة",
  pageNotFoundBody: "لم نعثر على هذه الصفحة. ربما تم نقلها أو أن العنوان غير صحيح.",
  backToHome: "العودة إلى الصفحة الرئيسية",
  errorTitle: "حدث خطأ ما",
  errorBody: "تعذّر عرض هذه الصفحة. حاول مرة أخرى، أو عُد بعد قليل.",
  tryAgain: "حاول مرة أخرى",
};

const tr: PublicMessages = {
  catalogTitle: "Programlar ve dersler",
  catalogIntro: "Akademinin öğrettiklerine göz atın.",
  programsHeading: "Programlar",
  coursesHeading: "Dersler",
  noCourses: "Henüz açık ders yok. Lütfen yakında tekrar bakın.",
  notAvailable: "Akademinin bu bölümü henüz kullanılamıyor.",
  partOfProgram: "Program",
  outlineHeading: "Neler öğreneceksiniz",
  outlineEmpty: "Ders planı yakında yayımlanacak.",
  lessonsCount: "ders",
  minutes: "dk",
  classGroupsHeading: "Yaklaşan sınıflar",
  classGroupsEmpty: "Henüz planlanmış sınıf yok.",
  starts: "Başlangıç",
  ends: "Bitiş",
  datesToBeAnnounced: "Tarihler daha sonra duyurulacak",
  open: "Yer var",
  full: "Dolu",
  courseNotFound: "Bu dersi bulamadık.",
  backToCatalog: "Tüm derslere dön",
  programCoursesHeading: "Bu programdaki dersler",
  programCoursesEmpty: "Bu programda henüz açık ders yok.",
  verifyTitle: "Sertifika doğrula",
  verifyIntro: "Sertifikanın üzerindeki kodu girin, örneğin RQ-XXXX-XXXX-XXXX.",
  verifyLabel: "Sertifika kodu",
  verifyButton: "Doğrula",
  verifyValid: "Bu sertifika geçerlidir.",
  verifyRevoked: "Bu sertifika iptal edilmiştir.",
  verifyNotFound: "Bu koda ait sertifika bulunamadı.",
  verifyTooMany: "Çok fazla deneme. Lütfen birkaç dakika bekleyip tekrar deneyin.",
  certificateLearner: "Verildiği kişi",
  certificateCourse: "Ders",
  certificateIssued: "Veriliş tarihi",
  certificateRevokedOn: "İptal tarihi",
  pageNotFoundTitle: "Sayfa bulunamadı",
  pageNotFoundBody: "Bu sayfayı bulamadık. Taşınmış ya da adres yanlış yazılmış olabilir.",
  backToHome: "Ana sayfaya dön",
  errorTitle: "Bir şeyler ters gitti",
  errorBody: "Bu sayfa gösterilemedi. Yeniden deneyin ya da biraz sonra tekrar gelin.",
  tryAgain: "Yeniden dene",
};

export const PUBLIC_MESSAGES: Readonly<Record<ProductLocale, PublicMessages>> = { en, ar, tr };

const DATE_LOCALES: Readonly<Record<ProductLocale, string>> = { en: "en-GB", ar: "ar", tr: "tr-TR" };

/** Formats an ISO date or instant as a calendar date in the reader's language (UTC, no time). */
export function formatPublicDate(value: string, locale: ProductLocale): string {
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(DATE_LOCALES[locale], { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(date);
}
