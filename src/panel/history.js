// AI Roundtable - Meeting History Controller

const PROVIDER_META = {
  claude: { name: 'Claude', color: '#D97757', icon: '🟠' },
  chatgpt: { name: 'ChatGPT', color: '#10A37F', icon: '🟢' },
  gemini: { name: 'Gemini', color: '#4285F4', icon: '🔵' },
};

// DOM elements
const viewList = document.getElementById('view-list');
const viewDetail = document.getElementById('view-detail');
const historyList = document.getElementById('history-list');
const emptyState = document.getElementById('empty-state');
const btnBack = document.getElementById('btn-back');
const detailTopic = document.getElementById('detail-topic');
const detailDate = document.getElementById('detail-date');
const detailParticipants = document.getElementById('detail-participants');
const detailContent = document.getElementById('detail-content');
const btnExportMd = document.getElementById('btn-export-md');
const btnDelete = document.getElementById('btn-delete');

let meetings = [];
let currentMeeting = null;

// Initialize
async function init() {
  const response = await sendMessage({ type: 'GET_MEETING_HISTORY' });
  if (response?.success) {
    meetings = response.history || [];
    renderList();
  }
}

function renderList() {
  historyList.innerHTML = '';

  if (meetings.length === 0) {
    emptyState.style.display = 'block';
    return;
  }
  emptyState.style.display = 'none';

  for (let i = 0; i < meetings.length; i++) {
    const meeting = meetings[i];
    const item = document.createElement('div');
    item.className = 'history-item';
    item.dataset.index = i;

    const participants = (meeting.participants || [])
      .map(p => {
        const meta = PROVIDER_META[p.id] || PROVIDER_META[p];
        return meta ? `${meta.icon} ${meta.name}` : p.id || p;
      })
      .join('、');

    const date = new Date(meeting.savedAt || meeting.createdAt || meeting.timestamp).toLocaleString('zh-TW');

    item.innerHTML = `
      <div class="history-item-main">
        <div class="history-item-topic">${escapeHtml(meeting.topic)}</div>
        <div class="history-item-meta">
          <span class="history-item-date">${date}</span>
          <span class="history-item-participants">${participants}</span>
        </div>
      </div>
      <div class="history-item-arrow">›</div>
    `;

    item.addEventListener('click', () => showDetail(i));
    historyList.appendChild(item);
  }
}

function showDetail(index) {
  currentMeeting = meetings[index];
  if (!currentMeeting) return;

  viewList.classList.remove('active');
  viewDetail.classList.add('active');

  detailTopic.textContent = currentMeeting.topic;
  detailDate.textContent = new Date(currentMeeting.savedAt || currentMeeting.createdAt || currentMeeting.timestamp).toLocaleString('zh-TW');

  const participants = (currentMeeting.participants || [])
    .map(p => {
      const meta = PROVIDER_META[p.id] || PROVIDER_META[p];
      return meta ? `${meta.icon} ${meta.name}` : p.id || p;
    })
    .join('、');
  detailParticipants.textContent = participants;

  // Render transcript
  detailContent.innerHTML = '';

  const transcript = currentMeeting.transcript || [];
  let lastRound = 0;

  for (const entry of transcript) {
    if (entry.round && entry.round !== lastRound) {
      lastRound = entry.round;
      const divider = document.createElement('div');
      divider.className = 'round-divider';
      divider.textContent = `── 第 ${entry.round} 輪 ──`;
      detailContent.appendChild(divider);
    }

    const participantId = entry.participant;
    const meta = PROVIDER_META[participantId];
    if (!meta) continue;

    const msgEl = document.createElement('div');
    msgEl.className = 'message';
    msgEl.style.setProperty('--msg-color', meta.color);
    msgEl.innerHTML = `
      <div class="message-header">
        <span class="message-avatar">${meta.icon}</span>
        <span class="message-name">${meta.name}</span>
      </div>
      <div class="message-content">${escapeHtml(entry.content)}</div>
    `;
    detailContent.appendChild(msgEl);
  }

  // Render evaluations
  const evaluations = currentMeeting.evaluations || [];
  if (evaluations.length > 0) {
    const evalHeader = document.createElement('div');
    evalHeader.className = 'detail-section-title';
    evalHeader.textContent = '📊 交叉評價';
    detailContent.appendChild(evalHeader);

    for (const ev of evaluations) {
      const meta = PROVIDER_META[ev.evaluator];
      const evalEl = document.createElement('div');
      evalEl.className = 'eval-card';
      evalEl.innerHTML = `
        <div class="eval-header">${meta ? meta.icon : ''} ${ev.evaluatorName || ev.evaluator} 的評價</div>
        <div class="eval-content">${escapeHtml(ev.content)}</div>
      `;
      detailContent.appendChild(evalEl);
    }
  }

  // Render summary
  if (currentMeeting.summary) {
    const sumHeader = document.createElement('div');
    sumHeader.className = 'detail-section-title';
    sumHeader.textContent = '📋 會議摘要';
    detailContent.appendChild(sumHeader);

    const sumEl = document.createElement('div');
    sumEl.className = 'summary-content';
    sumEl.textContent = currentMeeting.summary;
    detailContent.appendChild(sumEl);
  }
}

