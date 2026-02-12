// Popup controller

const statusEl = document.getElementById('status');
const btnOpen = document.getElementById('btn-open');
const btnOptions = document.getElementById('btn-options');

async function init() {
  const response = await chrome.runtime.sendMessage({ type: 'GET_MEETING_STATE' });
  if (response?.success && response.state) {
    statusEl.innerHTML = `<span class="active">● 會議進行中</span><br>議題：${response.state.topic}`;
  }
}

btnOpen.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab) {
    await chrome.sidePanel.open({ tabId: tab.id });
  }
  window.close();
});

btnOptions.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

init();
