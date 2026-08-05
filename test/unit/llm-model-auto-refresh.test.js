/* eslint-disable no-new-func */
/**
 * Tests for per-provider model list auto-refresh in LLMConfigManager:
 * building the listing request, parsing each provider's response shape,
 * repopulating the model dropdown, cache staleness, and failure handling.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';

const LLM_CONFIG_MANAGER_PATH = path.join(process.cwd(), 'src/renderer/modules/LLMConfigManager.js');
const INDEX_HTML_PATH = path.join(process.cwd(), 'src/renderer/index.html');

function loadLLMConfigManager() {
  const code = fs.readFileSync(LLM_CONFIG_MANAGER_PATH, 'utf-8');
  return new Function(`${code}; return LLMConfigManager;`)();
}

const LLMConfigManagerClass = loadLLMConfigManager();

function createManager() {
  return new LLMConfigManagerClass({}, null);
}

/**
 * Minimal markup mirroring one provider tab in index.html.
 */
function renderProviderTab(providerKey, options = '') {
  document.body.innerHTML = `
    <input type="password" id="${providerKey}ApiKey" value="">
    <button id="refresh${providerKey.charAt(0).toUpperCase() + providerKey.slice(1)}ModelsBtn"></button>
    <select id="${providerKey}Model">
      ${options}
      <option value="other">Other (specify below)</option>
    </select>
    <small id="${providerKey}ModelsStatus"></small>
    <div id="${providerKey}ModelOtherGroup" style="display: none;">
      <input type="text" id="${providerKey}ModelOther" value="">
    </div>
    <input type="text" id="${providerKey}BaseUrl" value="">
  `;
}

