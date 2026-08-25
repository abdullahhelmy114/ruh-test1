'use client';

import { Button } from '@/components/ui/button';
import { T } from '@/lib/translation';
import { ViewMode } from '@/types';
import { cn } from '@/lib/utils';

interface ViewToggleProps {
  currentMode: ViewMode;
  onToggle: (mode: ViewMode) => void;
}

export function ViewToggle({ currentMode, onToggle }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-2 bg-muted p-1 rounded-lg w-fit mx-auto">
      <Button
        variant={currentMode === 'simple' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onToggle('simple')}
        className={cn('min-w-[80px]')}
      >
        <T>Simple</T>
      </Button>
      <Button
        variant={currentMode === 'advanced' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => onToggle('advanced')}
        className={cn('min-w-[80px]')}
      >
        <T>Advanced</T>
      </Button>
    </div>
  );
}