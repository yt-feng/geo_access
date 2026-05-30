on run argv
  if (count of argv) < 5 then error "Usage: simple_chat_capture.applescript <url> <prompt> <html-out> <text-out> <screenshot-out> [wait-seconds]"
  set targetUrl to item 1 of argv
  set promptText to item 2 of argv
  set htmlOut to item 3 of argv
  set textOut to item 4 of argv
  set screenshotOut to item 5 of argv
  set waitSeconds to 8
  if (count of argv) >= 6 then set waitSeconds to (item 6 of argv as integer)

  tell application "Google Chrome"
    activate
    if (count of windows) = 0 then make new window
    tell front window
      set newTab to make new tab with properties {URL:targetUrl}
      set active tab index to (count of tabs)
    end tell
  end tell

  delay 8
  set the clipboard to promptText
  tell application "System Events"
    keystroke "v" using command down
    key code 36
  end tell

  delay waitSeconds

  do shell script "screencapture -x " & quoted form of screenshotOut

  tell application "Google Chrome"
    set pageHtml to execute active tab of front window javascript "document.documentElement.outerHTML"
    set pageText to execute active tab of front window javascript "document.body.innerText"
    close active tab of front window
  end tell

  my writeText(htmlOut, pageHtml)
  my writeText(textOut, pageText)
end run

on writeText(pathText, contentText)
  set targetFile to POSIX file pathText
  set fileRef to open for access targetFile with write permission
  try
    set eof fileRef to 0
    write contentText to fileRef as «class utf8»
    close access fileRef
  on error errMsg
    try
      close access fileRef
    end try
    error errMsg
  end try
end writeText
