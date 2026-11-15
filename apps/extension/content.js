// SafePaste AI — Content Script for ChatGPT, Claude, and Gemini Web Interfaces
(() => {
  const BUTTON_ID = 'safepaste-floating-trigger';
  let hideTimeout = null;

  function createFloatingButton() {
    let btn = document.getElementById(BUTTON_ID);
    if (btn) return btn;

    btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.type = 'button';
    btn.innerHTML = '🛡️ SafePaste';
    Object.assign(btn.style, {
      position: 'fixed',
      bottom: '22px',
      right: '22px',
      zIndex: '2147483647',
      display: 'none',
      alignItems: 'center',
      gap: '6px',
      padding: '8px 14px',
      borderRadius: '9999px',
      border: '1px solid rgba(16, 185, 129, 0.5)',
      background: 'rgba(15, 23, 42, 0.94)',
      color: '#6ee7b7',
      fontSize: '12px',
      fontWeight: '600',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.45)',
      cursor: 'pointer',
      backdropFilter: 'blur(8px)',
      transition: 'transform 120ms ease, opacity 120ms ease',
    });

    btn.addEventListener('mouseenter', () => {
      btn.style.transform = 'scale(1.04)';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.transform = 'scale(1)';
    });

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();

      const textToProtect = getCandidateText();
      chrome.runtime.sendMessage({
        type: 'OPEN_SAFEPASTE_SIDEPANEL',
        text: textToProtect,
      });
    });

    document.body.appendChild(btn);
    return btn;
  }

  function getActiveEditableElement() {
    const active = document.activeElement;
    if (
      active &&
      (active.tagName === 'TEXTAREA' ||
        (active instanceof HTMLElement && active.isContentEditable))
    ) {
      return active;
    }
    // Fallback selectors for common AI chat inputs
    return (
      document.querySelector('textarea#prompt-textarea') ||
      document.querySelector('[contenteditable="true"].ProseMirror') ||
      document.querySelector('rich-textarea [contenteditable="true"]') ||
      document.querySelector('textarea')
    );
  }

  function getCandidateText() {
    const selection = window.getSelection()?.toString()?.trim();
    if (selection) return selection;

    const el = getActiveEditableElement();
    if (!el) return '';
    if (el.tagName === 'TEXTAREA') {
      return el.value || '';
    }
    return el.innerText || el.textContent || '';
  }

  function showButtonTemporarily() {
    const btn = createFloatingButton();
    btn.style.display = 'inline-flex';
    if (hideTimeout) clearTimeout(hideTimeout);
    hideTimeout = setTimeout(() => {
      const candidate = getCandidateText();
      if (!candidate.trim()) {
        btn.style.display = 'none';
      }
    }, 8000);
  }

  document.addEventListener('mouseup', () => {
    const selection = window.getSelection()?.toString()?.trim();
    if (selection && selection.length > 3) {
      showButtonTemporarily();
    }
  });

  document.addEventListener('paste', () => {
    setTimeout(showButtonTemporarily, 50);
  });

  document.addEventListener('focusin', (e) => {
    const target = e.target;
    if (
      target instanceof HTMLElement &&
      (target.tagName === 'TEXTAREA' || target.isContentEditable)
    ) {
      showButtonTemporarily();
    }
  });

  // Support inserting sanitized text back from Side Panel into active prompt box
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'SAFEPASTE_INSERT_TEXT' && typeof message.text === 'string') {
      const el = getActiveEditableElement();
      if (!el) {
        sendResponse({ ok: false, error: 'No active chat input found' });
        return;
      }

      if (el.tagName === 'TEXTAREA') {
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype,
          'value'
        )?.set;
        if (setter) {
          setter.call(el, message.text);
        } else {
          el.value = message.text;
        }
        el.dispatchEvent(new Event('input', { bubbles: true }));
      } else if (el instanceof HTMLElement && el.isContentEditable) {
        el.focus();
        el.innerText = message.text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
      }
      sendResponse({ ok: true });
    }
  });
})();
