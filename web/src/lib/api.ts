export async function parseApiResponse<T = Record<string, unknown>>(res: Response): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    if (!res.ok) throw new Error(res.status === 401 ? "Unauthorized — please sign in again" : `Request failed (${res.status})`);
    return {} as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(text.slice(0, 200) || `Invalid server response (${res.status})`);
  }
}
