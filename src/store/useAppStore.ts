// ============================================================
// STORE APLIKACJI — zarządzanie stanem (Zustand)
//
// Zustand to prosta i wydajna biblioteka do zarządzania stanem.
// Zastępuje Redux dla mniejszych i średnich aplikacji.
// Dane są automatycznie zapisywane w localStorage (persist).
// ============================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  Channel, Program, Favorite, Notification, Category,
  FilterOptions, AppView, CategoryRule
} from '../types';
import { CHANNELS } from '../data/channels';
import { fetchPrograms } from '../api/tvGuideApi';

// ─── TYPY ─────────────────────────────────────────────────

export interface ChatShortcut {
  label: string;   // tekst wyświetlany na przycisku
  query: string;   // zapytanie wysyłane do AI
}

// ─── TYPY STANU ───────────────────────────────────────────

interface AppState {
  // ── DANE ──────────────────────────────────────────────
  channels: Channel[];          // Lista kanałów
  programs: Program[];          // Wszystkie załadowane programy

  // ── WIDOK ─────────────────────────────────────────────
  activeView: AppView;          // Aktywny widok aplikacji
  currentDate: Date;            // Wybrany dzień w siatce EPG
  darkMode: boolean;            // Tryb ciemny
  epgScrollToNow: boolean;      // Trigger - przewiń EPG do teraz

  // ── FILTRY I WYSZUKIWANIE ─────────────────────────────
  filters: FilterOptions;
  selectedProgram: Program | null; // Wybrany program (otwórz modal)
  selectedChannel: Channel | null; // Wybrany kanał (otwórz panel kanału)

  // ── MODALNE ───────────────────────────────────────────
  showSmartFilter: boolean;
  showAIChat: boolean;

  // ── DANE UŻYTKOWNIKA (persystowane) ──────────────────
  nickname: string;                // Pseudonim użytkownika
  chatSuggestions: ChatShortcut[]; // Własne podpowiedzi w asystencie AI
  favorites: Favorite[];           // Ulubione programy
  notifications: Notification[];   // Zaplanowane powiadomienia
  categories: Category[];          // Niestandardowe kategorie

  // ── AKCJE ─────────────────────────────────────────────
  // Kanały
  toggleFavoriteChannel: (channelId: string) => void;
  toggleChannelVisibility: (channelId: string) => void;
  setAllChannelsVisible: (visible: boolean) => void;
  resetChannels: () => void;

  // Widok i nawigacja
  setActiveView: (view: AppView) => void;
  setCurrentDate: (date: Date) => void;
  toggleDarkMode: () => void;
  setSelectedProgram: (program: Program | null) => void;
  setSelectedChannel: (channel: Channel | null) => void;
  triggerScrollToNow: () => void;
  setShowSmartFilter: (v: boolean) => void;
  setShowAIChat: (v: boolean) => void;

  // Filtry
  setFilters: (filters: Partial<FilterOptions>) => void;
  resetFilters: () => void;

  // Ulubione programy
  addFavorite: (program: Program) => void;
  removeFavorite: (favoriteId: string) => void;
  toggleFavoriteWatched: (favoriteId: string) => void;
  isFavoriteProgram: (programId: string) => boolean;

  // Powiadomienia
  addNotification: (program: Program, minutesBefore: number) => void;
  removeNotification: (notificationId: string) => void;
  markNotificationFired: (notificationId: string) => void;
  hasNotification: (programId: string) => boolean;

  // Onboarding
  hasSeenWelcome: boolean;
  setHasSeenWelcome: () => void;

  // Nickname
  setNickname: (name: string) => void;

  // Chat suggestions
  setChatSuggestions: (suggestions: ChatShortcut[]) => void;

  // Kategorie
  addCategory: (name: string, color: string, rules: Omit<CategoryRule, 'id'>[], logic: 'AND' | 'OR') => void;
  updateCategory: (id: string, updates: Partial<Pick<Category, 'name' | 'color' | 'rules' | 'ruleLogic'>>) => void;
  removeCategory: (id: string) => void;

  // Programy — wewnętrzne
  loadPrograms: () => void;
}

// ─── DOMYŚLNE FILTRY ──────────────────────────────────────

const DEFAULT_FILTERS: FilterOptions = {
  genres: [],
  country: undefined,
  searchQuery: '',
  showOnlyFavoriteChannels: false,
  categoryId: undefined,
  showOnlyLive: false,
};

