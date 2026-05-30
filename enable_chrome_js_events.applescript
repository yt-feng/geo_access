tell application "Google Chrome" to activate
delay 1
tell application "System Events"
  tell process "Google Chrome"
    tell menu bar 1
      tell menu bar item "View"
        tell menu "View"
          tell menu item "Developer"
            tell menu "Developer"
              click menu item "Allow JavaScript from Apple Events"
            end tell
          end tell
        end tell
      end tell
    end tell
  end tell
end tell
