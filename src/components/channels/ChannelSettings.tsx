// ============================================================
// USTAWIENIA KANAŁÓW
// Zarządzanie listą kanałów — widoczność, ulubione, sortowanie.
// ============================================================

import { useState } from 'react';
import { Heart, Eye, EyeOff, RotateCcw, Star, ArrowLeft } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { CHANNEL_CATEGORY_LABELS, CHANNEL_CATEGORY_COLORS } from '../../data/channels';
import { ChannelCategory } from '../../types';
import clsx from 'clsx';

export function ChannelSettings() {
  const { channels, toggleFavoriteChannel, toggleChannelVisibility,
          setAllChannelsVisible, resetChannels, setActiveView } = useAppStore();

  const [activeCategory, setActiveCategory] = useState<ChannelCategory | 'all'>('all');

  // Grupy kategorii
  const categories = ['all', ...new Set(channels.map(c => c.category))] as (ChannelCategory | 'all')[];

  const filteredChannels = activeCategory === 'all'
    ? channels
    : channels.filter(c => c.category === activeCategory);

  const sortedChannels = [...filteredChannels].sort((a, b) => a.sortOrder - b.sortOrder);

  const visibleCount = channels.filter(c => c.isVisible).length;
  const favoriteCount = channels.filter(c => c.isFavorite).length;

  return (
    <div className="max-w-2xl mx-auto p-4">
      {/* Nagłówek */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={() => setActiveView('profile')}
          className="p-1.5 rounded-xl bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors flex-shrink-0"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Kanały</h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {visibleCount} widocznych · {favoriteCount} ulubionych
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setAllChannelsVisible(true)}
            className="text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-lg transition-colors"
          >
            Pokaż wszystkie
          </button>
          <button
            onClick={resetChannels}
            className="flex items-center gap-1 text-xs px-3 py-1.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-lg transition-colors"
          >
            <RotateCcw size={12} />
            Reset
          </button>
        </div>
      </div>

      {/* Filtry kategorii */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-4 no-scrollbar">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={clsx(
              'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap',
              activeCategory === cat
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
            )}
          >
            {cat === 'all' ? `Wszystkie (${channels.length})` : (
              `${CHANNEL_CATEGORY_LABELS[cat]} (${channels.filter(c => c.category === cat).length})`
            )}
          </button>
        ))}
      </div>

      {/* Lista kanałów */}
      <div className="space-y-1.5">
        {sortedChannels.map(channel => (
          <div
            key={channel.id}
            className={clsx(
              'flex items-center gap-3 px-4 py-3 rounded-xl border transition-all',
              channel.isVisible
                ? 'bg-white dark:bg-slate-800 border-gray-200 dark:border-slate-700'
                : 'bg-gray-50 dark:bg-gray-800/50 border-gray-100 dark:border-gray-700/50 opacity-60'
            )}
          >
            {/* Emoji/Logo */}
            <div className="w-10 h-10 rounded-lg bg-gray-50 dark:bg-gray-800 flex items-center justify-center text-xl flex-shrink-0">
              {channel.logoEmoji}
            </div>

            {/* Nazwa i kategoria */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
                  {channel.name}
                </span>
                {channel.isFavorite && (
                  <Star size={11} className="text-amber-400 fill-current flex-shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className={clsx(
                  'text-[10px] px-1.5 py-0.5 rounded-full',
                  CHANNEL_CATEGORY_COLORS[channel.category]
                )}>
                  {CHANNEL_CATEGORY_LABELS[channel.category]}
                </span>
                {channel.description && (
                  <span className="text-[11px] text-gray-400 dark:text-gray-500 truncate">
                    {channel.description}
                  </span>
                )}
              </div>
            </div>

            {/* Akcje */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Ulubiony */}
              <button
                onClick={() => toggleFavoriteChannel(channel.id)}
                title={channel.isFavorite ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}
                className={clsx(
                  'p-1.5 rounded-lg transition-colors',
                  channel.isFavorite
                    ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100'
                    : 'text-gray-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20'
                )}
              >
                <Heart size={15} className={channel.isFavorite ? 'fill-current' : ''} />
              </button>

              {/* Widoczność */}
              <button
                onClick={() => toggleChannelVisibility(channel.id)}
                title={channel.isVisible ? 'Ukryj w EPG' : 'Pokaż w EPG'}
                className={clsx(
                  'p-1.5 rounded-lg transition-colors',
                  channel.isVisible
                    ? 'text-primary-600 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100'
                    : 'text-gray-400 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-gray-700'
                )}
              >
                {channel.isVisible ? <Eye size={15} /> : <EyeOff size={15} />}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Legenda */}
      <div className="mt-6 p-4 bg-gray-50 dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700">
        <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">Legenda:</p>
        <div className="space-y-1.5 text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <Eye size={13} className="text-primary-500" />
            <span>Kanał widoczny w siatce EPG</span>
          </div>
          <div className="flex items-center gap-2">
            <EyeOff size={13} className="text-gray-400" />
            <span>Kanał ukryty w siatce EPG</span>
          </div>
          <div className="flex items-center gap-2">
            <Heart size={13} className="text-amber-400 fill-current" />
            <span>Kanał ulubiony (filtr "Tylko ulubione")</span>
          </div>
        </div>
      </div>
    </div>
  );
}
