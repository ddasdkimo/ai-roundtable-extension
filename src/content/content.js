// AI Roundtable - Content Script
// Detects text selection and communicates with background service worker

(function () {
  let lastSelectedText = '';

  // Track text selection changes
  document.addEventListener('mouseup', () => {
    const selection = window.getSelection().toString().trim();
    if (selection && selection.length > 0) {
      lastSelectedText = selection;
      // Notify background that text is selected so context menu can be updated
      chrome.runtime.sendMessage({
        type: 'TEXT_SELECTED',
        payload: { text: selection },
      }).catch(() => {
        // Background might not be ready, ignore
      });
    }
  });

  // Listen for messages from background service worker
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case 'GET_SELECTED_TEXT': {
        const selection = window.getSelection().toString().trim();
        sendResponse({ text: selection || lastSelectedText });
        break;
      }

      case 'START_ROUNDTABLE_FROM_SELECTION': {
        // Visual feedback: briefly highlight that the selection was captured
        const selection = window.getSelection();
        if (selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          const highlight = document.createElement('span');
          highlight.style.cssText =
            'background: rgba(99, 102, 241, 0.2); border-radius: 2px; transition: background 0.5s;';
          try {
            range.surroundContents(highlight);
            setTimeout(() => {
              const parent = highlight.parentNode;
              if (parent) {
                parent.replaceChild(
                  document.createTextNode(highlight.textContent),
                  highlight
                );
              }
            }, 1000);
          } catch (e) {
            // Selection spans multiple elements, skip highlight
          }
        }
        sendResponse({ success: true });
        break;
      }

      default:
        break;
    }
    return true;
  });
})();
