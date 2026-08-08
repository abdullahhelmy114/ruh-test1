'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  ChevronUp,
  ChevronDown,
  MessageCircle,
  Plus,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/lib/firebase/AuthProvider';
import type { ForumQuestion } from '@/lib/types';

export function ForumSection({ gender }: { gender: 'male' | 'female' }) {
  const [questions, setQuestions] = useState<ForumQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<'latest' | 'votes'>('latest');
  const { user } = useAuth();

  const fetchQuestions = useCallback(async () => {
    const res = await fetch(`/api/forum/questions?gender=${gender}&sort=${sort}`);
    const data = await res.json();
    setQuestions(data.questions);
    setLoading(false);
  }, [gender, sort]);

  useEffect(() => {
    setLoading(true);
    fetchQuestions();
  }, [fetchQuestions]);

  const handleVote = async (questionId: string, voteType: 'upvote' | 'downvote') => {
    await fetch('/api/forum/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetId: questionId, targetType: 'question', voteType }),
    });
    fetchQuestions();
  };

  if (loading) return <div className="text-muted-foreground">جار التحميل...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <Button
          onClick={() => setSort(sort === 'latest' ? 'votes' : 'latest')}
          variant="outline"
          className="border-border"
        >
          {sort === 'latest' ? 'الأكثر تصويتاً' : 'الأحدث'}
        </Button>
        <AskQuestionDialog gender={gender} onSuccess={fetchQuestions} />
      </div>
      {questions.length === 0 ? (
        <p className="text-muted-foreground">لا توجد أسئلة بعد.</p>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <QuestionCard key={q.id} question={q} onVote={handleVote} />
          ))}
        </div>
      )}
    </div>
  );
}

function QuestionCard({
  question,
  onVote,
}: {
  question: ForumQuestion;
  onVote: (questionId: string, voteType: 'upvote' | 'downvote') => void;
}) {
  return (
    <Card className="bg-card border-border hover:border-primary/30 transition-colors">
      <CardContent className="p-4 flex gap-3">
        <div className="flex flex-col items-center space-y-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onVote(question.id, 'upvote')}
            className={`h-8 w-8 ${
              question.userVote === 'upvote' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <ChevronUp className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium text-foreground">
            {question.upvotes - question.downvotes}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onVote(question.id, 'downvote')}
            className={`h-8 w-8 ${
              question.userVote === 'downvote' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">{question.title}</h3>
          <p className="text-secondary-foreground text-sm mt-1 line-clamp-2">
            {question.content}
          </p>
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <Avatar className="h-6 w-6">
              <AvatarImage src={question.userAvatar} />
              <AvatarFallback className="bg-primary/10 text-primary">
                {question.userName?.[0]}
              </AvatarFallback>
            </Avatar>
            <span>{question.userName}</span>
            <span>•</span>
            <span>{new Date(question.createdAt).toLocaleDateString('ar')}</span>
            <span>•</span>
            <span className="flex items-center">
              <MessageCircle className="w-3 h-3 mr-1" /> {question.answersCount}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AskQuestionDialog({
  gender,
  onSuccess,
}: {
  gender: 'male' | 'female';
  onSuccess: () => void;
}) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) return;
    setSubmitting(true);
    await fetch('/api/forum/questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content }),
    });
    setSubmitting(false);
    setOpen(false);
    setTitle('');
    setContent('');
    onSuccess();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" /> اطرح سؤالاً
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">طرح سؤال جديد</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            placeholder="عنوان السؤال"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-muted border-border"
          />
          <Textarea
            placeholder="نص السؤال..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="bg-muted border-border"
            rows={5}
          />
          <Button
            onClick={handleSubmit}
            disabled={submitting || !title.trim() || !content.trim()}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {submitting ? 'جاري الإرسال...' : 'إرسال'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}