import { env, pipeline } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1/+esm'

const MODEL_ID = 'Xenova/whisper-small'
let transcriberPromise = null
let activeDevice = null

env.allowLocalModels = false
env.allowRemoteModels = true
env.useBrowserCache = true

function emitStatus(message, progress, requestId) {
  self.postMessage({ type: 'status', requestId, message, progress })
}

function normalizeProgress(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined
  return Math.max(0, Math.min(100, value))
}

function normalizeBioDashTerms(text) {
  return text
    .replace(/\bbio(?:di)?[\s-]?gestores\b/gi, 'biodigestores')
    .replace(/\bbio(?:di)?[\s-]?gestor\b/gi, 'biodigestor')
    .replace(/\bbiodigester\b/gi, 'biodigestor')
    .replace(/\bresidus\b/gi, 'resíduos')
    .replace(/\bbio dash\b/gi, 'BioDash')
    .replace(/\bkw[\s-]?h\b/gi, 'kWh')
}

async function createTranscriber(requestId) {
  const supportsWebGpu = Boolean(self.navigator && self.navigator.gpu)
  const attempts = supportsWebGpu
    ? [
        {
          device: 'webgpu',
          dtype: { encoder_model: 'fp16', decoder_model_merged: 'q4' },
        },
        { device: 'wasm', dtype: 'q8' },
      ]
    : [{ device: 'wasm', dtype: 'q8' }]

  let lastError
  for (const attempt of attempts) {
    try {
      activeDevice = attempt.device
      emitStatus(
        attempt.device === 'webgpu'
          ? 'Carregando Whisper Small com aceleração da GPU...'
          : 'Carregando Whisper Small no navegador...',
        undefined,
        requestId,
      )
      return await pipeline('automatic-speech-recognition', MODEL_ID, {
        ...attempt,
        progress_callback: progress => {
          if (progress.status !== 'progress') return
          emitStatus(
            'Baixando o modelo Whisper Small...',
            normalizeProgress(progress.progress),
            requestId,
          )
        },
      })
    } catch (error) {
      lastError = error
      if (attempt.device === 'webgpu') {
        emitStatus('A GPU não iniciou; tentando o modo compatível...', undefined, requestId)
      }
    }
  }
  throw lastError || new Error('Não foi possível carregar o Whisper Small.')
}

async function getTranscriber(requestId) {
  if (!transcriberPromise) {
    transcriberPromise = createTranscriber(requestId).catch(error => {
      transcriberPromise = null
      throw error
    })
  }
  const transcriber = await transcriberPromise
  self.postMessage({ type: 'ready' })
  return transcriber
}

self.onmessage = async event => {
  const { type, requestId, audio } = event.data || {}
  try {
    const transcriber = await getTranscriber(requestId)
    if (type === 'load') return
    if (type !== 'transcribe' || !(audio instanceof Float32Array)) {
      throw new Error('Áudio inválido para transcrição local.')
    }

    emitStatus(
      activeDevice === 'webgpu'
        ? 'Transcrevendo com Whisper Small na GPU...'
        : 'Transcrevendo com Whisper Small...',
      undefined,
      requestId,
    )
    const result = await transcriber(audio, {
      language: 'portuguese',
      task: 'transcribe',
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: false,
    })
    self.postMessage({
      type: 'result',
      requestId,
      text: normalizeBioDashTerms(String(result?.text || '').trim()),
    })
  } catch (error) {
    self.postMessage({
      type: 'error',
      requestId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
