"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Loader2, Plus, Upload, FileVideo, Image as ImageIcon,
} from "lucide-react";
import { T } from "@/components/TranslatedText";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/firebase/AuthProvider";

const THEMES = [
  { value: "theme-1", label: "Academic Theme" },
  { value: "theme-2", label: "Interactive Theme" },
  { value: "theme-3", label: "Simple Theme" },
  { value: "theme-4", label: "Immersive Theme" },
];

export default function NewCoursePage() {
  const router = useRouter();
  const { user } = useAuth();
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showCategoryDialog, setShowCategoryDialog] = useState(false);
  const [title, setTitle] = useState("");
  const [level, setLevel] = useState("A1");
  const [description, setDescription] = useState("");
  const [introVideoUrl, setIntroVideoUrl] = useState("");
  const [introVideoFile, setIntroVideoFile] = useState<File | null>(null);
  const [introVideoPreview, setIntroVideoPreview] = useState("");
  const [thumbnailUrl, setThumbnailUrl] = useState("");
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState("");
  const [price, setPrice] = useState(0);
  const [oldPrice, setOldPrice] = useState<number | undefined>();
  const [launchDate, setLaunchDate] = useState("");
  const [courseDuration, setCourseDuration] = useState("");
  const [lessonDuration, setLessonDuration] = useState("");
  const [instructorName, setInstructorName] = useState("Dr. Jehan Ali Ziad");
  const [theme, setTheme] = useState("theme-1");

  useEffect(() => {
    fetch("/api/categories")
      .then(r => r.json())
      .then(d => setCategories(d.categories || []));
  }, []);

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    await fetch("/api/admin/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newCategoryName }),
    });
    const { categories: updated } = await fetch("/api/categories").then(r => r.json());
    setCategories(updated);
    setNewCategoryName("");
    setShowCategoryDialog(false);
  };

  const handleIntroVideoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIntroVideoFile(file);
      setIntroVideoPreview(URL.createObjectURL(file));
    }
  };

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setThumbnailFile(file);
      setThumbnailPreview(URL.createObjectURL(file));
    }
  };

  const uploadToServer = async (file: File, folder: string): Promise<string> => {
    if (!user) throw new Error("Not authenticated");

    const token = await user.getIdToken();
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", folder);

    const res = await fetch("/api/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Upload failed");
    }

    const data = await res.json();
    return data.url;
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError("");

    try {
      let finalIntroVideoUrl = introVideoUrl;
      let finalThumbnailUrl = thumbnailUrl;

      if (introVideoFile) {
        finalIntroVideoUrl = await uploadToServer(introVideoFile, "course-videos");
      }

      if (thumbnailFile) {
        finalThumbnailUrl = await uploadToServer(thumbnailFile, "course-thumbnails");
      }

      const res = await fetch("/api/admin/course", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category_id: categoryId,
          title,
          level,
          description,
          intro_video_url: finalIntroVideoUrl,
          thumbnail_url: finalThumbnailUrl,
          price,
          old_price: oldPrice,
          launch_date: launchDate,
          course_duration: courseDuration,
          lesson_duration: lessonDuration,
          instructor_name: instructorName,
          theme,
          is_published: true,
        }),
      });

      if (res.ok) {
        router.push("/dashboard/admin/course");
      } else {
        setError("Failed to create course");
      }
    } catch {
      setError("Network error");
    }
    setLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto p-4 py-8">
      <h1 className="font-serif text-3xl mb-8"><T>Create New Course</T></h1>
      <div className="glass rounded-3xl p-6 space-y-6">
        {/* Category + New Category */}
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Label><T>Category</T></Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
              <SelectContent>
                {categories.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Dialog open={showCategoryDialog} onOpenChange={setShowCategoryDialog}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline"><Plus size={16} /> <T>New Category</T></Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle><T>Add Category</T></DialogTitle></DialogHeader>
              <Input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} placeholder="Category name" />
              <DialogFooter><Button onClick={handleAddCategory}><T>Save</T></Button></DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Course Title */}
        <div>
          <Label><T>Course Title</T></Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Arabic for Beginners" />
        </div>

        {/* Level */}
        <div>
          <Label><T>Level</T></Label>
          <Select value={level} onValueChange={setLevel}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {["A1","A2","B1","B2","C1","C2"].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Description */}
        <div>
          <Label><T>Course Description</T></Label>
          <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} placeholder="Detailed description..." />
        </div>

        {/* Intro Video */}
        <div className="space-y-3">
          <Label><T>Intro Video</T></Label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground"><T>From URL</T></Label>
              <Input value={introVideoUrl} onChange={e => setIntroVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground"><T>Upload from device</T></Label>
              <label className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background p-3 cursor-pointer hover:bg-secondary/50 transition">
                <FileVideo size={18} className="text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{introVideoFile ? introVideoFile.name : <T>Choose video</T>}</span>
                <input type="file" accept="video/*" className="hidden" onChange={handleIntroVideoChange} />
              </label>
            </div>
          </div>
          {introVideoPreview && (
            <video src={introVideoPreview} className="w-full h-40 rounded-xl object-cover" controls />
          )}
        </div>

        {/* Thumbnail */}
        <div className="space-y-3">
          <Label><T>Thumbnail Image</T></Label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs text-muted-foreground"><T>From URL</T></Label>
              <Input value={thumbnailUrl} onChange={e => setThumbnailUrl(e.target.value)} placeholder="https://example.com/thumb.jpg" />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground"><T>Upload from device</T></Label>
              <label className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background p-3 cursor-pointer hover:bg-secondary/50 transition">
                <ImageIcon size={18} className="text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{thumbnailFile ? thumbnailFile.name : <T>Choose image</T>}</span>
                <input type="file" accept="image/*" className="hidden" onChange={handleThumbnailChange} />
              </label>
            </div>
          </div>
          {thumbnailPreview && (
            <img src={thumbnailPreview} alt="Thumbnail preview" className="w-full h-40 rounded-xl object-cover" />
          )}
        </div>

        {/* Price + Old Price */}
        <div className="grid grid-cols-2 gap-4">
          <div><Label><T>Price ($)</T></Label><Input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} /></div>
          <div><Label><T>Old Price (optional)</T></Label><Input type="number" value={oldPrice ?? ''} onChange={e => setOldPrice(e.target.value ? Number(e.target.value) : undefined)} /></div>
        </div>

        {/* Launch Date */}
        <div><Label><T>Launch Date</T></Label><Input type="datetime-local" value={launchDate} onChange={e => setLaunchDate(e.target.value)} /></div>

        {/* Durations */}
        <div className="grid grid-cols-2 gap-4">
          <div><Label><T>Course Duration</T></Label><Input value={courseDuration} onChange={e => setCourseDuration(e.target.value)} placeholder="12 weeks" /></div>
          <div><Label><T>Lesson Duration</T></Label><Input value={lessonDuration} onChange={e => setLessonDuration(e.target.value)} placeholder="45 minutes" /></div>
        </div>

        {/* Instructor */}
        <div><Label><T>Instructor</T></Label><Input value={instructorName} onChange={e => setInstructorName(e.target.value)} /></div>

        {/* Theme */}
        <div>
          <Label><T>Landing Page Theme</T></Label>
          <RadioGroup value={theme} onValueChange={setTheme} className="grid grid-cols-2 gap-3 mt-2">
            {THEMES.map(t => (
              <label key={t.value} className={`flex items-center gap-3 rounded-2xl border p-4 cursor-pointer transition ${theme === t.value ? 'border-primary bg-primary/5' : 'border-border'}`}>
                <RadioGroupItem value={t.value} id={t.value} />
                <div><p className="font-medium text-sm"><T>{t.label}</T></p></div>
              </label>
            ))}
          </RadioGroup>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={handleSubmit} disabled={loading} className="w-full rounded-full bg-primary text-primary-foreground py-6 text-base">
          {loading ? <Loader2 className="animate-spin mx-auto" /> : <T>Publish Course</T>}
        </Button>
      </div>
    </div>
  );
}