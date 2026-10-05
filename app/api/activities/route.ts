import { type NextRequest } from "next/server";
import pool from "@/lib/postgres/client";
import { getTokenFromRequest } from "@/lib/auth/jwt";
import { successResponse, unauthorizedResponse, errorResponse } from "@/lib/api-response";

function formatTimestamp(timestamp: string): string {
  const now = new Date();
  const activityTime = new Date(timestamp);
  const diffInMinutes = Math.floor((now.getTime() - activityTime.getTime()) / (1000 * 60));

  if (diffInMinutes < 1) return "Agora mesmo";
  if (diffInMinutes < 60) return `${diffInMinutes} minuto${diffInMinutes > 1 ? "s" : ""} atrás`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours} hora${diffInHours > 1 ? "s" : ""} atrás`;

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays === 1) return "Ontem";
  if (diffInDays < 7) return `${diffInDays} dias atrás`;

  return activityTime.toLocaleDateString("pt-BR");
}

export async function GET(request: NextRequest) {
  try {
    const payload = getTokenFromRequest(request);
    if (!payload) return unauthorizedResponse("Unauthorized");

    const url = new URL(request.url);
    const limitParam = url.searchParams.get("limit");
    const limit = limitParam ? parseInt(limitParam) : 10;
    const since = url.searchParams.get("since");

    if (limitParam && (isNaN(limit) || limit < 1 || limit > 100)) {
      return errorResponse("Limit must be a number between 1 and 100", 400);
    }

    let query = `SELECT * FROM activities WHERE user_id = $1 ORDER BY timestamp DESC LIMIT $2`;
    const params: any[] = [payload.id, limit];

    if (since) {
      const sinceDate = new Date(since);
      if (isNaN(sinceDate.getTime())) {
        return errorResponse("Invalid 'since' date format. Use ISO 8601 format", 400);
      }
      query = `SELECT * FROM activities WHERE user_id = $1 AND timestamp > $3 ORDER BY timestamp DESC LIMIT $2`;
      params.push(since);
    }

    const { rows: activities } = await pool.query(query, params);

    const formattedActivities = (activities || []).map((activity) => ({
      ...activity,
      timestamp: formatTimestamp(activity.timestamp),
    }));

    return successResponse(
      { activities: formattedActivities, total: formattedActivities.length },
      "Activities retrieved successfully"
    );
  } catch (error: any) {
    console.error("Error fetching activities:", error);
    return errorResponse("Failed to fetch activities", 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const payload = getTokenFromRequest(request);
    if (!payload) return unauthorizedResponse("Unauthorized");

    const body = await request.json();
    const { type, description } = body;

    if (!type || !description) return errorResponse("Type and description are required", 400);
    if (typeof type !== "string" || type.trim().length === 0)
      return errorResponse("Type must be a non-empty string", 400);
    if (description.trim().length > 500)
      return errorResponse("Description must be less than 500 characters", 400);

    const { rows } = await pool.query(
      `INSERT INTO activities (user_id, type, description) VALUES ($1, $2, $3) RETURNING *`,
      [payload.id, type.trim(), description.trim()]
    );

    return successResponse(
      { ...rows[0], timestamp: formatTimestamp(rows[0].timestamp) },
      "Activity added successfully"
    );
  } catch (error: any) {
    console.error("Error adding activity:", error);
    if (error instanceof SyntaxError) return errorResponse("Invalid request body", 400);
    return errorResponse("Failed to add activity", 500);
  }
}
