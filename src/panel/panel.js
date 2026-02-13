// AI Roundtable - Side Panel Controller
import { renderMarkdown } from '../lib/markdown.js';

// Provider definitions with available models
const PROVIDERS = {
  claude: {
    name: 'Claude',
    color: '#D97757',
    colors: ['#D97757', '#E8956E', '#C75B3A', '#F4A886', '#B04525'],
    icon: '🟠',
    models: [
      { id: 'claude-opus-4-6', name: 'Opus 4.6' },
      { id: 'claude-sonnet-4-5-20250929', name: 'Sonnet 4.5' },
      { id: 'claude-haiku-4-5-20251001', name: 'Haiku 4.5' },
    ],
  },
  chatgpt: {
    name: 'ChatGPT',
    color: '#10A37F',
    colors: ['#10A37F', '#2BC49A', '#0D8A6A', '#4DD9B4', '#087356'],
    icon: '🟢',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    ],
  },
  gemini: {
    name: 'Gemini',
    color: '#4285F4',
    colors: ['#4285F4', '#5E9BF7', '#2B6FE0', '#82B4FA', '#1A5CC8'],
    icon: '🔵',
    models: [
      { id: 'gemini-2.0-flash', name: '2.0 Flash' },
      { id: 'gemini-2.0-pro', name: '2.0 Pro' },
      { id: 'gemini-1.5-pro', name: '1.5 Pro' },
    ],
  },
  copilot: {
    name: 'Copilot',
    color: '#8B5CF6',
    colors: ['#8B5CF6', '#A47CF8', '#7340E0', '#BC9CFA', '#5C2DC8'],
    icon: '🟣',
    models: [
      // OpenAI
      { id: 'openai/gpt-4.1', name: 'GPT-4.1' },
      { id: 'openai/gpt-4.1-mini', name: 'GPT-4.1 Mini' },
      { id: 'openai/gpt-4.1-nano', name: 'GPT-4.1 Nano' },
      { id: 'openai/gpt-4o', name: 'GPT-4o' },
      { id: 'openai/gpt-5', name: 'GPT-5' },
      { id: 'openai/gpt-5-mini', name: 'GPT-5 Mini' },
      { id: 'openai/o3', name: 'o3' },
      { id: 'openai/o3-mini', name: 'o3-mini' },
      { id: 'openai/o4-mini', name: 'o4-mini' },
      // DeepSeek
      { id: 'deepseek/DeepSeek-R1', name: 'DeepSeek R1' },
      { id: 'deepseek/DeepSeek-R1-0528', name: 'DeepSeek R1 0528' },
      { id: 'deepseek/DeepSeek-V3-0324', name: 'DeepSeek V3' },
      // Meta
      { id: 'Meta-Llama-3.1-405B-Instruct', name: 'Llama 3.1 405B' },
      { id: 'Llama-3.3-70B-Instruct', name: 'Llama 3.3 70B' },
      // xAI
      { id: 'xai/grok-3', name: 'Grok 3' },
      { id: 'xai/grok-3-mini', name: 'Grok 3 Mini' },
      // Mistral
      { id: 'mistral/Mistral-Medium-3', name: 'Mistral Medium 3' },
      { id: 'mistral/Mistral-Small-3.1', name: 'Mistral Small 3.1' },
      // Cohere
      { id: 'cohere/Command-A', name: 'Command A' },
    ],
  },
};

// Runtime participant meta (built dynamically from meeting config)
let participantMeta = {};

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
const btnAddParticipant = document.getElementById('btn-add-participant');
const participantList = document.getElementById('participant-list');
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
let participantCounter = 0;
const rawTextMap = new Map();

// --- Participant Row Management ---

