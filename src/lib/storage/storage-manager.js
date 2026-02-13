// Chrome Storage Manager

const STORAGE_KEYS = {
  API_KEYS: 'api_keys',
  SETTINGS: 'settings',
  MEETING_HISTORY: 'meeting_history',
};

const DEFAULT_SETTINGS = {
  defaultRounds: 2,
  evaluationMode: 'cross', // 'cross' | 'summary' | 'none'
  language: 'zh-TW',
  theme: 'auto',
  selectedProviders: ['claude', 'chatgpt', 'gemini', 'copilot'],
  models: {
    claude: 'claude-sonnet-4-5-20250929',
    chatgpt: 'gpt-4o',
    gemini: 'gemini-2.0-flash',
    copilot: 'gpt-4o',
  },
};

export class StorageManager {
  async getApiKeys() {
    const result = await chrome.storage.local.get(STORAGE_KEYS.API_KEYS);
    return result[STORAGE_KEYS.API_KEYS] || {};
  }

  async saveApiKey(provider, key) {
    const keys = await this.getApiKeys();
    keys[provider] = key;
    await chrome.storage.local.set({ [STORAGE_KEYS.API_KEYS]: keys });
  }

  async getSettings() {
    const result = await chrome.storage.local.get(STORAGE_KEYS.SETTINGS);
    return { ...DEFAULT_SETTINGS, ...(result[STORAGE_KEYS.SETTINGS] || {}) };
  }

  async saveSettings(settings) {
    const current = await this.getSettings();
    await chrome.storage.local.set({
      [STORAGE_KEYS.SETTINGS]: { ...current, ...settings },
    });
  }

  async getProviders() {
    const keys = await this.getApiKeys();
    const settings = await this.getSettings();
    const providers = {};
    for (const id of settings.selectedProviders) {
      if (keys[id]) {
        providers[id] = {
          apiKey: keys[id],
          model: settings.models[id],
        };
      }
    }
    return providers;
  }

  async saveMeeting(meeting) {
    const result = await chrome.storage.local.get(STORAGE_KEYS.MEETING_HISTORY);
    const history = result[STORAGE_KEYS.MEETING_HISTORY] || [];
    history.unshift({ ...meeting, savedAt: Date.now() });
    // Keep last 50 meetings
    if (history.length > 50) history.length = 50;
    await chrome.storage.local.set({ [STORAGE_KEYS.MEETING_HISTORY]: history });
  }

  async getMeetingHistory() {
    const result = await chrome.storage.local.get(STORAGE_KEYS.MEETING_HISTORY);
    return result[STORAGE_KEYS.MEETING_HISTORY] || [];
  }

  async deleteMeeting(meetingId) {
    const history = await this.getMeetingHistory();
    const filtered = history.filter(m => m.id !== meetingId);
    await chrome.storage.local.set({ [STORAGE_KEYS.MEETING_HISTORY]: filtered });
  }
}
