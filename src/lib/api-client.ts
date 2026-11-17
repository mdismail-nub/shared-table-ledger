// Centralized C++ Drogon REST Backend API Client
// Provides strongly typed access to the C++ backend endpoints with automatic fallback to local store

import { getAdminSession } from "./mess-store";
import { getMemberSession } from "./data";
import type { Mess, Member, Meal, Expense, Payment, Summary, NotificationItem } from "./data";
import type { WorkspacePayload } from "./workspace";

const isBrowser = typeof window !== "undefined";

export function isProductionDeployment(): boolean {
  if (!isBrowser) {
    return process.env["NODE_ENV"] === "production";
  }
  const host = window.location.hostname;
  return host !== "localhost" && host !== "127.0.0.1" && host !== "[::1]";
}

export function getCppBackendUrl(): string | null {
  const envUrl =
    (typeof import.meta !== "undefined" && (import.meta.env as Record<string, string | undefined>)?.[
      "VITE_CPP_API_URL"
    ]) ||
    (typeof process !== "undefined" && process.env?.["VITE_CPP_API_URL"]) ||
    (isBrowser && (window as unknown as { __CPP_API_URL__?: string }).__CPP_API_URL__);

  if (envUrl) {
    return envUrl.replace(/\/+$/, "");
  }

  if (isBrowser) {
    const isLocalhost =
      window.location.hostname === "localhost" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "[::1]";

    if (isLocalhost) {
      return "http://localhost:8080";
    }

    // On remote hosting (e.g. Vercel deployment), there is no localhost:8080 Drogon daemon.
    // Return null so the app requires VITE_CPP_API_URL instead of attempting impossible calls.
    return null;
  }

  return "http://localhost:8080";
}

export interface BackendConfigStatus {
  isConfigured: boolean;
  isProduction: boolean;
  url: string | null;
  errorMessage?: string;
}

export function getBackendConfigStatus(): BackendConfigStatus {
  const isProd = isProductionDeployment();
  const url = getCppBackendUrl();

  if (isProd && !url) {
    return {
      isConfigured: false,
      isProduction: true,
      url: null,
      errorMessage:
        "Production C++ Drogon backend URL (VITE_CPP_API_URL) is not configured in Vercel. Please set VITE_CPP_API_URL in your Vercel Project Settings.",
    };
  }

  return {
    isConfigured: !!url,
    isProduction: isProd,
    url,
  };
}

export function isCppBackendAvailable(): boolean {
  return getCppBackendUrl() !== null;
}

export function isNetworkOrConnectionError(error: string | null | undefined): boolean {
  if (!error) return false;
  const lower = error.toLowerCase();
  return (
    lower.includes("failed to fetch") ||
    lower.includes("networkerror") ||
    lower.includes("connection refused") ||
    lower.includes("failed to connect") ||
    lower.includes("not configured") ||
    lower.includes("not available") ||
    lower.includes("aborted") ||
    lower.includes("timeout") ||
    lower.includes("load failed") ||
    lower.includes("err_connection")
  );
}

function getAuthToken(): string | undefined {
    const admin = getAdminSession();
    if (admin?.token) return admin.token;
    const member = getMemberSession();
    if (member?.token) return member.token;
    return undefined;
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  isNetworkError?: boolean;
}

