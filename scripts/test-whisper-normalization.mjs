import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(
  new URL('../frontend/public/whisper-normalization.js', import.meta.url),
  'utf8',
)
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const { normalizeWhisperTranscript } = await import(moduleUrl)

const cases = [
  ['Se senta.', '60.'],
  ['se senta kg', '60 kg'],
  ['Foram se senta quilogramas processados.', 'Foram 60 quilogramas processados.'],
  ['sessenta e cinco kWh', '65 kWh'],
  ['dois mil e vinte e seis', '2026'],
  ['cento e cinquenta vírgula cinco kg', '150,5 kg'],
  ['Quando ele se senta, começa.', 'Quando ele se senta, começa.'],
]

for (const [input, expected] of cases) {
  assert.equal(normalizeWhisperTranscript(input), expected, input)
}

console.log(`${cases.length} casos de normalização do Whisper validados.`)