function addParticipantRow(providerId, modelId) {
  participantCounter++;
  const rowId = `participant-${participantCounter}`;
  const row = document.createElement('div');
  row.className = 'participant-row';
  row.id = rowId;

  // Provider select
  const providerSelect = document.createElement('select');
  providerSelect.className = 'participant-provider';
  for (const [id, p] of Object.entries(PROVIDERS)) {
    const opt = document.createElement('option');
    opt.value = id;
    opt.textContent = `${p.icon} ${p.name}`;
    if (id === providerId) opt.selected = true;
    providerSelect.appendChild(opt);
  }

  // Model select
  const modelSelect = document.createElement('select');
  modelSelect.className = 'participant-model';

  function populateModels(pid) {
    modelSelect.innerHTML = '';
    const provider = PROVIDERS[pid];
    if (!provider) return;
    for (const m of provider.models) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.name;
      if (m.id === modelId) opt.selected = true;
      modelSelect.appendChild(opt);
    }
  }

  populateModels(providerId || 'claude');
  providerSelect.addEventListener('change', () => {
    populateModels(providerSelect.value);
  });

  // Remove button
  const removeBtn = document.createElement('button');
  removeBtn.className = 'btn btn-remove-row';
  removeBtn.textContent = '✕';
  removeBtn.title = '移除';
  removeBtn.addEventListener('click', () => {
    row.remove();
  });

  row.appendChild(providerSelect);
  row.appendChild(modelSelect);
  row.appendChild(removeBtn);
  participantList.appendChild(row);
}

function getParticipants() {
  const rows = participantList.querySelectorAll('.participant-row');
  const participants = [];
  let idx = 0;
  const nameCount = {};
  const providerColorIndex = {}; // Track color assignment per provider

  rows.forEach((row) => {
    const provider = row.querySelector('.participant-provider').value;
    const model = row.querySelector('.participant-model').value;
    const providerInfo = PROVIDERS[provider];
    const modelInfo = providerInfo.models.find(m => m.id === model);
    const modelName = modelInfo ? modelInfo.name : model;

    // Track duplicates to generate unique display names
    const key = `${provider}:${model}`;
    nameCount[key] = (nameCount[key] || 0) + 1;

    // Assign a distinct color from the provider's palette
    const colorIdx = providerColorIndex[provider] || 0;
    const palette = providerInfo.colors || [providerInfo.color];
    const assignedColor = palette[colorIdx % palette.length];
    providerColorIndex[provider] = colorIdx + 1;

    participants.push({
      uid: `${provider}-${idx}`,
      provider,
      model,
      displayName: `${providerInfo.name} ${modelName}`,
      color: assignedColor,
      icon: providerInfo.icon,
    });
    idx++;
  });

  // Disambiguate identical provider+model combos
  const seen = {};
  for (const p of participants) {
    const key = `${p.provider}:${p.model}`;
    if (nameCount[key] > 1) {
      seen[key] = (seen[key] || 0) + 1;
      p.displayName += ` #${seen[key]}`;
    }
  }

  return participants;
}

// --- Init ---

async function init() {
  const response = await sendMessage({ type: 'GET_SETTINGS' });
  if (response?.success) {
    const settings = response.settings;
    inputRounds.value = settings.defaultRounds || 2;
    inputEval.value = settings.evaluationMode || 'cross';
  }

  // Default: add 3 participants (Claude Sonnet, ChatGPT GPT-4o, Gemini Flash)
  addParticipantRow('claude', 'claude-sonnet-4-5-20250929');
  addParticipantRow('chatgpt', 'gpt-4o');
  addParticipantRow('gemini', 'gemini-2.0-flash');

  // Check for active meeting
  const stateResp = await sendMessage({ type: 'GET_MEETING_STATE' });
  if (stateResp?.success && stateResp.state) {
    restoreMeetingView(stateResp.state);
  }
}

// --- Event Listeners ---

btnStart.addEventListener('click', startMeeting);
btnPause.addEventListener('click', togglePause);
btnStop.addEventListener('click', stopMeeting);
btnExport.addEventListener('click', exportTranscript);
btnAddParticipant.addEventListener('click', () => addParticipantRow('claude', ''));
btnHistory.addEventListener('click', () => {
  window.location.href = 'history.html';
});
btnSettings.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Listen for topic from context menu selection
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'ROUNDTABLE_TOPIC_FROM_SELECTION') {
    inputTopic.value = message.payload.topic;
  }
  if (message.type === 'MEETING_UPDATE' || message.type) {
    handleUpdate(message);
  }
});

