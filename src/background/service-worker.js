// AI Roundtable - Background Service Worker

import { MeetingOrchestrator } from '../lib/engine/orchestrator.js';
import { StorageManager } from '../lib/storage/storage-manager.js';

const storage = new StorageManager();
let activeOrchestrator = null;

// --- Context Menu Setup ---
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'start-roundtable',
    title: '以此為議題開始圓桌討論',
    contexts: ['selection'],
  });
});

// Handle context menu click
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'start-roundtable' && info.selectionText) {
    const topic = info.selectionText.trim();
    if (!topic) return;

    // Open side panel and send the selected topic
    await chrome.sidePanel.open({ tabId: tab.id });

    // Give the panel a moment to initialize, then send the topic
    setTimeout(() => {
      chrome.runtime.sendMessage({
        type: 'ROUNDTABLE_TOPIC_FROM_SELECTION',
        payload: { topic },
      }).catch(() => {
        // Panel might not be ready yet, ignore
      });
    }, 500);

    // Notify content script for visual feedback
    chrome.tabs.sendMessage(tab.id, {
      type: 'START_ROUNDTABLE_FROM_SELECTION',
    }).catch(() => {
      // Content script might not be ready, ignore
    });
  }
});

// Open side panel when extension icon is clicked
chrome.action.onClicked.addListener(async (tab) => {
  await chrome.sidePanel.open({ tabId: tab.id });
});

// Handle messages from panel and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse);
  return true; // keep channel open for async response
});

async function handleMessage(message, sender) {
  switch (message.type) {
    case 'START_MEETING': {
      const config = message.payload;
      const apiKeys = await storage.getApiKeys();

      // Validate: check all required provider keys exist
      if (config.participants) {
        const missingProviders = new Set();
        for (const p of config.participants) {
          if (!apiKeys[p.provider]) missingProviders.add(p.provider);
        }
        if (missingProviders.size > 0) {
          return { success: false, error: `缺少 API Key：${[...missingProviders].join(', ')}，請先在設定中配置` };
        }
        if (config.participants.length < 2) {
          return { success: false, error: '至少需要 2 個參與者' };
        }
      }

      activeOrchestrator = new MeetingOrchestrator(config, apiKeys);
      activeOrchestrator.onUpdate(async (update) => {
        broadcastToPanel({ type: 'MEETING_UPDATE', payload: update });
        // Auto-save when meeting completes naturally
        if (update.type === 'PHASE_CHANGE' && update.phase === 'completed' && update.meetingRecord) {
          await storage.saveMeeting(update.meetingRecord);
        }
      });
      // Start meeting in background — don't await, return immediately
      activeOrchestrator.start().catch((err) => {
        broadcastToPanel({
          type: 'MEETING_UPDATE',
          payload: { type: 'PHASE_CHANGE', phase: 'completed', error: err.message },
        });
      });
      return { success: true };
    }

    case 'PAUSE_MEETING': {
      if (activeOrchestrator) {
        activeOrchestrator.pause();
      }
      return { success: true };
    }

    case 'RESUME_MEETING': {
      if (activeOrchestrator) {
        await activeOrchestrator.resume();
      }
      return { success: true };
    }

    case 'STOP_MEETING': {
      if (activeOrchestrator) {
        const record = await activeOrchestrator.stop();
        await storage.saveMeeting(record);
        activeOrchestrator = null;
        return { success: true, summary: record.markdown };
      }
      return { success: false, error: 'No active meeting' };
    }

    case 'GET_MEETING_STATE': {
      if (activeOrchestrator) {
        return { success: true, state: activeOrchestrator.getState() };
      }
      return { success: true, state: null };
    }

    case 'SAVE_API_KEY': {
      await storage.saveApiKey(message.payload.provider, message.payload.key);
      return { success: true };
    }

    case 'GET_SETTINGS': {
      const settings = await storage.getSettings();
      return { success: true, settings };
    }

    case 'SAVE_SETTINGS': {
      await storage.saveSettings(message.payload);
      return { success: true };
    }

    case 'EXPORT_TRANSCRIPT': {
      if (activeOrchestrator) {
        const transcript = activeOrchestrator.exportTranscript();
        return { success: true, transcript };
      }
      return { success: false, error: 'No active meeting' };
    }

    case 'GET_MEETING_HISTORY': {
      const history = await storage.getMeetingHistory();
      return { success: true, history };
    }

    case 'DELETE_MEETING': {
      const { meetingId } = message.payload;
      await storage.deleteMeeting(meetingId);
      return { success: true };
    }

    default:
      return { success: false, error: `Unknown message type: ${message.type}` };
  }
}

function broadcastToPanel(message) {
  chrome.runtime.sendMessage(message).catch(() => {
    // Panel might not be open, ignore
  });
}