function showList() {
  viewDetail.classList.remove('active');
  viewList.classList.add('active');
  currentMeeting = null;
}

function exportMeeting() {
  if (!currentMeeting) return;

  const md = currentMeeting.markdown || buildMarkdown(currentMeeting);
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const dateStr = new Date(currentMeeting.savedAt || currentMeeting.createdAt || currentMeeting.timestamp)
    .toISOString().slice(0, 10);
  a.download = `roundtable-${dateStr}.md`;
  a.click();
  URL.revokeObjectURL(url);
}

function buildMarkdown(meeting) {
  let md = `# AI 圓桌會議記錄\n\n`;
  md += `**議題**: ${meeting.topic}\n`;

  const names = (meeting.participants || [])
    .map(p => {
      const meta = PROVIDER_META[p.id] || PROVIDER_META[p];
      return meta ? meta.name : p.id || p;
    })
    .join(', ');
  md += `**參與者**: ${names}\n`;
  md += `**日期**: ${new Date(meeting.savedAt || meeting.createdAt || meeting.timestamp).toLocaleString('zh-TW')}\n\n`;
  md += `---\n\n`;

  const transcript = meeting.transcript || [];
  let lastRound = 0;
  for (const entry of transcript) {
    if (entry.round && entry.round !== lastRound) {
      lastRound = entry.round;
      md += `## 第 ${entry.round} 輪討論\n\n`;
    }
    const name = entry.participantName ||
      (PROVIDER_META[entry.participant] ? PROVIDER_META[entry.participant].name : entry.participant);
    md += `### ${name}\n\n${entry.content}\n\n`;
  }

  const evaluations = meeting.evaluations || [];
  if (evaluations.length > 0) {
    md += `## 交叉評價\n\n`;
    for (const ev of evaluations) {
      md += `### ${ev.evaluatorName || ev.evaluator} 的評價\n\n${ev.content}\n\n`;
    }
  }

  if (meeting.summary) {
    md += `## 會議摘要\n\n${meeting.summary}\n`;
  }

  return md;
}

async function deleteMeeting() {
  if (!currentMeeting) return;

  const confirmed = confirm('確定要刪除此會議記錄？此操作無法復原。');
  if (!confirmed) return;

  const response = await sendMessage({
    type: 'DELETE_MEETING',
    payload: { meetingId: currentMeeting.id },
  });

  if (response?.success) {
    meetings = meetings.filter(m => m.id !== currentMeeting.id);
    showList();
    renderList();
  }
}

// Event listeners
btnBack.addEventListener('click', () => {
  if (viewDetail.classList.contains('active')) {
    showList();
  } else {
    // Navigate back to main panel
    window.location.href = 'panel.html';
  }
});

btnExportMd.addEventListener('click', exportMeeting);
btnDelete.addEventListener('click', deleteMeeting);

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function sendMessage(message) {
  return chrome.runtime.sendMessage(message);
}

init();