// --- Meeting Flow ---

async function startMeeting() {
  const topic = inputTopic.value.trim();
  if (!topic) {
    inputTopic.focus();
    inputTopic.classList.add('error');
    setTimeout(() => inputTopic.classList.remove('error'), 1500);
    return;
  }

  const participants = getParticipants();
  if (participants.length < 2) {
    apiWarning.textContent = '⚠️ 至少需要 2 個參與者';
    apiWarning.style.display = 'block';
    return;
  }

  // Build participant meta for UI rendering during meeting
  participantMeta = {};
  for (const p of participants) {
    participantMeta[p.uid] = {
      name: p.displayName,
      color: p.color,
      icon: p.icon,
    };
  }

  btnStart.disabled = true;
  btnStart.textContent = '啟動中...';
  apiWarning.style.display = 'none';

  const response = await sendMessage({
    type: 'START_MEETING',
    payload: {
      topic,
      rounds: parseInt(inputRounds.value),
      evaluationMode: inputEval.value,
      participants: participants.map(p => ({
        uid: p.uid,
        provider: p.provider,
        model: p.model,
        displayName: p.displayName,
        color: p.color,
        icon: p.icon,
      })),
    },
  });

  if (response?.success) {
    showMeetingView(participants, topic);
  } else {
    apiWarning.textContent = `⚠️ ${response?.error || '啟動失敗，請檢查 API Key 設定'}`;
    apiWarning.style.display = 'block';
    btnStart.disabled = false;
    btnStart.textContent = '開始圓桌會議';
  }
}

function showMeetingView(participants, topic) {
  viewSetup.classList.remove('active');
  viewMeeting.classList.add('active');
  btnExport.disabled = false;

  roundtableSeats.innerHTML = '';
  const count = participants.length;
  participants.forEach((p, i) => {
    const angle = (360 / count) * i - 90;
    const seat = document.createElement('div');
    seat.className = 'seat';
    seat.id = `seat-${p.uid}`;
    seat.style.setProperty('--angle', `${angle}deg`);
    seat.style.setProperty('--seat-color', p.color);
    seat.innerHTML = `
      <div class="seat-avatar">${p.icon}</div>
      <div class="seat-name">${p.displayName}</div>
    `;
    roundtableSeats.appendChild(seat);
  });

  transcript.innerHTML = `<div class="system-msg">會議開始：${topic}</div>`;
}

function restoreMeetingView(state) {
  participantMeta = {};
  for (const p of state.participants) {
    participantMeta[p.id] = {
      name: p.name,
      color: p.color || '#888',
      icon: p.icon || '🤖',
    };
  }
  showMeetingView(
    state.participants.map(p => ({
      uid: p.id,
      displayName: p.name,
      color: p.color || '#888',
      icon: p.icon || '🤖',
    })),
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

// --- Update Handler ---

function getMeta(participantId) {
  return participantMeta[participantId] || { name: participantId, color: '#888', icon: '🤖' };
}

function handleUpdate(update) {
  const payload = update.payload || update;

  switch (update.type) {
    case 'MEETING_UPDATE':
      handleUpdate(payload);
      break;

    case 'PHASE_CHANGE':
      phaseLabel.textContent = getPhaseLabel(payload.phase);
      if (payload.phase === 'evaluation') evaluationSection.style.display = 'block';
      if (payload.phase === 'summary') summarySection.style.display = 'block';
      break;

    case 'ROUND_START':
      roundLabel.textContent = `第 ${payload.round} 輪`;
      transcript.innerHTML += `<div class="round-divider">── 第 ${payload.round} 輪 ──</div>`;
      break;

    case 'TURN_START': {
      highlightSeat(payload.participant);
      const meta = getMeta(payload.participant);
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
          const meta = getMeta(payload.participant);
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
  const meta = getMeta(participantId);
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
    idle: '準備中', setup: '設定中', discussion: '討論中',
    evaluation: '評價中', summary: '生成摘要', completed: '已完成', paused: '已暫停',
  };
  return labels[phase] || phase;
}

function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

init();
