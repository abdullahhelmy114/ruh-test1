'use client';

import { Button } from '@/components/ui/button';
import { playAudio } from '@/lib/audio-utils';
import { T } from '@/lib/translation';

interface AudioPlayerProps {
  url: string;
  label?: string;
  className?: string;
}

export function AudioPlayer({ url, label, className }: AudioPlayerProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={() => playAudio(url)}
      aria-label={label || 'Listen'}
    >
      <T>Listen</T>
    </Button>
  );
}