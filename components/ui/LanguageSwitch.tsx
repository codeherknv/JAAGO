'use client';

import React from 'react';
import { useTranslation, Language } from '@/lib/i18n';

export function LanguageSwitch({ className = '' }: { className?: string }) {
  const { lang, setLang } = useTranslation();

  return (
    <div
      role="radiogroup"
      aria-label="Language selection"
      className={`inline-flex items-center p-0.5 rounded-control bg-kerb border border-border ${className}`}
    >
      <button
        type="button"
        role="radio"
        aria-checked={lang === 'en'}
        onClick={() => setLang('en')}
        className={`min-h-[34px] px-2.5 py-1 text-xs font-heading font-semibold rounded-[6px] transition-colors ${
          lang === 'en'
            ? 'bg-white text-asphalt shadow-sm border border-border/80'
            : 'text-asphalt-muted hover:text-asphalt'
        }`}
      >
        English
      </button>

      <button
        type="button"
        role="radio"
        aria-checked={lang === 'kn'}
        onClick={() => setLang('kn')}
        className={`min-h-[34px] px-2.5 py-1 text-xs font-heading font-semibold rounded-[6px] transition-colors ${
          lang === 'kn'
            ? 'bg-white text-asphalt shadow-sm border border-border/80'
            : 'text-asphalt-muted hover:text-asphalt'
        }`}
      >
        ಕನ್ನಡ
      </button>
    </div>
  );
}
