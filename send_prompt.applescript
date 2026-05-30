on run argv
  if (count of argv) < 1 then error "prompt required"
  set promptText to item 1 of argv
  tell application "Google Chrome" to activate
  delay 1
  set the clipboard to promptText
  tell application "System Events"
    keystroke "v" using command down
    key code 36
  end tell
end run
