"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { T } from "@/components/TranslatedText";
import HTMLFlipBook from "react-pageflip";
import Link from "next/link";

interface Page {
  page_number: number;
  image_url: string;
}

export default function BookReader() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [fullscreen, setFullscreen] = useState(false);
  const flipBookRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);

  useEffect(() => {
    if (!user || !params.id) {
      setCheckingAccess(false);
      return;
    }
    authFetch("/api/library/access")
      .then((r) => r.json())
      .then((data) => {
        setHasAccess(data.hasAccess);
        if (data.hasAccess) {
          return authFetch(`/api/library/books/${params.id}`);
        }
        return null;
      })
      .then((res) => {
        if (res && res.ok) return res.json();
        return { pages: [] };
      })
      .then((data) => {
        setPages(data.pages || []);
      })
      .finally(() => {
        setLoading(false);
        setCheckingAccess(false);
      });
  }, [params.id, user]);

  const handleContextMenu = useCallback((e: MouseEvent) => e.preventDefault(), []);
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.ctrlKey && (e.key === "s" || e.key === "p" || e.key === "c" || e.key === "u")) {
      e.preventDefault();
    }
  }, []);

  useEffect(() => {
    document.addEventListener("contextmenu", handleContextMenu);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("contextmenu", handleContextMenu);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleContextMenu, handleKeyDown]);

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

  if (loading || checkingAccess) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-hero">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-secondary-foreground">
            <T>Book Loading</T>
          </p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-hero">
        <p className="text-secondary-foreground text-lg">
          <T>Book Login Required</T>
        </p>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gradient-hero gap-4">
        <p className="text-secondary-foreground text-lg">
          <T>Book No Access</T>
        </p>
        <Link href="/library">
          <Button className="bg-primary text-primary-foreground">
            <T>Back to Library</T>
          </Button>
        </Link>
      </div>
    );
  }

  if (pages.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center bg-gradient-hero">
        <p className="text-muted-foreground text-lg">
          <T>Book No Pages Available</T>
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="min-h-screen bg-gradient-hero flex flex-col items-center justify-center p-4 select-none"
    >
      <div className="flex flex-wrap items-center justify-center gap-3 mb-4 bg-secondary/60 backdrop-blur-md rounded-xl p-2 shadow-lg z-10">
        <Button variant="ghost" size="icon" onClick={prevPage} className="text-secondary-foreground hover:text-primary hover:bg-accent/20" title="Previous page">
          <ChevronRight size={20} />
        </Button>
        <span className="text-sm text-secondary-foreground font-medium min-w-20 text-center">
          {currentPage + 1} / {pages.length}
        </span>
        <Button variant="ghost" size="icon" onClick={nextPage} className="text-secondary-foreground hover:text-primary hover:bg-accent/20" title="Next page">
          <ChevronLeft size={20} />
        </Button>
        <div className="w-px h-6 bg-border hidden sm:block" />
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={handleZoomIn} className="text-secondary-foreground hover:text-primary hover:bg-accent/20" title="Zoom in">
            <ZoomIn size={18} />
          </Button>
          <Button variant="ghost" size="icon" onClick={handleZoomOut} className="text-secondary-foreground hover:text-primary hover:bg-accent/20" title="Zoom out">
            <ZoomOut size={18} />
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-secondary-foreground hover:text-primary hover:bg-accent/20" title={fullscreen ? "Exit fullscreen" : "Fullscreen"}>
            <Maximize size={18} />
          </Button>
        </div>
      </div>

      <div
        className="flex justify-center items-center transition-transform duration-200 ease-out"
        style={{ transform: `scale(${zoom})`, transformOrigin: "center" }}
      >
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
          {pages.map((page) => (
            <div key={page.page_number} className="relative bg-white select-none" style={{ width: 400, height: 550 }}>
              <img
                src={page.image_url}
                alt={`Page ${page.page_number}`}
                className="w-full h-full object-contain pointer-events-none select-none"
                draggable={false}
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none opacity-20 mix-blend-difference z-10">
                <p className="text-center text-[10px] font-mono text-white rotate-45 whitespace-nowrap">
                  {user?.email || "Ruhulqudus Library"}
                </p>
              </div>
              <div className="absolute inset-0 z-20" />
            </div>
          ))}
        </HTMLFlipBook>
      </div>

      <div className="mt-4 text-xs text-secondary-foreground/40 text-center">
        <T>Book Help Text</T>
      </div>
    </div>
  );
}