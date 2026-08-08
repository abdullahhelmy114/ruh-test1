'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Trophy, Users, Calendar } from 'lucide-react';
import { useAuth } from '@/lib/firebase/AuthProvider';       // ✅ استيراد useAuth (أو الاسم الصحيح)
import type { Challenge } from '@/lib/types';

export function ChallengesSection({ gender }: { gender: 'male' | 'female' }) {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();                                // ✅ استخدام user من الـ hook الصحيح

  const fetchChallenges = async () => {
    const res = await fetch(`/api/challenges?gender=${gender}`);
    const data = await res.json();
    setChallenges(data.challenges);
    setLoading(false);
  };

  useEffect(() => {
    fetchChallenges();
  }, [gender]);

  const handleJoin = async (challengeId: string) => {
    await fetch('/api/challenges/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ challengeId }),
    });
    fetchChallenges();
  };

  if (loading) return <div className="text-muted-foreground">جار التحميل...</div>;

  return (
    <div className="space-y-4">
      {challenges.map((challenge) => (
        <Card key={challenge.id} className="bg-card border-border">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Trophy className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <div className="flex justify-between items-start">
                  <h3 className="font-semibold text-foreground">{challenge.title}</h3>
                  <Badge variant={challenge.status === 'active' ? 'default' : 'secondary'}>
                    {challenge.status === 'active' ? 'جارية' : 'منتهية'}
                  </Badge>
                </div>
                <p className="text-secondary-foreground text-sm mt-1">{challenge.description}</p>
                <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(challenge.startDate).toLocaleDateString('ar')} - {new Date(challenge.endDate).toLocaleDateString('ar')}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users className="h-3 w-3" />
                    {challenge.participantsCount} مشارك
                  </span>
                </div>
                {challenge.status === 'active' && !challenge.isJoined && (
                  <Button size="sm" onClick={() => handleJoin(challenge.id)} className="mt-3 bg-primary text-primary-foreground hover:bg-primary/90">
                    انضم للتحدي
                  </Button>
                )}
                {challenge.isJoined && (
                  <span className="inline-block mt-2 text-xs text-primary font-medium">✅ أنت مشترك</span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}