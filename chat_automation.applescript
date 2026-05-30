on jsString(s)
  set oldDelims to AppleScript's text item delimiters
  set AppleScript's text item delimiters to "\\"
  set parts to text items of s
  set AppleScript's text item delimiters to "\\\\"
  set s to parts as string
  set AppleScript's text item delimiters to quote
  set parts to text items of s
  set AppleScript's text item delimiters to "\\" & quote
  set s to parts as string
  set AppleScript's text item delimiters to linefeed
  set parts to text items of s
  set AppleScript's text item delimiters to "\\n"
  set s to parts as string
  set AppleScript's text item delimiters to oldDelims
  return quote & s & quote
end jsString

on run argv
  if (count of argv) < 3 then error "Usage: chat_automation.applescript <mode> <url-or-dash> <prompt>"
  set promptText to item 3 of argv
  set promptLiteral to my jsString(promptText)
  set js to "
(async function () {
  const prompt = " & promptLiteral & ";
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const visible = (el) => {
    if (!el) return false;
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  };
  const short = (text, limit = 140) => String(text || '').replace(/\\s+/g, ' ').trim().slice(0, limit);
  const pickInput = () => {
    const textareas = Array.from(document.querySelectorAll('textarea')).filter(visible);
    const byPlaceholder = textareas.find((el) => /发消息|发送消息|DeepSeek|消息/.test(el.placeholder || ''));
    if (byPlaceholder) return byPlaceholder;
    const editables = Array.from(document.querySelectorAll('[contenteditable=true], .ql-editor')).filter(visible);
    return textareas[0] || editables[0] || null;
  };
  const setTextareaValue = (el, value) => {
    const proto = Object.getPrototypeOf(el);
    const desc = Object.getOwnPropertyDescriptor(proto, 'value') || Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    if (desc && desc.set) desc.set.call(el, value);
    else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const setEditableValue = (el, value) => {
    el.innerHTML = '';
    const p = document.createElement('p');
    p.textContent = value;
    el.appendChild(p);
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    el.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const sendByEnter = (el) => {
    const init = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
    el.dispatchEvent(new KeyboardEvent('keydown', init));
    el.dispatchEvent(new KeyboardEvent('keypress', init));
    el.dispatchEvent(new KeyboardEvent('keyup', init));
  };
  const sendByClick = (input) => {
    const inputRect = input.getBoundingClientRect();
    const candidates = Array.from(document.querySelectorAll('button,[role=button]'))
      .filter(visible)
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const label = [el.innerText, el.getAttribute('aria-label'), el.title, el.className].join(' ');
        const disabled = el.disabled || /disabled|停止|stop/i.test(label);
        const distance = Math.abs(rect.top - inputRect.top) + Math.abs(rect.left - inputRect.right);
        return { el, rect, label, disabled, distance };
      })
      .filter((item) => /发送|send|submit|arrow|icon|sizing-container|semi-button|t-button/i.test(item.label));
    candidates.sort((a, b) => a.distance - b.distance);
    const target = candidates.find((item) => !item.disabled) || candidates[0];
    if (!target) return null;
    target.el.click();
    return {
      text: short(target.el.innerText || target.el.getAttribute('aria-label')),
      cls: short(target.el.className),
      top: Math.round(target.rect.top),
      left: Math.round(target.rect.left),
    };
  };
  const bodyBefore = document.body.innerText;
  const input = pickInput();
  if (!input) {
    return JSON.stringify({ ok: false, reason: 'input_not_found', title: document.title, url: location.href, text: document.body.innerText.slice(0, 4000) }, null, 2);
  }
  input.scrollIntoView({ block: 'center' });
  input.focus();
  if (input.tagName === 'TEXTAREA' || input.tagName === 'INPUT') setTextareaValue(input, prompt);
  else setEditableValue(input, prompt);
  await sleep(600);
  sendByEnter(input);
  await sleep(1000);
  let clicked = null;
  if (document.body.innerText.length < bodyBefore.length + prompt.length + 20) clicked = sendByClick(input);
  let stableTicks = 0;
  let lastLen = document.body.innerText.length;
  const started = Date.now();
  while (Date.now() - started < 45000) {
    await sleep(1000);
    window.scrollTo(0, document.body.scrollHeight);
    const currentLen = document.body.innerText.length;
    if (currentLen > bodyBefore.length + prompt.length + 80 && Math.abs(currentLen - lastLen) < 20) stableTicks += 1;
    else stableTicks = 0;
    lastLen = currentLen;
    if (stableTicks >= 3) break;
  }
  const bodyAfter = document.body.innerText;
  const possibleBlocks = Array.from(document.querySelectorAll('main,article,[class*=message],[class*=answer],[class*=content],[class*=markdown],.markdown,.prose'))
    .filter(visible)
    .map((el) => short(el.innerText, 2200))
    .filter((text) => text.length > 80)
    .slice(-8);
  return JSON.stringify({
    ok: true,
    title: document.title,
    url: location.href,
    clicked,
    input: {
      tag: input.tagName,
      placeholder: input.getAttribute('placeholder') || '',
      cls: short(input.className),
      editable: !!input.isContentEditable,
    },
    beforeLength: bodyBefore.length,
    afterLength: bodyAfter.length,
    elapsedMs: Date.now() - started,
    tail: bodyAfter.slice(-8000),
    possibleBlocks,
  }, null, 2);
})();
  "
  tell application "Google Chrome"
    activate
    return execute active tab of front window javascript js
  end tell
end run
