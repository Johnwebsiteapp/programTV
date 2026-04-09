// ============================================================
// GŁÓWNY KOMPONENT APLIKACJI — TV Stream
// ============================================================

import { useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import { Header } from './components/layout/Header';
import { BottomNavigation, SideNavigation } from './components/layout/Navigation';
import { EPGGrid } from './components/epg/EPGGrid';
import { FilterBar } from './components/epg/FilterBar';
import { FavoritesList } from './components/favorites/FavoritesList';
import { NotificationPanel } from './components/notifications/NotificationPanel';
import { CategoryManager } from './components/categories/CategoryManager';
import { ChannelSettings } from './components/channels/ChannelSettings';
import { SearchView } from './components/search/SearchView';
import { ProgramModal } from './components/programs/ProgramModal';
import { ChannelView } from './components/channels/ChannelView';
import { SmartFilterModal } from './components/smartfilter/SmartFilterModal';
import { AIChatModal } from './components/chat/AIChatModal';
import { HomeView } from './components/home/HomeView';
import { ProfileView } from './components/profile/ProfileView';
import { WelcomeModal } from './components/onboarding/WelcomeModal';
import { rescheduleAllNotifications } from './utils/notificationUtils';

export default function App() {
  const { activeView, darkMode, loadPrograms, notifications, markNotificationFired, showSmartFilter, setShowSmartFilter, showAIChat, setShowAIChat, hasSeenWelcome } = useAppStore();

  // Ustaw tryb ciemny przy starcie
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  // Załaduj dane programu TV przy starcie, a potem odświeżaj co 30 minut
  useEffect(() => {
    loadPrograms();
    const interval = setInterval(loadPrograms, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadPrograms]);

  // Przywróć zaplanowane powiadomienia po odświeżeniu strony
  useEffect(() => {
    const pending = notifications.filter(n => !n.fired && !n.dismissed);
    rescheduleAllNotifications(pending, markNotificationFired);
  }, []); // Tylko przy pierwszym renderze

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-slate-950 overflow-hidden pb-16 md:pb-0">
      {/* Nagłówek */}
      <Header />

      {/* Główna treść */}
      <div className="flex flex-1 overflow-hidden">
        {/* Boczna nawigacja (tylko desktop) */}
        <SideNavigation />

        {/* Obszar treści */}
        <main className="flex-1 overflow-hidden flex flex-col min-w-0">
          {/* Pasek filtrów (tylko w widoku EPG) */}
          {activeView === 'epg' && <FilterBar />}

          {/* Widoki — key powoduje remount i animację wejścia przy zmianie zakładki */}
          <div key={activeView} className="flex-1 overflow-hidden animate-view-enter">
            {activeView === 'home' && <HomeView />}

            {activeView === 'epg' && <EPGGrid />}

            {activeView === 'favorites' && (
              <div className="h-full overflow-y-auto">
                <FavoritesList />
              </div>
            )}

            {activeView === 'notifications' && (
              <div className="h-full overflow-y-auto">
                <NotificationPanel />
              </div>
            )}

            {activeView === 'categories' && (
              <div className="h-full overflow-y-auto">
                <CategoryManager />
              </div>
            )}

            {activeView === 'channels' && (
              <div className="h-full overflow-y-auto">
                <ChannelSettings />
              </div>
            )}

            {activeView === 'search' && <SearchView />}

            {activeView === 'profile' && (
              <div className="h-full overflow-y-auto">
                <ProfileView />
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Dolna nawigacja (mobile) */}
      <BottomNavigation />

      {/* Modal szczegółów programu */}
      <ProgramModal />

      {/* Panel kanału (pełny rozkład) */}
      <ChannelView />

      {/* Smart Filter i AI Chat — renderowane po BottomNavigation żeby nie były zablokowane przez transform */}
      {showSmartFilter && <SmartFilterModal onClose={() => setShowSmartFilter(false)} />}
      {showAIChat && <AIChatModal onClose={() => setShowAIChat(false)} />}

      {/* Onboarding — tylko przy pierwszym uruchomieniu */}
      {!hasSeenWelcome && <WelcomeModal />}
    </div>
  );
}
