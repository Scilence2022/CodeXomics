'use strict';

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

test('relaunch restores activity and the tool exchanges for a follow-up', async () => {
  const root = path.join(__dirname, '..', '..');
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'codexomics-chat-restart-'));
  const bootstrap = path.join(profile, 'bootstrap.cjs');
  const fixture = path.join(profile, 'test.fa');
  let app;
  const launch = async () => {
    app = await electron.launch({
      args: [bootstrap, '--no-sandbox', '--disable-gpu', fixture],
      env: { ...process.env, NODE_ENV: 'test', CODEXOMICS_E2E: '1' },
    });
    let view;
    await expect
      .poll(() => {
        view = app.windows().find(page => new URL(page.url()).pathname.endsWith('/renderer/index.html'));
        return Boolean(view);
      })
      .toBe(true);
    await view.waitForFunction(() => Boolean(window.genomeBrowser?.chatManager?.chatHistoryReady));
    await view.evaluate(() => window.genomeBrowser.chatManager.chatHistoryReady);
    return view;
  };

  try {
    await fs.writeFile(
      bootstrap,
      `const { app } = require('electron');
app.setPath('userData', ${JSON.stringify(profile)});
app.setPath('temp', ${JSON.stringify(profile)});
app.setAppPath(${JSON.stringify(root)});
require(${JSON.stringify(path.join(root, 'src/main.js'))});
`
    );
    await fs.writeFile(fixture, '>fixture\nACGT\n');
    let view = await launch();
    await view.evaluate(async () => {
      const cm = window.genomeBrowser.chatManager;
      document.querySelector('#contextModeToggle').click();
      const names = ['get_current_state', 'get_genome_info'];
      let round = 0;
      cm.llmConfigManager.isConfigured = () => true;
      cm.llmConfigManager.sendMessageWithHistory = async () => {
        const name = names[round++];
        return name
          ? {
              role: 'assistant',
              content: null,
              finish_reason: 'tool_calls',
              provider: 'openai',
              tool_calls: [{ id: 'call_' + round, type: 'function', function: { name, arguments: '{}' } }],
            }
          : 'Both checks are complete.';
      };
      cm.buildSystemMessage = async () => {
        cm.lastSystemPromptMetadata = { selectedTools: names.map(name => ({ name })) };
        return 'Run the requested checks.';
      };
      cm.shouldTerminateAfterToolExecution = () => false;
      cm.isSmartExecutionEnabled = false;
      cm.executeToolByName = async name => ({ success: true, value: 'saved-' + name });
      await cm.sendMessageProgrammatically('Check the current state and get genome info.');
    });
    await expect(view.locator('#chatMessages .activity-round')).toHaveCount(3);
    await expect(view.locator('#chatMessages')).toContainText('Both checks are complete.');
    await app.close();
    app = null;

    view = await launch();
    const panel = view.locator('#chatMessages .thinking-process');
    await expect(panel).toHaveCount(1);
    await expect(panel.locator('.activity-round')).toHaveCount(3);
    await expect(panel).toContainText('saved-get_genome_info');
    await panel.locator('.thinking-header').evaluate(header => header.click());
    await expect(panel.locator('.thinking-header')).toHaveAttribute('aria-expanded', 'true');
    await expect(view.locator('#contextModeToggle')).not.toBeChecked();
    const history = await view.evaluate(async () => {
      const cm = window.genomeBrowser.chatManager;
      let request;
      cm.llmConfigManager.isConfigured = () => true;
      cm.llmConfigManager.sendMessageWithHistory = async messages => {
        request ??= structuredClone(messages);
        return 'The two saved values are saved-get_current_state and saved-get_genome_info.';
      };
      await cm.sendMessageProgrammatically('What did the two checks report?');
      return request;
    });
    expect(history.map(msg => msg.role)).toEqual([
      'system',
      'user',
      'assistant',
      'tool',
      'assistant',
      'tool',
      'assistant',
      'user',
    ]);
    expect(history.filter(msg => msg.tool_calls).map(msg => msg.tool_calls[0].id)).toEqual(['call_1', 'call_2']);
    expect(history.filter(msg => msg.role === 'tool').map(msg => msg.tool_call_id)).toEqual(['call_1', 'call_2']);
    expect(history[3].content).toContain('saved-get_current_state');
    expect(history[5].content).toContain('saved-get_genome_info');
  } finally {
    await app?.close();
    await fs.rm(profile, { recursive: true, force: true });
  }
});
