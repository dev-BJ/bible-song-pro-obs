// Lightweight WebSocket client for the BSP relay (ws://127.0.0.1:5511).
// Reconnects with backoff. JSON in, JSON out.
// Attaches to window.BSPRelayClient so the file works as a plain <script>
// in both file:// (Helper App) and http:// (OBS dock) contexts.
(function (root) {
  class RelayClient {
    constructor(url) {
      this.url = url;
      this.ws = null;
      this.handlers = new Map();
      this.statusHandler = null;
      this.reconnectTimer = 0;
      this.attempts = 0;
      this.connected = false;
      this.connect();
    }

    on(type, handler) {
      if (!this.handlers.has(type)) this.handlers.set(type, new Set());
      this.handlers.get(type).add(handler);
      return () => this.handlers.get(type)?.delete(handler);
    }

    onStatus(handler) {
      this.statusHandler = handler;
      handler(this.connected);
    }

    send(payload) {
      if (this.ws && this.ws.readyState === 1) {
        this.ws.send(JSON.stringify(payload));
        return true;
      }
      return false;
    }

    normalizeInbound(raw) {
      if (!raw || typeof raw !== 'object') return null;
      if (raw.type !== 'RS_ENVELOPE') return raw;
      if (!raw.payload || typeof raw.payload !== 'object') return null;
      return raw.payload;
    }

    connect() {
      try {
        this.ws = new WebSocket(this.url);
      } catch (e) {
        this.scheduleReconnect();
        return;
      }
      this.ws.addEventListener('open', () => {
        this.attempts = 0;
        this.setConnected(true);
      });
      this.ws.addEventListener('close', () => {
        this.setConnected(false);
        this.scheduleReconnect();
      });
      this.ws.addEventListener('error', () => { /* close fires after */ });
      this.ws.addEventListener('message', (event) => {
        let msg;
        try { msg = JSON.parse(event.data); } catch (_) { return; }
        msg = this.normalizeInbound(msg);
        if (!msg) return;
        const type = msg && msg.type;
        if (!type) return;
        const subs = this.handlers.get(type);
        if (subs) subs.forEach((fn) => { try { fn(msg); } catch (e) { console.error(e); } });
        const wild = this.handlers.get('*');
        if (wild) wild.forEach((fn) => { try { fn(msg); } catch (e) { console.error(e); } });
      });
    }

    scheduleReconnect() {
      if (this.reconnectTimer) return;
      const delay = Math.min(8000, 500 * Math.pow(1.6, this.attempts++));
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = 0;
        this.connect();
      }, delay);
    }

    setConnected(value) {
      if (this.connected === value) return;
      this.connected = value;
      if (this.statusHandler) this.statusHandler(value);
    }
  }

  root.BSPRelayClient = RelayClient;
})(typeof window !== 'undefined' ? window : globalThis);
