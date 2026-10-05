import pool from "@/lib/postgres/client";

export function normalizeMarker(row: any) {
  const address = row.address || {};
  return {
    _id: String(row.id),
    id: String(row.id),
    userId: row.user_id,
    title: address.title || "Biodigestor",
    latitude: Number(address.latitude) || -14.235,
    longitude: Number(address.longitude) || -51.925,
    description: address.description || "",
    address,
    createdAt: row.created_at,
  };
}

export async function getUserMarkers(userId: string) {
  const { rows } = await pool.query(
    "SELECT id, user_id, address, created_at FROM biodigestor_maps WHERE user_id = $1 ORDER BY created_at DESC",
    [userId]
  );
  return rows.map(normalizeMarker);
}

export async function getUserIndicators(userId: string, limit: number = 30) {
  const { rows } = await pool.query(
    `SELECT id, user_id, waste_processed, energy_generated, tax_savings, measured_at, created_at
     FROM biodigester_indicators
     WHERE user_id = $1
     ORDER BY measured_at DESC
     LIMIT $2`,
    [userId, limit]
  );
  return rows.map((row) => ({
    ...row,
    waste_processed: Number(row.waste_processed) || 0,
    energy_generated: Number(row.energy_generated) || 0,
    tax_savings: Number(row.tax_savings) || 0,
  }));
}
