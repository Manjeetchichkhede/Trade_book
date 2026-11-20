export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    try {
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
