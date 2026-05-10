// Local AI engine — Moonshine ONNX speech-recognition via
// @huggingface/transformers running in live-scripture-offline-worker.js.
// Audio pipeline ported from BSP v128 live-scripture-tools.js.
(function (root) {
  'use strict';

  const LOCAL_MODELS = [
    { id: 'onnx-community/moonshine-tiny-ONNX',  label: 'Moonshine Tiny',  size: '50MB' },
    { id: 'onnx-community/moonshine-base-ONNX',  label: 'Moonshine Base',  size: '150MB · Recommended' }
  ];
  const DEFAULT_MODEL = 'onnx-community/moonshine-base-ONNX'; // Recommended

  // Audio processing constants (from BSP v128 live-scripture-tools.js)
  const PROCESSING_DELAY_MS         = 300;
  const MIN_AUDIO_SAMPLES           = 8000;
  const INTERIM_TARGET_SAMPLES      = 16000;
  const FINAL_TARGET_SAMPLES        = 48000;
  const MAX_AUDIO_CHUNKS            = 120;
  function buildMicUnavailableMessage() {
    const host = typeof location !== 'undefined' ? String(location.hostname || '') : '';
    const protocol = typeof location !== 'undefined' ? String(location.protocol || '') : '';
    const isLocalHost = host === 'localhost' || host === '127.0.0.1' || host === '::1';
    if (protocol !== 'https:' && !isLocalHost) {
      return 'Microphone capture unavailable on this browser context. Use HTTPS (or localhost) on mobile, then allow microphone permission.';
    }
    return 'Microphone capture unavailable. Check browser microphone permission and reload.';
  }

  async function openMicStream(deviceId) {
    const baseAudio = {
      channelCount: 1,
      sampleRate: 16000,
      noiseSuppression: true,
      echoCancellation: true,
      autoGainControl: true
    };
    const attempts = [];
    if (deviceId) {
      attempts.push({ audio: Object.assign({ deviceId: { exact: deviceId } }, baseAudio) });
      attempts.push({ audio: Object.assign({ deviceId: { ideal: deviceId } }, baseAudio) });
    }
    attempts.push({ audio: baseAudio });
    attempts.push({ audio: true });

    let lastErr = null;
    for (const constraints of attempts) {
      try {
        return await navigator.mediaDevices.getUserMedia(constraints);
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error(buildMicUnavailableMessage());
  }
  const NO_VOICE_CONTEXT_CHUNKS     = 3;
  const BUSY_BUFFER_LIMIT           = 28;
  const BUSY_BUFFER_KEEP            = 18;
  const FINALIZE_SILENCE_CHUNKS     = 4;
  const INTERIM_OVERLAP_CHUNKS      = 12;
  const FINAL_OVERLAP_CHUNKS        = 8;
  const VOICE_ACTIVITY_THRESHOLD    = 0.006;

  // ---------------------------------------------------------------------------
  // Shared worker singleton — keeps the model in memory across Start/Stop
  // cycles. The worker's own idle-dispose timer (5 min) handles cleanup.
  // ---------------------------------------------------------------------------
  let _worker          = null;
  let _msgId           = 0;
  let _pending         = new Map();
  let _loadedModelId   = '';
  let _modelState      = 'idle'; // idle | downloading | loading | ready | error

  // Set of { fn } callbacks subscribed to model-state updates.
  const _stateListeners = new Set();

  function _notifyState(state, progress, message) {
    _modelState = String(state || 'idle');
    const obj = { state: _modelState, progress: Number(progress || 0), message: String(message || '') };
    _stateListeners.forEach((fn) => { try { fn(obj); } catch (_) {} });
  }

  function _getWorker() {
    if (_worker) return _worker;
    const workerUrl = new URL('./live-scripture-offline-worker.js', window.location.href).href;
    const w = new Worker(workerUrl);
    w.onmessage = (ev) => _handleMessage(ev.data);
    w.onerror   = (ev) => {
      const msg = (ev && ev.message) ? ev.message : 'Worker error';
      _loadedModelId = '';
      _notifyState('error', 0, msg);
      _pending.forEach(({ reject, timeoutId }) => { clearTimeout(timeoutId); try { reject(new Error(msg)); } catch (_) {} });
      _pending.clear();
      _worker = null;
    };
    _worker = w;
    return w;
  }

  function _handleMessage(msg) {
    const { type, id, payload } = msg || {};
    const p = id ? _pending.get(id) : null;

    if (type === 'model-progress') {
      const status   = String(payload && payload.status ? payload.status : 'downloading');
      const progress = Number((payload && payload.progress) ? payload.progress : 0);
      const file     = String((payload && payload.file)     ? payload.file     : '');
      _notifyState(status === 'loading' ? 'loading' : 'downloading', progress, file || (status === 'loading' ? 'Initializing model…' : 'Downloading model files…'));
      return;
    }

    if (type === 'model-loaded') {
      if (payload && payload.success) {
        _loadedModelId = String((payload && payload.modelId) ? payload.modelId : '');
        _notifyState('ready', 100, 'Model ready');
      }
      if (p) { _pending.delete(id); clearTimeout(p.timeoutId); p.resolve(payload); }
      return;
    }

    if (type === 'transcription') {
      if (p) { _pending.delete(id); clearTimeout(p.timeoutId); p.resolve(payload); }
      return;
    }

    if (type === 'error') {
      const msg = String((payload && payload.message) ? payload.message : 'Worker error');
      if (p) { _pending.delete(id); clearTimeout(p.timeoutId); p.reject(new Error(msg)); }
      else if (_modelState !== 'ready') _notifyState('error', 0, msg);
      return;
    }

    if (type === 'disposed') {
      _worker        = null;
      _loadedModelId = '';
      _notifyState('idle', 0, '');
    }
    if (p) { _pending.delete(id); clearTimeout(p.timeoutId); p.resolve(payload); }
  }

  function _send(type, payload) {
    const worker = _getWorker();
    const id     = ++_msgId;
    return new Promise((resolve, reject) => {
      const ms        = type === 'load-model' ? 300000 : 60000;
      const timeoutId = setTimeout(() => { _pending.delete(id); reject(new Error('Worker timeout: ' + type)); }, ms);
      _pending.set(id, { resolve, reject, timeoutId });
      worker.postMessage({ type, id, payload });
    });
  }

  async function _ensureModel(modelId) {
    const target = modelId || DEFAULT_MODEL;
    if (_loadedModelId === target && _modelState === 'ready') return;
    _notifyState('downloading', 0, 'Starting model download…');
    await _send('load-model', { modelId: target });
  }

  // ---------------------------------------------------------------------------
  // Voice activity helpers (from v128)
  // ---------------------------------------------------------------------------
  function _hasVoice(chunk) {
    if (!(chunk instanceof Float32Array) || !chunk.length) return false;
    let sum = 0;
    for (let i = 0; i < chunk.length; i++) sum += chunk[i] * chunk[i];
    return Math.sqrt(sum / chunk.length) > VOICE_ACTIVITY_THRESHOLD;
  }

  function _trailingSilent(chunks) {
    let n = 0;
    for (let i = chunks.length - 1; i >= 0; i--) {
      if (_hasVoice(chunks[i])) break;
      n++;
    }
    return n;
  }

  function _buildWindow(chunks, targetLength) {
    const total = chunks.reduce((n, c) => n + (c ? c.length : 0), 0);
    if (!total) return { output: new Float32Array(0), totalLength: 0 };
    const outLen = Math.min(total, Math.max(1, targetLength));
    const out    = new Float32Array(outLen);
    let wo       = outLen;
    for (let i = chunks.length - 1; i >= 0 && wo > 0; i--) {
      const c = chunks[i];
      if (!c || !c.length) continue;
      const take = Math.min(c.length, wo);
      wo -= take;
      out.set(c.subarray(c.length - take), wo);
    }
    return { output: out, totalLength: total };
  }

  function _isUsefulTranscript(text) {
    const t = String(text || '').trim();
    if (!t) return false;
    const compact = t.replace(/[^A-Za-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    if (!compact || compact.length < 3) return false;
    const parts = compact.split(' ');
    if (parts.length === 1 && compact.length < 4) return false;
    return /[A-Za-z0-9]/.test(compact);
  }

  // ---------------------------------------------------------------------------
  // LocalEngine
  // ---------------------------------------------------------------------------
  class LocalEngine {
    constructor({ modelId, deviceId, onTranscript, onStatus, onModelState }) {
      this.modelId       = modelId || DEFAULT_MODEL;
      this.deviceId      = deviceId || null;
      this.onTranscript  = onTranscript;
      this.onStatus      = onStatus;
      this._onModelState = typeof onModelState === 'function' ? onModelState : null;

      this._running        = false;
      this._audioContext   = null;
      this._stream         = null;
      this._processorNode  = null;
      this._muteNode       = null;
      this._audioChunks    = [];
      this._processingTimer = 0;
      this._transcribing   = false;
      this._stateHandler   = null;
    }

    get name() { return 'local'; }

    // Called by the Download button — loads model without starting audio.
    async downloadModel() {
      const handler = (obj) => { if (this._onModelState) this._onModelState(obj); };
      _stateListeners.add(handler);
      this._stateHandler = handler;
      try {
        await _ensureModel(this.modelId);
      } catch (err) {
        throw err;
      }
    }

    async start() {
      if (this._running) return;
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        throw new Error(buildMicUnavailableMessage());
      }

      // Register state listener before model load so progress is visible.
      const handler = (obj) => { if (this._onModelState) this._onModelState(obj); };
      _stateListeners.add(handler);
      this._stateHandler = handler;

      try {
        this.onStatus({ running: false, engine: 'local', message: 'Loading local AI model…' });
        await _ensureModel(this.modelId);

        this.onStatus({ running: false, engine: 'local', message: 'Requesting microphone…' });
        this._stream = await openMicStream(this.deviceId);

        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (typeof AudioCtx !== 'function') throw new Error('AudioContext is not available');
        const ctx = new AudioCtx({ sampleRate: 16000 });
        if (ctx.state === 'suspended' && typeof ctx.resume === 'function') await ctx.resume();

        const sourceNode    = ctx.createMediaStreamSource(this._stream);
        const processorNode = ctx.createScriptProcessor(2048, 1, 1);
        const muteNode      = ctx.createGain();
        muteNode.gain.value = 0;

        this._audioContext  = ctx;
        this._processorNode = processorNode;
        this._muteNode      = muteNode;
        this._audioChunks   = [];

        processorNode.onaudioprocess = (ev) => {
          if (!this._running) return;
          const data = ev && ev.inputBuffer && ev.inputBuffer.getChannelData(0);
          if (!data || !data.length) return;
          this._audioChunks.push(new Float32Array(data));
          if (this._audioChunks.length > MAX_AUDIO_CHUNKS) {
            this._audioChunks = this._audioChunks.slice(-Math.floor(MAX_AUDIO_CHUNKS / 2));
          }
        };

        sourceNode.connect(processorNode);
        processorNode.connect(muteNode);
        muteNode.connect(ctx.destination);

        this._running = true;
        this.onStatus({ running: true, engine: 'local' });
        this._schedule(PROCESSING_DELAY_MS);
      } catch (err) {
        _stateListeners.delete(handler);
        this._stateHandler = null;
        this._stopAudio();
        throw err;
      }
    }

    stop() {
      this._running = false;
      if (this._processingTimer) { clearTimeout(this._processingTimer); this._processingTimer = 0; }
      this._stopAudio();
      if (this._stateHandler) { _stateListeners.delete(this._stateHandler); this._stateHandler = null; }
      this.onStatus({ running: false, engine: 'local' });
    }

    _stopAudio() {
      if (this._processorNode) { try { this._processorNode.disconnect(); } catch (_) {} this._processorNode = null; }
      if (this._muteNode)      { try { this._muteNode.disconnect();      } catch (_) {} this._muteNode      = null; }
      if (this._audioContext)  { try { this._audioContext.close();        } catch (_) {} this._audioContext  = null; }
      if (this._stream)        { this._stream.getTracks().forEach((t) => { try { t.stop(); } catch (_) {} }); this._stream = null; }
      this._audioChunks  = [];
      this._transcribing = false;
    }

    _schedule(ms) {
      if (this._processingTimer) { clearTimeout(this._processingTimer); this._processingTimer = 0; }
      this._processingTimer = setTimeout(() => {
        this._processingTimer = 0;
        if (!this._running) return;
        this._process().catch((err) => {
          const msg = (err && err.message) ? err.message : 'Local AI processing error';
          this._running = false;
          this.onStatus({ running: false, engine: 'local', error: msg });
        });
        if (this._running) this._schedule(PROCESSING_DELAY_MS);
      }, Math.max(100, ms || PROCESSING_DELAY_MS));
    }

    async _process() {
      if (!this._audioChunks.length || this._transcribing) {
        if (this._audioChunks.length > BUSY_BUFFER_LIMIT) {
          this._audioChunks = this._audioChunks.slice(-BUSY_BUFFER_KEEP);
        }
        return;
      }
      if (!this._audioChunks.some(_hasVoice)) {
        if (this._audioChunks.length > NO_VOICE_CONTEXT_CHUNKS) {
          this._audioChunks = this._audioChunks.slice(-NO_VOICE_CONTEXT_CHUNKS);
        }
        return;
      }
      const chunks       = this._audioChunks.slice();
      const silent       = _trailingSilent(chunks);
      const finalize     = silent >= FINALIZE_SILENCE_CHUNKS;
      const target       = finalize ? FINAL_TARGET_SAMPLES : INTERIM_TARGET_SAMPLES;
      const { output, totalLength } = _buildWindow(chunks, target);
      if (totalLength < MIN_AUDIO_SAMPLES) return;
      if (!finalize) {
        // Local Moonshine is cleaner when we wait for a short silence and emit
        // final phrases only, rather than noisy interim fragments.
        return;
      }

      const overlap = finalize ? FINAL_OVERLAP_CHUNKS : INTERIM_OVERLAP_CHUNKS;
      if (this._audioChunks.length > overlap) {
        this._audioChunks = this._audioChunks.slice(-overlap);
      }
      this._transcribing = true;
      try {
        const buf    = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength);
        const result = await _send('transcribe', {
          audioBuffer: buf,
          modelId:     this.modelId,
          language:    'en',
          isFinal:     finalize
        });
        const text    = String((result && result.text) ? result.text : '').trim();
        const isFinal = !!(result && result.is_final);
        if (isFinal && _isUsefulTranscript(text)) {
          try { this.onTranscript({ text, isFinal: true }); } catch (_) {}
        }
      } finally {
        this._transcribing = false;
      }
    }
  }

  // Public API
  root.BSPLocalEngine         = LocalEngine;
  root.BSP_LOCAL_MODELS       = LOCAL_MODELS;
  root.BSP_LOCAL_DEFAULT_MODEL = DEFAULT_MODEL;

  // Standalone download — called by the Download button before start().
  root.bspHelperDownloadLocalModel = async function bspHelperDownloadLocalModel(modelId, onState) {
    if (typeof onState === 'function') _stateListeners.add(onState);
    try {
      await _ensureModel(modelId || DEFAULT_MODEL);
    } finally {
      if (typeof onState === 'function') _stateListeners.delete(onState);
    }
  };

  root.bspHelperLocalModelState = function bspHelperLocalModelState() {
    return { state: _modelState, loadedModelId: _loadedModelId };
  };

})(typeof window !== 'undefined' ? window : globalThis);
