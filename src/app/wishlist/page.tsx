"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { T } from "@/components/TranslatedText";
import { Loader2, Heart, ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function WishlistPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchWishlist = () => {
    if (!user) return;
    setLoading(true);
    fetch(`/api/wishlist?uid=${user.uid}`)
      .then(r => r.json())
      .then(d => setItems(d.items || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchWishlist(); }, [user]);

  const removeItem = async (courseId: string) => {
    await fetch("/api/wishlist", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: user?.uid, courseId }),
    });
    fetchWishlist();
  };

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        <Link href="/login" className="text-accent-foreground"><T>Sign in to see your wishlist</T></Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <Link href="/marketplace" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft size={16} /> <T>Back to Marketplace</T>
      </Link>
      <h1 className="font-serif text-3xl mb-6 flex items-center gap-2">
        <Heart className="h-7 w-7 text-red-500 fill-current" /> <T>Wishlist</T>
      </h1>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Heart className="mx-auto h-12 w-12 mb-4 text-muted-foreground/50" />
          <p><T>Your wishlist is empty.</T></p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item: any) => (
            <div key={item.id} className="flex items-center justify-between glass rounded-2xl p-4">
              <div>
                <Link href={`/courses/${item.course_id}`} className="font-medium hover:text-accent-foreground">{item.title}</Link>
                <p className="text-xs text-muted-foreground"><T>by</T> {item.teacher_name} · {item.level}</p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-bold text-accent-foreground">${item.price}</span>
                <button onClick={() => removeItem(item.course_id)} className="text-red-500 hover:bg-red-50 p-2 rounded-full">
                  <Heart size={16} className="fill-current" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}