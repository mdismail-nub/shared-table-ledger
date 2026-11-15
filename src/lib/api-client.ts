// Centralized C++ Drogon REST Backend API Client
// Provides strongly typed access to the C++ backend endpoints with automatic fallback to local store

import { getAdminSession } from "./mess-store";
import { getMemberSession } from "./data";
import type { Mess, Member, Meal, Expense, Payment, Summary, NotificationItem } from "./data";
import type { WorkspacePayload } from "./workspace";

const CPP_BACKEND_URL =
  (typeof process !== "undefined" && process.env?.["VITE_CPP_API_URL"]) ||
  (typeof window !== "undefined" && (window as unknown as { __CPP_API_URL__?: string }).__CPP_API_URL__) ||
  "http://localhost:8080";

function getAuthToken(): string | undefined {
    const admin = getAdminSession();
    if (admin?.token) return admin.token;
    const member = getMemberSession();
    if (member?.token) return member.token;
    return undefined;
}

async function request<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<{ data: T | null; error: string | null }> {
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
        const url = `${CPP_BACKEND_URL}${endpoint}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

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
            return { data: null, error: errorMsg };
        }

        const data = (await response.json()) as T;
        return { data, error: null };
    } catch (err) {
        return {
            data: null,
            error: err instanceof Error ? err.message : "Failed to connect to C++ backend",
        };
    }
}

export const cppApi = {
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
        async createGuestSession(data: { code: string; memberId?: string }) {
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
    },
};
