"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { CreditCard } from "lucide-react";
import { T } from "@/components/TranslatedText";
import { PaymentModal } from "@/components/PaymentModal";
import { useAuth } from "@/lib/firebase/AuthProvider";

const defaultPlans = [
  { id: '1', name: 'Monthly Plan', price: 99, duration: '3 Months', max_courses: 3 },
  { id: '2', name: 'Semi-Annual Plan', price: 179, duration: '6 Months', max_courses: 5 },
];

export default function SubscriptionsPage() {
  const { user } = useAuth();
  const [plans] = useState(defaultPlans);
  const [showPayment, setShowPayment] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<typeof defaultPlans[0] | null>(null);

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-4xl font-bold text-gray-900 mb-8">
          <T>Subscription Plans</T>
        </h1>
        <div className="grid md:grid-cols-2 gap-8">
          {plans.map((plan) => (
            <Card key={plan.id} className="bg-card border-gray-200 p-8 text-center">
              <CardContent>
                <h2 className="text-2xl font-semibold text-gray-900">
                  <T>{plan.name}</T>
                </h2>
                <p className="text-gray-500 mt-2">
                  <T>{plan.duration}</T>
                </p>
                <p className="text-5xl font-bold text-primary my-6">${plan.price}</p>
                <p className="text-gray-500 mb-6">
                  <T>{`Access to ${plan.max_courses} courses of your choice`}</T>
                </p>
                <button
                  onClick={() => {
                    setSelectedPlan(plan);
                    setShowPayment(true);
                  }}
                  className="w-full rounded-full bg-amber-100py-3 text-sm font-semibold text-amber-700 hover:bg-accent/90 transition flex items-center justify-center gap-2"
                >
                  <CreditCard size={16} />
                  <T>Buy Now</T>
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {selectedPlan && (
        <PaymentModal
          isOpen={showPayment}
          onClose={() => setShowPayment(false)}
          courseTitle={selectedPlan.name}
          userEmail={user?.email ?? undefined}
        />
      )}
    </div>
  );
}