import { NextResponse } from "next/server";
import crypto from "crypto";

const WHOP_WEBHOOK_SECRET = process.env.WHOP_WEBHOOK_SECRET || "";

export async function POST(req: Request) {
  try {
    const rawBody = await req.text();
    const signature = req.headers.get("x-whop-signature");

    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 401 });
    }

    // 1️⃣ التحقق الأمني من التوقيع
    const computedSignature = crypto
      .createHmac("sha256", WHOP_WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    if (computedSignature !== signature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.action; // ✅ Whop uses "action" field

    console.log(`🚀 Whop Webhook Received: ${eventType}`);

    // 2️⃣ معالجة الحدث
    switch (eventType) {
      case "payment.succeeded": {
        // ✅ هذا الحدث الأكثر شيوعًا عند الدفع الناجح
        const { user, plan, membership_id } = event.data;
        const studentEmail = user?.email;
        const studentName = user?.username || "Student";
        const productId = plan?.product_id;

        console.log(`✅ Payment succeeded for ${studentEmail} on product ${productId}`);

        // 💡 هنا يتم ربط الطالب بالكورس في قاعدة البيانات
        // مثال:
        // await sql`INSERT INTO enrollments (user_email, course_id) VALUES (${studentEmail}, ${productId})`;
        break;
      }

      case "membership.went_active": {
        const { user, plan } = event.data;
        const studentEmail = user?.email;
        const productId = plan?.product_id;

        console.log(`✅ Membership active for ${studentEmail} on product ${productId}`);

        // 💡 منطق التفعيل: تحديث حالة الكورس للطالب
        break;
      }

      case "membership.became_inactive": {
        const { user, plan } = event.data;
        const studentEmail = user?.email;
        const productId = plan?.product_id;

        console.log(`❌ Membership inactive for ${studentEmail} on product ${productId}`);

        // 💡 منطق الإلغاء: إزالة وصول الطالب
        break;
      }

      default:
        console.log(`ℹ️ Unhandled Whop event type: ${eventType}`);
    }

    return NextResponse.json({ received: true }, { status: 200 });

  } catch (error: any) {
    console.error("💥 Webhook Handler Error:", error.message);
    return NextResponse.json({ error: "Webhook handler failed" }, { status: 500 });
  }
}