function mockJsonResponse(body, init = {}) {
  return {
    ok: init.ok !== undefined ? init.ok : true,
    status: init.status || 200,
    statusText: init.statusText || 'OK',
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe('LLMConfigManager model list auto-refresh', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('buildModelListRequest', () => {
    it('uses the OpenAI-compatible /models endpoint with a bearer token', () => {
      const manager = createManager();
      const request = manager.buildModelListRequest('openai', {
        apiKey: 'sk-test',
        baseUrl: 'https://api.openai.com/v1',
      });

      expect(request.url).toBe('https://api.openai.com/v1/models');
      expect(request.headers.Authorization).toBe('Bearer sk-test');
    });

    it('uses the Anthropic model endpoint with the direct browser access header', () => {
      const manager = createManager();
      const request = manager.buildModelListRequest('anthropic', {
        apiKey: 'sk-ant-test',
        baseUrl: 'https://api.anthropic.com',
      });

      expect(request.url).toContain('https://api.anthropic.com/v1/models');
      expect(request.headers['x-api-key']).toBe('sk-ant-test');
      expect(request.headers['anthropic-version']).toBe('2023-06-01');
      expect(request.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    });

    it('uses the Google v1beta path with the key as a query parameter', () => {
      const manager = createManager();
      const request = manager.buildModelListRequest('google', {
        apiKey: 'AIza-test',
        baseUrl: 'https://generativelanguage.googleapis.com',
      });

      expect(request.url).toContain('https://generativelanguage.googleapis.com/v1beta/models');
      expect(request.url).toContain('key=AIza-test');
    });

    it('strips trailing slashes from the base URL', () => {
      const manager = createManager();
      const request = manager.buildModelListRequest('deepseek', {
        apiKey: 'sk-test',
        baseUrl: 'https://api.deepseek.com/v1/',
      });

      expect(request.url).toBe('https://api.deepseek.com/v1/models');
    });

    it('returns null for cloud providers without an API key', () => {
      const manager = createManager();
      expect(manager.buildModelListRequest('openai', { apiKey: '', baseUrl: 'https://api.openai.com/v1' })).toBeNull();
      expect(manager.buildModelListRequest('anthropic', { apiKey: '  ' })).toBeNull();
      expect(manager.buildModelListRequest('google', { apiKey: '' })).toBeNull();
    });

    it('allows the custom endpoint to list models without an API key', () => {
      const manager = createManager();
      const request = manager.buildModelListRequest('local', { apiKey: '', baseUrl: 'http://localhost:11434/v1' });

      expect(request.url).toBe('http://localhost:11434/v1/models');
      expect(request.headers.Authorization).toBeUndefined();
    });
  });

  describe('extractModelIds', () => {
    it('reads OpenAI-compatible and Anthropic { data: [{ id }] } payloads', () => {
      const manager = createManager();
      const ids = manager.extractModelIds('openai', {
        data: [{ id: 'gpt-5.5' }, { id: 'gpt-5.5-pro' }, { id: 'gpt-5.5' }],
      });

      expect(ids).toEqual(['gpt-5.5', 'gpt-5.5-pro']);
    });

    it('strips the models/ prefix from Google entries', () => {
      const manager = createManager();
      const ids = manager.extractModelIds('google', {
        models: [{ name: 'models/gemini-3.5-flash' }, { name: 'models/text-embedding-004' }],
      });

      expect(ids).toEqual(['gemini-3.5-flash', 'text-embedding-004']);
    });

    it('ignores entries without a usable id', () => {
      const manager = createManager();
      expect(manager.extractModelIds('openai', { data: [{ id: '' }, {}, { id: '  spaced  ' }] })).toEqual(['spaced']);
    });
  });

  describe('fetchProviderModels', () => {
    it('returns the ids reported by the provider', async () => {
      const manager = createManager();
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => mockJsonResponse({ data: [{ id: 'gpt-5.5' }, { id: 'o9-preview' }] }))
      );

      const models = await manager.fetchProviderModels('openai', { apiKey: 'sk-test' });
      expect(models).toEqual(['gpt-5.5', 'o9-preview']);
    });

    it('flags a missing listing endpoint as unsupported rather than a failure', async () => {
      const manager = createManager();
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => mockJsonResponse({}, { ok: false, status: 404, statusText: 'Not Found' }))
      );

      await expect(manager.fetchProviderModels('minimax', { apiKey: 'key' })).rejects.toMatchObject({
        code: 'MODEL_LIST_UNSUPPORTED',
      });
    });

    it('surfaces the HTTP status for other errors', async () => {
      const manager = createManager();
      vi.stubGlobal(
        'fetch',
        vi.fn(async () =>
          mockJsonResponse({ error: 'bad key' }, { ok: false, status: 401, statusText: 'Unauthorized' })
        )
      );

      await expect(manager.fetchProviderModels('openai', { apiKey: 'sk-bad' })).rejects.toThrow(/401/);
    });

    it('rejects an empty model list instead of wiping the cached one', async () => {
      const manager = createManager();
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => mockJsonResponse({ data: [] }))
      );

      await expect(manager.fetchProviderModels('openai', { apiKey: 'sk-test' })).rejects.toThrow(/empty model list/i);
    });
  });

  describe('orderFetchedModels', () => {
    it('keeps built-in models first, sorts discovered ones, and drops unreported built-ins', () => {
      const manager = createManager();
      manager.builtInModels.test = ['known-a', 'known-b', 'retired'];

      const ordered = manager.orderFetchedModels('test', ['zeta-new', 'known-b', 'alpha-new', 'known-a']);

      expect(ordered).toEqual(['known-a', 'known-b', 'alpha-new', 'zeta-new']);
    });
  });

  describe('refreshProviderModels', () => {
    it('stores the refreshed list and rebuilds the dropdown', async () => {
      renderProviderTab('openai', '<option value="gpt-5.5">GPT-5.5 (Thinking / Standard - $5/$30 per M)</option>');
      const manager = createManager();
      await manager.waitForInitialization();
      manager.providers.openai.apiKey = 'sk-test';
      manager.providers.openai.model = 'gpt-5.5';

      vi.stubGlobal(
        'fetch',
        vi.fn(async () => mockJsonResponse({ data: [{ id: 'gpt-5.5' }, { id: 'gpt-6-preview' }] }))
      );

      const result = await manager.refreshProviderModels('openai', { silent: true, persist: false });

      expect(result.success).toBe(true);
      expect(manager.providers.openai.remoteModels).toEqual(['gpt-5.5', 'gpt-6-preview']);
      expect(manager.providers.openai.modelsSource).toBe('remote');
      expect(manager.providers.openai.availableModels).toContain('gpt-6-preview');

      const select = document.getElementById('openaiModel');
      const group = document.getElementById('openaiFetchedModelsOptgroup');
      expect(group).not.toBeNull();
      expect(Array.from(group.children).map(option => option.value)).toEqual(['gpt-5.5', 'gpt-6-preview']);
      // The shipped label is reused for models the provider also reports
      expect(group.children[0].textContent).toContain('$5/$30 per M');
      // ...and the model is not listed a second time outside the group
      expect(Array.from(select.options).filter(option => option.value === 'gpt-5.5')).toHaveLength(1);
      expect(manager.hasModelOption(select, 'other')).toBe(true);
      expect(select.value).toBe('gpt-5.5');
    });

    it('keeps the built-in list and reports the error when the refresh fails', async () => {
      renderProviderTab('openai', '<option value="gpt-5.5">GPT-5.5</option>');
      const manager = createManager();
      await manager.waitForInitialization();
      manager.providers.openai.apiKey = 'sk-bad';
      const builtIn = [...manager.providers.openai.availableModels];

      vi.stubGlobal(
        'fetch',
        vi.fn(async () => mockJsonResponse({}, { ok: false, status: 401, statusText: 'Unauthorized' }))
      );

      const result = await manager.refreshProviderModels('openai', { silent: true, persist: false });

      expect(result.success).toBe(false);
      expect(manager.providers.openai.availableModels).toEqual(builtIn);
      expect(manager.providers.openai.modelsSource).toBeUndefined();
      expect(document.getElementById('openaiModelsStatus').textContent).toContain('401');
      expect(document.getElementById('openaiModelsStatus').classList.contains('is-error')).toBe(true);
    });

    it('explains an unsupported listing endpoint without calling it a failure', async () => {
      renderProviderTab('minimax', '<option value="MiniMax-M2.7">MiniMax-M2.7</option>');
      const manager = createManager();
      await manager.waitForInitialization();
      manager.providers.minimax.apiKey = 'key';

      vi.stubGlobal(
        'fetch',
        vi.fn(async () => mockJsonResponse({}, { ok: false, status: 404, statusText: 'Not Found' }))
      );

      await manager.refreshProviderModels('minimax', { silent: true, persist: false });

      const status = document.getElementById('minimaxModelsStatus');
      expect(status.textContent).toContain('does not publish a model list');
      expect(status.classList.contains('is-warning')).toBe(true);
    });

    it('reuses the in-flight request instead of issuing a second one', async () => {
      renderProviderTab('openai');
      const manager = createManager();
      await manager.waitForInitialization();
      manager.providers.openai.apiKey = 'sk-test';

      const fetchMock = vi.fn(async () => mockJsonResponse({ data: [{ id: 'gpt-5.5' }] }));
      vi.stubGlobal('fetch', fetchMock);

      const [first, second] = await Promise.all([
        manager.refreshProviderModels('openai', { silent: true, persist: false }),
        manager.refreshProviderModels('openai', { silent: true, persist: false }),
      ]);

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(first.success).toBe(true);
      expect(second).toEqual(first);
    });

    it('replaces the shipped options with what the provider reported', async () => {
      renderProviderTab(
        'openai',
        `<optgroup label="Shipped">
           <option value="gpt-5.5">GPT-5.5 (Thinking / Standard - $5/$30 per M)</option>
           <option value="retired-model">Retired Model</option>
         </optgroup>`
      );
      const manager = createManager();
      await manager.waitForInitialization();
      manager.builtInModels.openai = ['gpt-5.5', 'retired-model'];
      manager.providers.openai.apiKey = 'sk-test';

      vi.stubGlobal(
        'fetch',
        vi.fn(async () => mockJsonResponse({ data: [{ id: 'gpt-5.5' }, { id: 'gpt-6-preview' }] }))
      );

      await manager.refreshProviderModels('openai', { silent: true, persist: false });

      const select = document.getElementById('openaiModel');
      // A model the provider no longer lists is gone from the dropdown and the
      // cached list — "Other" is how it can still be entered by hand
      expect(manager.hasModelOption(select, 'retired-model')).toBe(false);
      expect(manager.providers.openai.availableModels).toEqual(['gpt-5.5', 'gpt-6-preview']);
      expect(Array.from(select.options).map(option => option.value)).toEqual(['gpt-5.5', 'gpt-6-preview', 'other']);
      // The now-empty shipped group is not left behind as a stray label
      expect(select.querySelectorAll('optgroup')).toHaveLength(1);
    });

    it('falls back to the custom model field when the saved model is no longer offered', async () => {
      renderProviderTab('openai', '<option value="gpt-5.5">GPT-5.5</option>');
      const manager = createManager();
      await manager.waitForInitialization();
      manager.providers.openai.apiKey = 'sk-test';
      manager.providers.openai.model = 'my-fine-tune';
      document.getElementById('openaiModel').value = 'gpt-5.5';

      vi.stubGlobal(
        'fetch',
        vi.fn(async () => mockJsonResponse({ data: [{ id: 'gpt-5.5' }, { id: 'gpt-6-preview' }] }))
      );

      await manager.refreshProviderModels('openai', { silent: true, persist: false });

      // gpt-5.5 was still on screen and still offered, so it stays selected
      expect(document.getElementById('openaiModel').value).toBe('gpt-5.5');

      // Once it disappears from the provider's list the saved custom model wins
      manager.getModelRefreshState('openai').lastAttemptAt = 0;
      document.getElementById('openaiModel').value = 'gpt-6-preview';
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => mockJsonResponse({ data: [{ id: 'gpt-7' }] }))
      );
      await manager.refreshProviderModels('openai', { silent: true, persist: false });

      expect(document.getElementById('openaiModel').value).toBe('other');
      expect(document.getElementById('openaiModelOther').value).toBe('my-fine-tune');
      expect(document.getElementById('openaiModelOtherGroup').style.display).toBe('block');
    });
  });

  describe('isModelListStale', () => {
    it('is stale until a list has been fetched from the provider', () => {
      const manager = createManager();
      expect(manager.isModelListStale('openai')).toBe(true);
    });

    it('is fresh right after a refresh and stale past the TTL', () => {
      const manager = createManager();
      const provider = manager.providers.openai;
      provider.apiKey = 'sk-test';
      provider.remoteModels = ['gpt-5.5'];
      provider.modelsSource = 'remote';
      provider.modelsUpdatedAt = new Date().toISOString();
      provider.modelsFingerprint = manager.getProviderCredentialFingerprint(provider);

      expect(manager.isModelListStale('openai')).toBe(false);

      provider.modelsUpdatedAt = new Date(Date.now() - manager.modelRefreshTtlMs - 1000).toISOString();
      expect(manager.isModelListStale('openai')).toBe(true);
    });

    it('is stale as soon as the credentials change', () => {
      const manager = createManager();
      const provider = manager.providers.openai;
      provider.apiKey = 'sk-old';
      provider.remoteModels = ['gpt-5.5'];
      provider.modelsSource = 'remote';
      provider.modelsUpdatedAt = new Date().toISOString();
      provider.modelsFingerprint = manager.getProviderCredentialFingerprint(provider);

      expect(manager.isModelListStale('openai')).toBe(false);

      provider.apiKey = 'sk-new-key';
      expect(manager.isModelListStale('openai')).toBe(true);
    });

    it('does not keep a full copy of the API key in the fingerprint', () => {
      const manager = createManager();
      const fingerprint = manager.getProviderCredentialFingerprint({
        apiKey: 'sk-super-secret-value',
        baseUrl: 'https://api.openai.com/v1',
      });

      expect(fingerprint).not.toContain('sk-super-secret-value');
      expect(fingerprint).toContain('https://api.openai.com/v1');
    });
  });

  describe('maybeAutoRefreshProviderModels', () => {
    it('skips providers that have no credentials yet', async () => {
      const manager = createManager();
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      const result = await manager.maybeAutoRefreshProviderModels('openai');

      expect(result.skipped).toBe('no-credentials');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('skips a list that is still fresh', async () => {
      const manager = createManager();
      const provider = manager.providers.openai;
      provider.apiKey = 'sk-test';
      provider.remoteModels = ['gpt-5.5'];
      provider.modelsSource = 'remote';
      provider.modelsUpdatedAt = new Date().toISOString();
      provider.modelsFingerprint = manager.getProviderCredentialFingerprint(provider);

      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      expect((await manager.maybeAutoRefreshProviderModels('openai')).skipped).toBe('fresh');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does not retry a provider that was just attempted', async () => {
      const manager = createManager();
      manager.providers.openai.apiKey = 'sk-test';
      manager.getModelRefreshState('openai').lastAttemptAt = Date.now();

      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);

      expect((await manager.maybeAutoRefreshProviderModels('openai')).skipped).toBe('recently-attempted');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('fetches when credentials exist and the cached list is stale', async () => {
      const manager = createManager();
      manager.providers.openai.apiKey = 'sk-test';

      const fetchMock = vi.fn(async () => mockJsonResponse({ data: [{ id: 'gpt-5.5' }] }));
      vi.stubGlobal('fetch', fetchMock);

      const result = await manager.maybeAutoRefreshProviderModels('openai');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result.success).toBe(true);
    });
  });

  describe('reconcileBuiltInModelLists', () => {
    it('drops a persisted list that never came from the provider API', () => {
      const manager = createManager();
      manager.providers.openai.availableModels = ['stale-model-from-old-config'];

      manager.reconcileBuiltInModelLists();

      expect(manager.providers.openai.availableModels).toEqual(manager.builtInModels.openai);
    });

    it('keeps a remotely fetched list without re-adding the shipped models', () => {
      const manager = createManager();
      manager.providers.openai.modelsSource = 'remote';
      manager.providers.openai.remoteModels = ['gpt-5.5', 'gpt-6-preview'];
      manager.providers.openai.availableModels = ['gpt-5.5'];

      manager.reconcileBuiltInModelLists();

      expect(manager.providers.openai.availableModels).toEqual(['gpt-5.5', 'gpt-6-preview']);
      // Shipped models the provider did not report do not come back
      expect(manager.providers.openai.availableModels).not.toContain('gpt-5.5-pro');
    });
  });

  describe('wiring against the real configuration modal', () => {
    const mountConfigModal = () => {
      const html = fs.readFileSync(INDEX_HTML_PATH, 'utf-8');
      const body = html.slice(html.indexOf('<body'), html.indexOf('</body>'));
      document.body.innerHTML = body.slice(body.indexOf('>') + 1);
    };

    it('gives every provider tab a refresh button and status line with the ids the manager derives', async () => {
      mountConfigModal();
      const manager = createManager();
      await manager.waitForInitialization();

      Object.keys(manager.providers).forEach(providerKey => {
        const buttonId = `refresh${manager.capitalizeProviderKey(providerKey)}ModelsBtn`;
        expect(document.getElementById(`${providerKey}Model`), `${providerKey}Model`).not.toBeNull();
        expect(document.getElementById(buttonId), buttonId).not.toBeNull();
        expect(document.getElementById(`${providerKey}ModelsStatus`), `${providerKey}ModelsStatus`).not.toBeNull();
      });
    });

    it('refreshes a provider when its button is clicked', async () => {
      mountConfigModal();
      const manager = createManager();
      await manager.waitForInitialization();

      document.getElementById('openaiApiKey').value = 'sk-test';
      const fetchMock = vi.fn(async () => mockJsonResponse({ data: [{ id: 'gpt-5.5' }, { id: 'gpt-6-preview' }] }));
      vi.stubGlobal('fetch', fetchMock);

      document.getElementById('refreshOpenaiModelsBtn').click();
      await manager.getModelRefreshState('openai').inFlight;

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe('https://api.openai.com/v1/models');
      expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer sk-test');
      expect(document.getElementById('openaiFetchedModelsOptgroup')).not.toBeNull();
      expect(document.getElementById('openaiModelsStatus').textContent).toContain('2 models reported by OpenAI');
    });

    it('refreshes a stale list when its provider tab is opened', async () => {
      mountConfigModal();
      const manager = createManager();
      await manager.waitForInitialization();

      document.getElementById('deepseekApiKey').value = 'sk-deepseek';
      const fetchMock = vi.fn(async () => mockJsonResponse({ data: [{ id: 'deepseek-v4-flash' }] }));
      vi.stubGlobal('fetch', fetchMock);

      await manager.autoRefreshModelsForTab('deepseek');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock.mock.calls[0][0]).toBe('https://api.deepseek.com/v1/models');

      // A second visit inside the retry window must not hit the network again
      await manager.autoRefreshModelsForTab('deepseek');
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('refreshes every configured provider when the Model Selection tab is opened', async () => {
      mountConfigModal();
      const manager = createManager();
      await manager.waitForInitialization();

      document.getElementById('openaiApiKey').value = 'sk-openai';
      document.getElementById('anthropicApiKey').value = 'sk-ant';
      const fetchMock = vi.fn(async () => mockJsonResponse({ data: [{ id: 'model-a' }] }));
      vi.stubGlobal('fetch', fetchMock);

      await manager.autoRefreshModelsForTab('models');

      const requestedUrls = fetchMock.mock.calls.map(call => call[0]);
      expect(requestedUrls).toContain('https://api.openai.com/v1/models');
      expect(requestedUrls).toContain('https://api.anthropic.com/v1/models?limit=1000');
      // The custom endpoint needs no key, so its list is refreshed as well
      expect(requestedUrls).toContain('http://localhost:11434/v1/models');
      // Providers still missing an API key are left alone
      expect(requestedUrls.some(url => url.includes('generativelanguage'))).toBe(false);
      expect(requestedUrls.some(url => url.includes('openrouter'))).toBe(false);
    });
  });

  describe('custom endpoint dropdown', () => {
    it('rebuilds fetched models without discarding saved endpoint configurations', async () => {
      document.body.innerHTML = `
        <input type="text" id="localEndpoint" value="http://localhost:11434/v1">
        <input type="password" id="localApiKey" value="">
        <button id="refreshLocalModelsBtn"></button>
        <select id="localModel">
          <optgroup label="Qwen3 Series (Latest)">
            <option value="qwen3:8b">qwen3:8b (Latest - 5.2GB)</option>
          </optgroup>
          <optgroup label="Saved Configurations" id="localSavedModelsOptgroup" style="display: none;"></optgroup>
          <option value="other">Other (specify below)</option>
        </select>
        <small id="localModelsStatus"></small>
        <div id="localModelOtherGroup" style="display: none;">
          <input type="text" id="localModelOther" value="">
        </div>
      `;
      localStorage.setItem(
        'localCustomConfigs',
        JSON.stringify({ 'Lab server': { baseUrl: 'http://lab:11434/v1', model: 'llama4:70b' } })
      );

      const manager = createManager();
      await manager.waitForInitialization();

      vi.stubGlobal(
        'fetch',
        vi.fn(async () => mockJsonResponse({ data: [{ id: 'qwen3:8b' }, { id: 'llama4:70b' }] }))
      );

      await manager.refreshProviderModels('local', { silent: true, persist: false });

      // The custom endpoint ships no curated list, so everything it reports is
      // listed alphabetically
      const fetched = document.getElementById('localFetchedModelsOptgroup');
      expect(Array.from(fetched.children).map(option => option.value)).toEqual(['llama4:70b', 'qwen3:8b']);

      // The named configuration survives even though its model was also reported
      const saved = document.getElementById('localSavedModelsOptgroup');
      expect(Array.from(saved.children).map(option => option.textContent)).toEqual(['Lab server (llama4:70b)']);
    });
  });
});
