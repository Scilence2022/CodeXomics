/** Shared renderer facade for the Evo 2 GUI, ChatBox and MCP client bridge. */
class Evo2Service {
  async invoke(channel, parameters = {}) {
    if (!window.electronAPI?.invoke) throw new Error('Evo 2 requires the desktop application.');
    return window.electronAPI.invoke(channel, parameters);
  }

  evo2Generate(parameters) {
    return this.invoke('evo2:generate', parameters);
  }
  evo2GetResult(parameters) {
    return this.invoke('evo2:result', parameters);
  }
  evo2Cancel(parameters) {
    return this.invoke('evo2:cancel', parameters);
  }
}

if (typeof window !== 'undefined') window.Evo2Service = Evo2Service;
if (typeof module !== 'undefined' && module.exports) module.exports = Evo2Service;
