'use client';

import { useTranslation, T } from '@/lib/translation';
import { DictionaryEntry } from '@/types';

interface WordTableProps {
  entries: DictionaryEntry[];
}

export function WordTable({ entries }: WordTableProps) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted/50">
          <tr>
            <th className="px-4 py-2 text-right text-sm font-semibold">
              <T>Word</T>
            </th>
            <th className="px-4 py-2 text-right text-sm font-semibold">
              <T>Root</T>
            </th>
            <th className="px-4 py-2 text-right text-sm font-semibold">
              <T>Type</T>
            </th>
            <th className="px-4 py-2 text-right text-sm font-semibold">
              <T>Meaning</T>
            </th>
          </tr>
        </thead>
        <tbody className="bg-background divide-y divide-border">
          {entries.length === 0 ? (
            <tr>
              <td colSpan={4} className="px-4 py-4 text-center text-muted-foreground">
                <T>No words found</T>
              </td>
            </tr>
          ) : (
            entries.map((entry) => (
              <tr key={entry.id}>
                <td className="px-4 py-2 font-medium">{entry.word}</td>
                <td className="px-4 py-2">{entry.root}</td>
                <td className="px-4 py-2">{entry.word_type || '-'}</td>
                <td className="px-4 py-2">
                  {entry.meanings && entry.meanings.length > 0 ? (
                    <span>{entry.meanings[0].definition}</span>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}