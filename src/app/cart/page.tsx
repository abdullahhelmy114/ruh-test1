"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { T } from "@/components/TranslatedText";
import { Loader2, Trash2, ShoppingCart, ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function CartPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCart = () => {
    if (!user) return;
    setLoading(true);
    fetch(`/api/cart?uid=${user.uid}`)
      .then(r => r.json())
      .then(d => setItems(d.items || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchCart(); }, [user]);

  const removeItem = async (courseId: string) => {
    await fetch("/api/cart", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: user?.uid, courseId }),
    });
    fetchCart();
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Link href="/login" className="text-accent-foreground"><T>Sign in to view your cart</T></Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/marketplace" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft size={16} /> <T>Back to Marketplace</T>
      </Link>
      <h1 className="font-serif text-3xl mb-6 flex items-center gap-2">
        <ShoppingCart className="h-7 w-7 text-secondary-foreground" /> <T>Shopping Cart</T>
      </h1>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <ShoppingCart className="mx-auto h-12 w-12 mb-4 text-secondary-foreground/50" />
          <p><T>Your cart is empty.</T></p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item: any) => (
            <div key={item.id} className="flex items-center justify-between glass rounded-2xl p-4">
              <div className="flex items-center gap-4">
                <div className="h-16 w-16 rounded-xl bg-linear-to-br from-emerald-600 to-emerald-800 flex items-center justify-center overflow-hidden">
                  {item.image_url ? (
                    <Image src={item.image_url} alt={item.title} width={64} height={64} className="object-cover" />
                  ) : (
                    <ShoppingCart className="h-6 w-6 text-white/50" />
                  )}
                </div>
                <div>
                  <Link href={`/courses/${item.course_id}`} className="font-medium hover:text-accent-foreground">{item.title}</Link>
                  <p className="text-xs text-muted-foreground"><T>by</T> {item.teacher_name} · {item.level}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-bold text-accent-foreground">${item.price}</span>
                <button onClick={() => removeItem(item.course_id)} className="p-2 rounded-full hover:bg-red-50 text-red-500">
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
          <div className="text-right mt-4">
            <button className="rounded-full bg-amber-500 px-8 py-3 text-sm font-semibold text-black hover:bg-amber-400">
              <T>Checkout</T>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}