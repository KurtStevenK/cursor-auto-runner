cask "cursor-auto-runner" do
  version "1.2.10"
  sha256 "PLACEHOLDER"

  url "https://github.com/KurtStevenK/cursor-auto-runner/releases/download/v#{version}/Cursor%20Auto%20Runner-#{version}.dmg"
  name "Cursor Auto Runner"
  desc "Auto-clicks Run / Approve buttons in the Cursor IDE"
  homepage "https://github.com/KurtStevenK/cursor-auto-runner"

  app "Cursor Auto Runner.app"
end
