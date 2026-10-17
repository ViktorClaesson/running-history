import { registerSW } from 'virtual:pwa-register';

/** How often an open app asks the server whether a new version exists. */
const UPDATE_CHECK_MS = 60 * 60 * 1000;

/**
 * Service-worker updates, the "prompt" way: when a new deploy has been downloaded in the
 * background, `needRefresh` turns true and a banner offers to reload. Nothing swaps code
 * under a running page. So an installed app is never stranded on an old version, it also
 * checks for updates every hour and whenever it comes back to the foreground.
 * https://vite-pwa-org.netlify.app/guide/prompt-for-update
 */
class UpdateStore {
  needRefresh = $state(false);
  offlineReady = $state(false);
  private update: ((reload?: boolean) => Promise<void>) | null = null;

  start(): void {
    if (!('serviceWorker' in navigator)) return;
    this.update = registerSW({
      onNeedRefresh: () => (this.needRefresh = true),
      onOfflineReady: () => (this.offlineReady = true),
      onRegisteredSW: (_url, reg) => {
        if (!reg) return;
        const check = () => void reg.update().catch(() => undefined);
        setInterval(check, UPDATE_CHECK_MS);
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') check();
        });
      },
    });
  }

  reload(): void {
    void this.update?.(true);
  }
}

export const updates = new UpdateStore();
