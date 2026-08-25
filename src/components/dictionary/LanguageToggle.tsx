'use client';

import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/translation';
import { Language } from '@/types';
import { cn } from '@/lib/utils';

export function LanguageToggle() {
  const { language, setLanguage } = useTranslation();

  return (
    <div className="flex items-center gap-1 bg-muted p-1 rounded-lg w-fit">
      <Button
        variant={language === 'en' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setLanguage('en')}
        className={cn('min-w-[48px]')}
      >
        EN
      </Button>
      <Button
        variant={language === 'tr' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => setLanguage('tr')}
        className={cn('min-w-[48px]')}
      >
        TR
      </Button>
    </div>
  );
}