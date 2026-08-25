"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { authFetch } from "@/lib/authFetch";
import { T } from "@/components/TranslatedText";
import {
  Loader2,
  Pencil,
  Trash2,
  ImageIcon,
  Tag,
  FileEdit,
  Plus,
  UploadCloud,
} from "lucide-react";

// ── Types ────────────────────────────────────────
interface Book {
  id: string;
  title: string;
  author: string;
  description?: string;
  cover_file_id?: string | null;
  cover_url?: string | null; // للتوافق مع البيانات القديمة
  file_id?: string | null;
  processing_status: "uploaded" | "processing" | "ready" | "failed";
  access_type: string;
  price: number;
  is_published: boolean;
  created_at: string;
  pages_count?: number;
  categories?: { id: string; name: string; slug: string }[];
}

interface Category {
  id: string;
  name: string;
  name_ar?: string;
  slug: string;
  description?: string;
  parent_id?: string | null;
  created_at: string;
}

// ── Main Component ──────────────────────────────
export default function AdminLibraryPage() {
  const router = useRouter();

  // Active tab
  const [tab, setTab] = useState<"books" | "categories">("books");

  // ── Books Data ─────────────────────────────────
  const [books, setBooks] = useState<Book[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(true);

  // ── Add Book Form State ───────────────────────
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [year, setYear] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [addCategoryIds, setAddCategoryIds] = useState<string[]>([]);
  const [sourceType, setSourceType] = useState<"upload" | "url">("upload");
  const [sourceUrl, setSourceUrl] = useState("");
  const [accessType, setAccessType] = useState("free");
  const [price, setPrice] = useState("0");
  const [allowedPages, setAllowedPages] = useState("[]");
  const [courseId, setCourseId] = useState("");
  const [bundleId, setBundleId] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [flipbookConfig, setFlipbookConfig] = useState("{}");
  const [uploading, setUploading] = useState(false);

  // ── Bulk Upload ───────────────────────────────
  const [bulkFiles, setBulkFiles] = useState<FileList | null>(null);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);

  // ── Edit Book ─────────────────────────────────
  const [editBook, setEditBook] = useState<Book | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editAuthor, setEditAuthor] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editCategoryIds, setEditCategoryIds] = useState<string[]>([]);
  const [editAccessType, setEditAccessType] = useState("free");
  const [editPrice, setEditPrice] = useState("0");
  const [editAllowedPages, setEditAllowedPages] = useState("[]");
  const [editSaving, setEditSaving] = useState(false);

  // ── Convert to Images ─────────────────────────
  const [convertingId, setConvertingId] = useState<string | null>(null);

  // ── Categories Data ───────────────────────────
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // Category dialog state
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catName, setCatName] = useState("");
  const [catNameAr, setCatNameAr] = useState("");
  const [catSlug, setCatSlug] = useState("");
  const [catDescription, setCatDescription] = useState("");
  const [catParentId, setCatParentId] = useState("");
  const [catSaving, setCatSaving] = useState(false);

  // ── Fetch Functions ───────────────────────────
  const fetchBooks = async () => {
    try {
      const res = await authFetch("/api/admin/library/books");
      if (res.ok) {
        const data = await res.json();
        setBooks(data.books || []);
      }
    } catch (err) {
      console.error(err);
    }
    setLoadingBooks(false);
  };

  const fetchCategories = async () => {
    try {
      const res = await authFetch("/api/admin/categories");
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      }
    } catch (err) {
      console.error(err);
    }
    setLoadingCategories(false);
  };

  useEffect(() => {
    fetchBooks();
    fetchCategories();
  }, []);

  // ── Book Operations ───────────────────────────
  const handleAddBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) {
      toast.error(<T>Title Required</T>);
      return;
    }
    setUploading(true);
    const formData = new FormData();
    formData.append("title", title);
    formData.append("author", author);
    formData.append("description", description);
    formData.append("year", year);
    formData.append("source_type", sourceType);
    if (sourceType === "url") {
      formData.append("source_url", sourceUrl);
    }
    formData.append("access_type", accessType);
    formData.append("price", price);
    formData.append("allowed_pages", allowedPages);
    formData.append("course_id", courseId);
    formData.append("bundle_id", bundleId);
    formData.append("categories", JSON.stringify(addCategoryIds));
    formData.append("flipbook_config", flipbookConfig);
    formData.append("ai_prompt", aiPrompt);
    if (coverFile) formData.append("cover_image", coverFile);
    if (pdfFile) formData.append("pdf_file", pdfFile);

    try {
      const res = await authFetch("/api/admin/library/books", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(<T>Book Added</T>);
        // Reset form
        setTitle("");
        setAuthor("");
        setDescription("");
        setYear("");
        setCoverFile(null);
        setPdfFile(null);
        setAddCategoryIds([]);
        setSourceType("upload");
        setSourceUrl("");
        setAccessType("free");
        setPrice("0");
        setAllowedPages("[]");
        setCourseId("");
        setBundleId("");
        setAiPrompt("");
        setFlipbookConfig("{}");
        fetchBooks();
      } else {
        const err = await res.json();
        toast.error(err.error || "Failed");
      }
    } catch {
      toast.error(<T>Upload Error</T>);
    } finally {
      setUploading(false);
    }
  };

  const handleBulkUpload = async () => {
    if (!bulkFiles || bulkFiles.length === 0) {
      toast.error(<T>Please select PDF files</T>);
      return;
    }
    setBulkUploading(true);
    const formData = new FormData();
    for (let i = 0; i < bulkFiles.length; i++) {
      formData.append("files", bulkFiles[i]);
    }
    try {
      const res = await authFetch("/api/admin/library/books/bulk", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(<T>Books added successfully</T>);
        setBulkFiles(null);
        setBulkDialogOpen(false);
        fetchBooks();
      } else {
        const err = await res.json();
        toast.error(err.error || "Bulk upload failed");
      }
    } catch {
      toast.error(<T>Network Error</T>);
    } finally {
      setBulkUploading(false);
    }
  };

  const handleEditClick = (book: Book) => {
    setEditBook(book);
    setEditTitle(book.title);
    setEditAuthor(book.author || "");
    setEditDescription(book.description || "");
    setEditCoverFile(null);
    setEditCategoryIds(book.categories?.map((c) => c.id) || []);
    setEditAccessType(book.access_type || "free");
    setEditPrice(book.price?.toString() || "0");
    setEditAllowedPages("[]"); // يمكن تحميلها من قاعدة البيانات لاحقًا
    setEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!editBook) return;
    setEditSaving(true);
    const formData = new FormData();
    formData.append("title", editTitle);
    formData.append("author", editAuthor);
    formData.append("description", editDescription);
    formData.append("access_type", editAccessType);
    formData.append("price", editPrice);
    formData.append("allowed_pages", editAllowedPages);
    formData.append("categories", JSON.stringify(editCategoryIds));
    if (editCoverFile) formData.append("cover_image", editCoverFile);
    try {
      const res = await authFetch(`/api/admin/library/books/${editBook.id}`, {
        method: "PUT",
        body: formData,
      });
      if (res.ok) {
        toast.success(<T>Book updated successfully</T>);
        setEditDialogOpen(false);
        fetchBooks();
      } else {
        const err = await res.json();
        toast.error(err.error || "Update failed");
      }
    } catch {
      toast.error(<T>Network Error</T>);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteBook = async (id: string) => {
    if (!confirm("Are you sure you want to delete this book?")) return;
    try {
      const res = await authFetch(`/api/admin/library/books/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(<T>Book Deleted</T>);
        fetchBooks();
      } else {
        const err = await res.json();
        toast.error(err.error || "Delete failed");
      }
    } catch {
      toast.error(<T>Delete Error</T>);
    }
  };

  const handleConvertToImages = async (bookId: string) => {
    if (convertingId === bookId) return;
    setConvertingId(bookId);
    try {
      const res = await authFetch("/api/admin/library/books/convert", {
        method: "POST",
        body: JSON.stringify({ bookId }),
      });
      if (res.ok) {
        const data = await res.json();
        toast.success(<T>Converted pages successfully</T>);
        fetchBooks();
      } else {
        const err = await res.json();
        toast.error(err.error || "Conversion failed");
      }
    } catch {
      toast.error(<T>Network Error</T>);
    } finally {
      setConvertingId(null);
    }
  };

  // ── Category Operations ───────────────────────
  const openNewCategory = () => {
    setEditingCategory(null);
    setCatName("");
    setCatNameAr("");
    setCatSlug("");
    setCatDescription("");
    setCatParentId("");
    setCatDialogOpen(true);
  };

  const openEditCategory = (cat: Category) => {
    setEditingCategory(cat);
    setCatName(cat.name);
    setCatNameAr(cat.name_ar || "");
    setCatSlug(cat.slug);
    setCatDescription(cat.description || "");
    setCatParentId(cat.parent_id || "");
    setCatDialogOpen(true);
  };

  const saveCategory = async () => {
    if (!catName || !catSlug) {
      toast.error(<T>Name and slug are required</T>);
      return;
    }
    setCatSaving(true);
    const body = {
      name: catName,
      name_ar: catNameAr || null,
      slug: catSlug,
      description: catDescription || null,
      parent_id: catParentId || null,
    };
    try {
      const res = editingCategory
        ? await authFetch(`/api/admin/categories/${editingCategory.id}`, {
            method: "PUT",
            body: JSON.stringify(body),
          })
        : await authFetch("/api/admin/categories", {
            method: "POST",
            body: JSON.stringify(body),
          });
      if (res.ok) {
        toast.success(editingCategory ? <T>Category updated</T> : <T>Category added</T>);
        setCatDialogOpen(false);
        fetchCategories();
      } else {
        const err = await res.json();
        toast.error(err.error || "Save failed");
      }
    } catch {
      toast.error(<T>Network Error</T>);
    } finally {
      setCatSaving(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Are you sure you want to delete this category?")) return;
    try {
      const res = await authFetch(`/api/admin/categories/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(<T>Category deleted</T>);
        fetchCategories();
      } else {
        const err = await res.json();
        toast.error(err.error || "Delete failed");
      }
    } catch {
      toast.error(<T>Network Error</T>);
    }
  };

  const parentCategoryName = (parentId?: string | null) => {
    if (!parentId) return "—";
    const parent = categories.find((c) => c.id === parentId);
    return parent ? parent.name : parentId;
  };

  // ── Category Checkboxes Component ──────────────
  const CategoryCheckboxes = ({
    selectedIds,
    onChange,
  }: {
    selectedIds: string[];
    onChange: (ids: string[]) => void;
  }) => (
    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-border rounded-xl p-3">
      {categories.map((cat) => (
        <label key={cat.id} className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={selectedIds.includes(cat.id)}
            onChange={(e) => {
              if (e.target.checked) {
                onChange([...selectedIds, cat.id]);
              } else {
                onChange(selectedIds.filter((id) => id !== cat.id));
              }
            }}
            className="rounded accent-primary"
          />
          {cat.name_ar || cat.name}
        </label>
      ))}
      {categories.length === 0 && (
        <p className="text-xs text-muted-foreground col-span-2">
          <T>No categories available</T>
        </p>
      )}
    </div>
  );

  // ── Loading State ─────────────────────────────
  const isLoading = loadingBooks || loadingCategories;
  if (isLoading) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        <Loader2 className="mx-auto animate-spin h-8 w-8" />
        <T>Loading</T>
      </div>
    );
  }

  // ── Render ────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8" dir="rtl">
      <h1 className="text-3xl font-bold text-secondary-foreground">
        <T>Library Management</T>
      </h1>

      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          variant={tab === "books" ? "default" : "outline"}
          onClick={() => setTab("books")}
          className="rounded-full"
        >
          <T>Books</T>
        </Button>
        <Button
          variant={tab === "categories" ? "default" : "outline"}
          onClick={() => setTab("categories")}
          className="rounded-full"
        >
          <Tag className="h-4 w-4 ml-2" />
          <T>Categories</T>
        </Button>
      </div>

      {/* ── Books Tab ──────────────────────────── */}
      {tab === "books" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl"><T>Add New Book</T></CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddBook} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label><T>Book Title</T></Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
                  </div>
                  <div>
                    <Label><T>Author</T></Label>
                    <Input value={author} onChange={(e) => setAuthor(e.target.value)} />
                  </div>
                </div>
                <div>
                  <Label><T>Description</T></Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label><T>Year</T></Label>
                    <Input value={year} onChange={(e) => setYear(e.target.value)} />
                  </div>
                  <div>
                    <Label><T>Source Type</T></Label>
                    <select
                      className="w-full border border-input bg-background px-3 py-2 rounded-md text-foreground"
                      value={sourceType}
                      onChange={(e) => setSourceType(e.target.value as "upload" | "url")}
                    >
                      <option value="upload"><T>Upload File</T></option>
                      <option value="url"><T>External URL</T></option>
                    </select>
                  </div>
                  {sourceType === "url" && (
                    <div>
                      <Label><T>PDF URL</T></Label>
                      <Input value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} />
                    </div>
                  )}
                </div>
                <div>
                  <Label><T>Categories</T></Label>
                  <CategoryCheckboxes
                    selectedIds={addCategoryIds}
                    onChange={setAddCategoryIds}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label><T>Access Type</T></Label>
                    <select
                      className="w-full border border-input bg-background px-3 py-2 rounded-md text-foreground"
                      value={accessType}
                      onChange={(e) => setAccessType(e.target.value)}
                    >
                      <option value="free"><T>Free</T></option>
                      <option value="partial"><T>Partial Free</T></option>
                      <option value="paid"><T>Paid</T></option>
                      <option value="course"><T>Course-based</T></option>
                      <option value="bundle"><T>Bundle-based</T></option>
                      <option value="subscription"><T>Subscription</T></option>
                    </select>
                  </div>
                  {accessType === "paid" && (
                    <div>
                      <Label><T>Price</T></Label>
                      <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
                    </div>
                  )}
                  {accessType === "partial" && (
                    <div>
                      <Label><T>Free Pages (JSON)</T></Label>
                      <Input value={allowedPages} onChange={(e) => setAllowedPages(e.target.value)} />
                    </div>
                  )}
                  {(accessType === "course" || accessType === "bundle") && (
                    <div>
                      <Label>{accessType === "course" ? <T>Course ID</T> : <T>Bundle ID</T>}</Label>
                      <Input
                        value={accessType === "course" ? courseId : bundleId}
                        onChange={(e) =>
                          accessType === "course"
                            ? setCourseId(e.target.value)
                            : setBundleId(e.target.value)
                        }
                      />
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label><T>Flipbook Config (JSON)</T></Label>
                    <Textarea
                      value={flipbookConfig}
                      onChange={(e) => setFlipbookConfig(e.target.value)}
                      rows={2}
                      placeholder='{"sound": true, "pageWidth": 400}'
                    />
                  </div>
                  <div>
                    <Label><T>AI Prompt (Optional)</T></Label>
                    <Textarea
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      rows={2}
                      placeholder='e.g., "Divide this book by units"'
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label><T>Cover Image</T></Label>
                    <Input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} />
                  </div>
                  <div>
                    <Label><T>PDF File</T></Label>
                    <Input
                      type="file"
                      accept=".pdf"
                      onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
                      required={sourceType === "upload"}
                    />
                  </div>
                </div>
                <div className="flex gap-4 flex-wrap">
                  <Button type="submit" disabled={uploading} className="bg-primary text-primary-foreground">
                    {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <T>Add Book</T>}
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setBulkDialogOpen(true)}>
                    <T>Bulk Upload</T>
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-xl"><T>Existing Books</T> ({books.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {books.length === 0 ? (
                <p className="text-muted-foreground text-center"><T>No Books Available Yet</T></p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead><T>Cover</T></TableHead>
                      <TableHead><T>Book Title</T></TableHead>
                      <TableHead><T>Author</T></TableHead>
                      <TableHead><T>Access Type</T></TableHead>
                      <TableHead><T>Status</T></TableHead>
                      <TableHead className="text-right"><T>Actions</T></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {books.map((book) => (
                      <TableRow key={book.id}>
                        <TableCell>
                          {book.cover_file_id ? (
                            <img
                              src={`/api/library/files/${book.cover_file_id}`}
                              alt={book.title}
                              className="w-10 h-14 object-cover rounded"
                            />
                          ) : book.cover_url ? (
                            <img src={book.cover_url} alt={book.title} className="w-10 h-14 object-cover rounded" />
                          ) : (
                            <div className="w-10 h-14 bg-muted rounded flex items-center justify-center text-muted-foreground">
                              <ImageIcon className="h-4 w-4" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{book.title}</TableCell>
                        <TableCell>{book.author || "—"}</TableCell>
                        <TableCell>
                          <span className="text-xs bg-secondary px-2 py-1 rounded-full">
                            {book.access_type}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={`text-xs px-2 py-1 rounded-full ${
                              book.processing_status === "ready"
                                ? "bg-green-100 text-green-800"
                                : book.processing_status === "processing"
                                ? "bg-blue-100 text-blue-800"
                                : book.processing_status === "failed"
                                ? "bg-red-100 text-red-800"
                                : "bg-yellow-100 text-yellow-800"
                            }`}
                          >
                            {book.processing_status}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleConvertToImages(book.id)}
                              disabled={convertingId === book.id}
                              title="Convert to Images"
                            >
                              {convertingId === book.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <ImageIcon className="h-4 w-4" />
                              )}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleEditClick(book)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/dashboard/admin/library/editor/${book.id}`)}
                              title="Interactive Editor"
                            >
                              <FileEdit className="h-4 w-4 text-blue-500" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteBook(book.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Bulk Upload Dialog */}
          <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
            <DialogContent className="bg-card border-border text-foreground">
              <DialogHeader>
                <DialogTitle className="text-xl"><T>Bulk Upload</T></DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Label><T>Select PDF Files</T></Label>
                <Input type="file" accept=".pdf" multiple onChange={(e) => setBulkFiles(e.target.files)} />
                {bulkFiles && (
                  <p className="text-sm text-muted-foreground">
                    <T>Selected files</T>: {bulkFiles.length}
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setBulkDialogOpen(false)}>
                  <T>Cancel</T>
                </Button>
                <Button onClick={handleBulkUpload} disabled={bulkUploading} className="bg-primary text-primary-foreground">
                  {bulkUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <T>Upload Files</T>}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Edit Book Dialog */}
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="bg-card border-border text-foreground sm:max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="text-xl"><T>Edit Book</T></DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label><T>Book Title</T></Label>
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                </div>
                <div>
                  <Label><T>Author</T></Label>
                  <Input value={editAuthor} onChange={(e) => setEditAuthor(e.target.value)} />
                </div>
                <div>
                  <Label><T>Description</T></Label>
                  <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} />
                </div>
                <div>
                  <Label><T>Categories</T></Label>
                  <CategoryCheckboxes
                    selectedIds={editCategoryIds}
                    onChange={setEditCategoryIds}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label><T>Access Type</T></Label>
                    <select
                      className="w-full border border-input bg-background px-3 py-2 rounded-md text-foreground"
                      value={editAccessType}
                      onChange={(e) => setEditAccessType(e.target.value)}
                    >
                      <option value="free"><T>Free</T></option>
                      <option value="partial"><T>Partial Free</T></option>
                      <option value="paid"><T>Paid</T></option>
                      <option value="course"><T>Course-based</T></option>
                      <option value="bundle"><T>Bundle-based</T></option>
                      <option value="subscription"><T>Subscription</T></option>
                    </select>
                  </div>
                  {editAccessType === "paid" && (
                    <div>
                      <Label><T>Price</T></Label>
                      <Input type="number" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
                    </div>
                  )}
                  {editAccessType === "partial" && (
                    <div>
                      <Label><T>Free Pages (JSON)</T></Label>
                      <Input value={editAllowedPages} onChange={(e) => setEditAllowedPages(e.target.value)} />
                    </div>
                  )}
                </div>
                <div>
                  <Label><T>Cover Image</T></Label>
                  <Input type="file" accept="image/*" onChange={(e) => setEditCoverFile(e.target.files?.[0] || null)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setEditDialogOpen(false)}>
                  <T>Cancel</T>
                </Button>
                <Button onClick={handleEditSave} disabled={editSaving} className="bg-primary text-primary-foreground">
                  {editSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <T>Save Changes</T>}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* ── Categories Tab ────────────────────── */}
      {tab === "categories" && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl"><T>Categories</T></CardTitle>
              <Button onClick={openNewCategory} size="sm">
                <Plus className="h-4 w-4 mr-1" />
                <T>Add Category</T>
              </Button>
            </CardHeader>
            <CardContent>
              {categories.length === 0 ? (
                <p className="text-muted-foreground text-center"><T>No categories yet</T></p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead><T>Name</T></TableHead>
                      <TableHead><T>Arabic Name</T></TableHead>
                      <TableHead><T>Slug</T></TableHead>
                      <TableHead><T>Parent Category</T></TableHead>
                      <TableHead className="text-right"><T>Actions</T></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {categories.map((cat) => (
                      <TableRow key={cat.id}>
                        <TableCell className="font-medium">{cat.name}</TableCell>
                        <TableCell>{cat.name_ar || "—"}</TableCell>
                        <TableCell className="font-mono text-sm">{cat.slug}</TableCell>
                        <TableCell>{parentCategoryName(cat.parent_id)}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => openEditCategory(cat)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteCategory(cat.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Category Dialog */}
          <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
            <DialogContent className="bg-card border-border text-foreground">
              <DialogHeader>
                <DialogTitle className="text-xl">
                  {editingCategory ? <T>Edit Category</T> : <T>Add Category</T>}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label><T>Name (English)</T></Label>
                  <Input value={catName} onChange={(e) => setCatName(e.target.value)} required />
                </div>
                <div>
                  <Label><T>Arabic Name</T></Label>
                  <Input value={catNameAr} onChange={(e) => setCatNameAr(e.target.value)} />
                </div>
                <div>
                  <Label><T>Slug</T></Label>
                  <Input value={catSlug} onChange={(e) => setCatSlug(e.target.value)} required />
                </div>
                <div>
                  <Label><T>Description</T></Label>
                  <Textarea value={catDescription} onChange={(e) => setCatDescription(e.target.value)} rows={2} />
                </div>
                <div>
                  <Label><T>Parent Category</T></Label>
                  <select
                    className="w-full border border-input bg-background px-3 py-2 rounded-md text-foreground"
                    value={catParentId}
                    onChange={(e) => setCatParentId(e.target.value)}
                  >
                    <option value="">— None (top-level) —</option>
                    {categories
                      .filter((c) => c.id !== editingCategory?.id)
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} {c.name_ar ? `(${c.name_ar})` : ""}
                        </option>
                      ))}
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setCatDialogOpen(false)}>
                  <T>Cancel</T>
                </Button>
                <Button onClick={saveCategory} disabled={catSaving} className="bg-primary text-primary-foreground">
                  {catSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingCategory ? <T>Update</T> : <T>Add</T>}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );
}