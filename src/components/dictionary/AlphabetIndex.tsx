'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AlphabetIndexProps {
  selectedLetter: string | null;
  onLetterSelect: (letter: string | null) => void;
}

const ARABIC_LETTERS = [
  'ا', 'ب', 'ت', 'ث', 'ج', 'ح', 'خ', 'د', 'ذ', 'ر', 'ز', 'س', 'ش', 'ص',
  'ض', 'ط', 'ظ', 'ع', 'غ', 'ف', 'ق', 'ك', 'ل', 'م', 'ن', 'ه', 'و', 'ي',
];

export function AlphabetIndex({ selectedLetter, onLetterSelect }: AlphabetIndexProps) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 p-4">
      <Button
        variant={selectedLetter === null ? 'default' : 'outline'}
        size="sm"
        onClick={() => onLetterSelect(null)}
      >
        الكل
      </Button>
      {ARABIC_LETTERS.map((letter) => (
        <Button
          key={letter}
          variant={selectedLetter === letter ? 'default' : 'outline'}
          size="sm"
          className={cn('min-w-[2.5rem] text-lg font-bold')}
          onClick={() => onLetterSelect(letter)}
        >
          {letter}
        </Button>
      ))}
    </div>
  );
}