async function request<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<ApiResponse<T>> {
    const config = getBackendConfigStatus();
    if (!config.isConfigured || !config.url) {
        return {
            data: null,
            error: config.errorMessage || "C++ Drogon backend is not configured.",
            isNetworkError: true,
        };
    }

    const token = getAuthToken();
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
        headers["X-Guest-Token"] = token;
    }

    try {
        const url = `${config.url}${endpoint}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout for cloud latencies

        const response = await fetch(url, {
            ...options,
            headers,
            signal: controller.signal,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            let errorMsg = `Server error ${response.status}`;
            try {
                const errJson = await response.json();
                if (errJson?.error) errorMsg = errJson.error;
            } catch {
                // ignore
            }

            // Redirect to auth on 401 Unauthorized (token expired or invalidated)
            if (response.status === 401 && isBrowser && !window.location.pathname.startsWith("/auth")) {
                window.location.href = "/auth";
            }

            return { data: null, error: errorMsg, isNetworkError: false };
        }

        const data = (await response.json()) as T;
        return { data, error: null, isNetworkError: false };
    } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to connect to C++ backend";
        return {
            data: null,
            error: `C++ Backend (${config.url}): ${msg}`,
            isNetworkError: true,
        };
    }
}

export const cppApi = {
    isAvailable: isCppBackendAvailable,
    isConfigured: () => getBackendConfigStatus().isConfigured,
    getConfigStatus: getBackendConfigStatus,
    isProduction: isProductionDeployment,
    getUrl: getCppBackendUrl,

    // 0. Health
    health: {
        async check() {
            return request<{
                status: string;
                service: string;
                framework: string;
                version: string;
                database: string;
                uptime_seconds: number;
            }>("/api/health", { method: "GET" });
        },
    },
    // 1. Authentication
    auth: {
        async register(data: {
            email: string;
            password: string;
            name: string;
            messName: string;
            currency?: string;
        }) {
            return request<{ success: boolean; token?: string; userId?: string }>("/api/auth/register", {
                method: "POST",
                body: JSON.stringify(data),
            });
        },
        async login(credentials: { email: string; password: string }) {
            return request<{
                userId: string;
                email: string;
                name: string;
                messId: string;
                role: string;
                token: string;
                inviteCode?: string;
                createdAt?: string;
            }>("/api/auth/login", {
                method: "POST",
                body: JSON.stringify(credentials),
            });
        },
        async createGuestSession(data: { code: string; memberId?: string | undefined }) {
            return request<{
                token: string;
                mess_id: string;
                role: string;
                expires_at: number;
            }>("/api/auth/guest-session", {
                method: "POST",
                body: JSON.stringify(data),
            });
        },
    },

    // 2. Workspace
    workspace: {
        async getWorkspace(month: string) {
            return request<WorkspacePayload>(`/api/workspace?month=${encodeURIComponent(month)}`, {
                method: "GET",
            });
        },
        async getWorkspaceByCode(code: string, month: string, token?: string) {
            return request<WorkspacePayload>("/api/workspace/by-code", {
                method: "POST",
                body: JSON.stringify({ code, month, token }),
            });
        },
        async previewMess(code: string) {
            return request<{
                id: string;
                name: string;
                manager: string;
                address: string;
                currency: string;
                members: Member[];
            }>(`/api/workspace/preview/${encodeURIComponent(code)}`, {
                method: "GET",
            });
        },
    },

    // 3. Members
    members: {
        async list() {
            return request<Member[]>("/api/members", { method: "GET" });
        },
        async add(member: { name: string; phone?: string; room?: string }) {
            return request<{ success: boolean; id: string }>("/api/members", {
                method: "POST",
                body: JSON.stringify(member),
            });
        },
        async updateStatus(id: string, status: "active" | "new" | "left") {
            return request<{ success: boolean }>(`/api/members/${id}/status`, {
                method: "PUT",
                body: JSON.stringify({ status }),
            });
        },
        async delete(id: string) {
            return request<{ success: boolean }>(`/api/members/${id}`, {
                method: "DELETE",
            });
        },
    },

    // 4. Meals
    meals: {
        async list(month: string) {
            return request<Meal[]>(`/api/meals?month=${encodeURIComponent(month)}`, {
                method: "GET",
            });
        },
        async upsertDaily(meals: Meal[]) {
            return request<{ success: boolean; count: number }>("/api/meals/daily", {
                method: "POST",
                body: JSON.stringify(meals),
            });
        },
    },

    // 5. Expenses
    expenses: {
        async list(month: string) {
            return request<Expense[]>(`/api/expenses?month=${encodeURIComponent(month)}`, {
                method: "GET",
            });
        },
        async add(expense: {
            date: string;
            type: "meal" | "household";
            category: string;
            description?: string;
            amount: number;
            member_id?: string | null;
            method?: string;
        }) {
            return request<{ success: boolean; id: string }>("/api/expenses", {
                method: "POST",
                body: JSON.stringify(expense),
            });
        },
        async delete(id: string) {
            return request<{ success: boolean }>(`/api/expenses/${id}`, {
                method: "DELETE",
            });
        },
    },

    // 6. Payments
    payments: {
        async list(month: string) {
            return request<Payment[]>(`/api/payments?month=${encodeURIComponent(month)}`, {
                method: "GET",
            });
        },
        async record(payment: {
            date: string;
            member_id: string;
            amount: number;
            method?: string;
            reference?: string;
        }) {
            return request<{ success: boolean; id: string }>("/api/payments", {
                method: "POST",
                body: JSON.stringify(payment),
            });
        },
        async delete(id: string) {
            return request<{ success: boolean }>(`/api/payments/${id}`, {
                method: "DELETE",
            });
        },
    },

    // 7. Accounting
    accounting: {
        async getLedger(month: string) {
            return request<unknown[]>(`/api/accounting/ledger?month=${encodeURIComponent(month)}`, {
                method: "GET",
            });
        },
        async getSummary(month: string) {
            return request<Summary>(`/api/accounting/summary?month=${encodeURIComponent(month)}`, {
                method: "GET",
            });
        },
        async getStatement(memberId: string, month: string) {
            return request<unknown>(
                `/api/accounting/statement/${memberId}?month=${encodeURIComponent(month)}`,
                { method: "GET" }
            );
        },
    },

    // 8. Notifications
    notifications: {
        async list() {
            return request<NotificationItem[]>("/api/notifications", { method: "GET" });
        },
        async send(notif: {
            title: string;
            message: string;
            type?: "notice" | "reminder" | "alert" | "info";
            recipient_id?: string | null;
        }) {
            return request<{ success: boolean; id: string }>("/api/notifications", {
                method: "POST",
                body: JSON.stringify(notif),
            });
        },
        async delete(id: string) {
            return request<{ success: boolean }>(`/api/notifications/${id}`, {
                method: "DELETE",
            });
        },
    },

    // 9. Settings
    settings: {
        async update(settings: Partial<Mess>) {
            return request<{ success: boolean }>("/api/settings", {
                method: "PUT",
                body: JSON.stringify(settings),
            });
        },
        async regenerateCode() {
            return request<{ success: boolean; code: string }>("/api/settings/regenerate-code", {
                method: "POST",
            });
        },
        async getInviteCode() {
            return request<{ success: boolean; code: string; show_invite_to_members?: boolean }>(
                "/api/settings/invite-code",
                { method: "GET" }
            );
        },
    },
};
