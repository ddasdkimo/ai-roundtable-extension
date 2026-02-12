// AI Roundtable - Side Panel Controller
import { renderMarkdown } from '../lib/markdown.js';

const PROVIDER_META = {
  claude: { name: 'Claude', color: '#D97757', icon: '🟠' },
  chatgpt: { name: 'ChatGPT', color: '#10A37F', icon: '🟢' },
  gemini: { name: 'Gemini', color: '#4285F4', icon: '🔵' },
};

// DOM elements
const viewSetup = document.getElementById('view-setup');
const viewMeeting = document.getElementById('view-meeting');
const inputTopic = document.getElementById('input-topic');
const inputRounds = document.getElementById('input-rounds');
const inputEval = document.getElementById('input-eval');
const btnStart = document.getElementById('btn-start');
const btnPause = document.getElementById('btn-pause');
const btnStop = document.getElementById('btn-stop');
const btnHistory = document.getElementById('btn-history');
const btnExport = document.getElementById('btn-export');
const btnSettings = document.getElementById('btn-settings');
const phaseLabel = document.getElementById('phase-label');
const roundLabel = document.getElementById('round-label');
const roundtableSeats = document.getElementById('roundtable-seats');
const transcript = document.getElementById('transcript');
const evaluationSection = document.getElementById('evaluation-section');
const evaluations = document.getElementById('evaluations');
const summarySection = document.getElementById('summary-section');
const summaryContent = document.getElementById('summary-content');
const apiWarning = document.getElementById('api-warning');

let currentStreamEl = null;
let isPaused = false;

// Accumulate raw text per streaming target so we can render markdown on completion
const rawTextMap = new Map();

// Initialize
async function init() {
  const response = await sendMessage({ type: 'GET_SETTINGS' });
  if (response?.success) {
    const settings = response.settings;
    inputRounds.value = settings.defaultRounds || 2;
    inputEval.value = settings.evaluationMode || 'cross';
  }

  // Check for active meeting
  const stateResp = await sendMessage({ type: 'GET_MEETING_STATE' });
  if (stateResp?.success && stateResp.state) {
    restoreMeetingView(stateResp.state);
  }

  // Check API keys
  checkApiKeys();
}

async function checkApiKeys() {
  const response = await sendMessage({ type: 'GET_SETTINGS' });
  // We'll rely on the meeting start to validate
}

// Event Listeners
btnStart.addEventListener('click', startMeeting);
btnPause.addEventListener('click', togglePause);
btnStop.addEventListener('click', stopMeeting);
btnExport.addEventListener('click', exportTranscript);
btnHistory.addEventListener('click', () => {
  window.location.href = 'history.html';
});
btnSettings.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

async function startMeeting() {
  const topic = inputTopic.value.trim();
  if (!topic) {
    inputTopic.focus();
    inputTopic.classList.add('error');
    setTimeout(() => inputTopic.classList.remove('error'), 1500);
    return;
  }

  const selectedProviders = [];
  document.querySelectorAll('.participant-selector input:checked').forEach(cb => {
    selectedProviders.push(cb.value);
  });

  if (selectedProviders.length < 2) {
    apiWarning.textContent = '⚠️ 至少需要選擇 2 個 AI 參與者';
    apiWarning.style.display = 'block';
    return;
  }

  btnStart.disabled = true;
  btnStart.textContent = '啟動中...';

  const response = await sendMessage({
    type: 'START_MEETING',
    payload: {
      topic,
      rounds: parseInt(inputRounds.value),
      evaluationMode: inputEval.value,
      selectedProviders,
    },
  });

  if (response?.success) {
    showMeetingView(selectedProviders, topic);
  } else {
    apiWarning.textContent = `⚠️ ${response?.error || '啟動失敗，請檢查 API Key 設定'}`;
    apiWarning.style.display = 'block';
    btnStart.disabled = false;
    btnStart.textContent = '開始圓桌會議';
  }
}

function showMeetingView(providers, topic) {
  viewSetup.classList.remove('active');
  viewMeeting.classList.add('active');
  btnExport.disabled = false;

  // Render roundtable seats
  roundtableSeats.innerHTML = '';
  const count = providers.length;
  providers.forEach((id, i) => {
    const meta = PROVIDER_META[id];
    const angle = (360 / count) * i - 90;
    const seat = document.createElement('div');
    seat.className = 'seat';
    seat.id = `seat-${id}`;
    seat.style.setProperty('--angle', `${angle}deg`);
    seat.style.setProperty('--seat-color', meta.color);
    seat.innerHTML = `
      <div class="seat-avatar">${meta.icon}</div>
      <div class="seat-name">${meta.name}</div>
    `;
    roundtableSeats.appendChild(seat);
  });

  transcript.innerHTML = `<div class="system-msg">會議開始：${topic}</div>`;
}

function restoreMeetingView(state) {
  showMeetingView(
    state.participants.map(p => p.id),
    state.topic
  );
  phaseLabel.textContent = getPhaseLabel(state.phase);
  roundLabel.textContent = `第 ${state.currentRound} 輪`;

  for (const entry of state.transcript) {
    appendMessage(entry.participant, entry.content);
  }
}

async function togglePause() {
  if (isPaused) {
    await sendMessage({ type: 'RESUME_MEETING' });
    btnPause.textContent = '⏸ 暫停';
    isPaused = false;
  } else {
    await sendMessage({ type: 'PAUSE_MEETING' });
    btnPause.textContent = '▶️ 繼續';
    isPaused = true;
  }
}

async function stopMeeting() {
  const response = await sendMessage({ type: 'STOP_MEETING' });
  if (response?.success) {
    phaseLabel.textContent = '已結束';
    btnPause.disabled = true;
    btnStop.disabled = true;
  }
}

