import { supabase } from "../supabase/client";

export type OAuthProvider = "google" | "apple" | "microsoft" | "lovable";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

const BROKER_BASE = "https://36e058a0-368f-4562-bf68-4982f2289b64.lovableproject.com";
const ALLOWED_REDIRECT_URI = "https://36e058a0-368f-4562-bf68-4982f2289b64.lovableproject.com/";
const EXPECTED_MESSAGE_TYPE = "authorization_response";
const SUPPORTED_ORIGINS = [
  "https://oauth.lovable.app",
  "https://lovable.dev",
  "https://36e058a0-368f-4562-bf68-4982f2289b64.lovableproject.com",
];

function generateState(): string {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    return [...crypto.getRandomValues(new Uint8Array(16))]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: OAuthProvider, opts?: SignInOptions) => {
      const state = generateState();
      const params = new URLSearchParams({
        ...opts?.extraParams,
        provider,
        response_mode: "web_message",
        redirect_uri: ALLOWED_REDIRECT_URI,
        state,
      });

      const url = `${BROKER_BASE}/~oauth/initiate?${params.toString()}`;

      // Open OAuth popup
      const width = Math.min(520, window.outerWidth * 0.9);
      const height = Math.min(680, window.outerHeight * 0.9);
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        url,
        "lovable_oauth_popup",
        `width=${width},height=${height},left=${left},top=${top},status=no,toolbar=no,menubar=no`,
      );

      if (!popup) {
        throw new Error(
          "Pop-up window was blocked. Please allow pop-ups for this site to sign in with Google.",
        );
      }

      return new Promise<{
        tokens?: { access_token: string; refresh_token: string };
        error: Error | null;
        redirected?: boolean;
      }>((resolve) => {
        let timer: ReturnType<typeof setInterval> | null = null;

        const onMessage = async (e: MessageEvent) => {
          if (!SUPPORTED_ORIGINS.some((origin) => e.origin === origin)) return;
          const data = e.data;
          if (!data || typeof data !== "object") return;
          if (data.type !== EXPECTED_MESSAGE_TYPE) return;

          window.removeEventListener("message", onMessage);
          if (timer) clearInterval(timer);
          try {
            popup.close();
          } catch {
            // Popup may already be closed
          }

          const resp = data.response;
          if (!resp) {
            resolve({ error: new Error("No response received from OAuth provider") });
            return;
          }
          if (resp.state !== state) {
            resolve({ error: new Error("OAuth state validation failed") });
            return;
          }
          if (resp.error) {
            resolve({
              error: new Error(resp.error_description || resp.error || "Google sign-in failed"),
            });
            return;
          }
          if (!resp.access_token || !resp.refresh_token) {
            resolve({ error: new Error("Authentication tokens not received") });
            return;
          }

          try {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: resp.access_token,
              refresh_token: resp.refresh_token,
            });
            if (sessionError) {
              resolve({ error: sessionError });
              return;
            }
            resolve({
              tokens: {
                access_token: resp.access_token,
                refresh_token: resp.refresh_token,
              },
              error: null,
            });
          } catch (err) {
            resolve({ error: err instanceof Error ? err : new Error(String(err)) });
          }
        };

        window.addEventListener("message", onMessage);

        timer = setInterval(() => {
          if (popup.closed) {
            if (timer) clearInterval(timer);
            window.removeEventListener("message", onMessage);
            resolve({ error: new Error("Sign-in window was closed") });
          }
        }, 500);
      });
    },
  },
};
