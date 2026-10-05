export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getTokenFromRequest } from "@/lib/auth/jwt";
import { getUserIndicators, getUserMarkers } from "@/lib/chatbot-data";
import { runChatbot } from "@/lib/chatbot-engine";
import { errorResponse, successResponse, unauthorizedResponse } from "@/lib/api-response";

export async function POST(request: NextRequest) {
  const user = getTokenFromRequest(request);
  if (!user) return unauthorizedResponse("Sessão inválida ou expirada.");

  try {
    const body = await request.json();
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) return errorResponse("A mensagem é obrigatória.", 400);
    if (message.length > 500) return errorResponse("A mensagem deve ter no máximo 500 caracteres.", 400);

    const [markers, indicators] = await Promise.all([
      getUserMarkers(user.id),
      getUserIndicators(user.id),
    ]);
    const answer = runChatbot(message, markers, indicators);
    return successResponse(answer);
  } catch (error: any) {
    if (error instanceof SyntaxError) return errorResponse("Corpo da requisição inválido.", 400);
    console.error("Chatbot route error:", error);
    return errorResponse("Não foi possível processar a mensagem.", 500);
  }
}
