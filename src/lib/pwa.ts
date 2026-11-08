import { useEffect, useState } from "react";

// Standard BeforeInstallPromptEvent type
export interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

type PwaListener = () => void;

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let waitingWorker: ServiceWorker | null = null;
let isUpdateAvailable = false;
const listeners = new Set<PwaListener>();

function notify() {
  listeners.forEach((listener) => {
    try {
      listener();
    } catch {
      // ignore
    }
  });
}

/**
 * Check if the application is currently running in standalone PWA mode.
 */
export function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (navigator as unknown as { standalone?: boolean }).standalone === true ||
    document.referrer.includes("android-app://")
  );
}

/**
 * Initialize Service Worker and PWA Install Prompt Listeners.
 */
export function registerPwaServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return;
  }

  // 1. Capture beforeinstallprompt
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });

  // 2. Track successful app installation
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });

  // 3. Register Service Worker on window load
  window.addEventListener("load", async () => {
    try {
      const registration = await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
      });

      // Handle updates found
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener("statechange", () => {
          if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
            waitingWorker = newWorker;
            isUpdateAvailable = true;
            notify();
          }
        });
      });

      // If a worker is already waiting
      if (registration.waiting && navigator.serviceWorker.controller) {
        waitingWorker = registration.waiting;
        isUpdateAvailable = true;
        notify();
      }

      // Check for updates periodically (every 30 mins)
      setInterval(
        () => {
          registration.update().catch(() => {});
        },
        30 * 60 * 1000,
      );
    } catch (err) {
      console.warn("[PWA] Service worker registration failed:", err);
    }
  });

  // 4. Reload on controller change once updated
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!refreshing) {
      refreshing = true;
      window.location.reload();
    }
  });
}

/**
 * Trigger the browser's native PWA installation prompt.
 */
export async function promptPwaInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferredPrompt) {
    return "unavailable";
  }

  try {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    deferredPrompt = null;
    notify();
    return outcome;
  } catch {
    return "unavailable";
  }
}

/**
 * Skip waiting and activate the newly installed service worker.
 */
export function activateAppUpdate() {
  if (waitingWorker) {
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  } else if (typeof window !== "undefined") {
    window.location.reload();
  }
}

/**
 * React hook to observe PWA state (installability, standalone mode, updates).
 */
export function usePwa() {
  const [state, setState] = useState(() => ({
    isInstallable: !!deferredPrompt,
    isStandalone: isStandaloneMode(),
    hasUpdate: isUpdateAvailable,
  }));

  useEffect(() => {
    const handler = () => {
      setState({
        isInstallable: !!deferredPrompt,
        isStandalone: isStandaloneMode(),
        hasUpdate: isUpdateAvailable,
      });
    };

    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  return {
    ...state,
    promptInstall: promptPwaInstall,
    updateApp: activateAppUpdate,
  };
}
