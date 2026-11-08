/** Collect page, content-script and worker diagnostics, plus Chrome's own extension error records. */
export class ExtensionDiagnostics {
  #entries = new Map();
  #phase = 'startup';

  constructor(context) {
    context.on('console', (message) => {
      if (!['warning', 'error'].includes(message.type())) return;
      const location = message.location();
      const source = location.url || message.worker()?.url() || message.page()?.url() || '';
      if (!source.startsWith('chrome-extension://')) return;
      this.add(message.type(), message.text(), source, location.lineNumber);
    });
    context.on('weberror', (event) => {
      this.add('exception', event.error().message, event.error().stack || event.page()?.url() || '');
    });
  }

  phase(name) { this.#phase = name; }

  add(kind, message, source = '', line) {
    const key = `${kind}:${message}:${source}`;
    const entry = this.#entries.get(key);
    if (entry) return;
    this.#entries.set(key, { phase: this.#phase, kind, message, source, ...(line === undefined ? {} : { line }) });
  }

  async collect(manager, extensionId) {
    const records = await manager.evaluate(async (id) => {
      // This private Chromium API is used only on chrome://extensions in this isolated test profile.
      const info = await chrome.developerPrivate.getExtensionInfo(id);
      return { manifest: info.manifestErrors, runtime: info.runtimeErrors };
    }, extensionId);
    if (!Array.isArray(records.manifest) || !Array.isArray(records.runtime)) {
      throw new Error('Extension check could not read Chrome extension error records');
    }
    for (const error of [...records.manifest, ...records.runtime]) {
      if (error.severity === 'LOG') continue;
      this.add(error.type === 'MANIFEST' ? 'manifest' : error.severity.toLowerCase(), error.message,
        error.stackTrace?.[0]?.url || error.source || error.contextUrl, error.stackTrace?.[0]?.lineNumber);
    }
  }

  get entries() { return [...this.#entries.values()]; }
}
