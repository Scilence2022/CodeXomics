/** Evo 2 DNA generation. Results remain separate from the loaded genome. */
class Evo2UI {
  constructor(app) {
    this.app = app;
    this.service = new window.Evo2Service();
    this.jobId = null;
    this.result = null;
    this.timer = null;
    this.busy = false;
  }

  element(id) {
    return this.modal.querySelector(`#evo2${id}`);
  }

  ensureModal() {
    if (this.modal) return;
    this.modal = document.createElement('div');
    this.modal.className = 'modal evo2-modal';
    this.modal.id = 'evo2Modal';
    this.modal.setAttribute('role', 'dialog');
    this.modal.setAttribute('aria-modal', 'true');
    this.modal.setAttribute('aria-labelledby', 'evo2Title');
    this.modal.innerHTML = `
      <div class="modal-content large">
        <div class="modal-header"><h3 id="evo2Title">Evo 2 · DNA Generation</h3>
          <button type="button" class="modal-close" id="evo2Close" aria-label="Close Evo 2">&times;</button></div>
        <div class="modal-body">
          <p class="help-text">arc/evo2-40b · NVIDIA NIM. Your input DNA is sent to NVIDIA when you generate.</p>
          <details id="evo2Credentials"><summary>NVIDIA API key <span id="evo2Configured"></span></summary>
            <div class="evo2-actions">
              <label for="evo2Key">API key</label><input id="evo2Key" type="password" autocomplete="off" spellcheck="false" placeholder="nvapi-…">
              <button type="button" class="btn btn-secondary" id="evo2SaveKey">Save key</button>
              <button type="button" class="btn btn-secondary" id="evo2RemoveKey">Remove key</button>
            </div><p class="help-text">Saved with OS encryption on this computer.</p>
          </details>
          <form id="evo2Form">
            <label for="evo2Sequence">Input DNA or one FASTA record</label>
            <textarea id="evo2Sequence" rows="5" required spellcheck="false" placeholder="ACGT…"></textarea>
            <div class="evo2-actions">
              <button type="button" class="btn btn-secondary btn-sm" id="evo2Region">Use visible region</button>
              <span id="evo2Source" class="help-text">A / C / G / T / N · up to 100,000 bases</span>
            </div>
            <div class="evo2-grid">
              <label for="evo2Tokens">New tokens<input id="evo2Tokens" type="number" min="1" max="1200" step="1" value="100" required></label>
              <label for="evo2Temperature">Temperature<input id="evo2Temperature" type="number" min="0.01" max="1.3" step="any" value="0.7" required></label>
              <label for="evo2TopK">Top K<input id="evo2TopK" type="number" min="0" max="6" step="1" value="3" required></label>
              <label for="evo2TopP">Top P<input id="evo2TopP" type="number" min="0" max="1" step="any" value="1" required></label>
              <label for="evo2Seed">Random seed (optional)<input id="evo2Seed" type="number" step="1" placeholder="Automatic"></label>
            </div>
            <details><summary>Advanced options</summary>
              <label for="evo2Taxonomy">Taxonomy prompt (optional)</label>
              <input id="evo2Taxonomy" type="text" placeholder="|k__…;p__…;c__…;o__…;g__…;s__…|">
              <div class="evo2-actions">
                <label><input id="evo2Probs" type="checkbox" checked> Token probabilities</label>
                <label><input id="evo2Logits" type="checkbox"> Logits (larger output)</label>
                <label><input id="evo2Timing" type="checkbox"> Per-token timing</label>
              </div>
            </details>
            <div class="evo2-actions">
              <button type="submit" class="btn btn-primary" id="evo2Generate">Generate DNA</button>
              <button type="button" class="btn btn-secondary" id="evo2Cancel" disabled>Cancel</button>
              <button type="button" class="btn btn-secondary" id="evo2Refresh" hidden>Refresh result</button>
            </div>
          </form>
          <p id="evo2Status" role="status" aria-live="polite">Ready.</p>
          <section id="evo2Results" hidden>
            <label for="evo2Output">Generated sequence</label>
            <textarea id="evo2Output" rows="5" readonly spellcheck="false"></textarea>
            <p id="evo2Metrics" class="help-text"></p>
            <div class="evo2-actions">
              <button type="button" class="btn btn-secondary" id="evo2Copy">Copy sequence</button>
              <button type="button" class="btn btn-secondary" id="evo2Fasta">Export FASTA</button>
              <button type="button" class="btn btn-secondary" id="evo2Json">Export JSON</button>
            </div>
          </section>
        </div>
      </div>`;
    document.body.appendChild(this.modal);
    const on = (id, fn) => this.element(id).addEventListener('click', () => this.perform(fn));
    on('Close', () => this.close());
    on('SaveKey', () => this.saveKey());
    on('RemoveKey', () => this.saveKey(true));
    on('Region', () => this.useRegion());
    on('Cancel', () => this.cancel());
    on('Refresh', () => this.poll());
    on('Copy', async () => {
      await navigator.clipboard.writeText(this.result.result.sequence);
      this.status('Sequence copied.');
    });
    on('Fasta', () => this.exportResult('fasta'));
    on('Json', () => this.exportResult('json'));
    this.element('Sequence').addEventListener('input', () => {
      this.element('Source').textContent = 'Custom input · up to 100,000 bases';
    });
    this.element('Form').addEventListener('submit', event => {
      event.preventDefault();
      this.perform(() => this.generate());
    });
    this.modal.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        this.close();
      }
      if (event.key === 'Tab') {
        const items = [...this.modal.querySelectorAll('button, input, textarea, summary')].filter(
          item => !item.disabled && item.getClientRects().length
        );
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        }
        if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    });
  }

  async perform(action) {
    try {
      await action();
    } catch (error) {
      this.status(error.message, true);
    }
  }

  status(message, error = false) {
    this.element('Status').textContent = message;
    this.element('Status').classList.toggle('evo2-error', error);
  }

  check(response) {
    if (!response?.success) throw new Error(response?.error || 'Evo 2 request failed.');
    return response;
  }

  async open() {
    this.ensureModal();
    this.previousFocus = document.activeElement;
    document.getElementById('optionsDropdownMenu')?.classList.remove('show');
    this.modal.classList.add('show');
    this.element('Close').focus();
    await this.perform(async () => {
      this.showSettings(this.check(await this.service.invoke('evo2:settings')));
      if (this.jobId && this.busy) await this.poll();
    });
  }

  close() {
    this.modal.classList.remove('show');
    clearTimeout(this.timer);
    this.element('Key').value = '';
    this.previousFocus?.focus();
  }

  showSettings(settings) {
    this.element('Configured').textContent = settings.configured ? '— configured' : '— not configured';
    this.element('Credentials').open = !settings.configured;
  }

  async saveKey(removeKey = false) {
    const apiKey = this.element('Key').value;
    try {
      this.showSettings(this.check(await this.service.invoke('evo2:save-settings', { apiKey, removeKey })));
      this.status(removeKey ? 'API key removed.' : 'API key saved. Generate a short sequence to verify access.');
    } finally {
      this.element('Key').value = '';
    }
  }

  useRegion() {
    const chromosome = document.getElementById('chromosomeSelect')?.value || this.app?.currentChromosome;
    const sequence = this.app?.currentSequence?.[chromosome];
    const { start, end } = this.app?.currentPosition || {};
    if (typeof sequence !== 'string' || !Number.isInteger(start) || !Number.isInteger(end) || end <= start) {
      throw new Error('Load a genome and navigate to a region first.');
    }
    if (end - start > 100000) throw new Error('Zoom to a region of at most 100,000 bases first.');
    this.element('Sequence').value = sequence.slice(start, end);
    this.element('Source').textContent =
      `${chromosome}:${start + 1}-${Math.min(end, sequence.length)} (forward strand)`;
  }

  setBusy(busy) {
    this.busy = busy;
    this.element('Generate').disabled = busy;
    this.element('Cancel').disabled = !busy || !this.jobId;
  }

  async generate() {
    if (this.busy) return;
    this.jobId = null;
    this.setBusy(true);
    this.result = null;
    this.element('Results').hidden = true;
    this.element('Refresh').hidden = true;
    this.status('Submitting to NVIDIA…');
    try {
      const params = {
        sequence: this.element('Sequence').value,
        taxonomy: this.element('Taxonomy').value.trim(),
        num_tokens: Number(this.element('Tokens').value),
        temperature: Number(this.element('Temperature').value),
        top_k: Number(this.element('TopK').value),
        top_p: Number(this.element('TopP').value),
        enable_sampled_probs: this.element('Probs').checked,
        enable_logits: this.element('Logits').checked,
        enable_elapsed_ms_per_token: this.element('Timing').checked,
      };
      if (this.element('Seed').value !== '') params.random_seed = Number(this.element('Seed').value);
      const job = this.check(await this.service.evo2Generate(params));
      this.jobId = job.job_id;
      this.setBusy(true);
      await this.poll();
    } catch (error) {
      this.setBusy(false);
      throw error;
    }
  }

  async poll() {
    clearTimeout(this.timer);
    this.element('Refresh').hidden = true;
    try {
      const job = await this.service.evo2GetResult({ job_id: this.jobId });
      if (job.status === 'running') {
        this.status(
          `Generating DNA… ${Math.floor(job.elapsed_ms / 1000)} s. You can close this panel and reopen it later.`
        );
        if (this.modal.classList.contains('show')) this.timer = setTimeout(() => this.perform(() => this.poll()), 2000);
        return;
      }
      this.setBusy(false);
      this.check(job);
      this.result = job;
      this.element('Output').value = job.result.sequence;
      this.element('Metrics').textContent =
        `${job.result.sequence.length} generated bases · NVIDIA processing ${(job.result.elapsed_ms / 1000).toFixed(2)} s` +
        (job.result.sampled_probs ? ` · ${job.result.sampled_probs.length} token probabilities available in JSON` : '');
      this.element('Results').hidden = false;
      this.status('Generation complete. Export the result to keep it after closing the app.');
    } catch (error) {
      this.element('Refresh').hidden = false;
      throw error;
    }
  }

  async cancel() {
    if (!this.jobId) return;
    clearTimeout(this.timer);
    const job = await this.service.evo2Cancel({ job_id: this.jobId });
    if (job.status !== 'cancelled') {
      this.check(job);
      await this.poll();
      return;
    }
    this.setBusy(false);
    this.status(job.error);
  }

  async exportResult(format) {
    if (!this.result) return;
    const result =
      format === 'json'
        ? this.check(await this.service.evo2GetResult({ job_id: this.jobId, include_logits: true }))
        : this.result;
    const sequence = result.result.sequence;
    const data =
      format === 'json'
        ? JSON.stringify(result, null, 2)
        : `>evo2-40b_${result.job_id} generated_sequence\n${sequence.match(/.{1,80}/g).join('\n')}\n`;
    const url = URL.createObjectURL(new Blob([data], { type: format === 'json' ? 'application/json' : 'text/plain' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `evo2-${result.job_id}.${format}`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

if (typeof window !== 'undefined') {
  window.Evo2UI = Evo2UI;
  document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('evo2Btn')?.addEventListener('click', () => {
      if (!window.evo2UI) window.evo2UI = new Evo2UI(window.genomeBrowser);
      window.evo2UI.open();
    });
  });
}
if (typeof module !== 'undefined' && module.exports) module.exports = Evo2UI;