// ─── TWORZENIE STORE ──────────────────────────────────────

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // ── Stan początkowy ────────────────────────────────
      channels: CHANNELS,
      programs: [],

      activeView: 'home',
      currentDate: new Date(),
      darkMode: window.matchMedia('(prefers-color-scheme: dark)').matches,
      epgScrollToNow: false,

      filters: DEFAULT_FILTERS,
      selectedProgram: null,
      selectedChannel: null,
      showSmartFilter: false,
      showAIChat: false,

      nickname: '',
      chatSuggestions: [],
      hasSeenWelcome: false,
      favorites: [],
      notifications: [],
      categories: [],

      // ── Ładowanie programów ────────────────────────────
      loadPrograms: () => {
        // Pobieramy dane z backendu (onet.pl) asynchronicznie
        fetchPrograms(get().channels).then(programs => {
          set({ programs });
        }).catch(err => {
          console.error('[Store] Nie udało się załadować programów:', err);
        });
      },

      // ── Kanały ────────────────────────────────────────
      toggleFavoriteChannel: (channelId) =>
        set(state => ({
          channels: state.channels.map(ch =>
            ch.id === channelId ? { ...ch, isFavorite: !ch.isFavorite } : ch
          ),
        })),

      toggleChannelVisibility: (channelId) =>
        set(state => ({
          channels: state.channels.map(ch =>
            ch.id === channelId ? { ...ch, isVisible: !ch.isVisible } : ch
          ),
        })),

      setAllChannelsVisible: (visible) =>
        set(state => ({
          channels: state.channels.map(ch => ({ ...ch, isVisible: visible })),
        })),

      resetChannels: () =>
        set({ channels: CHANNELS }),

      // ── Widok i nawigacja ─────────────────────────────
      setActiveView: (view) => set({ activeView: view }),
      setShowSmartFilter: (v) => set({ showSmartFilter: v }),
      setShowAIChat: (v) => set({ showAIChat: v }),

      setCurrentDate: (date) => set({ currentDate: date }),

      toggleDarkMode: () =>
        set(state => {
          const newMode = !state.darkMode;
          // Dodaj/usuń klasę 'dark' z <html>
          document.documentElement.classList.toggle('dark', newMode);
          return { darkMode: newMode };
        }),

      setHasSeenWelcome: () => set({ hasSeenWelcome: true }),
      setNickname: (name) => set({ nickname: name.trim() }),
      setChatSuggestions: (suggestions) => set({ chatSuggestions: suggestions }),

      setSelectedProgram: (program) => set({ selectedProgram: program }),
      setSelectedChannel: (channel) => set({ selectedChannel: channel }),

      triggerScrollToNow: () =>
        set({ epgScrollToNow: true }, false),

      // ── Filtry ────────────────────────────────────────
      setFilters: (newFilters) =>
        set(state => ({
          filters: { ...state.filters, ...newFilters },
        })),

      resetFilters: () => set({ filters: DEFAULT_FILTERS }),

      // ── Ulubione programy ─────────────────────────────
      addFavorite: (program) =>
        set(state => {
          // Nie dodawaj duplikatów
          if (state.favorites.some(f => f.programId === program.id)) {
            return state;
          }
          const favorite: Favorite = {
            id: `fav_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            programId: program.id,
            program,
            addedAt: new Date(),
            watched: false,
          };
          return { favorites: [...state.favorites, favorite] };
        }),

      removeFavorite: (favoriteId) =>
        set(state => ({
          favorites: state.favorites.filter(f => f.id !== favoriteId),
        })),

      toggleFavoriteWatched: (favoriteId) =>
        set(state => ({
          favorites: state.favorites.map(f =>
            f.id === favoriteId ? { ...f, watched: !f.watched } : f
          ),
        })),

      isFavoriteProgram: (programId) =>
        get().favorites.some(f => f.programId === programId),

      // ── Powiadomienia ─────────────────────────────────
      addNotification: (program, minutesBefore) => {
        // Oblicz czas wysłania powiadomienia
        const scheduledAt = new Date(
          program.startTime.getTime() - minutesBefore * 60 * 1000
        );
        // Nie twórz powiadomień dla przeszłości
        if (scheduledAt < new Date()) return;

        set(state => {
          // Usuń istniejące powiadomienie dla tego programu jeśli istnieje
          const filtered = state.notifications.filter(
            n => n.programId !== program.id
          );
          const notification: Notification = {
            id: `notif_${Date.now()}_${Math.random().toString(36).slice(2)}`,
            programId: program.id,
            program,
            minutesBefore,
            scheduledAt,
            fired: false,
            dismissed: false,
            createdAt: new Date(),
          };
          return { notifications: [...filtered, notification] };
        });
      },

      removeNotification: (notificationId) =>
        set(state => ({
          notifications: state.notifications.filter(n => n.id !== notificationId),
        })),

      markNotificationFired: (notificationId) =>
        set(state => ({
          notifications: state.notifications.map(n =>
            n.id === notificationId ? { ...n, fired: true } : n
          ),
        })),

      hasNotification: (programId) =>
        get().notifications.some(n => n.programId === programId && !n.fired),

      // ── Kategorie ─────────────────────────────────────
      addCategory: (name, color, rulesWithoutId, logic) => {
        const rules: CategoryRule[] = rulesWithoutId.map(r => ({
          ...r,
          id: `rule_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        }));
        const category: Category = {
          id: `cat_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          name,
          color,
          rules,
          ruleLogic: logic,
          createdAt: new Date(),
        };
        set(state => ({
          categories: [...state.categories, category],
        }));
      },

      updateCategory: (id, updates) =>
        set(state => ({
          categories: state.categories.map(c =>
            c.id === id ? { ...c, ...updates } : c
          ),
        })),

      removeCategory: (id) =>
        set(state => ({
          categories: state.categories.filter(c => c.id !== id),
        })),
    }),

    // ── Konfiguracja persystencji (localStorage) ──────
    {
      name: 'tv-guide-storage',
      storage: createJSONStorage(() => localStorage),
      // Zapisuj tylko dane użytkownika, nie programy (są regenerowane)
      partialize: (state) => ({
        channels: state.channels,
        favorites: state.favorites,
        notifications: state.notifications,
        categories: state.categories,
        darkMode: state.darkMode,
        filters: state.filters,
        nickname: state.nickname,
        chatSuggestions: state.chatSuggestions,
        hasSeenWelcome: state.hasSeenWelcome,
      }),
      // Odtwarzanie dat po deserializacji z JSON
      onRehydrateStorage: () => (state) => {
        if (!state) return;

        // Usuń kanały których już nie ma w CHANNELS (zostały skasowane)
        const validIds = new Set(CHANNELS.map(ch => ch.id));
        state.channels = state.channels.filter(ch => validIds.has(ch.id));

        // Dołącz nowe kanały z CHANNELS których jeszcze nie ma w zapisanym stanie
        const savedIds = new Set(state.channels.map(ch => ch.id));
        const newChannels = CHANNELS.filter(ch => !savedIds.has(ch.id));
        if (newChannels.length > 0) {
          state.channels = [...state.channels, ...newChannels];
        }

        // Daty są serializowane jako string — przywróć je jako Date
        state.favorites = state.favorites.map(f => ({
          ...f,
          addedAt: new Date(f.addedAt),
          program: {
            ...f.program,
            startTime: new Date(f.program.startTime),
            endTime: new Date(f.program.endTime),
          },
        }));
        state.notifications = state.notifications.map(n => ({
          ...n,
          scheduledAt: new Date(n.scheduledAt),
          createdAt: new Date(n.createdAt),
          program: {
            ...n.program,
            startTime: new Date(n.program.startTime),
            endTime: new Date(n.program.endTime),
          },
        }));
        state.categories = state.categories.map(c => ({
          ...c,
          createdAt: new Date(c.createdAt),
        }));
        // Przywróć tryb ciemny
        if (state.darkMode) {
          document.documentElement.classList.add('dark');
        }
      },
    }
  )
);

// ─── SELEKTORY (pomocnicze funkcje do pobierania danych) ──

/**
 * Zwraca kanały do wyświetlenia w EPG (widoczne + opcjonalnie tylko ulubione)
 */
export function selectVisibleChannels(state: AppState): Channel[] {
  let channels = state.channels.filter(ch => ch.isVisible);
  if (state.filters.showOnlyFavoriteChannels) {
    channels = channels.filter(ch => ch.isFavorite);
  }
  return channels.sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Sprawdza czy program pasuje do aktywnych filtrów
 */
export function programMatchesFilters(
  program: Program,
  filters: FilterOptions,
  categories: Category[],
  now: Date = new Date()
): boolean {
  // Filtr gatunku
  if (filters.genres.length > 0 && !filters.genres.includes(program.genre)) {
    return false;
  }

  // Filtr kraju
  if (filters.country && program.country !== filters.country) {
    return false;
  }

  // Filtr "tylko na żywo"
  if (filters.showOnlyLive && !(program.startTime <= now && program.endTime > now)) {
    return false;
  }

  // Filtr kategorii niestandardowej
  if (filters.categoryId) {
    const category = categories.find(c => c.id === filters.categoryId);
    if (category && !programMatchesCategory(program, category)) {
      return false;
    }
  }

  // Filtr wyszukiwania tekstowego
  if (filters.searchQuery) {
    const query = filters.searchQuery.toLowerCase();
    const titleMatch = program.title.toLowerCase().includes(query);
    const originalTitleMatch = program.originalTitle?.toLowerCase().includes(query) ?? false;
    const descMatch = program.description.toLowerCase().includes(query);
    if (!titleMatch && !originalTitleMatch && !descMatch) {
      return false;
    }
  }

  return true;
}

/**
 * Sprawdza czy program pasuje do niestandardowej kategorii
 */
export function programMatchesCategory(program: Program, category: Category): boolean {
  const { rules, ruleLogic } = category;
  if (rules.length === 0) return false;

  const results = rules.map(rule => {
    const fieldValue = ((): string => {
      switch (rule.field) {
        case 'genre':        return program.genre;
        case 'title':        return program.title;
        case 'originalTitle': return program.originalTitle ?? '';
        case 'country':      return program.country ?? '';
        case 'description':  return program.description;
      }
    })().toLowerCase();

    const ruleValue = rule.value.toLowerCase();

    switch (rule.operator) {
      case 'contains':    return fieldValue.includes(ruleValue);
      case 'equals':      return fieldValue === ruleValue;
      case 'startsWith':  return fieldValue.startsWith(ruleValue);
      case 'notContains': return !fieldValue.includes(ruleValue);
    }
  });

  return ruleLogic === 'AND' ? results.every(Boolean) : results.some(Boolean);
}
