'use client';

import { useTranslation, T } from '@/lib/translation';
import { DictionaryEntry } from '@/types';

interface AdvancedWordViewProps {
  entry: DictionaryEntry;
  onShowIrab?: () => void;
}

export function AdvancedWordView({ entry, onShowIrab }: AdvancedWordViewProps) {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold">{entry.word}</h2>
        <p className="text-lg text-muted-foreground">
          {entry.word_type || ''} {entry.root ? `• الجذر: ${entry.root}` : ''}
        </p>
        {onShowIrab && (
          <button
            onClick={onShowIrab}
            className="mt-2 text-sm bg-primary/10 hover:bg-primary/20 text-primary rounded px-3 py-1"
          >
            <T>Show Irab</T>
          </button>
        )}
      </div>

      <div>
        <h3 className="text-xl font-semibold mb-4">
          <T>Meanings</T>
        </h3>
        {entry.meanings.length === 0 ? (
          <p className="text-muted-foreground">
            <T>No meanings found</T>
          </p>
        ) : (
          <ul className="space-y-3">
            {entry.meanings.map((meaning, idx) => (
              <li key={idx} className="border rounded-lg p-4 bg-background shadow-elegant">
                <span className="font-medium">{idx + 1}.</span> {meaning.definition}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}