'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trophy, HelpCircle, MessageCircle } from 'lucide-react';
import { AchievementsWall } from '@/components/AchievementsWall';
import { ForumSection } from '@/components/ForumSection';
import { ChallengesSection } from '@/components/ChallengesSection';

export function CommunityTabs({ gender }: { gender: 'male' | 'female' }) {
  return (
    <Tabs defaultValue="achievements" className="w-full">
      <TabsList className="grid w-full max-w-lg grid-cols-3 mb-8 bg-muted rounded-lg">
        <TabsTrigger
          value="achievements"
          className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
        >
          <Trophy className="w-4 h-4 mr-2" />
          حائط الإنجازات
        </TabsTrigger>
        <TabsTrigger
          value="forum"
          className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
        >
          <HelpCircle className="w-4 h-4 mr-2" />
          المنتدى
        </TabsTrigger>
        <TabsTrigger
          value="challenges"
          className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
        >
          <Trophy className="w-4 h-4 mr-2" />
          التحديات
        </TabsTrigger>
      </TabsList>

      <TabsContent value="achievements">
        <AchievementsWall gender={gender} />
      </TabsContent>
      <TabsContent value="forum">
        <ForumSection gender={gender} />
      </TabsContent>
      <TabsContent value="challenges">
        <ChallengesSection gender={gender} />
      </TabsContent>
    </Tabs>
  );
}