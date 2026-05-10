// Stub engine — emits scripted transcript lines on a timer so the
// end-to-end plumbing (Helper → relay → dock) can be validated before
// the real Deepgram/Moonshine engines are ported in.
(function (root) {
  class StubEngine {
    constructor({ onTranscript, onStatus }) {
      this.onTranscript = onTranscript;
      this.onStatus = onStatus;
      this.timer = 0;
      this.idx = 0;
      this.lines = [
        'For God so loved the world',
        'that he gave his only begotten Son',
        'that whosoever believeth in him should not perish',
        'but have everlasting life',
        'John chapter three verse sixteen',
        'The Lord is my shepherd I shall not want',
        'Psalm twenty three verse one'
      ];
    }

    get name() { return 'stub'; }

    async start() {
      if (this.timer) return;
      this.onStatus({ running: true, engine: 'stub' });
      this.timer = setInterval(() => {
        const text = this.lines[this.idx % this.lines.length];
        this.idx += 1;
        this.onTranscript({ text, isFinal: true });
      }, 2000);
    }

    stop() {
      if (this.timer) { clearInterval(this.timer); this.timer = 0; }
      this.onStatus({ running: false, engine: 'stub' });
    }
  }

  root.BSPStubEngine = StubEngine;
})(typeof window !== 'undefined' ? window : globalThis);
