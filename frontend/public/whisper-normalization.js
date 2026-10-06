const NUMBER_VALUES = {
  zero: 0,
  um: 1,
  uma: 1,
  dois: 2,
  duas: 2,
  tres: 3,
  quatro: 4,
  cinco: 5,
  seis: 6,
  sete: 7,
  oito: 8,
  nove: 9,
  dez: 10,
  onze: 11,
  doze: 12,
  treze: 13,
  catorze: 14,
  quatorze: 14,
  quinze: 15,
  dezesseis: 16,
  dezessete: 17,
  dezoito: 18,
  dezenove: 19,
  vinte: 20,
  trinta: 30,
  quarenta: 40,
  cinquenta: 50,
  sessenta: 60,
  setenta: 70,
  oitenta: 80,
  noventa: 90,
  cem: 100,
  cento: 100,
  duzentos: 200,
  duzentas: 200,
  trezentos: 300,
  trezentas: 300,
  quatrocentos: 400,
  quatrocentas: 400,
  quinhentos: 500,
  quinhentas: 500,
  seiscentos: 600,
  seiscentas: 600,
  setecentos: 700,
  setecentas: 700,
  oitocentos: 800,
  oitocentas: 800,
  novecentos: 900,
  novecentas: 900,
}

const NUMBER_WORD = [
  'zero', 'um', 'uma', 'dois', 'duas', 'tr[eê]s', 'quatro', 'cinco', 'seis', 'sete',
  'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'catorze', 'quatorze', 'quinze',
  'dezesseis', 'dezessete', 'dezoito', 'dezenove', 'vinte', 'trinta', 'quarenta',
  'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa', 'cem', 'cento',
  'duzentos', 'duzentas', 'trezentos', 'trezentas', 'quatrocentos', 'quatrocentas',
  'quinhentos', 'quinhentas', 'seiscentos', 'seiscentas', 'setecentos', 'setecentas',
  'oitocentos', 'oitocentas', 'novecentos', 'novecentas', 'mil',
].join('|')

const NUMBER_PHRASE = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${NUMBER_WORD})(?:\\s+(?:e\\s+)?(?:${NUMBER_WORD}))*(?![\\p{L}\\p{N}])`,
  'giu',
)

function simplify(value) {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function parseNumberPhrase(phrase) {
  const words = simplify(phrase).split(/\s+/).filter(word => word !== 'e')
  let total = 0
  let current = 0

  for (const word of words) {
    if (word === 'mil') {
      total += Math.max(current, 1) * 1000
      current = 0
    } else {
      current += NUMBER_VALUES[word] ?? 0
    }
  }

  return String(total + current)
}

function normalizeSpokenNumbers(text) {
  return text
    .replace(/^\s*se\s+senta(?=\s*(?:kg|quilos?|quilogramas?|kwh|reais?|por cento|%|[.,!?]|$))/iu, 'sessenta')
    .replace(/(?<![\p{L}\p{N}])se\s+senta(?=\s+(?:kg|quilos?|quilogramas?|kwh|reais?|por cento|%))(?![\p{L}\p{N}])/giu, 'sessenta')
    .replace(NUMBER_PHRASE, parseNumberPhrase)
    .replace(/(\d+)\s+v[ií]rgula\s+(\d+)/giu, '$1,$2')
}

export function normalizeWhisperTranscript(text) {
  const normalizedTerms = text
    .replace(/\bbio(?:di)?[\s-]?gestores\b/gi, 'biodigestores')
    .replace(/\bbio(?:di)?[\s-]?gestor\b/gi, 'biodigestor')
    .replace(/\bbiodigester\b/gi, 'biodigestor')
    .replace(/\bresidus\b/gi, 'resíduos')
    .replace(/\bbio dash\b/gi, 'BioDash')
    .replace(/\bkw[\s-]?h\b/gi, 'kWh')
    .replace(/\bquil[oô]\s+ou\s+a\s+teora\b/gi, 'quilowatt-hora')
    .replace(/\bquilo(?:watt)?[\s-]?hora\b/gi, 'quilowatt-hora')
    .replace(/\ba gente d[ei]\s+a manutenção\b/gi, match =>
      /^[A-ZÁÀÃÂ]/.test(match) ? 'Agende a manutenção' : 'agende a manutenção'
    )

  return normalizeSpokenNumbers(normalizedTerms)
}
