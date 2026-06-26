"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { T } from "@/components/TranslatedText";
import {
  Loader2, Heart, MessageCircle, Send, Trash2,
  Plus, X, ArrowRight,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

interface Post {
  id: string;
  title: string;
  content: string;
  image_url: string | null;
  created_at: string;
  comments_count: number;
  likes_count: number;
  liked_by: string | null;
  comments: {
    id: string;
    user_name: string;
    user_uid: string;
    comment: string;
    created_at: string;
  }[];
}

export default function BlogPage() {
  const { user, role } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewPost, setShowNewPost] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [submittingComment, setSubmittingComment] = useState(false);

  const isAdmin = role === "admin";

  const fetchPosts = () => {
    setLoading(true);
    fetch('/api/blog/posts')
      .then(r => r.json())
      .then(d => setPosts(d.posts || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchPosts(); }, []);

  const handleCreatePost = async () => {
    if (!newTitle.trim() || !newContent.trim()) return;
    await fetch('/api/blog/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adminUid: user?.uid, title: newTitle, content: newContent, imageUrl: newImageUrl || null }),
    });
    setNewTitle("");
    setNewContent("");
    setNewImageUrl("");
    setShowNewPost(false);
    fetchPosts();
  };

  const handleDeletePost = async (postId: string) => {
    if (!confirm("Delete this post?")) return;
    await fetch('/api/blog/posts', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, adminUid: user?.uid }),
    });
    fetchPosts();
  };

  const handleAddComment = async (postId: string) => {
    if (!user) return;
    const text = commentText[postId] || "";
    if (!text.trim()) return;
    setSubmittingComment(true);
    await fetch('/api/blog/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, userUid: user.uid, comment: text }),
    });
    setCommentText(prev => ({ ...prev, [postId]: "" }));
    setSubmittingComment(false);
    fetchPosts(); // إعادة تحميل البوستات لتظهر التعليق الجديد
  };

  const handleToggleLike = async (postId: string) => {
    if (!user) return;
    const res = await fetch('/api/blog/likes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, userUid: user.uid }),
    });
    const data = await res.json();
    setPosts(prev =>
      prev.map(p =>
        p.id === postId
          ? {
              ...p,
              likes_count: data.count,
              liked_by: data.liked
                ? [...(p.liked_by ? p.liked_by.split(',') : []), user.uid].join(',')
                : (p.liked_by || '').split(',').filter(uid => uid !== user.uid).join(','),
            }
          : p
      )
    );
  };

  const isLikedByUser = (post: Post) => {
    return post.liked_by ? post.liked_by.split(',').includes(user?.uid || '') : false;
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 md:px-8 space-y-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="font-serif text-4xl"><T>Blog</T></h1>
        <p className="mt-2 text-muted-foreground"><T>News, tips, and updates from the Academy.</T></p>
      </div>

      {/* زر إضافة بوست للأدمن */}
      {isAdmin && (
        <div className="text-right">
          <button
            onClick={() => setShowNewPost(true)}
            className="rounded-full bg-amber-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-amber-400 inline-flex items-center gap-2"
          >
            <Plus size={16} /> <T>New Post</T>
          </button>
        </div>
      )}

      {/* نافذة إضافة بوست */}
      {showNewPost && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-card rounded-3xl p-6 max-w-lg w-full shadow-elegant space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-serif text-2xl"><T>New Post</T></h2>
              <button onClick={() => setShowNewPost(false)}><X size={20} /></button>
            </div>
            <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Title" className="w-full rounded-2xl border bg-background px-4 py-3 text-sm" />
            <textarea value={newContent} onChange={e => setNewContent(e.target.value)} rows={5} placeholder="Content" className="w-full rounded-2xl border bg-background px-4 py-3 text-sm" />
            <input value={newImageUrl} onChange={e => setNewImageUrl(e.target.value)} placeholder="Image URL (optional)" className="w-full rounded-2xl border bg-background px-4 py-3 text-sm" />
            <button onClick={handleCreatePost} className="w-full rounded-full bg-amber-500 py-3 text-sm font-semibold text-black"><T>Publish</T></button>
          </div>
        </div>
      )}

      {/* قائمة البوستات */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <p><T>No posts yet.</T></p>
        </div>
      ) : (
        posts.map(post => (
          <div key={post.id} className="glass rounded-3xl p-6 shadow-elegant space-y-4">
            {/* حذف بوست للأدمن */}
            {isAdmin && (
              <div className="text-right">
                <button onClick={() => handleDeletePost(post.id)} className="text-red-500 hover:bg-red-50 p-1 rounded-full">
                  <Trash2 size={16} />
                </button>
              </div>
            )}

            <h2 className="font-serif text-2xl">{post.title}</h2>
            {post.image_url && (
              <div className="rounded-2xl overflow-hidden">
                <Image src={post.image_url} alt={post.title} width={600} height={300} className="w-full object-cover max-h-96" />
              </div>
            )}
            <p className="text-muted-foreground leading-relaxed">{post.content}</p>
            <p className="text-xs text-muted-foreground">{new Date(post.created_at).toLocaleString()}</p>

            {/* ✅ التعليقات تظهر دائماً */}
            {post.comments && post.comments.length > 0 && (
              <div className="space-y-3 pt-2 border-t border-border/50">
                {post.comments.map(c => (
                  <div key={c.id} className="flex items-start gap-2 text-sm">
                    <span className="font-medium text-accent-foreground">{c.user_name}</span>
                    <span className="text-muted-foreground">{c.comment}</span>
                    <span className="text-[10px] text-muted-foreground ml-auto">{new Date(c.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            )}

            {/* الإعجاب والتعليقات */}
            <div className="flex items-center gap-6 pt-3 border-t border-border">
              <button
                onClick={() => handleToggleLike(post.id)}
                className={`inline-flex items-center gap-1.5 text-sm transition ${isLikedByUser(post) ? 'text-red-500' : 'text-muted-foreground hover:text-red-500'}`}
              >
                <Heart size={18} className={isLikedByUser(post) ? 'fill-current' : ''} />
                {post.likes_count}
              </button>
              <div className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <MessageCircle size={18} />
                {post.comments_count}
              </div>
            </div>

            {/* إضافة تعليق */}
            {user && (
              <div className="flex items-center gap-2 pt-2">
                <input
                  value={commentText[post.id] || ""}
                  onChange={e => setCommentText(prev => ({ ...prev, [post.id]: e.target.value }))}
                  placeholder="Add a comment..."
                  className="flex-1 rounded-full border bg-background px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-amber-500/50"
                  onKeyDown={e => { if (e.key === 'Enter') handleAddComment(post.id); }}
                />
                <button onClick={() => handleAddComment(post.id)} disabled={submittingComment} className="p-2 rounded-full bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-50">
                  <Send size={16} />
                </button>
              </div>
            )}

            {/* أزرار الانضمام لغير المسجلين */}
            {!user && (
              <div className="text-center pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground mb-2"><T>Want to interact?</T></p>
                <div className="flex justify-center gap-2">
                  <Link href="/signup?role=student" className="rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 inline-flex items-center gap-1">
                    <T>Join as Student</T> <ArrowRight size={12} />
                  </Link>
                  <Link href="/signup?role=teacher" className="rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-black hover:bg-amber-400 inline-flex items-center gap-1">
                    <T>Join as Teacher</T> <ArrowRight size={12} />
                  </Link>
                </div>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}