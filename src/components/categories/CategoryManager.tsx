// ============================================================
// MENADŻER KATEGORII NIESTANDARDOWYCH
// Pozwala tworzyć własne filtry, np. "Filmy niemieckie",
// "Tylko komedie", "Seriale HBO".
// ============================================================

import { useState } from 'react';
import { Plus, Trash2, Tag, ChevronDown, ChevronUp, Filter } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { Category, CategoryRule, RuleField, RuleOperator, ProgramGenre } from '../../types';
import { GENRE_LABELS } from '../ui/Badge';
import clsx from 'clsx';

// ── Opcje pól reguł ────────────────────────────────────────
const FIELD_LABELS: Record<RuleField, string> = {
  title:        'Tytuł',
  originalTitle: 'Tytuł oryginalny',
  genre:        'Gatunek',
  country:      'Kraj produkcji',
  description:  'Opis',
};

const OPERATOR_LABELS: Record<RuleOperator, string> = {
  contains:    'zawiera',
  notContains: 'nie zawiera',
  equals:      'jest równy',
  startsWith:  'zaczyna się od',
};

const PRESET_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#ef4444',
  '#f97316', '#eab308', '#22c55e', '#14b8a6',
  '#3b82f6', '#64748b',
];

// Przykładowe presety dla szybkiego tworzenia kategorii
const CATEGORY_PRESETS = [
  {
    name: 'Filmy niemieckie',
    rules: [{ field: 'genre' as RuleField, operator: 'equals' as RuleOperator, value: 'movie' },
            { field: 'country' as RuleField, operator: 'equals' as RuleOperator, value: 'DE' }],
    logic: 'AND' as const, color: '#64748b',
  },
  {
    name: 'Tylko komedie',
    rules: [{ field: 'description' as RuleField, operator: 'contains' as RuleOperator, value: 'komedi' }],
    logic: 'OR' as const, color: '#eab308',
  },
  {
    name: 'Polskie seriale',
    rules: [{ field: 'genre' as RuleField, operator: 'equals' as RuleOperator, value: 'series' },
            { field: 'country' as RuleField, operator: 'equals' as RuleOperator, value: 'PL' }],
    logic: 'AND' as const, color: '#ef4444',
  },
  {
    name: 'Sport na żywo',
    rules: [{ field: 'genre' as RuleField, operator: 'equals' as RuleOperator, value: 'sport' }],
    logic: 'AND' as const, color: '#22c55e',
  },
];

