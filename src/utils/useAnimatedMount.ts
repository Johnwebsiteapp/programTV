import { useState, useEffect } from 'react';

/**
 * Hook do animowanych wejść/wyjść komponentów.
 * mounted — czy element ma być w DOM
 * visible — czy element jest w stanie "widocznym" (do CSS transition)
 */
export function useAnimatedMount(isOpen: boolean, duration = 300) {
  const [mounted, setMounted] = useState(isOpen);
  // visible zawsze startuje jako false — animacja wejścia gra nawet gdy isOpen=true od razu
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      // Podwójny rAF zapewnia niezawodne uruchomienie CSS transition
      const f1 = requestAnimationFrame(() => {
        const f2 = requestAnimationFrame(() => setVisible(true));
        return () => cancelAnimationFrame(f2);
      });
      return () => cancelAnimationFrame(f1);
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), duration);
      return () => clearTimeout(t);
    }
  }, [isOpen, duration]);

  return { mounted, visible };
}
