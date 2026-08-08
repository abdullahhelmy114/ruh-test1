"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard, Loader2 } from "lucide-react";

const defaultPlans = [
  { id: '1', name: 'الخطة الشهرية', price: 99, duration: '3 أشهر', max_courses: 3 },
  { id: '2', name: 'الخطة النصف سنوية', price: 179, duration: '6 أشهر', max_courses: 5 },
];

export default function SubscriptionsPage() {
  const [plans] = useState(defaultPlans);
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);

  const handleBuyPlan = async (plan: typeof defaultPlans[0]) => {
    setLoadingPlanId(plan.id);
    try {
      const res = await fetch('/api/shopier/create-payment-link', {
        method: 'POST',
        credentials: 'include', // ✅ تمت الإضافة هنا
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'subscription',
          planId: plan.id,
          title: plan.name,
          price: plan.price,
        }),
      });
      const data = await res.json();
      if (data.paymentUrl) {
        window.open(data.paymentUrl, '_blank');
      } else {
        alert(data.error || 'فشل في إنشاء رابط الدفع');
      }
    } catch {
      alert('خطأ في الشبكة');
    } finally {
      setLoadingPlanId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-4xl font-bold text-foreground mb-8">خطط الاشتراك</h1>
        <div className="grid md:grid-cols-2 gap-8">
          {plans.map((plan) => (
            <Card key={plan.id} className="bg-card border-border p-8 text-center">
              <CardContent>
                <h2 className="text-2xl font-semibold text-foreground">{plan.name}</h2>
                <p className="text-muted-foreground mt-2">{plan.duration}</p>
                <p className="text-5xl font-bold text-primary my-6">${plan.price}</p>
                <p className="text-muted-foreground mb-6">
                  وصول لـ {plan.max_courses} كورسات من اختيارك
                </p>
                <button
                  onClick={() => handleBuyPlan(plan)}
                  disabled={loadingPlanId === plan.id}
                  className="w-full rounded-full bg-accent py-3 text-sm font-semibold text-accent-foreground hover:bg-accent/90 transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loadingPlanId === plan.id ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <CreditCard size={16} />
                      اشتر الآن
                    </>
                  )}
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}