async function exportTranscript() {
  const response = await sendMessage({ type: 'EXPORT_TRANSCRIPT' });
  if (response?.success) {
    const blob = new Blob([response.transcript], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `roundtable-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }
}

// Listen for updates from background
chrome.runtime.onMessage.addListener((message) => {
  if (!message.type) return;
  handleUpdate(message);
});

function handleUpdate(update) {
  const payload = update.payload || update;

  switch (update.type) {
    case 'MEETING_UPDATE':
      handleUpdate(payload);
      break;

    case 'PHASE_CHANGE':
      phaseLabel.textContent = getPhaseLabel(payload.phase);
      if (payload.phase === 'evaluation') {
        evaluationSection.style.display = 'block';
      }
      if (payload.phase === 'summary') {
        summarySection.style.display = 'block';
      }
      break;

    case 'ROUND_START':
      roundLabel.textContent = `第 ${payload.round} 輪`;
      transcript.innerHTML += `<div class="round-divider">── 第 ${payload.round} 輪 ──</div>`;
      break;

    case 'TURN_START': {
      highlightSeat(payload.participant);
      const meta = PROVIDER_META[payload.participant];
      const msgEl = document.createElement('div');
      msgEl.className = 'message';
      msgEl.style.setProperty('--msg-color', meta.color);
      msgEl.innerHTML = `
        <div class="message-header">
          <span class="message-avatar">${meta.icon}</span>
          <span class="message-name">${meta.name}</span>
        </div>
        <div class="message-content" id="stream-${payload.participant}"></div>
      `;
      transcript.appendChild(msgEl);
      currentStreamEl = document.getElementById(`stream-${payload.participant}`);
      transcript.scrollTop = transcript.scrollHeight;
      break;
    }

    case 'STREAM_CHUNK': {
      if (payload.phase === 'evaluation') {
        let evalEl = document.getElementById(`eval-${payload.participant}`);
        if (!evalEl) {
          const meta = PROVIDER_META[payload.participant];
          const wrapper = document.createElement('div');
          wrapper.className = 'eval-card';
          wrapper.innerHTML = `
            <div class="eval-header">${meta.icon} ${meta.name} 的評價</div>
            <div class="eval-content" id="eval-${payload.participant}"></div>
          `;
          evaluations.appendChild(wrapper);
          evalEl = document.getElementById(`eval-${payload.participant}`);
        }
        const evalKey = `eval-${payload.participant}`;
        rawTextMap.set(evalKey, (rawTextMap.get(evalKey) || '') + payload.chunk);
        evalEl.textContent += payload.chunk;
      } else if (payload.phase === 'summary') {
        rawTextMap.set('summary', (rawTextMap.get('summary') || '') + payload.chunk);
        summaryContent.textContent += payload.chunk;
      } else if (currentStreamEl) {
        const streamKey = `stream-${payload.participant}`;
        rawTextMap.set(streamKey, (rawTextMap.get(streamKey) || '') + payload.chunk);
        currentStreamEl.textContent += payload.chunk;
        transcript.scrollTop = transcript.scrollHeight;
      }
      break;
    }

    case 'TURN_END': {
      unhighlightAllSeats();
      // Render accumulated markdown
      if (currentStreamEl && payload.participant) {
        const streamKey = `stream-${payload.participant}`;
        const raw = rawTextMap.get(streamKey);
        if (raw) {
          currentStreamEl.innerHTML = renderMarkdown(raw);
          currentStreamEl.classList.add('md-rendered');
          rawTextMap.delete(streamKey);
        }
      }
      currentStreamEl = null;
      break;
    }

    case 'EVAL_START':
      highlightSeat(payload.participant);
      break;

    case 'EVAL_END': {
      unhighlightAllSeats();
      // Render accumulated markdown for evaluation
      if (payload.participant) {
        const evalKey = `eval-${payload.participant}`;
        const evalEl = document.getElementById(evalKey);
        const raw = rawTextMap.get(evalKey);
        if (evalEl && raw) {
          evalEl.innerHTML = renderMarkdown(raw);
          evalEl.classList.add('md-rendered');
          rawTextMap.delete(evalKey);
        }
      }
      break;
    }

    case 'SUMMARY_COMPLETE': {
      phaseLabel.textContent = '會議結束';
      btnPause.disabled = true;
      btnStop.disabled = true;
      // Render accumulated markdown for summary
      const summaryRaw = rawTextMap.get('summary');
      if (summaryRaw) {
        summaryContent.innerHTML = renderMarkdown(summaryRaw);
        summaryContent.classList.add('md-rendered');
        rawTextMap.delete('summary');
      }
      break;
    }
  }
}

function appendMessage(participantId, content) {
  const meta = PROVIDER_META[participantId];
  if (!meta) return;
  const msgEl = document.createElement('div');
  msgEl.className = 'message';
  msgEl.style.setProperty('--msg-color', meta.color);
  msgEl.innerHTML = `
    <div class="message-header">
      <span class="message-avatar">${meta.icon}</span>
      <span class="message-name">${meta.name}</span>
    </div>
    <div class="message-content md-rendered">${renderMarkdown(content)}</div>
  `;
  transcript.appendChild(msgEl);
}

function highlightSeat(participantId) {
  unhighlightAllSeats();
  const seat = document.getElementById(`seat-${participantId}`);
  if (seat) seat.classList.add('speaking');
}

function unhighlightAllSeats() {
  document.querySelectorAll('.seat').forEach(s => s.classList.remove('speaking'));
}

function getPhaseLabel(phase) {
  const labels = {
    idle: '準備中',
    setup: '設定中',
    discussion: '討論中',
    evaluation: '評價中',
    summary: '生成摘要',
    completed: '已完成',
    paused: '已暫停',
  };
  return labels[phase] || phase;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

init();
