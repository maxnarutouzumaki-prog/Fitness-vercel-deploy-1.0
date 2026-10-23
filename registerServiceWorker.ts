/**
 * Registra o Service Worker apenas em produção. Depois de ativo, avisa o worker para
 * guardar em cache os arquivos que a página já carregou, para abrir sem internet.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('sw.js')
      .then(async () => {
        const registration = await navigator.serviceWorker.ready;
        const urls = performance
          .getEntriesByType('resource')
          .map((entry) => entry.name)
          .filter((url) => url.startsWith(window.location.origin));
        registration.active?.postMessage({ type: 'CACHE_URLS', urls: [...urls, window.location.href] });
      })
      .catch(() => {
        /* sem Service Worker o app segue funcionando online */
      });
  });
}
