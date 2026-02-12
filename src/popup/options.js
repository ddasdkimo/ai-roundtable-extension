// Options page controller

const PROVIDERS = ['claude', 'chatgpt', 'gemini'];

async function init() {
  // Load saved keys
  const keysResp = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
  if (keysResp?.success) {
    const settings = keysResp.settings;
    document.getElementById('setting-language').value = settings.language || 'zh-TW';
    document.getElementById('setting-rounds').value = settings.defaultRounds || 2;

    if (settings.models) {
      for (const p of PROVIDERS) {
        const select = document.getElementById(`model-${p}`);
        if (select && settings.models[p]) select.value = settings.models[p];
      }
    }
  }

  // Load API keys (they're stored separately)
  for (const p of PROVIDERS) {
    const result = await chrome.storage.local.get('api_keys');
    const keys = result.api_keys || {};
    if (keys[p]) {
      document.getElementById(`key-${p}`).value = keys[p];
    }
  }
}

// Verify buttons
document.querySelectorAll('.btn-verify').forEach(btn => {
  btn.addEventListener('click', async () => {
    const provider = btn.dataset.provider;
    const key = document.getElementById(`key-${provider}`).value.trim();
    if (!key) return;

    btn.textContent = '驗證中...';
    btn.className = 'btn btn-verify';

    await chrome.runtime.sendMessage({
      type: 'SAVE_API_KEY',
      payload: { provider, key },
    });

    // Simple validation: try to check if key format looks right
    let valid = false;
    if (provider === 'claude' && key.startsWith('sk-ant-')) valid = true;
    else if (provider === 'chatgpt' && key.startsWith('sk-')) valid = true;
    else if (provider === 'gemini' && key.startsWith('AIza')) valid = true;
    else valid = key.length > 10; // fallback

    if (valid) {
      btn.textContent = '✓ 已儲存';
      btn.classList.add('valid');
    } else {
      btn.textContent = '格式可能有誤';
      btn.classList.add('invalid');
    }

    setTimeout(() => {
      btn.textContent = '驗證';
      btn.className = 'btn btn-verify';
    }, 3000);
  });
});

// Save settings
document.getElementById('btn-save').addEventListener('click', async () => {
  // Save API keys
  for (const p of PROVIDERS) {
    const key = document.getElementById(`key-${p}`).value.trim();
    if (key) {
      await chrome.runtime.sendMessage({
        type: 'SAVE_API_KEY',
        payload: { provider: p, key },
      });
    }
  }

  // Save settings
  await chrome.runtime.sendMessage({
    type: 'SAVE_SETTINGS',
    payload: {
      language: document.getElementById('setting-language').value,
      defaultRounds: parseInt(document.getElementById('setting-rounds').value),
      models: {
        claude: document.getElementById('model-claude').value,
        chatgpt: document.getElementById('model-chatgpt').value,
        gemini: document.getElementById('model-gemini').value,
      },
    },
  });

  const status = document.getElementById('save-status');
  status.classList.add('visible');
  setTimeout(() => status.classList.remove('visible'), 2000);
});

init();
