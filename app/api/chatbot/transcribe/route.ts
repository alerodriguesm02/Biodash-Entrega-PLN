export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getTokenFromRequest } from "@/lib/auth/jwt";
import { OpenAIServiceError, requestOpenAI } from "@/lib/openai";
import { errorResponse, successResponse, unauthorizedResponse } from "@/lib/api-response";

export const maxDuration = 60;

const MAX_AUDIO_BYTES = 4 * 1024 * 1024;
const TRANSCRIPTION_PROMPT =
  "Conversa em português brasileiro sobre BioDash, biodigestores, resíduos, energia, kWh, quilogramas, benefícios fiscais, métricas, manutenção, relatório, endereço, localização e CEP.";

export async function POST(request: NextRequest) {
  const user = getTokenFromRequest(request);
  if (!user) return unauthorizedResponse("Sessão inválida ou expirada.");

  try {
    const incoming = await request.formData();
    const audio = incoming.get("audio");
    if (!(audio instanceof File)) return errorResponse("Envie o áudio no campo 'audio'.", 400);
    if (!audio.size) return errorResponse("O arquivo de áudio está vazio.", 400);
    if (audio.size > MAX_AUDIO_BYTES) return errorResponse("O áudio excede o limite de 4 MB.", 413);

    const outgoing = new FormData();
    outgoing.append("file", audio, audio.name || "voice-message.webm");
    outgoing.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe");
    outgoing.append("language", "pt");
    outgoing.append("prompt", TRANSCRIPTION_PROMPT);
    outgoing.append("response_format", "json");
    outgoing.append("temperature", "0");

    const transcription = await requestOpenAI<{ text: string; usage?: unknown }>(
      "/audio/transcriptions",
      { method: "POST", body: outgoing },
      60_000
    );
    return successResponse({
      text: transcription.text,
      language: "pt",
      model: process.env.OPENAI_TRANSCRIBE_MODEL || "gpt-4o-mini-transcribe",
      usage: transcription.usage,
    });
  } catch (error: any) {
    if (error instanceof OpenAIServiceError) return errorResponse(error.message, error.status);
    console.error("Audio transcription route error:", error);
    return errorResponse("Não foi possível transcrever o áudio.", 500);
  }
}
