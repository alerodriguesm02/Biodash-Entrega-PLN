const TARGET_SAMPLE_RATE = 16_000

type WhisperWorkerMessage =
  | { type: 'status'; requestId?: string; message: string; progress?: number }
  | { type: 'ready' }
  | { type: 'result'; requestId: string; text: string }
  | { type: 'error'; requestId?: string; error: string }

export interface WhisperProgress {
  message: string
  progress?: number
}

interface PendingRequest {
  resolve: (text: string) => void
  reject: (error: Error) => void
  onProgress?: (progress: WhisperProgress) => void
}

let worker: Worker | null = null
let workerReadyPromise: Promise<void> | null = null
let resolveWorkerReady: (() => void) | null = null
let rejectWorkerReady: ((error: Error) => void) | null = null
const pendingRequests = new Map<string, PendingRequest>()

function resetWorker(error: Error) {
  worker?.terminate()
  worker = null
  workerReadyPromise = null
  resolveWorkerReady = null
  rejectWorkerReady = null
  pendingRequests.forEach(request => request.reject(error))
  pendingRequests.clear()
}

function getWorker() {
  if (worker) return worker
  if (typeof window === 'undefined' || typeof Worker === 'undefined') {
    throw new Error('Este navegador não oferece suporte ao Whisper local.')
  }

  workerReadyPromise = new Promise<void>((resolve, reject) => {
    resolveWorkerReady = resolve
    rejectWorkerReady = reject
  })

  worker = new Worker('/whisper-worker.js', { type: 'module', name: 'biodash-whisper-small' })
  worker.onmessage = (event: MessageEvent<WhisperWorkerMessage>) => {
    const message = event.data
    if (message.type === 'ready') {
      resolveWorkerReady?.()
      resolveWorkerReady = null
      rejectWorkerReady = null
      return
    }

    if (message.type === 'status') {
      if (message.requestId) {
        pendingRequests.get(message.requestId)?.onProgress?.({
          message: message.message,
          progress: message.progress,
        })
      } else {
        pendingRequests.forEach(request => request.onProgress?.({
          message: message.message,
          progress: message.progress,
        }))
      }
      return
    }

    if (message.type === 'result') {
      const request = pendingRequests.get(message.requestId)
      if (!request) return
      pendingRequests.delete(message.requestId)
      request.resolve(message.text)
      return
    }

    const error = new Error(message.error || 'Falha ao executar o Whisper Small.')
    if (message.requestId) {
      const request = pendingRequests.get(message.requestId)
      pendingRequests.delete(message.requestId)
      request?.reject(error)
      if (rejectWorkerReady) {
        rejectWorkerReady(error)
        resetWorker(error)
      }
      return
    }
    rejectWorkerReady?.(error)
    resetWorker(error)
  }
  worker.onerror = event => {
    resetWorker(new Error(event.message || 'O processo local do Whisper foi interrompido.'))
  }
  return worker
}

export async function prepareWhisperSmall(onProgress?: (progress: WhisperProgress) => void) {
  const currentWorker = getWorker()
  const preloadId = `preload-${Date.now()}-${Math.random().toString(36).slice(2)}`
  const ready = workerReadyPromise
  pendingRequests.set(preloadId, {
    resolve: () => undefined,
    reject: () => undefined,
    onProgress,
  })
  currentWorker.postMessage({ type: 'load', requestId: preloadId })
  try {
    await ready
  } finally {
    pendingRequests.delete(preloadId)
  }
}

async function decodeToMono16kHz(audio: Blob): Promise<Float32Array> {
  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
  if (!AudioContextClass) throw new Error('Este navegador não consegue decodificar o áudio gravado.')

  const context = new AudioContextClass()
  try {
    const decoded = await context.decodeAudioData(await audio.arrayBuffer())
    const mono = new Float32Array(decoded.length)
    for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
      const data = decoded.getChannelData(channel)
      for (let index = 0; index < decoded.length; index += 1) {
        mono[index] += data[index] / decoded.numberOfChannels
      }
    }

    if (decoded.sampleRate === TARGET_SAMPLE_RATE) return mono

    const ratio = decoded.sampleRate / TARGET_SAMPLE_RATE
    const outputLength = Math.max(1, Math.round(mono.length / ratio))
    const resampled = new Float32Array(outputLength)
    for (let index = 0; index < outputLength; index += 1) {
      const position = index * ratio
      const left = Math.floor(position)
      const right = Math.min(left + 1, mono.length - 1)
      const weight = position - left
      resampled[index] = mono[left] * (1 - weight) + mono[right] * weight
    }
    return resampled
  } finally {
    await context.close().catch(() => undefined)
  }
}

export async function transcribeWithWhisperSmall(
  audio: Blob,
  onProgress?: (progress: WhisperProgress) => void,
) {
  onProgress?.({ message: 'Preparando o áudio...' })
  const samples = await decodeToMono16kHz(audio)
  const currentWorker = getWorker()
  const requestId = `transcribe-${Date.now()}-${Math.random().toString(36).slice(2)}`

  return new Promise<string>((resolve, reject) => {
    pendingRequests.set(requestId, { resolve, reject, onProgress })
    currentWorker.postMessage(
      { type: 'transcribe', requestId, audio: samples },
      [samples.buffer],
    )
  })
}
