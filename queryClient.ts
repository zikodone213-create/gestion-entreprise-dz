import { QueryClient, QueryFunction } from "@tanstack/react-query";

const API_BASE = "__PORT_5000__".startsWith("__") ? "" : "__PORT_5000__";

/** رمز الجلسة — يُحفظ في الذاكرة فقط (localStorage محجوب داخل الإطار) */
let authToken: string | null = null;
export function setAuthToken(t: string | null) {
  authToken = t;
}
export function getAuthToken() {
  return authToken;
}
function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return { ...(extra || {}), ...(authToken ? { "x-auth-token": authToken } : {}) };
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: authHeaders(data ? { "Content-Type": "application/json" } : {}),
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = queryKey
      .filter((k) => k !== undefined && k !== null && k !== "")
      .join("/")
      .replace(/\/\?/g, "?");
    const res = await fetch(`${API_BASE}${url}`, { headers: authHeaders() });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
