on run argv
  if (count of argv) < 1 then error "URL argument required"
  set targetUrl to item 1 of argv
  tell application "Google Chrome"
    activate
    if (count of windows) = 0 then make new window
    tell front window
      set newTab to make new tab with properties {URL:targetUrl}
      set active tab index to (count of tabs)
    end tell
    delay 8
    set js to "
      (function () {
        const pick = (el) => ({
          tag: el.tagName,
          type: el.getAttribute('type') || '',
          role: el.getAttribute('role') || '',
          aria: el.getAttribute('aria-label') || '',
          placeholder: el.getAttribute('placeholder') || '',
          text: (el.innerText || el.textContent || '').trim().slice(0, 120),
          cls: el.className ? String(el.className).slice(0, 120) : '',
          id: el.id || '',
          editable: !!el.isContentEditable
        });
        const fields = Array.from(document.querySelectorAll('textarea,input,[contenteditable=\"true\"],div[role=\"textbox\"]')).slice(-30).map(pick);
        const buttons = Array.from(document.querySelectorAll('button,[role=\"button\"]')).slice(-60).map(pick);
        return JSON.stringify({
          title: document.title,
          url: location.href,
          ready: document.readyState,
          bodyTextSample: document.body.innerText.slice(0, 1200),
          fields,
          buttons
        }, null, 2);
      })();
    "
    return execute active tab of front window javascript js
  end tell
end run
