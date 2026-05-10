// Deepgram realtime STT engine — ported from V16's
// js/panel/live-scripture-tools.js startDeepgramSession().
// Captures mic via getUserMedia, encodes with MediaRecorder
// (audio/webm;codecs=opus), and streams the WebM blobs to
// Deepgram's WebSocket endpoint. Deepgram does the decode +
// transcription server-side; the engine just forwards bytes.
(function (root) {
  const DG_URL = 'wss://api.deepgram.com/v1/listen?model=nova-2&punctuate=true&interim_results=true&endpointing=400';

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
    const baseAudio = { channelCount: 1, noiseSuppression: true, echoCancellation: true, autoGainControl: true };
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

  class DeepgramEngine {
    constructor({ apiKey, deviceId, onTranscript, onStatus }) {
      this.apiKey = apiKey;
      this.deviceId = deviceId || null;
      this.onTranscript = onTranscript;
      this.onStatus = onStatus;
      this.socket = null;
      this.recorder = null;
      this.stream = null;
      this.keepAliveTimer = 0;
      this.stopped = false;
    }

    get name() { return 'deepgram'; }

    async start() {
      if (!this.apiKey) throw new Error('Deepgram API key is required');
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error(buildMicUnavailableMessage());
      }
      if (typeof MediaRecorder === 'undefined') {
        throw new Error('MediaRecorder unavailable on this browser. Try latest Safari/Chrome on mobile.');
      }

      this.onStatus({ running: false, engine: 'deepgram', message: 'Requesting microphone…' });
      try {
        this.stream = await openMicStream(this.deviceId);
      } catch (err) {
        const msg = err && err.message ? err.message : buildMicUnavailableMessage();
        throw new Error(msg);
      }

      this.onStatus({ running: false, engine: 'deepgram', message: 'Connecting to Deepgram…' });
      this.socket = new WebSocket(DG_URL, ['token', this.apiKey]);

      await new Promise((resolve, reject) => {
        let settled = false;
        this.socket.addEventListener('open', () => {
          if (settled) return;
          settled = true;
          resolve();
        });
        this.socket.addEventListener('error', () => {
          if (settled) return;
          settled = true;
          reject(new Error('Deepgram connection failed'));
        });
        this.socket.addEventListener('close', (ev) => {
          if (!settled) {
            settled = true;
            const reason = (ev && ev.reason) ? `: ${ev.reason}` : '';
            reject(new Error(`Deepgram closed (${ev?.code || 0})${reason}`));
            return;
          }
          this._handleClose(ev);
        });
      });

      this.socket.addEventListener('message', (event) => {
        let payload;
        try { payload = JSON.parse(event.data); } catch (_) { return; }
        const text = payload && payload.channel && payload.channel.alternatives
          && payload.channel.alternatives[0] && payload.channel.alternatives[0].transcript;
        if (!text) return;
        try {
          this.onTranscript({ text, isFinal: !!payload.is_final });
        } catch (_) { /* swallow renderer errors */ }
      });

      const mimeType = MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus' : '';
      this.recorder = mimeType ? new MediaRecorder(this.stream, { mimeType }) : new MediaRecorder(this.stream);
      this.recorder.addEventListener('dataavailable', async (event) => {
        if (!event.data || !event.data.size) return;
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return;
        try {
          const buffer = await event.data.arrayBuffer();
          this.socket.send(buffer);
        } catch (_) { /* ignore stream-blob errors */ }
      });
      this.recorder.addEventListener('error', (ev) => {
        const msg = ev && ev.error && ev.error.message ? ev.error.message : 'recorder error';
        this.onStatus({ running: false, engine: 'deepgram', error: msg });
        this.stop();
      });
      this.recorder.start(250);

      // Deepgram closes idle sockets; ping every 8s when not speaking.
      this.keepAliveTimer = setInterval(() => {
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
          try { this.socket.send(JSON.stringify({ type: 'KeepAlive' })); } catch (_) {}
        }
      }, 8000);

      this.onStatus({ running: true, engine: 'deepgram' });
    }

    _handleClose(ev) {
      if (this.stopped) return;
      const code = ev && ev.code;
      const reason = ev && ev.reason ? `: ${ev.reason}` : '';
      const isClean = code === 1000;
      this.stop();
      this.onStatus({
        running: false,
        engine: 'deepgram',
        error: isClean ? null : `Deepgram closed (${code || 0})${reason}`
      });
    }

    stop() {
      this.stopped = true;
      if (this.keepAliveTimer) { clearInterval(this.keepAliveTimer); this.keepAliveTimer = 0; }
      if (this.recorder) {
        try { if (this.recorder.state !== 'inactive') this.recorder.stop(); } catch (_) {}
        this.recorder = null;
      }
      if (this.socket) {
        try { this.socket.close(1000, 'client stop'); } catch (_) {}
        this.socket = null;
      }
      if (this.stream) {
        this.stream.getTracks().forEach((t) => { try { t.stop(); } catch (_) {} });
        this.stream = null;
      }
      this.onStatus({ running: false, engine: 'deepgram' });
    }
  }

  root.BSPDeepgramEngine = DeepgramEngine;
})(typeof window !== 'undefined' ? window : globalThis);
