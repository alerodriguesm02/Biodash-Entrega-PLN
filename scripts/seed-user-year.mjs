import pg from 'pg'

const { Pool } = pg
const args = process.argv.slice(2)
const readArg = name => {
  const index = args.indexOf(name)
  return index >= 0 ? args[index + 1] : undefined
}

const email = readArg('--email')?.trim().toLowerCase()
const months = Number(readArg('--months') || 12)
const apply = args.includes('--apply')

if (!email) throw new Error('Informe --email.')
if (!Number.isInteger(months) || months < 1 || months > 36) {
  throw new Error('--months deve ser um inteiro entre 1 e 36.')
}
if (!process.env.POSTGRES_URL || process.env.POSTGRES_URL === '[SENSITIVE]') {
  throw new Error('POSTGRES_URL não está disponível neste ambiente.')
}

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
  max: 1,
  connectionTimeoutMillis: 10_000,
})

const monthKey = date => date.toISOString().slice(0, 7)
const current = new Date()
const periods = []

for (let offset = months - 1; offset >= 0; offset -= 1) {
  const start = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - offset, 1))
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1))
  const day = offset === 0 ? Math.min(15, current.getUTCDate()) : 15
  const measuredAt = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), day, 12))
  periods.push({ start, end, measuredAt, key: monthKey(start) })
}

const seasonalVariation = [35, 10, -25, -45, -10, 25, 55, 80, 65, 30, 5, -15]
const metricsFor = (period, index) => {
  const waste = Math.round(1180 + index * 48 + seasonalVariation[period.start.getUTCMonth()])
  const energy = Math.round((waste * 0.315 + 18 + index * 1.8) * 10) / 10
  const savings = Math.round((energy * 2.4 + 95) * 100) / 100
  return { waste, energy, savings }
}

const client = await pool.connect()
try {
  const userResult = await client.query(
    'SELECT id FROM users WHERE LOWER(email) = $1 LIMIT 1',
    [email],
  )
  if (!userResult.rowCount) throw new Error(`Conta não encontrada: ${email}`)

  const userId = userResult.rows[0].id
  const existingResult = await client.query(
    `SELECT measured_at FROM biodigester_indicators
     WHERE user_id = $1 AND measured_at >= $2 AND measured_at < $3
     ORDER BY measured_at`,
    [userId, periods[0].start, periods.at(-1).end],
  )
  const existingMonths = new Set(existingResult.rows.map(row => monthKey(new Date(row.measured_at))))
  const missing = periods.filter(period => !existingMonths.has(period.key))

  console.log(`Conta: ${email}`)
  console.log(`Período: ${periods[0].key} a ${periods.at(-1).key}`)
  console.log(`Meses existentes preservados: ${existingMonths.size}`)
  console.log(`Meses faltantes: ${missing.map(period => period.key).join(', ') || 'nenhum'}`)

  if (!apply) {
    console.log('Simulação concluída; nenhum dado foi alterado.')
  } else if (!missing.length) {
    console.log('Nenhum registro precisou ser inserido.')
  } else {
    await client.query('BEGIN')
    try {
      for (const period of missing) {
        const metric = metricsFor(period, periods.indexOf(period))
        await client.query(
          `INSERT INTO biodigester_indicators
           (user_id, waste_processed, energy_generated, tax_savings, measured_at)
           VALUES ($1, $2, $3, $4, $5)`,
          [userId, metric.waste, metric.energy, metric.savings, period.measuredAt],
        )
      }
      await client.query('COMMIT')
      console.log(`${missing.length} meses inseridos com sucesso.`)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  }
} finally {
  client.release()
  await pool.end()
}
