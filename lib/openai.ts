const OPENAI_API_URL = "https://api.openai.com/v1";

export class OpenAIServiceError extends Error {
  constructor(message: string, public status: number = 502) {
    super(message);
  }
}

export async function requestOpenAI<T>(
  path: string,
  options: RequestInit,
  timeoutMs: number = 60_000
): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new OpenAIServiceError("OPENAI_API_KEY não configurada no servidor.", 503);
  }

  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${apiKey}`);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${OPENAI_API_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal,
      cache: "no-store",
    });
    const raw = await response.text();
    let body: any = {};
    try {
      body = raw ? JSON.parse(raw) : {};
    } catch {
      throw new OpenAIServiceError("A API de transcrição retornou uma resposta inválida.");
    }
    if (!response.ok) {
      const status = response.status === 429 ? 503 : response.status >= 500 ? 502 : 400;
      throw new OpenAIServiceError(body?.error?.message || "Falha na API de transcrição.", status);
    }
    return body as T;
  } catch (error: any) {
    if (error instanceof OpenAIServiceError) throw error;
    if (error?.name === "AbortError") {
      throw new OpenAIServiceError("A transcrição excedeu o tempo de resposta.", 504);
    }
    throw new OpenAIServiceError("Não foi possível acessar a API de transcrição.", 502);
  } finally {
    clearTimeout(timeout);
  }
}
