/**
 * Pool compartilhado do PostgreSQL (AWS RDS)
 * Importar este módulo em todas as rotas que precisam de DB.
 */
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('🔴 PostgreSQL pool error (BioDashBD):', err.message);
});

export default pool;
