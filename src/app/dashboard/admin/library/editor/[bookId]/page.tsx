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
  Plus,
  Trash2,
  Image as ImageIcon,
  Video,
  Music,
  HelpCircle,
  Loader2,
  Link2,
  Gamepad2,
} from "lucide-react";

// ── Types ──────────────────────────────────────────
interface PageInfo {
  page_number: number;
  image_url?: string;
  image_file_id?: string;
}

interface OverlayItem {
  id: string;
  book_id: string;
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

// ── Main Component ────────────────────────────────
export default function BookEditorPage() {
  const params = useParams<{ bookId: string }>();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();

  const bookId = params.bookId as string;

  // Book data
  const [bookTitle, setBookTitle] = useState("");
  const [pages, setPages] = useState<PageInfo[]>([]);
  const [loading, setLoading] = useState(true);

  // Current selected page
  const [selectedPage, setSelectedPage] = useState<number | null>(null);

  // Overlays for the whole book
  const [overlays, setOverlays] = useState<OverlayItem[]>([]);

  // Dialog state for adding/editing overlay
  const [overlayDialogOpen, setOverlayDialogOpen] = useState(false);
  const [editingOverlay, setEditingOverlay] = useState<OverlayItem | null>(null);
  const [overlayType, setOverlayType] = useState<string>("video");
  const [overlayUrl, setOverlayUrl] = useState("");
  const [overlayPosition, setOverlayPosition] = useState({
    x: 10,
    y: 10,
    width: 20,
    height: 20,
  });
  const [quizQuestion, setQuizQuestion] = useState("");
  const [quizOptions, setQuizOptions] = useState("");
  const [quizCorrect, setQuizCorrect] = useState("");
  const [savingOverlay, setSavingOverlay] = useState(false);

  // Drag to position
  const imageRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  // ── Fetch book and overlays ──────────────────────
  useEffect(() => {
    if (!user || !bookId) {
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        // Fetch book details and pages
        const res = await authFetch(`/api/admin/library/books/${bookId}`);
        if (!res.ok) throw new Error("Book not found");
        const data = await res.json();
        setBookTitle(data.book?.title || "Untitled");
        const fetchedPages: PageInfo[] = data.pages || [];
        setPages(fetchedPages);
        if (fetchedPages.length > 0) {
          setSelectedPage(fetchedPages[0].page_number);
        }

        // Fetch overlays
        const overlaysRes = await authFetch(`/api/admin/library/overlays?bookId=${bookId}`);
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

    load();
  }, [user, bookId]);

  // Overlays for current page
  const currentOverlays = overlays.filter(
    (o) => o.page_number === selectedPage
  );

  const getPageImageUrl = (page: PageInfo) => {
    if (page.image_file_id) {
      return `/api/library/files/${page.image_file_id}`;
    }
    if (page.image_url) {
      return page.image_url;
    }
    return "";
  };

  // ── Overlay operations ───────────────────────────
  const openNewOverlay = () => {
    setEditingOverlay(null);
    setOverlayType("video");
    setOverlayUrl("");
    setQuizQuestion("");
    setQuizOptions("");
    setQuizCorrect("");
    setOverlayPosition({ x: 10, y: 10, width: 20, height: 20 });
    setOverlayDialogOpen(true);
  };

  const openEditOverlay = (item: OverlayItem) => {
    setEditingOverlay(item);
    setOverlayType(item.type);
    setOverlayUrl(item.content?.url || "");
    setQuizQuestion(item.content?.question || "");
    setQuizOptions((item.content?.options || []).join(", "));
    setQuizCorrect(item.content?.correct || "");
    setOverlayPosition(item.position);
    setOverlayDialogOpen(true);
  };

  const saveOverlay = async () => {
    if (!selectedPage) return;
    setSavingOverlay(true);

    const content: any = {
      url: overlayUrl,
    };
    if (overlayType === "quiz") {
      content.question = quizQuestion;
      content.options = quizOptions
        .split(",")
        .map((opt) => opt.trim())
        .filter((opt) => opt.length > 0);
      content.correct = quizCorrect;
    }

    const body = {
      book_id: bookId,
      page_number: selectedPage,
      type: overlayType,
      position: overlayPosition,
      content,
      settings: {},
    };

    try {
      const res = editingOverlay
        ? await authFetch(`/api/admin/library/overlays/${editingOverlay.id}`, {
            method: "PUT",
            body: JSON.stringify(body),
          })
        : await authFetch("/api/admin/library/overlays", {
            method: "POST",
            body: JSON.stringify(body),
          });

      if (res.ok) {
        toast.success(
          editingOverlay ? <T>Overlay updated</T> : <T>Overlay added</T>
        );
        // Reload overlays
        const overlaysRes = await authFetch(
          `/api/admin/library/overlays?bookId=${bookId}`
        );
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
      toast.error(<T>Network error</T>);
    } finally {
      setSavingOverlay(false);
    }
  };

  const deleteOverlay = async (overlayId: string) => {
    if (!confirm("Are you sure you want to delete this overlay?")) return;
    try {
      const res = await authFetch(`/api/admin/library/overlays/${overlayId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(<T>Overlay deleted</T>);
        setOverlays((prev) => prev.filter((o) => o.id !== overlayId));
      } else {
        const err = await res.json();
        toast.error(err.error || "Delete failed");
      }
    } catch {
      toast.error(<T>Network error</T>);
    }
  };

  // ── Drag to position ─────────────────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setOverlayPosition((prev) => ({
      ...prev,
      x: Math.round(x),
      y: Math.round(y),
    }));
    setDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || !imageRef.current) return;
    const rect = imageRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setOverlayPosition((prev) => ({
      ...prev,
      x: Math.round(x),
      y: Math.round(y),
    }));
  };

  const handleMouseUp = () => setDragging(false);

  // ── Loading state ────────────────────────────────
  if (authLoading || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8" dir="rtl">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/dashboard/admin/library")}
          >
            <ArrowLeft className="ml-2 h-4 w-4" />
            <T>Back to Library</T>
          </Button>
          <h1 className="text-2xl font-bold">{bookTitle}</h1>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Pages Sidebar */}
        <div className="col-span-12 lg:col-span-3">
          <div className="rounded-xl border bg-card p-4">
            <h2 className="mb-3 font-semibold">
              <T>Pages</T>
            </h2>
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
                  <span className="text-sm">
                    <T>Page</T> {page.page_number}
                  </span>
                </button>
              ))}
              {pages.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  <T>No pages available. Convert PDF first.</T>
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Editor Area */}
        <div className="col-span-12 lg:col-span-9">
          {selectedPage ? (
            <div className="rounded-xl border bg-card p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-semibold">
                  <T>Page</T> {selectedPage}
                </h3>
                <Button onClick={openNewOverlay} size="sm">
                  <Plus className="ml-2 h-4 w-4" />
                  <T>Add Interactive Element</T>
                </Button>
              </div>

              {/* Page preview with overlays */}
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
                  src={
                    getPageImageUrl(
                      pages.find((p) => p.page_number === selectedPage) as PageInfo
                    ) || "/placeholder-page.png"
                  }
                  alt={`Page ${selectedPage}`}
                  className="h-full w-full object-contain"
                  draggable={false}
                />

                {/* Render overlays for selected page */}
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
                      {item.type === "game" && <Gamepad2 className="h-6 w-6 text-primary" />}
                      {(item.type === "iframe" || item.type === "link") && (
                        <Link2 className="h-6 w-6 text-primary" />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center rounded-xl border bg-card p-12 text-muted-foreground">
              <p>
                <T>Select a page from the list to edit it</T>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Overlay Dialog */}
      <Dialog open={overlayDialogOpen} onOpenChange={setOverlayDialogOpen}>
        <DialogContent className="bg-card sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingOverlay ? <T>Edit Element</T> : <T>Add Interactive Element</T>}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Type */}
            <div>
              <Label>
                <T>Type</T>
              </Label>
              <Select value={overlayType} onValueChange={setOverlayType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">
                    <T>Video</T>
                  </SelectItem>
                  <SelectItem value="audio">
                    <T>Audio</T>
                  </SelectItem>
                  <SelectItem value="quiz">
                    <T>Quiz</T>
                  </SelectItem>
                  <SelectItem value="game">
                    <T>Game</T>
                  </SelectItem>
                  <SelectItem value="iframe">
                    <T>Embed iframe</T>
                  </SelectItem>
                  <SelectItem value="link">
                    <T>Link</T>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* URL */}
            <div>
              <Label>
                <T>URL</T>
              </Label>
              <Input
                value={overlayUrl}
                onChange={(e) => setOverlayUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>

            {/* Quiz fields */}
            {overlayType === "quiz" && (
              <>
                <div>
                  <Label>
                    <T>Question</T>
                  </Label>
                  <Input
                    value={quizQuestion}
                    onChange={(e) => setQuizQuestion(e.target.value)}
                    placeholder="What is the capital of France?"
                  />
                </div>
                <div>
                  <Label>
                    <T>Options (comma separated)</T>
                  </Label>
                  <Input
                    value={quizOptions}
                    onChange={(e) => setQuizOptions(e.target.value)}
                    placeholder="Paris, London, Rome, Madrid"
                  />
                </div>
                <div>
                  <Label>
                    <T>Correct Answer</T>
                  </Label>
                  <Input
                    value={quizCorrect}
                    onChange={(e) => setQuizCorrect(e.target.value)}
                    placeholder="Paris"
                  />
                </div>
              </>
            )}

            {/* Position */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>X %</Label>
                <Input
                  type="number"
                  value={overlayPosition.x}
                  onChange={(e) =>
                    setOverlayPosition((prev) => ({
                      ...prev,
                      x: Number(e.target.value),
                    }))
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
                    setOverlayPosition((prev) => ({
                      ...prev,
                      y: Number(e.target.value),
                    }))
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
                    setOverlayPosition((prev) => ({
                      ...prev,
                      width: Number(e.target.value),
                    }))
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
                    setOverlayPosition((prev) => ({
                      ...prev,
                      height: Number(e.target.value),
                    }))
                  }
                  min={1}
                  max={100}
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              <T>Or click and drag on the page to set the position.</T>
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOverlayDialogOpen(false)}>
              <T>Cancel</T>
            </Button>
            <Button onClick={saveOverlay} disabled={savingOverlay}>
              {savingOverlay ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <T>Save</T>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}