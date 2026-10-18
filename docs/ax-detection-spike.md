# Spike A1: Accessibility-API button detection

## Goal
Find out whether Cursor's "Run", "Always Run" and "Allow" buttons can be located and pressed through OS accessibility APIs instead of screenshot template matching. That would be faster, theme-independent and DPI-independent.

## How to run (macOS)
```
node scripts/spike-ax-buttons.js              # sets AXEnhancedUserInterface/AXManualAccessibility on Cursor, walks, reports
node scripts/spike-ax-buttons.js --no-enable  # walk without enabling AX (baseline)
node scripts/spike-ax-buttons.js --press      # also press if exactly one "Run" button matches (default is dry-run)
```
The script runs JXA through `osascript` and drives System Events. It walks every Cursor window (depth 25, 20000 nodes, 8 s budget) and prints the element count, a role histogram, the walk time and any AXButton matching `/^(Run|Always Run|Allow|Approve|Accept|Run command)/i`. The calling app (Terminal, the Claude host, or later the packaged app) needs Accessibility permission.

## Observed on this machine (2026-10-18)
No measurements could be taken:
- Cursor was not running, so both runs (`--no-enable` and default) ended with "Cursor process not running".
- A sanity check against Finder failed with `-25211` ("osascript hat keine Berechtigung fuer den Hilfszugriff"). The host process has no Accessibility permission, so System Events cannot read UI elements at all. I did not retry.

The script is untested against a live tree. **To get real numbers:** grant Accessibility to the terminal, start Cursor, trigger a Run prompt, then run the script with `--no-enable` and again without it. Compare `elements visited` between the two runs; that difference is the effect of enabling AX.

Record results here:

| Run | Elements | Walk ms | Matching buttons |
|-----|----------|---------|------------------|
| before enabling AX | _tbd_ | _tbd_ | _tbd_ |
| after enabling AX | _tbd_ | _tbd_ | _tbd_ |

## Feasibility verdict (macOS): open, plausible
Not proven here. From how Chromium behaves:
- **Tree available:** Probably yes, but only after an assistive client has been detected. Setting `AXEnhancedUserInterface` or `AXManualAccessibility` on the app element is the standard trigger. Chromium builds the tree lazily, so the first walk may show only the window frame and toolbar.
- **Walk time:** Each AX attribute read is an IPC round trip to the renderer. System Events via JXA is slow, typically tens of ms per 100 elements. A full VS Code tree can have thousands of nodes, so a full walk is likely 1 to 8 s. That is too slow for a 150 ms poll. A narrow walk would be needed, for example only the chat or composer subtree, or a native `AXUIElement` addon with batch attribute copy, which is much faster.
- **Press:** `AXPress` on Chromium buttons normally works and does not need the mouse or focus. That is a real advantage over synthetic clicks.
- **Unknown:** whether Cursor renders the prompt buttons as real `<button>` elements with accessible names, or as divs without roles. This needs the live check above.

## Windows equivalent
UI Automation (UIA). Chromium exposes UIA when it detects a UIA client, or with `--force-renderer-accessibility`. Options:
- PowerShell with `System.Windows.Automation`: `AutomationElement.RootElement.FindAll(TreeScope.Descendants, PropertyCondition(ControlTypeProperty, ControlType.Button))`, filtered by `Name`, then `InvokePattern.Invoke()`. Process startup costs about 300 ms per call, so a long-lived helper process is better.
- A small native addon (C++/C# using UIAutomationClient, or `node-ffi` against COM) that caches an `IUIAutomation` instance and uses a `CacheRequest` to batch properties. This is the efficient route.
Not implemented in this spike.

## Risks
- Chromium accessibility is only active while an AT is connected. Enabling it makes Cursor's renderers build and maintain the full AX tree, adding CPU and memory cost in every window and possibly slowing the editor. Needs measuring.
- Names are localized. The patterns are English, so other UI languages would fail where template matching might still work. A fallback or per-locale list is needed.
- The app needs the Accessibility permission, which is one more TCC prompt on top of Screen Recording. It would also be needed for signed or notarized builds.
- Cursor can change its DOM and ARIA labels between releases, as it can change visuals. Both approaches break, in different ways.
- AX trees contain other Cursor windows, webviews, and text from the user's code. Matching must be limited to buttons, and nothing from the tree should be logged.

## Recommended next step
1. Run the script on a machine with Accessibility granted, with a real Run prompt on screen, to fill in the table above (about 1 hour).
2. If the tree is exposed with named buttons: add a `detection-ax.ts` provider behind an opt-in setting (e.g. `detection.mode: 'template' | 'ax' | 'auto'`). `auto` tries AX first and falls back to template matching on any failure (permission denied, no match, timeout). Use a native `AXUIElement` helper with a scoped subtree walk rather than JXA. The provider should return the same `{x, y, label}` shape as the matcher, so the click path stays unchanged, with `AXPress` as a bonus.
3. Effort: macOS provider about 3 to 4 days (helper, permission flow, settings, tests, perf measurement). Windows UIA provider about 3 to 5 days more. If the spike shows unnamed elements or walks above 1 s even when scoped, drop the idea.
