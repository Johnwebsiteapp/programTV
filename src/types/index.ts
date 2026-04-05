// ============================================================
// TYPY DANYCH — TV Guide App
// Tutaj definiujemy wszystkie struktury danych używane w aplikacji
// ============================================================

// ---------- KANAŁ ----------

/** Kategoria kanału telewizyjnego */
export type ChannelCategory =
  | 'general'      // Ogólnopolskie
  | 'news'         // Informacyjne
  | 'sports'       // Sportowe
  | 'movies'       // Filmowe/Rozrywkowe
  | 'kids'         // Dla dzieci
  | 'documentary'  // Dokumentalne
  | 'music'        // Muzyczne
  | 'entertainment'; // Rozrywkowe

/** Kanał telewizyjny */
export interface Channel {
  id: string;
  name: string;           // Nazwa wyświetlana (np. "TVP 1")
  shortName: string;      // Skrócona nazwa (np. "TVP1")
  logo?: string;          // URL logo lub emoji jako zastępnik
  logoEmoji?: string;     // Emoji jako fallback gdy brak logo
  category: ChannelCategory;
  description?: string;
  isFavorite: boolean;    // Czy użytkownik dodał do ulubionych
  isVisible: boolean;     // Czy kanał jest widoczny w siatce EPG
  sortOrder: number;      // Kolejność wyświetlania
}

// ---------- PROGRAM ----------

/** Gatunek programu telewizyjnego */
export type ProgramGenre =
  | 'movie'         // Film fabularny
  | 'series'        // Serial
  | 'sport'         // Sport
  | 'documentary'   // Dokument
  | 'news'          // Wiadomości/Serwis informacyjny
  | 'kids'          // Program dla dzieci
  | 'entertainment' // Rozrywka (talkshow, kabaret, itp.)
  | 'music'         // Muzyczny
  | 'magazin'       // Magazyn/Publicystyka
  | 'other';        // Inne

/** Informacje o odcinku serialu */
export interface EpisodeInfo {
  season?: number;   // Sezon
  episode?: number;  // Numer odcinka
  total?: number;    // Łączna liczba odcinków w sezonie
  title?: string;    // Tytuł odcinka
}

/** Program telewizyjny */
export interface Program {
  id: string;
  channelId: string;      // ID kanału
  title: string;          // Tytuł programu
  originalTitle?: string; // Oryginalny tytuł (dla filmów zagranicznych)
  description: string;    // Opis programu
  startTime: Date;        // Czas rozpoczęcia
  endTime: Date;          // Czas zakończenia
  genre: ProgramGenre;    // Gatunek
  country?: string;       // Kraj produkcji (np. "PL", "USA", "DE")
  year?: number;          // Rok produkcji
  rating?: string;        // Klasyfikacja wiekowa (np. "12+", "16+")
  episode?: EpisodeInfo;  // Informacje o odcinku (dla seriali)
  imageUrl?: string;      // URL zdjęcia/plakatu
  isLive?: boolean;       // Czy to transmisja na żywo
  isPremiere?: boolean;   // Czy to premiera
  isRepeat?: boolean;     // Czy to powtórka
}

// ---------- ULUBIONE ----------

/** Zapisany ulubiony program */
export interface Favorite {
  id: string;
  programId: string;    // ID programu (może być już nieaktualny)
  program: Program;     // Pełne dane programu w momencie zapisania
  addedAt: Date;        // Kiedy dodano do ulubionych
  notes?: string;       // Własne notatki użytkownika
  watched: boolean;     // Czy użytkownik już obejrzał
}

// ---------- POWIADOMIENIE ----------

/** Zaplanowane powiadomienie o programie */
export interface Notification {
  id: string;
  programId: string;
  program: Program;         // Pełne dane programu
  minutesBefore: number;    // Ile minut przed emisją wysłać powiadomienie
  scheduledAt: Date;        // Obliczony czas wysłania powiadomienia
  fired: boolean;           // Czy powiadomienie zostało już wysłane
  dismissed: boolean;       // Czy użytkownik odrzucił
  createdAt: Date;
}

// ---------- KATEGORIA NIESTANDARDOWA ----------

/** Operator reguły filtrowania */
export type RuleOperator = 'contains' | 'equals' | 'startsWith' | 'notContains';

/** Pole, na którym opiera się reguła */
export type RuleField = 'genre' | 'title' | 'country' | 'description' | 'originalTitle';

/** Jedna reguła filtrowania w kategorii */
export interface CategoryRule {
  id: string;
  field: RuleField;
  operator: RuleOperator;
  value: string;
}

/** Niestandardowa kategoria użytkownika (np. "Filmy niemieckie") */
export interface Category {
  id: string;
  name: string;             // Nazwa kategorii
  color: string;            // Kolor wyróżnienia (hex)
  rules: CategoryRule[];    // Reguły (program pasuje jeśli spełnia WSZYSTKIE reguły)
  ruleLogic: 'AND' | 'OR'; // Czy wszystkie reguły muszą pasować, czy wystarczy jedna
  createdAt: Date;
}

// ---------- FILTRY ----------

/** Opcje filtrowania widoku EPG */
export interface FilterOptions {
  genres: ProgramGenre[];   // Filtruj po gatunkach (puste = wszystkie)
  country?: string;         // Filtruj po kraju produkcji
  searchQuery: string;      // Wyszukiwanie tekstowe
  showOnlyFavoriteChannels: boolean; // Pokaż tylko ulubione kanały
  categoryId?: string;      // Filtruj programy pasujące do kategorii
  showOnlyLive: boolean;    // Pokaż tylko aktualnie emitowane
}

// ---------- WIDOK ----------

/** Dostępne widoki aplikacji */
export type AppView =
  | 'home'           // Ekran główny
  | 'epg'            // Główna siatka programu
  | 'favorites'      // Moje ulubione
  | 'notifications'  // Powiadomienia
  | 'categories'     // Moje kategorie
  | 'channels'       // Zarządzanie kanałami
  | 'search'         // Wyniki wyszukiwania
  | 'profile';       // Profil użytkownika

// ---------- POMOCNICZE ----------

/** Zakres czasu (używany w EPG do obliczania pozycji) */
export interface TimeRange {
  start: Date;
  end: Date;
}

/** Stan ładowania danych */
export type LoadingState = 'idle' | 'loading' | 'success' | 'error';
