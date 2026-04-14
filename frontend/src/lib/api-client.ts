const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export class ApiError extends Error {
  public status: number;
  public detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

export async function apiFetch<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${BASE_URL}${endpoint}`;

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });
  } catch (networkError) {
    throw new ApiError(0, 'Cannot reach backend server. Is it running on port 8000?');
  }

  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      detail = body?.detail ?? detail;
    } catch {
      // response body is not JSON — use default detail
    }
    throw new ApiError(response.status, detail);
  }

  return response.json() as Promise<T>;
}
