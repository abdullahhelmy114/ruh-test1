// src/app/library/book/detail/client.tsx
"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { T } from "@/components/TranslatedText";
import { authFetch } from "@/lib/authFetch";
import Link from "next/link";
import HTMLFlipBook from "react-pageflip";
import dynamic from "next/dynamic";
import { pdfjs } from "react-pdf";
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Maximize,
  Pencil,
  Highlighter,
  Eraser,
  Video,
  Music,
  HelpCircle,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

import { PageOverlay, type OverlayItem } from "@/components/reader/PageOverlay";

const Document = dynamic(() => import("react-pdf").then((mod) => mod.Document), { ssr: false });
const Page = dynamic(() => import("react-pdf").then((mod) => mod.Page), { ssr: false });

// إعداد العامل بشكل ثابت
if (typeof window !== "undefined") {
  pdfjs.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
}

interface PageOverlayData extends OverlayItem {
  page_number: number;
}

export default function BookReaderClient() {
  const searchParams = useSearchParams();
  const bookId = searchParams.get("id") || "";
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const [book, setBook] = useState<any>(null);
  const [pdfUrl, setPdfUrl] = useState<string>("");
  const [numPages, setNumPages] = useState(0);
  const [loadingBook, setLoadingBook] = useState(true);

  const [role, setRole] = useState<"admin" | "student" | "teacher" | "organization" | "guest">("guest");
  const [checkingAccess, setCheckingAccess] = useState(true);

  const [currentPage, setCurrentPage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const flipBookRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [drawMode, setDrawMode] = useState<"none" | "pen" | "highlighter" | "eraser">("none");
  const [penColor, setPenColor] = useState("#000000");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const [overlays, setOverlays] = useState<PageOverlayData[]>([]);
  const [showAdminTools, setShowAdminTools] = useState(false);

  // دالة تحويل رابط Google Drive إلى رابط تحميل مباشر
  function getDirectDownloadUrl(url: string): string {
    const match = url.match(/\/d\/([^/]+)\//) || url.match(/id=([^&]+)/);
    if (match) {
      const fileId = match[1];
      return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
    return url;
  }

  useEffect(() => {
    if (!user || !bookId) {
      setCheckingAccess(false);
      setLoadingBook(false);
      return;
    }

    const load = async () => {
      try {
        const accessRes = await authFetch("/api/library/access");
        const accessData = await accessRes.json();

        if (accessData.isAdmin) setRole("admin");
        else if (accessData.role === "student") setRole("student");
        else if (accessData.role === "teacher") setRole("teacher");
        else if (accessData.role === "organization") setRole("organization");
        else if (accessData.hasAccess) setRole("student");
        else {
          setRole("guest");
          setCheckingAccess(false);
          setLoadingBook(false);
          return;
        }

        const bookRes = await authFetch(`/api/library/books?id=${bookId}`);
        if (!bookRes.ok) throw new Error("Book not found");
        const bookData = await bookRes.json();
        setBook(bookData.book);
        // استخدام الرابط المباشر للتحميل
        const directUrl = getDirectDownloadUrl(bookData.book?.pdf_url || "");
        setPdfUrl(directUrl);

        const overlaysRes = await authFetch(`/api/library/page-overlay?bookId=${bookId}`);
        if (overlaysRes.ok) {
          const overlaysData = await overlaysRes.json();
          setOverlays(overlaysData.overlays || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoadingBook(false);
        setCheckingAccess(false);
      }
    };

    load();
  }, [user, bookId]);

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  }, []);

  // الحماية من النسخ
  useEffect(() => {
    if (role === "admin") return;
    const prevent = (e: Event) => e.preventDefault();
    const preventKeyboard = (e: KeyboardEvent) => {
      if ((e.ctrlKey && (e.key === "s" || e.key === "p" || e.key === "c" || e.key === "u")) || e.key === "F12" || (e.ctrlKey && e.shiftKey && e.key === "I")) {
        e.preventDefault();
        return false;
      }
    };
    document.addEventListener("contextmenu", prevent);
    document.addEventListener("keydown", preventKeyboard);
    return () => {
      document.removeEventListener("contextmenu", prevent);
      document.removeEventListener("keydown", preventKeyboard);
    };
  }, [role]);

  // الرسم على Canvas
  useEffect(() => {
    if (!canvasRef.current || drawMode === "none" || role === "admin" || role === "guest") return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      ctx.strokeStyle = penColor;
      ctx.lineWidth = drawMode === "highlighter" ? 15 : 2;
      ctx.lineCap = "round";
      ctx.globalAlpha = drawMode === "highlighter" ? 0.3 : 1;
    };
    resize();
    window.addEventListener("resize", resize);

    const getPos = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const start = (e: MouseEvent | TouchEvent) => { isDrawing.current = true; lastPos.current = getPos(e); };
    const move = (e: MouseEvent | TouchEvent) => {
      if (!isDrawing.current || !lastPos.current) return;
      const pos = getPos(e);
      if (drawMode === "eraser") {
        ctx.clearRect(pos.x - 10, pos.y - 10, 20, 20);
      } else {
        ctx.beginPath();
        ctx.moveTo(lastPos.current.x, lastPos.current.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
      }
      lastPos.current = pos;
    };
    const end = () => { isDrawing.current = false; lastPos.current = null; };

    canvas.addEventListener("mousedown", start);
    canvas.addEventListener("mousemove", move);
    canvas.addEventListener("mouseup", end);
    canvas.addEventListener("touchstart", start);
    canvas.addEventListener("touchmove", move);
    canvas.addEventListener("touchend", end);

    return () => {
      canvas.removeEventListener("mousedown", start);
      canvas.removeEventListener("mousemove", move);
      canvas.removeEventListener("mouseup", end);
      canvas.removeEventListener("touchstart", start);
      canvas.removeEventListener("touchmove", move);
      canvas.removeEventListener("touchend", end);
      window.removeEventListener("resize", resize);
    };
  }, [drawMode, penColor, role]);

  const saveDrawing = async () => {
    if (!canvasRef.current) return;
    try {
      const dataUrl = canvasRef.current.toDataURL();
      await authFetch("/api/library/annotations", {
        method: "POST",
        body: JSON.stringify({ book_id: bookId, page_number: currentPage + 1, data: dataUrl }),
      });
      toast.success("تم حفظ الرسم");
    } catch {
      toast.error("فشل حفظ الرسم");
    }
  };

  const nextPage = () => flipBookRef.current?.pageFlip()?.flipNext();
  const prevPage = () => flipBookRef.current?.pageFlip()?.flipPrev();
  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 0.1, 2));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 0.1, 0.5));
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setFullscreen(true);
    } else {
      document.exitFullscreen();
      setFullscreen(false);
    }
  };

  if (authLoading || loadingBook || checkingAccess) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-gray-500"><T>Loading</T></p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <p className="text-lg text-gray-500"><T>Login Required</T></p>
        <Link href="/login"><Button><T>Login</T></Button></Link>
      </div>
    );
  }

  if (role === "guest") {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-background">
        <p className="text-lg text-gray-500"><T>Book No Access</T></p>
        <Link href="/library"><Button variant="outline"><T>Back to Library</T></Button></Link>
      </div>
    );
  }

  if (!pdfUrl) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <p className="text-lg text-gray-500"><T>Book No Pages Available</T></p>
      </div>
    );
  }

  const currentOverlays: OverlayItem[] = overlays
    .filter((o) => o.page_number === currentPage + 1)
    .map(({ page_number, ...rest }) => rest);

  return (
    <div ref={containerRef} className="min-h-screen bg-background flex flex-col items-center justify-center p-2 md:p-4 select-none" dir="rtl">
      {/* شريط الأدوات */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-3 bg-card/80 backdrop-blur-md border border-gray-200 rounded-xl p-2 shadow-lg z-10">
        <Button variant="ghost" size="icon" onClick={prevPage}><ChevronRight size={20} /></Button>
        <span className="text-sm font-medium min-w-[60px] text-center tabular-nums">{currentPage + 1} / {numPages || '?'}</span>
        <Button variant="ghost" size="icon" onClick={nextPage}><ChevronLeft size={20} /></Button>
        <div className="w-px h-6 bg-border" />
        <Button variant="ghost" size="icon" onClick={handleZoomIn} title="Zoom in"><ZoomIn size={18} /></Button>
        <Button variant="ghost" size="icon" onClick={handleZoomOut} title="Zoom out"><ZoomOut size={18} /></Button>
        <Button variant="ghost" size="icon" onClick={toggleFullscreen} title={fullscreen ? "Exit fullscreen" : "Fullscreen"}><Maximize size={18} /></Button>
        {(role === "student" || role === "teacher") && (
          <>
            <div className="w-px h-6 bg-border" />
            <Button variant={drawMode === "pen" ? "default" : "ghost"} size="icon" onClick={() => setDrawMode(drawMode === "pen" ? "none" : "pen")} title="Pen"><Pencil size={18} /></Button>
            <Button variant={drawMode === "highlighter" ? "default" : "ghost"} size="icon" onClick={() => setDrawMode(drawMode === "highlighter" ? "none" : "highlighter")} title="Highlighter"><Highlighter size={18} /></Button>
            <Button variant={drawMode === "eraser" ? "default" : "ghost"} size="icon" onClick={() => setDrawMode(drawMode === "eraser" ? "none" : "eraser")} title="Eraser"><Eraser size={18} /></Button>
            <Button variant="ghost" size="icon" onClick={saveDrawing} title="Save drawing"><Save size={18} /></Button>
          </>
        )}
        {role === "admin" && (
          <>
            <div className="w-px h-6 bg-border" />
            <Button variant={showAdminTools ? "default" : "ghost"} size="sm" onClick={() => setShowAdminTools(!showAdminTools)}><Pencil size={16} className="ml-1" /> أدوات</Button>
          </>
        )}
      </div>

      {showAdminTools && role === "admin" && (
        <div className="flex flex-wrap gap-2 mb-3 bg-card/90 backdrop-blur-md border border-gray-200 rounded-xl p-3 shadow-lg z-10">
          <Button variant="outline" size="sm" onClick={() => alert("إضافة فيديو - قيد التطوير")}><Video size={16} className="ml-1" /> فيديو</Button>
          <Button variant="outline" size="sm" onClick={() => alert("إضافة صوت - قيد التطوير")}><Music size={16} className="ml-1" /> صوت</Button>
          <Button variant="outline" size="sm" onClick={() => alert("إضافة اختبار - قيد التطوير")}><HelpCircle size={16} className="ml-1" /> اختبار</Button>
        </div>
      )}

      <div className="relative flex justify-center items-center transition-transform duration-200 ease-out" style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}>
        <Document file={pdfUrl} onLoadSuccess={onDocumentLoadSuccess} loading={<div className="text-gray-500">تحميل الكتاب...</div>}>
          {numPages > 0 && (
            <HTMLFlipBook
              width={400}
              height={550}
              size="fixed"
              minWidth={300}
              maxWidth={600}
              minHeight={400}
              maxHeight={700}
              showCover={true}
              mobileScrollSupport={true}
              onFlip={(e: any) => setCurrentPage(e.data)}
              ref={flipBookRef}
              className="shadow-2xl rounded-lg overflow-hidden"
              style={{ background: "transparent" }}
              startPage={0}
              drawShadow={true}
              flippingTime={800}
              usePortrait={false}
              startZIndex={0}
              autoSize={false}
              maxShadowOpacity={0.5}
              showPageCorners={true}
              disableFlipByClick={false}
              clickEventForward={true}
              useMouseEvents={true}
              swipeDistance={30}
            >
              {Array.from(new Array(numPages), (_, index) => (
                <div key={index} className="relative bg-[#F5F0E8] select-none" style={{ width: 400, height: 550 }}>
                  <Page
                    pageNumber={index + 1}
                    width={400}
                    height={550}
                    renderTextLayer={false}
                    renderAnnotationLayer={false}
                    className="pointer-events-none"
                  />
                  {role !== "admin" && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-10 z-10">
                      <p className="text-center text-xl font-bold text-black rotate-45 whitespace-nowrap">RUHULQUDUS</p>
                    </div>
                  )}
                  {(role === "student" || role === "teacher") && drawMode !== "none" && (
                    <canvas ref={canvasRef} className="absolute inset-0 z-20 cursor-crosshair" style={{ width: "100%", height: "100%" }} />
                  )}
                  {index + 1 === currentPage + 1 && currentOverlays.length > 0 && (
                    <PageOverlay items={currentOverlays} pageWidth={400} pageHeight={550} role={role} />
                  )}
                </div>
              ))}
            </HTMLFlipBook>
          )}
        </Document>
      </div>

      <div className="mt-3 text-xs text-gray-500 text-center">
        {role === "admin" && <T>Admin mode: full access</T>}
        {(role === "student" || role === "teacher") && <T>Use the drawing tools to annotate</T>}
        {role === "organization" && <T>Organization access: read only</T>}
      </div>
    </div>
  );
}