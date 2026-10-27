export function getToken(): string | null {
  if (typeof window !== "undefined") {
    return (
      localStorage.getItem("devmentor_token") ||
      localStorage.getItem("token")
    );
  }
  return null;
}

export function setToken(token: string): void {
  if (typeof window !== "undefined") {
    localStorage.setItem("devmentor_token", token);
    localStorage.setItem("token", token);
  }
}

export function removeToken(): void {
  if (typeof window !== "undefined") {
    localStorage.removeItem("devmentor_token");
    localStorage.removeItem("token");
  }
}

export async function apiFetch<T = any>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  const response = await fetch(cleanEndpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Request failed with status ${response.status}`
    );
  }

  return response.json();
}

export async function streamSSE(
  endpoint: string,
  body: any,
  onToken: (token: string) => void,
  onComplete?: () => void
): Promise<void> {
  const token = getToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;

  const response = await fetch(cleanEndpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    if (onComplete) onComplete();
    const errorData = await response.json().catch(() => ({}));
    throw new Error(
      errorData.detail || `Stream failed with status ${response.status}`
    );
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    const data = await response.json();
    const message =
      data.response || data.reply || data.answer || data.message || "";
    onToken(message);
    if (onComplete) onComplete();
    return;
  }

  if (!response.body) {
    if (onComplete) onComplete();
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;

      const rawData = line.slice(6);

      if (rawData.trim() === "[DONE]") {
        if (onComplete) onComplete();
        return;
      }

      try {
        const parsed = JSON.parse(rawData);
        if (parsed.token !== undefined) {
          onToken(parsed.token);
        } else if (parsed.text !== undefined) {
          onToken(parsed.text);
        } else if (parsed.content !== undefined) {
          onToken(parsed.content);
        }
      } catch {
        onToken(rawData);
      }
    }
  }

  if (onComplete) onComplete();
}
