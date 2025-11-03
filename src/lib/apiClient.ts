const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_BASE_URL as string;

function buildUrl(path: string) {
  if (!BASE_URL) throw new Error("Backend base URL not configured");
  if (!path.startsWith("/")) path = "/" + path;
  return `${BASE_URL}${path}`;
}

function extractErrorMessage(data: any): string | undefined {
  if (!data) return undefined;

  if (typeof data === "string") {
    return data;
  }

  if (typeof data === "object") {
    if (data.message && typeof data.message === "string") {
      return data.message;
    }
    if (data.error && typeof data.error === "string") {
      return data.error;
    }
    if (Array.isArray(data.errors)) {
      const combined = data.errors
          .map((err: any) => err?.message)
          .filter((msg: any): msg is string => Boolean(msg))
          .join("; ");
      if (combined) {
        return combined;
      }
    }
    if (data.data) {
      const nested = extractErrorMessage(data.data);
      if (nested) {
        return nested;
      }
    }
  }

  return undefined;
}

async function request(path: string, options: RequestInit & { auth?: boolean, headers?: HeadersInit } = {}) {
  const url = buildUrl(path);
  const headers = new Headers(options.headers || {});

  // Attach JSON
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // Only attach Authorization header if explicitly requested
  if (options.auth === true) {
    const token = typeof window !== "undefined"
      ? (sessionStorage.getItem("hmrcToken") || sessionStorage.getItem("authToken"))
      : null;
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  console.log('Making request to:', url);
  // Convert Headers to a plain object for logging
  const headersObj: Record<string, string> = {};
  headers.forEach((value, key) => {
    headersObj[key] = value;
  });

  console.log('Request options:', {
    method: options.method || 'GET',
    headers: headersObj,
    body: options.body ? (options.body instanceof FormData ? '[FormData]' : JSON.stringify(options.body)) : undefined,
  });

  const res = await fetch(url, {
    ...options,
    headers,
    body: options.body && !(options.body instanceof FormData) ? JSON.stringify(options.body) : (options.body as BodyInit | undefined),
  });

  console.log('Response status:', res.status);

  const contentType = res.headers.get("content-type");
  const isJson = contentType && contentType.includes("application/json");
  const data = isJson ? await res.json().catch(() => ({})) : await res.text();

  if (!res.ok) {
    const message = isJson ? extractErrorMessage(data) : undefined;
    throw new Error(message || res.statusText || `Request failed: ${res.status}`);
  }

  return data;
}

export interface ApiClientOptions {
  auth?: boolean;
  headers?: HeadersInit;
}

export const apiClient = {
  get(path: string, options: ApiClientOptions = {}) {
    return request(path, { method: 'GET', ...options });
  },
  post(path: string, body?: any, options: ApiClientOptions = {}) {
    return request(path, { method: 'POST', body, ...options });
  },
  put(path: string, body?: any, options: ApiClientOptions = {}) {
    return request(path, { method: 'PUT', body, ...options });
  }
}
