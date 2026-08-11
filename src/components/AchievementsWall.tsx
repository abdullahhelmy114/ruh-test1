'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Heart, MessageCircle, Send } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/firebase/AuthProvider'; // ✅ استيراد useAuth
import type { CommunityPost } from '@/lib/types';

export function AchievementsWall({ gender }: { gender: 'male' | 'female' }) {
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth(); // ✅ استخدام useAuth

  const fetchPosts = async () => {
    const res = await fetch(`/api/community/posts?gender=${gender}`);
    const data = await res.json();
    setPosts(data.posts);
    setLoading(false);
  };

  useEffect(() => {
    fetchPosts();
  }, [gender]);

  const handleLike = async (postId: string) => {
    await fetch('/api/community/likes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId }),
    });
    fetchPosts();
  };

  const handleComment = async (postId: string, comment: string) => {
    await fetch('/api/community/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId, content: comment }),
    });
    fetchPosts();
  };

  if (loading) return <div className="text-gray-500">جار التحميل...</div>;

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <Card key={post.id} className="bg-card border-gray-200">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10 border-2 border-primary/20">
                <AvatarImage src={post.userAvatar} />
                <AvatarFallback className="bg-emerald-500/10 text-primary">
                  {post.userName?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex justify-between">
                  <p className="font-semibold text-gray-900">{post.userName}</p>
                  <span className="text-xs text-gray-500">
                    {new Date(post.createdAt).toLocaleDateString('ar')}
                  </span>
                </div>
                <p className="text-secondary-foreground mt-1">{post.content}</p>
                <div className="flex items-center gap-4 mt-3">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleLike(post.id)}
                    className="text-gray-500 hover:text-primary"
                  >
                    <Heart
                      className={`w-4 h-4 mr-1 ${
                        post.isLiked ? 'fill-primary text-primary' : ''
                      }`}
                    />
                    {post.likes}
                  </Button>
                  <CommentTrigger
                    postId={post.id}
                    onComment={handleComment}
                    commentsCount={post.commentsCount}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// مكون تعليق مبسط (يظهر عند الضغط)
function CommentTrigger({
  postId,
  onComment,
  commentsCount,
}: {
  postId: string;
  onComment: (postId: string, comment: string) => void;
  commentsCount: number;
}) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState('');

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(!open)}
        className="text-gray-500 hover:text-primary"
      >
        <MessageCircle className="w-4 h-4 mr-1" />
        {commentsCount}
      </Button>
      {open && (
        <div className="mt-2 space-y-2">
          <Textarea
            placeholder="أضف تعليقاً..."
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="bg-muted border-gray-200"
          />
          <Button
            size="sm"
            onClick={() => {
              onComment(postId, comment);
              setComment('');
              setOpen(false);
            }}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Send className="w-4 h-4 mr-1" /> إرسال
          </Button>
        </div>
      )}
    </>
  );
}