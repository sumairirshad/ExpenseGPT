import type { ChatReply, Dashboard } from "./types";

// Set in `.env` (see `.env.example`). Must point at a reachable Expense GPT
// web server: your machine's LAN IP for a physical device, 10.0.2.2 for the
// Android emulator, localhost for iOS simulator / `expo start --web`.
const API_URL = process.env.EXPO_PUBLIC_API_URL;

class ApiConfigError extends Error {
  constructor() {
    super(
      "EXPO_PUBLIC_API_URL is not set. Copy mobile/.env.example to mobile/.env, " +
        "point it at your running Expense GPT web server, and restart `expo start`.",
    );
    this.name = "ApiConfigError";
  }
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  if (!API_URL) throw new ApiConfigError();
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  return res;
}

export async function fetchDashboard(): Promise<Dashboard> {
  const res = await request("/api/dashboard", { headers: {} });
  if (!res.ok) throw new Error(`Dashboard request failed: ${res.status}`);
  return res.json();
}

export async function sendChatMessage(message: string, requestId: string): Promise<ChatReply> {
  const res = await request("/api/chat", {
    method: "POST",
    body: JSON.stringify({ message, requestId }),
  });
  if (!res.ok) throw new Error(`Chat request failed: ${res.status}`);
  return res.json();
}

export async function deleteTransaction(id: string): Promise<boolean> {
  const res = await request(`/api/transactions/${id}`, { method: "DELETE", headers: {} });
  return res.ok;
}

export async function restoreTransaction(id: string): Promise<boolean> {
  const res = await request(`/api/transactions/${id}/restore`, { method: "POST", headers: {} });
  return res.ok;
}
