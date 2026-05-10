const MODELS = {
  MOONSHINE_TINY: 'onnx-community/moonshine-tiny-ONNX',
  MOONSHINE_BASE: 'onnx-community/moonshine-base-ONNX'
};

const DEFAULT_MODEL = MODELS.MOONSHINE_TINY;
const CDN_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1';
const IDLE_DISPOSE_TIME = 5 * 60 * 1000;

let transformersModule = null;
let transcriber = null;
let currentModelId = null;
let idleDisposeTimer = 0;

function normalizeModelId(modelId) {
  const value = String(modelId || '').trim();
  if (!value) return DEFAULT_MODEL;
  return Object.values(MODELS).includes(value) ? value : DEFAULT_MODEL;
}

function clearIdleDisposeTimer() {
  if (!idleDisposeTimer) return;
  clearTimeout(idleDisposeTimer);
  idleDisposeTimer = 0;
}

function startIdleDisposeTimer() {
  clearIdleDisposeTimer();
  idleDisposeTimer = setTimeout(() => {
    dispose().catch((error) => console.error('[LiveScriptureWorker] Idle dispose failed:', error));
  }, IDLE_DISPOSE_TIME);
}

async function dispose() {
  clearIdleDisposeTimer();
  if (transcriber && typeof transcriber.dispose === 'function') {
    try {
      await transcriber.dispose();
    } catch (error) {
      console.warn('[LiveScriptureWorker] Transcriber dispose failed:', error);
    }
  }
  transcriber = null;
  currentModelId = null;
  transformersModule = null;
  postMessage({ type: 'disposed' });
}

async function ensureTransformers() {
  if (transformersModule) return transformersModule;
  transformersModule = await import(/* @vite-ignore */ CDN_URL);
  return transformersModule;
}

async function loadModel(modelId, messageId) {
  const nextModelId = normalizeModelId(modelId);
  if (transcriber && currentModelId === nextModelId) {
    clearIdleDisposeTimer();
    postMessage({ type: 'model-loaded', id: messageId, payload: { success: true, cached: true, modelId: nextModelId } });
    return true;
  }
  if (transcriber && currentModelId !== nextModelId) {
    await dispose();
  }
  try {
    postMessage({
      type: 'model-progress',
      id: messageId,
      payload: { status: 'downloading', progress: 0, file: 'Initializing...' }
    });
    const { pipeline, env } = await ensureTransformers();
    env.allowLocalModels = false;
    env.allowRemoteModels = true;
    env.useBrowserCache = true;
    transcriber = await pipeline('automatic-speech-recognition', nextModelId, {
      dtype: 'q4',
      progress_callback(progress) {
        if (progress.status === 'progress') {
          postMessage({
            type: 'model-progress',
            id: messageId,
            payload: {
              status: 'downloading',
              progress: Math.round(progress.progress || 0),
              file: progress.file || 'Downloading model files...'
            }
          });
          return;
        }
        if (progress.status === 'done') {
          postMessage({
            type: 'model-progress',
            id: messageId,
            payload: { status: 'loading', progress: 100, file: 'Initializing model...' }
          });
          return;
        }
        if (progress.status === 'initiate') {
          postMessage({
            type: 'model-progress',
            id: messageId,
            payload: { status: 'downloading', progress: 0, file: progress.file || 'Preparing download...' }
          });
        }
      }
    });
    currentModelId = nextModelId;
    postMessage({ type: 'model-loaded', id: messageId, payload: { success: true, modelId: nextModelId } });
    return true;
  } catch (error) {
    postMessage({
      type: 'error',
      id: messageId,
      payload: { message: error && error.message ? error.message : 'Failed to load model' }
    });
    return false;
  }
}

async function transcribeAudio(audioBuffer, modelId, language, isFinal, messageId) {
  const ready = await loadModel(modelId, undefined);
  if (!ready || !transcriber) {
    postMessage({ type: 'error', id: messageId, payload: { message: 'Model not loaded' } });
    return;
  }
  try {
    const audioData = audioBuffer instanceof Float32Array ? audioBuffer : new Float32Array(audioBuffer);
    const lang = String(language || '').trim().toLowerCase();
    const result = await transcriber(audioData, lang ? { language: lang } : {});
    postMessage({
      type: 'transcription',
      id: messageId,
      payload: { text: String(result?.text || '').trim(), is_final: !!isFinal }
    });
    startIdleDisposeTimer();
  } catch (error) {
    postMessage({
      type: 'error',
      id: messageId,
      payload: { message: error && error.message ? error.message : 'Transcription failed' }
    });
  }
}

self.onmessage = async (event) => {
  const { type, id, payload } = event.data || {};
  switch (type) {
    case 'load-model':
      await loadModel(payload?.modelId, id);
      break;
    case 'transcribe':
      if (!payload?.audioBuffer) {
        postMessage({ type: 'error', id, payload: { message: 'No audio data provided' } });
        return;
      }
      await transcribeAudio(payload.audioBuffer, payload.modelId, payload.language, payload.isFinal, id);
      break;
    case 'dispose':
      await dispose();
      break;
    default:
      postMessage({ type: 'error', id, payload: { message: `Unknown worker message: ${String(type || 'unknown')}` } });
      break;
  }
};
