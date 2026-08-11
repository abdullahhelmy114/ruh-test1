"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { authFetch } from "@/lib/authFetch";
import { T } from "@/components/TranslatedText";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Image as ImageIcon,
  Video,
  Music,
  HelpCircle,
  Loader2,
  Move,
} from "lucide-react";
import type { OverlayItem } from "@/components/reader/PageOverlay";

// ── أنواع ──────────────────────────────────────────
interface PageInfo {
  page_number: number;
  image_url: string;
}

// ── المكون الرئيسي ────────────────────────────────
export default function BookEditorPage() {
  const params = useParams<{ bookId: string }>();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  // بيانات الكتاب
  const [bookTitle, setBookTitle] = useState("");
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // الصفحة المختارة حاليًا
  const [selectedPage, setSelectedPage] = useState<number | null>(null);

  // التراكبات (خاصة بالكتاب كله)
  const [overlays, setOverlays] = useState<OverlayItem[]>([]);

  // حوار إضافة/تعديل تراكب
  const [overlayDialogOpen, setOverlayDialogOpen] = useState(false);
  const [editingOverlay, setEditingOverlay] = useState<OverlayItem | null>(null);
  const [overlayType, setOverlayType] = useState<"audio" | "video" | "quiz" | "game">("video");
  const [overlayUrl, setOverlayUrl] = useState("");
  const [overlayPosition, setOverlayPosition] = useState({ x: 10, y: 10, width: 80, height: 80 });
  const [savingOverlay, setSavingOverlay] = useState(false);

  // السحب لتحديد الموضع (بسيط)
  const imageRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  // ── تحميل الكتاب ──────────────────────────────────
  useEffect(() => {
    if (!user || !params.bookId) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const res = await authFetch(`/api/library/books/${params.bookId}`);
        if (!res.ok) throw new Error("Book not found");
        const data = await res.json();
        setBookTitle(data.book?.title || "Untitled");
        setPages(data.pages || []);

        // تحميل التراكبات
        const overlaysRes = await authFetch(`/api/library/page-overlay/${params.bookId}`);
        if (overlaysRes.ok) {
          const overlaysData = await overlaysRes.json();
          setOverlays(overlaysData.overlays || []);
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load book");
      }
      setLoading(false);
    };

    load();
  }, [user, params.bookId]);

  // التراكبات الخاصة بالصفحة الحالية
  const currentOverlays = overlays.filter(
    (o) => (o as any).page_number === selectedPage
  );

  // ── إضافة / تعديل تراكب ──────────────────────────
  const openNewOverlay = () => {
    setEditingOverlay(null);
    setOverlayType("video");
    setOverlayUrl("");
    setOverlayPosition({ x: 10, y: 10, width: 80, height: 80 });
    setOverlayDialogOpen(true);
  };

  const openEditOverlay = (item: OverlayItem) => {
    setEditingOverlay(item);
    setOverlayType(item.type);
    setOverlayUrl(item.content?.url || "");
    setOverlayPosition(item.position);
    setOverlayDialogOpen(true);
  };

  const saveOverlay = async () => {
    if (!selectedPage) return;
    setSavingOverlay(true);

    const body = {
      book_id: params.bookId,
      page_number: selectedPage,
      type: overlayType,
      position: overlayPosition,
      content: { url: overlayUrl }, // تبسيط
    };

    try {
      // إنشاء تراكب جديد (POST)
      const res = await authFetch("/api/library/page-overlay", {
        method: "POST",
        body: JSON.stringify(body),
      });
      if (res.ok) {
        toast.success(editingOverlay ? "Overlay updated" : "Overlay added");
        // إعادة تحميل التراكبات
        const overlaysRes = await authFetch(`/api/library/page-overlay/${params.bookId}`);
        if (overlaysRes.ok) {
          const overlaysData = await overlaysRes.json();
          setOverlays(overlaysData.overlays || []);
        }
        setOverlayDialogOpen(false);
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed to save overlay");
      }
    } catch {
      toast.error("Network error");
    } finally {
      setSavingOverlay(false);
    }
  };

  const deleteOverlay = async (overlayId: string) => {
    // ملاحظة: لم ننشئ endpoint DELETE للتراكبات بعد. يمكن إضافته لاحقًا.
    // حاليًا نستخدم تحذير.
    toast.error("Delete overlay not implemented yet. Remove from database manually.");
  };

  // ── السحب لتحديد الموضع ─────────────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setOverlayPosition((prev) => ({ ...prev, x: Math.round(x), y: Math.round(y) }));
    setDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setOverlayPosition((prev) => ({ ...prev, x: Math.round(x), y: Math.round(y) }));
  };

  const handleMouseUp = () => setDragging(false);

  // ── عرض التحميل ──────────────────────────────────
  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" dir="rtl">
      {/* رأس الصفحة */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard/admin")}
          >
            <ArrowLeft className="ml-2 h-4 w-4" />
            <T>Back to Dashboard</T>
          </Button>
          <h1 className="text-2xl font-bold">{bookTitle}</h1>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* قائمة الصفحات (الشريط الجانبي) */}
        <div className="col-span-12 lg:col-span-3">
          <div className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 font-semibold"><T>Pages</T></h2>
            <div className="space-y-2 max-h-[70vh] overflow-y-auto">
              {pages.map((page) => (
                <button
                  key={page.page_number}
                  onClick={() => setSelectedPage(page.page_number)}
                  className={`w-full flex items-center gap-3 rounded-lg border p-3 text-right transition ${
                    selectedPage === page.page_number
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <ImageIcon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">صفحة {page.page_number}</span>
                </button>
              ))}
              {pages.length === 0 && (
                <p className="text-sm text-muted-foreground">لا توجد صفحات بعد. قم بتحويل الـ PDF أولاً.</p>
              )}
            </div>
          </div>
        </div>

        {/* منطقة تحرير الصفحة */}
        <div className="col-span-12 lg:col-span-9">
          {selectedPage ? (
            <div className="rounded-xl border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">صفحة {selectedPage}</h3>
                <Button onClick={openNewOverlay} size="sm">
                  <Plus className="ml-2 h-4 w-4" />
                  إضافة عنصر تفاعلي
                </Button>
              </div>

              {/* معاينة الصفحة مع التراكبات */}
              <div
                ref={imageRef}
                className="relative mx-auto overflow-hidden rounded-lg border"
                style={{ width: 400, height: 550 }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
              >
                <img
                  src={pages.find((p) => p.page_number === selectedPage)?.image_url}
                  alt={`Page ${selectedPage}`}
                  className="h-full w-full object-contain"
                  draggable={false}
                />

                {/* عرض التراكبات الحالية */}
                {currentOverlays.map((item) => {
                  const left = `${item.position.x}%`;
                  const top = `${item.position.y}%`;
                  const width = `${item.position.width}%`;
                  const height = `${item.position.height}%`;

                  return (
                    <div
                      key={item.id}
                      className="absolute flex cursor-pointer items-center justify-center border-2 border-dashed border-primary/50 bg-primary/10 hover:bg-primary/20"
                      style={{ left, top, width, height }}
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditOverlay(item);
                      }}
                    >
                      {item.type === "video" && <Video className="h-6 w-6 text-primary" />}
                      {item.type === "audio" && <Music className="h-6 w-6 text-primary" />}
                      {item.type === "quiz" && <HelpCircle className="h-6 w-6 text-primary" />}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl border bg-card p-12 text-muted-foreground">
              <p>اختر صفحة من القائمة لتحريرها</p>
            </div>
          )}
        </div>
      </div>

      {/* حوار إضافة / تعديل تراكب */}
      <Dialog open={overlayDialogOpen} onOpenChange={setOverlayDialogOpen}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>
              {editingOverlay ? "تعديل العنصر" : "إضافة عنصر تفاعلي"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* اختيار النوع */}
            <div>
              <Label>النوع</Label>
              <Select
                value={overlayType}
                onValueChange={(val: any) => setOverlayType(val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">فيديو</SelectItem>
                  <SelectItem value="audio">صوت</SelectItem>
                  <SelectItem value="quiz">اختبار</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* رابط الوسائط */}
            <div>
              <Label>الرابط (URL)</Label>
              <Input
                value={overlayUrl}
                onChange={(e) => setOverlayUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            {/* إحداثيات الموضع */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>X %</Label>
                <Input
                  type="number"
                  value={overlayPosition.x}
                  onChange={(e) =>
                    setOverlayPosition((prev) => ({ ...prev, x: Number(e.target.value) }))
                  }
                  min={0}
                  max={100}
                />
              </div>
              <div>
                <Label>Y %</Label>
                <Input
                  type="number"
                  value={overlayPosition.y}
                  onChange={(e) =>
                    setOverlayPosition((prev) => ({ ...prev, y: Number(e.target.value) }))
                  }
                  min={0}
                  max={100}
                />
              </div>
              <div>
                <Label>Width %</Label>
                <Input
                  type="number"
                  value={overlayPosition.width}
                  onChange={(e) =>
                    setOverlayPosition((prev) => ({ ...prev, width: Number(e.target.value) }))
                  }
                  min={1}
                  max={100}
                />
              </div>
              <div>
                <Label>Height %</Label>
                <Input
                  type="number"
                  value={overlayPosition.height}
                  onChange={(e) =>
                    setOverlayPosition((prev) => ({ ...prev, height: Number(e.target.value) }))
                  }
                  min={1}
                  max={100}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              أو انقر واسحب على الصفحة لتحديد الموضع.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOverlayDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={saveOverlay} disabled={savingOverlay}>
              {savingOverlay ? <Loader2 className="h-4 w-4 animate-spin" /> : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}