"use client";

import { useEffect, useState } from "react";
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
} from "lucide-react";
import { useRouter } from "next/navigation";

// ── أنواع ────────────────────────────────────────
interface Book {
  id: string;
  title: string;
  author: string;
  description?: string;
  cover_url: string;
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

// ── المكون الرئيسي ──────────────────────────────
export default function AdminLibraryPage() {
  const router = useRouter();

  // التبويب النشط
  const [tab, setTab] = useState<"books" | "categories">("books");

  // ── بيانات الكتب ──────────────────────────────
  const [books, setBooks] = useState<Book[]>([]);
  const [loadingBooks, setLoadingBooks] = useState(true);

  // ── إضافة كتاب ────────────────────────────────
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [description, setDescription] = useState("");
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [addCategoryIds, setAddCategoryIds] = useState<string[]>([]);

  // ── رفع جماعي ──────────────────────────────────
  const [bulkFiles, setBulkFiles] = useState<FileList | null>(null);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkUploading, setBulkUploading] = useState(false);

  // ── تعديل كتاب ─────────────────────────────────
  const [editBook, setEditBook] = useState<Book | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editAuthor, setEditAuthor] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editCategoryIds, setEditCategoryIds] = useState<string[]>([]);
  const [editSaving, setEditSaving] = useState(false);

  // ── تحويل PDF ─────────────────────────────────
  const [convertingId, setConvertingId] = useState<string | null>(null);

  // ── التصنيفات ──────────────────────────────────
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);

  // حوار إضافة/تعديل تصنيف
  const [catDialogOpen, setCatDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [catName, setCatName] = useState("");
  const [catNameAr, setCatNameAr] = useState("");
  const [catSlug, setCatSlug] = useState("");
  const [catDescription, setCatDescription] = useState("");
  const [catParentId, setCatParentId] = useState<string>("");
  const [catSaving, setCatSaving] = useState(false);

  // ── جلب البيانات ──────────────────────────────
  const fetchBooks = async () => {
    try {
      const res = await authFetch("/api/library/books");
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
      const res = await authFetch("/api/categories");
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

  // ── عمليات الكتب ──────────────────────────────
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
    formData.append("categories", JSON.stringify(addCategoryIds));
    if (coverFile) formData.append("cover", coverFile);
    if (pdfFile) formData.append("pdf", pdfFile);

    try {
      const res = await authFetch("/api/admin/library/books", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        toast.success(<T>Book Added</T>);
        setTitle("");
        setAuthor("");
        setDescription("");
        setCoverFile(null);
        setPdfFile(null);
        setAddCategoryIds([]);
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
      toast.error("يرجى اختيار ملفات PDF");
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
        toast.success(`تم إضافة ${data.books.length} كتب`);
        setBulkFiles(null);
        setBulkDialogOpen(false);
        fetchBooks();
      } else {
        const err = await res.json();
        toast.error(err.error || "فشل الرفع المجمع");
      }
    } catch {
      toast.error("خطأ في الشبكة");
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
    const bookCats = book.categories?.map((c) => c.id) || [];
    setEditCategoryIds(bookCats);
    setEditDialogOpen(true);
  };

  const handleEditSave = async () => {
    if (!editBook) return;
    setEditSaving(true);
    const formData = new FormData();
    formData.append("title", editTitle);
    formData.append("author", editAuthor);
    formData.append("description", editDescription);
    formData.append("categories", JSON.stringify(editCategoryIds));
    if (editCoverFile) formData.append("cover", editCoverFile);
    try {
      const res = await authFetch(`/api/admin/library/books/${editBook.id}`, {
        method: "PUT",
        body: formData,
      });
      if (res.ok) {
        toast.success("تم تحديث الكتاب");
        setEditDialogOpen(false);
        fetchBooks();
      } else {
        const err = await res.json();
        toast.error(err.error || "فشل التحديث");
      }
    } catch {
      toast.error("خطأ في الشبكة");
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteBook = async (id: string) => {
    if (!confirm("هل تريد حذف هذا الكتاب؟")) return;
    try {
      const res = await authFetch(`/api/admin/library/books/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success(<T>Book Deleted</T>);
        fetchBooks();
      } else {
        const err = await res.json();
        toast.error(err.error || "فشل الحذف");
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
        toast.success(`تم تحويل ${data.pages_count} صفحة`);
        fetchBooks();
      } else {
        const err = await res.json();
        toast.error(err.error || "فشل التحويل");
      }
    } catch {
      toast.error("خطأ في الشبكة");
    } finally {
      setConvertingId(null);
    }
  };

  // ── عمليات التصنيفات ──────────────────────────
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
      toast.error("الاسم والـ slug مطلوبان");
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
        ? await authFetch(`/api/categories/${editingCategory.id}`, {
            method: "PUT",
            body: JSON.stringify(body),
          })
        : await authFetch("/api/categories", {
            method: "POST",
            body: JSON.stringify(body),
          });
      if (res.ok) {
        toast.success(editingCategory ? "تم تحديث التصنيف" : "تم إضافة التصنيف");
        setCatDialogOpen(false);
        fetchCategories();
      } else {
        const err = await res.json();
        toast.error(err.error || "فشل الحفظ");
      }
    } catch {
      toast.error("خطأ في الشبكة");
    } finally {
      setCatSaving(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("هل تريد حذف هذا التصنيف؟")) return;
    try {
      const res = await authFetch(`/api/categories/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("تم حذف التصنيف");
        fetchCategories();
      } else {
        const err = await res.json();
        toast.error(err.error || "فشل الحذف");
      }
    } catch {
      toast.error("خطأ في الشبكة");
    }
  };

  const parentCategoryName = (parentId?: string | null) => {
    if (!parentId) return "—";
    const parent = categories.find((c) => c.id === parentId);
    return parent ? parent.name : parentId;
  };

  // ── مكون مربع اختيار التصنيفات ─────────────────
  const CategoryCheckboxes = ({
    selectedIds,
    onChange,
  }: {
    selectedIds: string[];
    onChange: (ids: string[]) => void;
  }) => (
    <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-gray-200 rounded-xl p-3">
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
        <p className="text-xs text-gray-500 col-span-2">
          <T>No categories available</T>
        </p>
      )}
    </div>
  );

  // ── التحميل ────────────────────────────────────
  const isLoading = loadingBooks || loadingCategories;

  if (isLoading) {
    return (
      <div className="p-6 text-center text-gray-500">
        <Loader2 className="mx-auto animate-spin h-8 w-8" />
        <T>Loading</T>
      </div>
    );
  }

  // ── واجهة المستخدم ─────────────────────────────
  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8" dir="rtl">
      <h1 className="text-3xl font-bold text-secondary-foreground">
        <T>Library Management</T>
      </h1>

      {/* أزرار التبويب */}
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

      {/* ── تبويب الكتب ────────────────────────── */}
      {tab === "books" && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-xl"><T>Add New Book</T></CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAddBook} className="space-y-4">
                <div>
                  <Label><T>Book Title</T></Label>
                  <Input value={title} onChange={(e) => setTitle(e.target.value)} required />
                </div>
                <div>
                  <Label><T>Author</T></Label>
                  <Input value={author} onChange={(e) => setAuthor(e.target.value)} />
                </div>
                <div>
                  <Label><T>Description</T></Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
                </div>

                <div>
                  <Label><T>Categories</T></Label>
                  <CategoryCheckboxes
                    selectedIds={addCategoryIds}
                    onChange={setAddCategoryIds}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <Label><T>Cover Image</T></Label>
                    <Input type="file" accept="image/*" onChange={(e) => setCoverFile(e.target.files?.[0] || null)} />
                  </div>
                  <div>
                    <Label><T>PDF File</T></Label>
                    <Input type="file" accept=".pdf" onChange={(e) => setPdfFile(e.target.files?.[0] || null)} />
                  </div>
                </div>
                <div className="flex gap-4">
                  <Button type="submit" disabled={uploading} className="bg-emerald-600 text-primary-foreground">
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
                <p className="text-gray-500 text-center"><T>No Books Available Yet</T></p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead><T>Cover</T></TableHead>
                      <TableHead><T>Book Title</T></TableHead>
                      <TableHead><T>Author</T></TableHead>
                      <TableHead><T>Date Added</T></TableHead>
                      <TableHead className="text-right"><T>Actions</T></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {books.map((book) => (
                      <TableRow key={book.id}>
                        <TableCell>
                          {book.cover_url ? (
                            <img src={book.cover_url} alt={book.title} className="w-10 h-14 object-cover rounded" />
                          ) : (
                            <div className="w-10 h-14 bg-muted rounded" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">{book.title}</TableCell>
                        <TableCell>{book.author || "—"}</TableCell>
                        <TableCell>{new Date(book.created_at).toLocaleDateString("ar-EG")}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex gap-2 justify-end">
                            {/* تحويل PDF إلى صور */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleConvertToImages(book.id)}
                              disabled={convertingId === book.id}
                              title="Convert to images"
                            >
                              {convertingId === book.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <ImageIcon className="h-4 w-4" />
                              )}
                            </Button>

                            {/* تعديل البيانات الوصفية */}
                            <Button variant="ghost" size="sm" onClick={() => handleEditClick(book)}>
                              <Pencil className="h-4 w-4" />
                            </Button>

                            {/* ✨ محرر المحتوى التفاعلي ✨ */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/dashboard/admin/library/editor/${book.id}`)}
                              title="Edit Content"
                            >
                              <FileEdit className="h-4 w-4 text-blue-500" />
                            </Button>

                            {/* حذف الكتاب */}
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

          {/* حوار الرفع المجمع */}
          <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
            <DialogContent className="bg-card border-gray-200 text-gray-900">
              <DialogHeader>
                <DialogTitle className="text-xl"><T>Bulk Upload</T></DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Label><T>Select PDF Files</T></Label>
                <Input type="file" accept=".pdf" multiple onChange={(e) => setBulkFiles(e.target.files)} />
                {bulkFiles && <p className="text-sm text-gray-500">تم اختيار {bulkFiles.length} ملف</p>}
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setBulkDialogOpen(false)}>
                  <T>Cancel</T>
                </Button>
                <Button onClick={handleBulkUpload} disabled={bulkUploading} className="bg-emerald-600 text-primary-foreground">
                  {bulkUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <T>Upload Files</T>}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* حوار تعديل الكتاب */}
          <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
            <DialogContent className="bg-card border-gray-200 text-gray-900 sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
                <div>
                  <Label><T>Cover Image</T></Label>
                  <Input type="file" accept="image/*" onChange={(e) => setEditCoverFile(e.target.files?.[0] || null)} />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setEditDialogOpen(false)}>
                  <T>Cancel</T>
                </Button>
                <Button onClick={handleEditSave} disabled={editSaving} className="bg-emerald-600 text-primary-foreground">
                  {editSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <T>Save Changes</T>}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}

      {/* ── تبويب التصنيفات ────────────────────── */}
      {tab === "categories" && (
        <>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-xl"><T>Categories</T></CardTitle>
              <Button onClick={openNewCategory} size="sm">
                <T>Add Category</T>
              </Button>
            </CardHeader>
            <CardContent>
              {categories.length === 0 ? (
                <p className="text-gray-500 text-center"><T>No categories yet</T></p>
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

          {/* حوار إضافة/تعديل تصنيف */}
          <Dialog open={catDialogOpen} onOpenChange={setCatDialogOpen}>
            <DialogContent className="bg-card border-gray-200 text-gray-900">
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
                    className="w-full border border-input bg-background px-3 py-2 rounded-md text-gray-900"
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
                <Button onClick={saveCategory} disabled={catSaving} className="bg-emerald-600 text-primary-foreground">
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