export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    try {
      // In Vite dev mode, unregister any previously installed SW so dev chunks never go stale
      if (import.meta.env.DEV) {
        navigator.serviceWorker
          .getRegistrations()
          .then((regs) => {
            regs.forEach((reg) => {
              void reg.unregister();
            });
          })
          .catch(() => {});
        if ('caches' in window) {
          caches
            .keys()
            .then((keys) => {
              keys.forEach((k) => {
                void caches.delete(k);
              });
            })
            .catch(() => {});
        }
        return;
      }

      navigator.serviceWorker
        .register('/sw.js', { scope: '/' })
        .catch(() => {
          // Silently ignore in restricted preview iframes
        });
    } catch {
      // Silently ignore in sandboxed environments
    }
  });
}
