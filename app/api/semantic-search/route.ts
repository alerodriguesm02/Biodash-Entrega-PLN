export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { getTokenFromRequest } from "@/lib/auth/jwt";
import { getUserMarkers } from "@/lib/chatbot-data";
import { errorResponse, successResponse, unauthorizedResponse } from "@/lib/api-response";

function tokens(value: string) {
  return new Set(
    value.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .split(/[^a-z0-9]+/).filter((token) => token.length > 2)
  );
}

function markerText(marker: any) {
  return [marker.title, marker.description, marker.address?.street, marker.address?.city,
    marker.address?.state, marker.address?.cep].filter(Boolean).join(" ");
}

export async function POST(request: NextRequest) {
  const user = getTokenFromRequest(request);
  if (!user) return unauthorizedResponse("Sessão inválida ou expirada.");

  try {
    const body = await request.json();
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    if (!query) return errorResponse("A busca é obrigatória.", 400);

    const markers = await getUserMarkers(user.id);
    const queryTokens = tokens(query);
    const results = markers.map((marker) => {
      const candidate = tokens(markerText(marker));
      const matches = [...queryTokens].filter((token) => candidate.has(token)).length;
      const score = queryTokens.size ? matches / queryTokens.size : 0;
      return { ...marker, similarity_score: Number(score.toFixed(4)) };
    }).filter((marker) => marker.similarity_score > 0)
      .sort((a, b) => b.similarity_score - a.similarity_score).slice(0, 10);
    return successResponse({ results });
  } catch (error: any) {
    console.error("Semantic search route error:", error);
    return errorResponse("Não foi possível realizar a busca.", 500);
  }
}