export function CategoryManager() {
  const { categories, addCategory, removeCategory, setFilters, filters } = useAppStore();
  const [showForm, setShowForm] = useState(false);

  return (
    <div className="max-w-2xl mx-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Moje kategorie
        </h2>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          <Plus size={16} />
          Nowa kategoria
        </button>
      </div>

      {/* Formularz tworzenia */}
      {showForm && (
        <CategoryForm onClose={() => setShowForm(false)} />
      )}

      {/* Presety */}
      {categories.length === 0 && !showForm && (
        <section className="mb-6">
          <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
            Szybki start — gotowe presety
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORY_PRESETS.map(preset => (
              <button
                key={preset.name}
                onClick={() => addCategory(preset.name, preset.color, preset.rules, preset.logic)}
                className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-slate-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-slate-700 rounded-xl text-left transition-colors group"
              >
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: preset.color }} />
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate">{preset.name}</span>
                <Plus size={14} className="ml-auto text-gray-400 group-hover:text-primary-500 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Lista kategorii */}
      {categories.length > 0 && (
        <div className="space-y-3">
          {categories.map(cat => (
            <CategoryCard
              key={cat.id}
              category={cat}
              isActive={filters.categoryId === cat.id}
              onActivate={() => setFilters({
                categoryId: filters.categoryId === cat.id ? undefined : cat.id
              })}
              onRemove={() => removeCategory(cat.id)}
            />
          ))}
        </div>
      )}

      {categories.length === 0 && !showForm && (
        <EmptyState onNew={() => setShowForm(true)} />
      )}
    </div>
  );
}

// ── Karta kategorii ────────────────────────────────────────

function CategoryCard({ category, isActive, onActivate, onRemove }: {
  category: Category;
  isActive: boolean;
  onActivate: () => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={clsx(
      'bg-white dark:bg-slate-800 rounded-xl border-2 transition-all',
      isActive
        ? 'border-primary-400 shadow-md shadow-primary-100 dark:shadow-primary-900/20'
        : 'border-gray-200 dark:border-slate-700'
    )}>
      <div className="p-4">
        <div className="flex items-center gap-3">
          {/* Kolor kategorii */}
          <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: category.color }} />

          {/* Nazwa */}
          <button onClick={onActivate} className="flex-1 text-left">
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{category.name}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              {category.rules.length} {category.rules.length === 1 ? 'reguła' : 'reguły'}
              {' • '}
              {category.ruleLogic === 'AND' ? 'Wszystkie muszą pasować' : 'Wystarczy jedna'}
            </p>
          </button>

          {/* Przycisk filtrowania */}
          <button
            onClick={onActivate}
            className={clsx(
              'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors',
              isActive
                ? 'bg-primary-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-primary-50 dark:hover:bg-primary-900/30'
            )}
          >
            <Filter size={12} />
            {isActive ? 'Aktywna' : 'Filtruj'}
          </button>

          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 rounded transition-colors"
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>

          <button
            onClick={onRemove}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Rozwinięte reguły */}
      {expanded && (
        <div className="border-t border-gray-100 dark:border-slate-700 px-4 pb-4 pt-3">
          <div className="space-y-1.5">
            {category.rules.map((rule, i) => (
              <div key={rule.id} className="flex items-center gap-2 text-xs">
                {i > 0 && (
                  <span className="text-gray-400 text-[10px] uppercase font-bold w-6 text-center">
                    {category.ruleLogic}
                  </span>
                )}
                {i === 0 && <span className="w-6" />}
                <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-300">
                  {FIELD_LABELS[rule.field]}
                </span>
                <span className="text-gray-400">{OPERATOR_LABELS[rule.operator]}</span>
                <span className="px-2 py-0.5 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 rounded font-medium">
                  {rule.field === 'genre' ? GENRE_LABELS[rule.value] || rule.value : rule.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Formularz nowej kategorii ──────────────────────────────

function CategoryForm({ onClose }: { onClose: () => void }) {
  const { addCategory } = useAppStore();
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET_COLORS[0]);
  const [logic, setLogic] = useState<'AND' | 'OR'>('AND');
  const [rules, setRules] = useState<Omit<CategoryRule, 'id'>[]>([
    { field: 'genre', operator: 'equals', value: 'movie' }
  ]);

  const addRule = () => {
    setRules(r => [...r, { field: 'title', operator: 'contains', value: '' }]);
  };

  const updateRule = (idx: number, updates: Partial<Omit<CategoryRule, 'id'>>) => {
    setRules(r => r.map((rule, i) => i === idx ? { ...rule, ...updates } : rule));
  };

  const removeRule = (idx: number) => {
    setRules(r => r.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    if (!name.trim() || rules.length === 0) return;
    const validRules = rules.filter(r => r.value.trim());
    if (validRules.length === 0) return;
    addCategory(name.trim(), color, validRules, logic);
    onClose();
  };

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl p-4 mb-4 animate-fade-in">
      <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Nowa kategoria</h3>

      {/* Nazwa */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Nazwa</label>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="np. Filmy niemieckie, Komedie romantyczne..."
          className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-slate-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Kolor */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Kolor</label>
        <div className="flex gap-2 flex-wrap">
          {PRESET_COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={clsx(
                'w-6 h-6 rounded-full transition-all',
                color === c ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-gray-800 scale-125' : 'hover:scale-110'
              )}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>

      {/* Logika reguł */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Warunek pasowania</label>
        <div className="flex gap-2">
          {(['AND', 'OR'] as const).map(l => (
            <button
              key={l}
              onClick={() => setLogic(l)}
              className={clsx(
                'px-3 py-1.5 text-xs rounded-lg border transition-colors',
                logic === l
                  ? 'bg-primary-600 text-white border-primary-600'
                  : 'border-gray-200 dark:border-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
              )}
            >
              {l === 'AND' ? 'Wszystkie reguły (AND)' : 'Dowolna reguła (OR)'}
            </button>
          ))}
        </div>
      </div>

      {/* Reguły */}
      <div className="mb-3">
        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Reguły filtrowania</label>
        <div className="space-y-2">
          {rules.map((rule, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <select
                value={rule.field}
                onChange={e => updateRule(idx, { field: e.target.value as RuleField })}
                className="text-xs border border-gray-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                {(Object.entries(FIELD_LABELS) as [RuleField, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>

              <select
                value={rule.operator}
                onChange={e => updateRule(idx, { operator: e.target.value as RuleOperator })}
                className="text-xs border border-gray-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
              >
                {(Object.entries(OPERATOR_LABELS) as [RuleOperator, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>

              {rule.field === 'genre' ? (
                <select
                  value={rule.value}
                  onChange={e => updateRule(idx, { value: e.target.value })}
                  className="flex-1 text-xs border border-gray-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                >
                  {(Object.entries(GENRE_LABELS) as [ProgramGenre, string][]).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={rule.value}
                  onChange={e => updateRule(idx, { value: e.target.value })}
                  placeholder={rule.field === 'country' ? 'np. DE, PL, USA' : 'Wpisz wartość...'}
                  className="flex-1 text-xs border border-gray-200 dark:border-slate-700 rounded-lg px-2 py-1.5 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              )}

              {rules.length > 1 && (
                <button
                  onClick={() => removeRule(idx)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>

        <button
          onClick={addRule}
          className="mt-2 flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 transition-colors"
        >
          <Plus size={12} />
          Dodaj regułę
        </button>
      </div>

      {/* Przyciski */}
      <div className="flex gap-2 mt-4">
        <button
          onClick={handleSave}
          disabled={!name.trim() || rules.every(r => !r.value.trim())}
          className="flex-1 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
        >
          Utwórz kategorię
        </button>
        <button
          onClick={onClose}
          className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors"
        >
          Anuluj
        </button>
      </div>
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mb-4">
        <Tag size={28} className="text-indigo-300 dark:text-indigo-600" />
      </div>
      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">
        Twórz własne filtry
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 max-w-xs mb-4">
        Kategorie pozwalają filtrować program TV według własnych reguł, np. "tylko polskie komedie" lub "filmy z USA".
      </p>
      <button
        onClick={onNew}
        className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors"
      >
        <Plus size={16} />
        Utwórz pierwszą kategorię
      </button>
    </div>
  );
}
