// SafePaste AI — Chrome Manifest V3 Background Service Worker

chrome.runtime.onInstalled.addListener(() => {
  // Enable opening the Side Panel directly on toolbar icon click
  if (chrome.sidePanel && chrome.sidePanel.setPanelBehavior) {
    chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  }

  // Register right-click context menu for quick privacy masking
  chrome.contextMenus.create({
    id: 'safepaste-mask-selection',
    title: '🛡️ Protect & Mask with SafePaste AI',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'safepaste-mask-selection' && info.selectionText) {
    await chrome.storage.local.set({
      pendingSafePasteInput: info.selectionText,
      pendingUpdatedAt: Date.now(),
    });
    if (tab && tab.windowId && chrome.sidePanel && chrome.sidePanel.open) {
      chrome.sidePanel.open({ windowId: tab.windowId }).catch(() => {});
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'OPEN_SAFEPASTE_SIDEPANEL') {
    const text = typeof message.text === 'string' ? message.text : '';
    chrome.storage.local
      .set({
        pendingSafePasteInput: text,
        pendingUpdatedAt: Date.now(),
      })
      .then(() => {
        if (sender.tab?.windowId && chrome.sidePanel && chrome.sidePanel.open) {
          return chrome.sidePanel.open({ windowId: sender.tab.windowId });
        }
      })
      .then(() => sendResponse({ ok: true }))
      .catch((err) => sendResponse({ ok: false, error: String(err) }));
    return true; // Async response
  }

  if (message?.type === 'INSERT_SAFEPASTE_INTO_ACTIVE_TAB' && typeof message.text === 'string') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      if (!activeTab?.id) {
        sendResponse({ ok: false, error: 'No active tab' });
        return;
      }
      chrome.tabs.sendMessage(
        activeTab.id,
        { type: 'SAFEPASTE_INSERT_TEXT', text: message.text },
        (resp) => {
          if (chrome.runtime.lastError) {
            sendResponse({ ok: false, error: chrome.runtime.lastError.message });
          } else {
            sendResponse(resp || { ok: true });
          }
        }
      );
    });
    return true;
  }
});
