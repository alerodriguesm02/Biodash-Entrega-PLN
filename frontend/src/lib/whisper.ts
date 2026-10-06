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
    const OfflineAudioContextClass = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext
    let samples: Float32Array

    if (OfflineAudioContextClass) {
      const outputLength = Math.max(1, Math.ceil(decoded.duration * TARGET_SAMPLE_RATE))
      const offlineContext = new OfflineAudioContextClass(1, outputLength, TARGET_SAMPLE_RATE)
      const source = offlineContext.createBufferSource()
      source.buffer = decoded
      source.connect(offlineContext.destination)
      source.start(0)
      const rendered = await offlineContext.startRendering()
      samples = new Float32Array(rendered.getChannelData(0))
    } else {
      const mono = new Float32Array(decoded.length)
      for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
        const data = decoded.getChannelData(channel)
        for (let index = 0; index < decoded.length; index += 1) {
          mono[index] += data[index] / decoded.numberOfChannels
        }
      }

      if (decoded.sampleRate === TARGET_SAMPLE_RATE) {
        samples = mono
      } else {
        const ratio = decoded.sampleRate / TARGET_SAMPLE_RATE
        const outputLength = Math.max(1, Math.round(mono.length / ratio))
        samples = new Float32Array(outputLength)
        for (let index = 0; index < outputLength; index += 1) {
          const position = index * ratio
          const left = Math.floor(position)
          const right = Math.min(left + 1, mono.length - 1)
          const weight = position - left
          samples[index] = mono[left] * (1 - weight) + mono[right] * weight
        }
      }
    }

    return normalizeAndTrim(samples)
  } finally {
    await context.close().catch(() => undefined)
  }
}

function normalizeAndTrim(input: Float32Array) {
  if (!input.length) return input

  let mean = 0
  for (const sample of input) mean += sample
  mean /= input.length

  let sumSquares = 0
  let peak = 0
  const centered = new Float32Array(input.length)
  for (let index = 0; index < input.length; index += 1) {
    const sample = input[index] - mean
    centered[index] = sample
    sumSquares += sample * sample
    peak = Math.max(peak, Math.abs(sample))
  }

  const rms = Math.sqrt(sumSquares / centered.length)
  if (rms < 0.0005 || peak === 0) return centered

  const windowSize = Math.round(TARGET_SAMPLE_RATE * 0.02)
  const padding = Math.round(TARGET_SAMPLE_RATE * 0.25)
  const windowLevels: number[] = []

  for (let start = 0; start < centered.length; start += windowSize) {
    const end = Math.min(start + windowSize, centered.length)
    let windowEnergy = 0
    for (let index = start; index < end; index += 1) {
      windowEnergy += centered[index] * centered[index]
    }
    windowLevels.push(Math.sqrt(windowEnergy / (end - start)))
  }

  const sortedLevels = [...windowLevels].sort((left, right) => left - right)
  const noiseFloor = sortedLevels[Math.floor(sortedLevels.length * 0.2)] || 0
  const loudestWindow = sortedLevels[sortedLevels.length - 1] || peak
  const threshold = Math.max(0.002, noiseFloor * 2.5, loudestWindow * 0.04)
  let firstSound = 0
  let lastSound = centered.length - 1

  for (let windowIndex = 0; windowIndex < windowLevels.length; windowIndex += 1) {
    if (windowLevels[windowIndex] >= threshold) {
      firstSound = Math.max(0, windowIndex * windowSize - padding)
      break
    }
  }

  for (let windowIndex = windowLevels.length - 1; windowIndex >= 0; windowIndex -= 1) {
    if (windowLevels[windowIndex] >= threshold) {
      lastSound = Math.min(centered.length - 1, (windowIndex + 1) * windowSize + padding)
      break
    }
  }

  const trimmed = centered.slice(firstSound, lastSound + 1)
  let trimmedSquares = 0
  let trimmedPeak = 0
  for (const sample of trimmed) {
    trimmedSquares += sample * sample
    trimmedPeak = Math.max(trimmedPeak, Math.abs(sample))
  }
  const trimmedRms = Math.sqrt(trimmedSquares / trimmed.length)
  const targetRms = 0.12
  const gain = Math.min(6, targetRms / trimmedRms, 0.95 / trimmedPeak)
  if (gain <= 1.05) return trimmed
  for (let index = 0; index < trimmed.length; index += 1) trimmed[index] *= gain
  return trimmed
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
