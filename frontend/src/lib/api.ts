const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1"
).replace(/\/+$/, "");

const BACKEND_ORIGIN = API_BASE_URL.replace(/\/api\/v1$/, "");

export function resolveMediaUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const trimmed = path.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")) {
    return trimmed;
  }
  let normalized = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  if (normalized.startsWith("/app/uploads/")) {
    normalized = normalized.replace(/^\/app/, "");
  } else if (
    !normalized.startsWith("/uploads/") &&
    (normalized.startsWith("/products/") ||
      normalized.startsWith("/categories/") ||
      normalized.startsWith("/logos/") ||
      normalized.startsWith("/receipts/"))
  ) {
    normalized = `/uploads${normalized}`;
  }
  return `${BACKEND_ORIGIN}${normalized}`;
}

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

interface ApiFetchOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { body, headers, ...rest } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    let detail = "An unexpected error occurred";
    try {
      const errorData = (await response.json()) as { detail?: unknown };
      if (errorData?.detail) {
        detail = typeof errorData.detail === "string" ? errorData.detail : JSON.stringify(errorData.detail);
      }
    } catch {
      detail = response.statusText || detail;
    }
    throw new ApiError(response.status, detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function apiUpload<T>(
  path: string,
  formData: FormData,
  method: "POST" | "PUT" = "POST"
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: "include",
    body: formData,
  });

  if (!response.ok) {
    let detail = "Upload failed";
    try {
      const errorData = (await response.json()) as { detail?: unknown };
      if (errorData?.detail) {
        detail = typeof errorData.detail === "string" ? errorData.detail : JSON.stringify(errorData.detail);
      }
    } catch {
      detail = response.statusText || detail;
    }
    throw new ApiError(response.status, detail);
  }

  return (await response.json()) as T;
}
