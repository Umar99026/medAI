/** Per-port token so localhost:3000 (GP) and localhost:3001 (specialist) never clash */
function tokenKey(): string {
  if (typeof window === "undefined") return "medai_token";
  return `medai_token_${window.location.port || "default"}`;
}

export function setToken(token: string) {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(tokenKey(), token);
  // Remove legacy shared keys that caused account switching
  sessionStorage.removeItem("medai_token");
  localStorage.removeItem("medai_token");
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(tokenKey()) ?? sessionStorage.getItem("medai_token");
}

export function clearToken() {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(tokenKey());
  sessionStorage.removeItem("medai_token");
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const headers = new Headers(init?.headers);
  const token = getToken();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(input, { ...init, headers });
}
