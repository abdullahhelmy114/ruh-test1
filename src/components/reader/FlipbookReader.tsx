"use client";

import React, { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { authFetch } from "@/lib/authFetch";
import { T } from "@/components/TranslatedText";
import { Button } from "@/components/ui/button";
import { Loader2, Volume2, VolumeX, ZoomIn, ZoomOut } from "lucide-react";
import { toast } from "sonner";
import HTMLFlipBook from "react-pageflip";

// ── Types ──────────────────────────────────────────
interface PageData {
  page_number: number;
  image_file_id: string;
  image_url?: string;
  text_content?: string;
}

interface OverlayItem {
  id: string;
  page_number: number;
  type: "audio" | "video" | "quiz" | "game" | "iframe" | "link";
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  content: any;
  settings?: any;
}

interface BookData {
  id: string;
  title: string;
  author?: string;
  access_type: string;
  allowed_pages?: number[];
  flipbook_config?: {
    sound?: boolean;
    pageWidth?: number;
    pageHeight?: number;
    showCover?: boolean;
    watermarkText?: string;
  };
}

// ── مكون عرض عنصر تفاعلي داخل الصفحة ────────────────
function InteractiveElement({ overlay }: { overlay: OverlayItem }) {
  const { type, content, position } = overlay;

  const style: React.CSSProperties = {
    position: "absolute",
    left: `${position.x}%`,
    top: `${position.y}%`,
    width: `${position.width}%`,
    height: `${position.height}%`,
    zIndex: 20,
    cursor: "pointer",
  };

  const renderContent = () => {
    switch (type) {
      case "audio":
        return (
          <audio controls style={{ width: "100%", height: "100%" }}>
            <source src={content?.url} />
            Your browser does not support the audio element.
          </audio>
        );
      case "video":
        // استخدام iframe مع sandbox لمنع الخروج من الموقع
        if (content?.url?.includes("youtube.com") || content?.url?.includes("youtu.be")) {
          const videoId = content.url.includes("watch?v=")
            ? content.url.split("watch?v=")[1]?.split("&")[0]
            : content.url.split("/").pop();
          return (
            <iframe
              src={`https://www.youtube.com/embed/${videoId}?controls=0&rel=0&modestbranding=1&showinfo=0&fs=0&iv_load_policy=3`}
              className="w-full h-full rounded-lg"
              allow="autoplay; encrypted-media"
              sandbox="allow-same-origin allow-scripts allow-presentation"
              title="Video"
            />
          );
        }
        return (
          <iframe
            src={content?.url}
            className="w-full h-full rounded-lg"
            sandbox="allow-same-origin allow-scripts"
            title="Video"
          />
        );
      case "quiz":
        // عرض زر اختبار يفتح نافذة بسيطة
        return (
          <div
            className="w-full h-full bg-blue-100 hover:bg-blue-200 rounded-lg flex items-center justify-center text-blue-800 font-bold text-center cursor-pointer"
            onClick={() => {
              // يمكن عرض الاختبار في نافذة منبثقة
              toast.info(<T>Quiz: {content?.question}</T>);
            }}
          >
            📝 {content?.question || "Quiz"}
          </div>
        );
      case "game":
        return (
          <iframe
            src={content?.url}
            className="w-full h-full rounded-lg"
            sandbox="allow-same-origin allow-scripts"
            title="Game"
          />
        );
      case "iframe":
        return (
          <iframe
            src={content?.url}
            className="w-full h-full rounded-lg"
            sandbox="allow-same-origin allow-scripts allow-popups"
            title="Embed"
          />
        );
      case "link":
        return (
          <a
            href={content?.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full h-full bg-green-100 hover:bg-green-200 rounded-lg flex items-center justify-center text-green-800 font-bold"
          >
            🔗 {content?.label || "Link"}
          </a>
        );
      default:
        return null;
    }
  };

  return <div style={style}>{renderContent()}</div>;
}

// ── مكون الصفحة مع العلامة المائية والتراكبات ──────
const PageContent = React.forwardRef<
  HTMLDivElement,
  {
    pageNumber: number;
    imageUrl: string;
    overlays: OverlayItem[];
    watermarkText: string;
  }
>(({ pageNumber, imageUrl, overlays, watermarkText }, ref) => {
  return (
    <div className="page relative w-full h-full" ref={ref}>
      <img
        src={imageUrl}
        alt={`Page ${pageNumber}`}
        className="w-full h-full object-contain select-none pointer-events-none"
        draggable={false}
      />
      {/* العلامة المائية */}
      <div
        className="absolute inset-0 flex items-center justify-center pointer-events-none"
        style={{
          background: `repeating-linear-gradient(
            45deg,
            transparent,
            transparent 80px,
            rgba(255, 255, 255, 0.06) 80px,
            rgba(255, 255, 255, 0.06) 160px
          )`,
        }}
      >
        <span
          className="text-gray-400 text-2xl font-bold rotate-[-30deg] opacity-20 select-none"
          style={{ textShadow: "0 0 10px rgba(0,0,0,0.3)" }}
        >
          {watermarkText || "Ruh Ul-Qudus"}
        </span>
      </div>

      {/* العناصر التفاعلية */}
      {overlays.map((overlay) => (
        <InteractiveElement key={overlay.id} overlay={overlay} />
      ))}
    </div>
  );
});
PageContent.displayName = "PageContent";

// ── المكون الرئيسي للعارض ─────────────────────────
export default function FlipbookReader({ bookId }: { bookId: string }) {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [book, setBook] = useState<BookData | null>(null);
  const [pages, setPages] = useState<PageData[]>([]);
  const [overlays, setOverlays] = useState<OverlayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scale, setScale] = useState(1);

  const flipBookRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Watermark text
  const watermarkText = book?.flipbook_config?.watermarkText || "Ruh Ul-Qudus";

  // ── Fetch data ─────────────────────────────────
  useEffect(() => {
    if (!user || !bookId) {
      setLoading(false);
      return;
    }

    const loadBook = async () => {
      try {
        const res = await authFetch(`/api/library/books/${bookId}`);
        if (!res.ok) throw new Error("Book not found");
        const data = await res.json();
        setBook(data.book || null);

        // تحميل الصفحات
        const pagesRes = await authFetch(`/api/library/books/${bookId}/pages`);
        if (pagesRes.ok) {
          const pagesData = await pagesRes.json();
          const availablePages = pagesData.pages || [];
          // إذا كان الكتاب جزئيًا مجانيًا، نعرض الصفحات المسموحة فقط
          if (data.book?.access_type === "partial" && data.book?.allowed_pages) {
            const allowedSet = new Set(data.book.allowed_pages);
            setPages(
              availablePages.filter((p: PageData) => allowedSet.has(p.page_number))
            );
          } else {
            setPages(availablePages);
          }
        }

        // تحميل العناصر التفاعلية
        const overlaysRes = await authFetch(
          `/api/library/books/${bookId}/overlays`
        );
        if (overlaysRes.ok) {
          const overlaysData = await overlaysRes.json();
          setOverlays(overlaysData.overlays || []);
        }
      } catch (err) {
        console.error(err);
        toast.error(<T>Failed to load book</T>);
      }
      setLoading(false);
    };

    loadBook();
  }, [user, bookId]);

  // ── Sound effect for page flip ─────────────────
  const playFlipSound = useCallback(() => {
    if (!soundEnabled) return;
    if (!audioRef.current) {
      audioRef.current = new Audio("/sounds/page-flip.mp3");
    }
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(() => {
      // تجاهل خطأ التشغيل (سياسة المتصفح)
    });
  }, [soundEnabled]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  // ── Handlers ───────────────────────────────────
  const handlePageChange = (e: any) => {
    const page = e.data as number;
    setCurrentPage(page + 1); // react-pageflip يعطي index
    playFlipSound();
  };

  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.1, 0.5));

  const toggleSound = () => setSoundEnabled((prev) => !prev);

  // ── حماية من التحميل والتصوير ──────────────────
  useEffect(() => {
    const preventContextMenu = (e: MouseEvent) => e.preventDefault();
    const preventDrag = (e: DragEvent) => e.preventDefault();
    const preventKeys = (e: KeyboardEvent) => {
      if (
        e.key === "PrintScreen" ||
        (e.ctrlKey && e.key === "s") ||
        (e.ctrlKey && e.key === "p") ||
        (e.ctrlKey && e.shiftKey && e.key === "i")
      ) {
        e.preventDefault();
      }
    };
    const preventSelect = (e: Event) => {
      if (e.target instanceof HTMLElement) {
        e.target.style.userSelect = "none";
      }
    };

    document.addEventListener("contextmenu", preventContextMenu);
    document.addEventListener("dragstart", preventDrag);
    document.addEventListener("keydown", preventKeys);
    document.addEventListener("selectstart", preventSelect);

    return () => {
      document.removeEventListener("contextmenu", preventContextMenu);
      document.removeEventListener("dragstart", preventDrag);
      document.removeEventListener("keydown", preventKeys);
      document.removeEventListener("selectstart", preventSelect);
    };
  }, []);

  // ── Loading state ─────────────────────────────
  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!book) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">
          <T>Book not found</T>
        </p>
      </div>
    );
  }

  // ── Render ────────────────────────────────────
  return (
    <div
      className="min-h-screen bg-background p-4 md:p-8 flex flex-col items-center"
      dir="rtl"
    >
      {/* شريط الأدوات */}
      <div className="w-full max-w-4xl flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/library")}
          >
            <T>Back to Library</T>
          </Button>
          <h1 className="text-xl font-bold mr-2">{book.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleSound}>
            {soundEnabled ? (
              <Volume2 className="h-5 w-5" />
            ) : (
              <VolumeX className="h-5 w-5" />
            )}
          </Button>
          <Button variant="ghost" size="icon" onClick={handleZoomOut}>
            <ZoomOut className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleZoomIn}>
            <ZoomIn className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* عرض الكتاب */}
      <div
        className="flipbook-container"
        style={{
          transform: `scale(${scale})`,
          transformOrigin: "top center",
          transition: "transform 0.2s ease",
        }}
      >
        <HTMLFlipBook
          ref={flipBookRef}
          width={400}
          height={550}
          size="stretch"
          minWidth={200}
          maxWidth={600}
          minHeight={300}
          maxHeight={800}
          showCover={book.flipbook_config?.showCover ?? false}
          mobileScrollSupport={true}
          onFlip={handlePageChange}
          className="mx-auto"
          style={{}}
          startPage={0}
          drawShadow={true}
          flippingTime={800}
          usePortrait={true}
          startZIndex={0}
          autoSize={true}
          maxShadowOpacity={0.5}
          showPageCorners={true}
          disableFlipByClick={false}
          clickEventForward={true}
          useMouseEvents={true}
          swipeDistance={30}
        >
          {pages.map((page) => (
            <div key={page.page_number} className="demoPage">
              <PageContent
                pageNumber={page.page_number}
                imageUrl={
                  page.image_file_id
                    ? `/api/library/files/${page.image_file_id}`
                    : page.image_url || "/placeholder-page.png"
                }
                overlays={overlays.filter(
                  (o) => o.page_number === page.page_number
                )}
                watermarkText={watermarkText}
              />
            </div>
          ))}
        </HTMLFlipBook>
      </div>

      {/* شريط الحالة */}
      <div className="mt-4 text-sm text-muted-foreground">
        <T>Page</T> {currentPage} / {pages.length}
      </div>
    </div>
  );
}