import { useState } from 'react';
import { Tv, ArrowRight } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';

export function WelcomeModal() {
  const { setNickname, setHasSeenWelcome } = useAppStore();
  const [name, setName] = useState('');

  const handleConfirm = () => {
    if (name.trim()) setNickname(name);
    setHasSeenWelcome();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm px-6">
      <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden animate-view-enter">

        {/* Górna część z ikoną */}
        <div className="bg-gradient-to-br from-primary-600 to-primary-700 px-6 pt-8 pb-6 text-center">
          <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Tv size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Witaj w TV Guide!</h1>
          <p className="text-primary-100 text-sm mt-1">Twój osobisty program telewizyjny</p>
        </div>

        {/* Formularz */}
        <div className="px-6 py-6">
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-5">
            Jak mamy się do Ciebie zwracać?
          </p>

          <input
            autoFocus
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleConfirm()}
            maxLength={30}
            placeholder="Twój pseudonim (np. Jan)"
            className="w-full px-4 py-3.5 rounded-2xl border-2 border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 text-base font-medium outline-none focus:border-primary-500 transition-colors"
          />

          <button
            onClick={handleConfirm}
            className="mt-4 w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 active:scale-95 text-white font-bold py-3.5 rounded-2xl transition-all text-base"
          >
            {name.trim() ? `Witaj, ${name.trim()}!` : 'Pomiń'}
            <ArrowRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
