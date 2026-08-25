'use client';

import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/Spinner';
import { useTranslation } from '@/lib/translation';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  onSearch: (query: string) => void;
  suggestions?: string[];
  loading?: boolean;
}

export function SearchBar({ onSearch, suggestions = [], loading = false }: SearchBarProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handler = setTimeout(() => {
      onSearch(query);
    }, 300); // debounce
    return () => clearTimeout(handler);
  }, [query, onSearch]);

  const handleSuggestionClick = (suggestion: string) => {
    setQuery(suggestion);
    onSearch(suggestion);
    setFocused(false);
  };

  return (
    <div className="relative w-full max-w-xl mx-auto">
      <div className="relative">
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={t('Search')}
          className="pr-10"
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <Spinner className="h-4 w-4 text-muted-foreground" />
          </div>
        )}
      </div>
      {focused && suggestions.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full bg-background border border-input rounded-md shadow-lg max-h-60 overflow-auto">
          {suggestions.map((s, i) => (
            <li
              key={i}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSuggestionClick(s)}
              className="px-4 py-2 cursor-pointer hover:bg-accent"
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}