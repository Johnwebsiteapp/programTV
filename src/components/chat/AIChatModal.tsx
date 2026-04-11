// ============================================================
// AI CHAT — Asystent programu TV oparty na Claude
// ============================================================

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { X, Send, Bot, User, Star, Tv, Loader2, AlertCircle, ExternalLink, ChevronDown, ChevronUp, Clock, Plus, Trash2, Check } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { batchSearchFilmweb, FilmwebData } from '../../api/filmwebApi';
import { sendChatMessage, ChatMessage, ChatFilters } from '../../api/chatApi';
import type { Program, Channel } from '../../types';
import clsx from 'clsx';

// ── Typy ──────────────────────────────────────────────────

interface SearchResult {
  program: Program;
  channel: Channel;
  filmweb: FilmwebData | null;
  dayLabel: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  results?: SearchResult[];
  searching?: boolean;
  searchProgress?: { done: number; total: number };
  error?: boolean;
}

// ── Stałe ─────────────────────────────────────────────────

const DAY_NAMES = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];

function getDayLabel(date: Date): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diff === 0) return 'Dziś';
  if (diff === 1) return 'Jutro';
  return DAY_NAMES[date.getDay()];
}

function formatTime(d: Date) {
  return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

function filmwebLink(fw: FilmwebData): string {
  const type = fw.type?.toLowerCase().includes('serial') ? 'serial' : 'film';
  const slug = fw.title.replace(/ /g, '+');
  return `https://www.filmweb.pl/${type}/${slug}-${fw.year}-${fw.id}`;
}

// ── Wyszukiwanie ──────────────────────────────────────────

async function runSearch(
  filters: ChatFilters,
  programs: Program[],
  channels: Channel[],
  onProgress: (done: number, total: number) => void
): Promise<SearchResult[]> {
  const now = new Date();
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(todayStart.getTime() + (filters.weekOffset ?? 0) * 7 * 24 * 60 * 60 * 1000);
  const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const visibleChannelIds = new Set(channels.filter(c => c.isVisible).map(c => c.id));

  const candidates = programs.filter(p => {
    if (!visibleChannelIds.has(p.channelId)) return false;
    if (p.startTime < weekStart || p.startTime >= weekEnd) return false;
    if (p.endTime < now) return false; // skip already ended
    if (filters.selectedDays?.length) {
      if (!filters.selectedDays.includes(getDayLabel(p.startTime))) return false;
    }
    if (filters.types.includes('film') && p.genre === 'movie') return true;
    if (filters.types.includes('serial') && p.genre === 'series') return true;
    return false;
  });

  const uniqueTitles = [...new Set(candidates.map(p => p.title))];
  const filmwebMap = await batchSearchFilmweb(uniqueTitles, onProgress);

  const results: SearchResult[] = [];
  const RATING_TOLERANCE = 0.6;

  for (const program of candidates) {
    const fw = filmwebMap[program.title] ?? null;
    const ch = channels.find(c => c.id === program.channelId);
    if (!ch) continue;

    // Filtr oceny
    if (filters.minRating > 0 && fw?.rate != null) {
      if (fw.rate < filters.minRating - RATING_TOLERANCE) continue;
    }
    // Filtr roku
    if (filters.minYear > 0 && fw?.year != null && fw.year < filters.minYear) continue;

    // Wymagane gatunki
    if (filters.includedGenres?.length && fw?.genres?.length) {
      const matches = filters.includedGenres.some(ig =>
        fw.genres.some(g => g.toLowerCase().includes(ig.toLowerCase()))
      );
      if (!matches) continue;
    }

    // Wykluczone gatunki
    if (filters.excludedGenres?.length && fw?.genres?.length) {
      if (filters.excludedGenres.some(eg =>
        fw.genres.some(g => g.toLowerCase().includes(eg.toLowerCase()))
      )) continue;
    }

    // Wykluczone kraje
    if (filters.excludedCountries?.length && fw?.countries?.length) {
      if (filters.excludedCountries.some(ec =>
        fw.countries.some(c => c.toLowerCase().includes(ec.toLowerCase()))
      )) continue;
    }

    results.push({ program, channel: ch, filmweb: fw, dayLabel: getDayLabel(program.startTime) });
  }

  results.sort((a, b) => {
    const ra = a.filmweb?.rate ?? 0;
    const rb = b.filmweb?.rate ?? 0;
    if (rb !== ra) return rb - ra;
    return a.program.startTime.getTime() - b.program.startTime.getTime();
  });

  return results;
}

// ── Props ─────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

// ── Komponent główny ──────────────────────────────────────

export function AIChatModal({ onClose }: Props) {
  const { programs, channels, setSelectedProgram, chatSuggestions, setChatSuggestions } = useAppStore();

  // Zamroź wysokość przy montowaniu — klawiatura mobilna nie zmieni rozmiaru modalu
  // visualViewport.height daje dokładniejszy wynik na Android Chrome
  const [sheetHeight] = useState(() => {
    const h = window.visualViewport?.height ?? window.innerHeight;
    return Math.round(h * 0.88);
  });

  // Animacja wejścia/wyjścia
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    const f1 = requestAnimationFrame(() => {
      const f2 = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(f2);
    });
    return () => cancelAnimationFrame(f1);
  }, []);
  const handleClose = () => { setClosing(true); setTimeout(onClose, 320); };
  const sheetVisible = visible && !closing;

  // Blokada scrolla tła
  useEffect(() => {
    const scrollY = window.scrollY;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';
    return () => {
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.width = '';
      window.scrollTo(0, scrollY);
    };
  }, []);

  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome',
    role: 'assistant',
    content: 'Cześć! Jestem asystentem TV Stream. Mogę przeszukać program TV i znaleźć filmy lub seriale według Twoich preferencji.\n\nNp. "filmy akcji od 2020 z oceną powyżej 7" albo "co dobrego jest dziś wieczór na TVP?"',
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Historia dla API (tylko role+content bez results)
  const apiHistory = useCallback((): ChatMessage[] => {
    return messages
      .filter(m => m.id !== 'welcome' && !m.error)
      .map(m => ({ role: m.role, content: m.content }));
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages]);

  const updateMessage = (id: string, updates: Partial<Message>) => {
    setMessages(prev => prev.map(m => m.id === id ? { ...m, ...updates } : m));
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || loading) return;

    setInput('');
    setLoading(true);

    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text };
    const assistantId = crypto.randomUUID();
    const assistantMsg: Message = { id: assistantId, role: 'assistant', content: '', searching: false };

    setMessages(prev => [...prev, userMsg, assistantMsg]);

    try {
      // 1. Wyślij do AI
      const { reply, filters } = await sendChatMessage(text, apiHistory());

      updateMessage(assistantId, { content: reply });

      // 2. Jeśli są filtry — uruchom wyszukiwanie
      if (filters) {
        updateMessage(assistantId, { searching: true, searchProgress: { done: 0, total: 0 } });

        const results = await runSearch(
          filters,
          programs,
          channels,
          (done, total) => updateMessage(assistantId, { searchProgress: { done, total } })
        );

        updateMessage(assistantId, { results, searching: false });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Nieznany błąd';
      updateMessage(assistantId, {
        content: `Przepraszam, wystąpił błąd: ${msg}`,
        error: true,
        searching: false,
      });
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      {/* Backdrop */}
      <div
        className={clsx('absolute inset-0 bg-black/60 backdrop-blur-sm modal-backdrop', sheetVisible ? 'modal-visible' : 'modal-hidden')}
        style={{ touchAction: 'none' }}
        onClick={handleClose}
      />

      {/* Sheet */}
      <div
        className={clsx(
          'relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-t-3xl shadow-2xl flex flex-col sheet-panel',
          sheetVisible ? 'sheet-visible' : 'sheet-hidden'
        )}
        style={{ height: sheetHeight, overscrollBehavior: 'contain' }}
      >
        {/* Nagłówek */}
        <div className="flex-shrink-0 flex items-center gap-3 px-4 pt-4 pb-3 border-b border-gray-100 dark:border-slate-800">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center flex-shrink-0">
            <Bot size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-sm text-gray-900 dark:text-white">Asystent TV</p>
            <p className="text-[11px] text-gray-400">Powered by Groq AI</p>
          </div>
          <button
            onClick={handleClose}
            className="w-8 h-8 rounded-full bg-gray-100 dark:bg-slate-800 flex items-center justify-center text-gray-500"
          >
            <X size={16} style={{ pointerEvents: 'none' }} />
          </button>
        </div>

        {/* Wiadomości */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4 min-h-0" style={{ WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
          {messages.map(msg => (
            <ChatBubble
              key={msg.id}
              message={msg}
              onOpenProgram={setSelectedProgram}
            />
          ))}

          {/* Sugerowane zapytania — widoczne tylko gdy brak wiadomości użytkownika */}
          {messages.length === 1 && !loading && (
            <SuggestionsPanel
              suggestions={chatSuggestions}
              onSelect={(s) => { setInput(s); inputRef.current?.focus(); }}
              onSave={setChatSuggestions}
            />
          )}

          {/* Wskaźnik ładowania AI */}
          {loading && messages[messages.length - 1]?.content === '' && !messages[messages.length - 1]?.searching && (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Loader2 size={14} className="animate-spin" />
              <span>Asystent myśli...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 px-4 pt-3 border-t border-gray-100 dark:border-slate-800"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
          <div className="flex gap-2 items-end">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Np. filmy akcji od 2020 z oceną powyżej 7..."
              disabled={loading}
              className="flex-1 px-4 py-3 text-base rounded-2xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-500 disabled:opacity-50 transition-all"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center text-white disabled:opacity-40 transition-all active:scale-95 flex-shrink-0"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Bąbelek wiadomości ────────────────────────────────────

function ChatBubble({ message, onOpenProgram }: {
  message: Message;
  onOpenProgram: (p: Program) => void;
}) {
  const isUser = message.role === 'user';

  return (
    <div className={clsx('flex gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div className={clsx(
        'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
        isUser
          ? 'bg-violet-100 dark:bg-violet-900/30'
          : 'bg-gradient-to-br from-violet-500 to-purple-700'
      )}>
        {isUser
          ? <User size={14} className="text-violet-600 dark:text-violet-400" />
          : <Bot size={14} className="text-white" />
        }
      </div>

      <div className={clsx('max-w-[85%] flex flex-col gap-2', isUser ? 'items-end' : 'items-start')}>
        {/* Tekst wiadomości */}
        {message.content && (
          <div className={clsx(
            'px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed',
            isUser
              ? 'bg-violet-600 text-white rounded-tr-sm'
              : message.error
              ? 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-tl-sm'
              : 'bg-gray-100 dark:bg-slate-800 text-gray-900 dark:text-gray-100 rounded-tl-sm'
          )}>
            {message.error && <AlertCircle size={13} className="inline mr-1.5" />}
            {message.content.split('\n').map((line, i) => (
              <span key={i}>{line}{i < message.content.split('\n').length - 1 && <br />}</span>
            ))}
          </div>
        )}

        {/* Pasek postępu wyszukiwania */}
        {message.searching && (
          <div className="bg-gray-100 dark:bg-slate-800 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2 w-full">
            <Loader2 size={13} className="animate-spin flex-shrink-0 text-violet-500" />
            <span>
              {message.searchProgress && message.searchProgress.total > 0
                ? `Sprawdzam Filmweb: ${message.searchProgress.done}/${message.searchProgress.total}...`
                : 'Przygotowuję wyszukiwanie...'}
            </span>
          </div>
        )}

        {/* Wyniki wyszukiwania */}
        {message.results !== undefined && !message.searching && (
          <SearchResults results={message.results} onOpen={onOpenProgram} />
        )}
      </div>
    </div>
  );
}

// ── Wyniki wyszukiwania ───────────────────────────────────

function SearchResults({ results, onOpen }: {
  results: SearchResult[];
  onOpen: (p: Program) => void;
}) {
  const [expandedTitles, setExpandedTitles] = useState<Set<string>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [imdbUrls, setImdbUrls] = useState<Record<string, string>>({});
  const MAX_PREVIEW = 5;

  if (results.length === 0) {
    return (
      <div className="bg-gray-100 dark:bg-slate-800 rounded-2xl rounded-tl-sm px-3.5 py-3 text-sm text-gray-500 dark:text-gray-400 flex items-center gap-2">
        <Tv size={14} className="flex-shrink-0" />
        Brak wyników dla podanych kryteriów. Spróbuj zmienić filtry.
      </div>
    );
  }

  // Dla tytułów bez Filmweb — sprawdź IMDb
  useEffect(() => {
    const titlesWithoutFilmweb = [...new Set(
      results.filter(r => r.filmweb === null).map(r => r.program.title)
    )];
    if (titlesWithoutFilmweb.length === 0) return;
    let cancelled = false;
    Promise.all(
      titlesWithoutFilmweb.map(async (title) => {
        try {
          const res = await fetch(`/api/imdb/search?title=${encodeURIComponent(title)}`);
          const json = await res.json();
          if (json.imdbUrl) return [title, json.imdbUrl] as [string, string];
        } catch {}
        return null;
      })
    ).then(entries => {
      if (cancelled) return;
      const found: Record<string, string> = {};
      for (const e of entries) { if (e) found[e[0]] = e[1]; }
      if (Object.keys(found).length > 0) setImdbUrls(prev => ({ ...prev, ...found }));
    });
    return () => { cancelled = true; };
  }, [results]);

  // Grupuj po tytule
  const groups = (() => {
    const map = new Map<string, SearchResult[]>();
    for (const r of results) {
      const key = r.program.title;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    }
    return [...map.entries()].map(([title, items]) => ({ title, items }));
  })();

  const shownGroups = showAll ? groups : groups.slice(0, MAX_PREVIEW);
  const uniqueCount = groups.length;

  const toggleTitle = (title: string) => {
    setExpandedTitles(prev => {
      const next = new Set(prev);
      next.has(title) ? next.delete(title) : next.add(title);
      return next;
    });
  };

  return (
    <div className="w-full bg-gray-50 dark:bg-slate-800/60 rounded-2xl rounded-tl-sm overflow-hidden border border-gray-200 dark:border-slate-700">
      {/* Nagłówek */}
      <div className="px-3.5 py-2 bg-violet-600 flex items-center gap-2">
        <Tv size={13} className="text-white/80" />
        <span className="text-sm font-bold text-white">
          {uniqueCount === 1 ? '1 tytuł' : `${uniqueCount} tytułów`}
          {results.length !== uniqueCount && (
            <span className="font-normal opacity-80"> · {results.length} emisji</span>
          )}
        </span>
      </div>

      {/* Lista zgrupowana */}
      <div className="divide-y divide-gray-100 dark:divide-slate-700">
        {shownGroups.map(({ title, items }) => {
          const { filmweb, channel } = items[0];
          const isExpanded = expandedTitles.has(title);
          return (
            <div key={title}>
              {/* Karta tytułu */}
              <button
                onClick={() => toggleTitle(title)}
                className="w-full text-left px-3.5 py-2.5 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors flex items-start gap-2.5"
              >
                <span className="text-lg flex-shrink-0 mt-0.5">{channel.logoEmoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-gray-900 dark:text-white truncate">{title}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {filmweb ? (
                      <>
                        {filmweb.rate != null && (
                          <span className="flex items-center gap-0.5 text-sm font-bold text-amber-500">
                            <Star size={12} className="fill-amber-400 text-amber-400" />
                            {filmweb.rate.toFixed(1)}
                          </span>
                        )}
                        {filmweb.year && <span className="text-sm text-gray-400">{filmweb.year}</span>}
                        {filmweb.genres.slice(0, 2).map(g => (
                          <span key={g} className="text-xs px-2 py-0.5 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 rounded-full capitalize">{g}</span>
                        ))}
                        <a
                          href={filmwebLink(filmweb)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="ml-auto flex-shrink-0 flex flex-col items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-[#FFCD05] to-[#D89124] shadow-sm hover:shadow-md active:scale-95 transition-all"
                        >
                          <img src="/filmweb-logo.svg" alt="" className="w-8 h-8 drop-shadow-sm" />
                          <span className="text-[8px] font-black text-[#7A4800] tracking-wide leading-none">FILMWEB</span>
                        </a>
                      </>
                    ) : imdbUrls[title] ? (
                      <a
                        href={imdbUrls[title]}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="ml-auto flex-shrink-0 flex flex-col items-center justify-center w-14 h-14 rounded-2xl bg-[#F5C518] shadow-sm hover:shadow-md active:scale-95 transition-all"
                      >
                        <span className="text-[15px] font-black text-black leading-none">IMDb</span>
                        <span className="text-[8px] font-bold text-black/60 mt-0.5">otwórz</span>
                      </a>
                    ) : null}
                  </div>
                  {/* Liczba emisji */}
                  <div className="flex items-center gap-1 mt-1.5">
                    <Clock size={12} className="text-violet-500" />
                    <span className="text-sm text-violet-600 dark:text-violet-400 font-medium">
                      {items.length === 1 ? '1 emisja' : `${items.length} emisje/i`}
                    </span>
                  </div>
                </div>
                {isExpanded
                  ? <ChevronUp size={15} className="text-gray-400 flex-shrink-0 mt-1" />
                  : <ChevronDown size={15} className="text-gray-400 flex-shrink-0 mt-1" />
                }
              </button>

              {/* Rozwinięte emisje */}
              {isExpanded && (
                <div className="bg-gray-100/60 dark:bg-slate-700/40 divide-y divide-gray-200 dark:divide-slate-600">
                  {items.map(({ program, channel: ch, dayLabel }) => (
                    <button
                      key={program.id}
                      onClick={() => onOpen(program)}
                      className="w-full text-left px-5 py-2 hover:bg-violet-50 dark:hover:bg-violet-900/20 transition-colors flex items-center gap-2.5"
                    >
                      <span className="text-lg flex-shrink-0">{ch.logoEmoji}</span>
                      <span className="text-sm font-bold text-violet-600 dark:text-violet-400 w-12 flex-shrink-0">{dayLabel}</span>
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">{formatTime(program.startTime)}</span>
                      <span className="text-sm text-gray-400 truncate">{ch.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Pokaż więcej tytułów */}
      {groups.length > MAX_PREVIEW && (
        <button
          onClick={() => setShowAll(e => !e)}
          className="w-full py-2.5 text-sm font-semibold text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/10 transition-colors border-t border-gray-200 dark:border-slate-700"
        >
          {showAll ? 'Pokaż mniej ↑' : `Pokaż wszystkie ${uniqueCount} tytuły ↓`}
        </button>
      )}
    </div>
  );
}

// ── Panel własnych podpowiedzi ────────────────────────────

function SuggestionsPanel({ suggestions, onSelect, onSave }: {
  suggestions: string[];
  onSelect: (s: string) => void;
  onSave: (s: string[]) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [editMode, setEditMode] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleAdd = () => {
    const trimmed = draft.trim();
    if (!trimmed) { setAdding(false); return; }
    onSave([...suggestions, trimmed]);
    setDraft('');
    setAdding(false);
  };

  const handleDelete = (idx: number) => {
    onSave(suggestions.filter((_, i) => i !== idx));
  };

  return (
    <div className="flex flex-col gap-2 pt-1">
      <div className="flex items-center justify-between px-1">
        <p className="text-[11px] text-gray-400 dark:text-gray-500 font-medium">
          {suggestions.length > 0 ? 'Twoje skróty:' : 'Dodaj własne skróty zapytań:'}
        </p>
        {suggestions.length > 0 && (
          <button
            onClick={() => setEditMode(e => !e)}
            className={clsx(
              'text-[11px] font-semibold px-2 py-0.5 rounded-full transition-colors',
              editMode
                ? 'text-red-500 bg-red-50 dark:bg-red-900/20'
                : 'text-gray-400 hover:text-violet-600'
            )}
          >
            {editMode ? 'Gotowe' : 'Edytuj'}
          </button>
        )}
      </div>

      {suggestions.map((s, idx) => (
        <div key={idx} className="flex items-center gap-2">
          <button
            onClick={() => !editMode && onSelect(s)}
            className={clsx(
              'flex-1 text-left text-sm px-3.5 py-2.5 rounded-2xl rounded-tl-sm border transition-colors',
              editMode
                ? 'bg-gray-100 dark:bg-slate-800 text-gray-400 border-gray-200 dark:border-slate-700 cursor-default'
                : 'bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-slate-700 hover:bg-violet-50 dark:hover:bg-violet-900/20 hover:text-violet-700 dark:hover:text-violet-300 hover:border-violet-300 dark:hover:border-violet-700'
            )}
          >
            {s}
          </button>
          {editMode && (
            <button
              onClick={() => handleDelete(idx)}
              className="w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30 text-red-500 hover:bg-red-200 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}

      {adding ? (
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') { setAdding(false); setDraft(''); } }}
            placeholder="Np. filmy SF od 2020..."
            maxLength={80}
            className="flex-1 text-sm px-3.5 py-2.5 rounded-2xl border-2 border-violet-500 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 outline-none"
          />
          <button
            onClick={handleAdd}
            className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-full bg-violet-600 text-white hover:bg-violet-700 transition-colors"
          >
            <Check size={16} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => { setAdding(true); setEditMode(false); }}
          className="flex items-center gap-2 px-3.5 py-2.5 rounded-2xl border-2 border-dashed border-gray-300 dark:border-slate-600 text-gray-400 dark:text-gray-500 hover:border-violet-400 hover:text-violet-500 transition-colors text-sm"
        >
          <Plus size={15} />
          Dodaj skrót
        </button>
      )}
    </div>
  );
}
