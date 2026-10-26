# YouTube Skip Button Clicker — version 1.3.0

Version 1.3.0 adds master activation and independent action settings. Open the
rabbit popup, then the Settings gear. **Automatic ad skipping** pauses/resumes
both actions without losing your preferences. **Jump ads to the end** and
**Click Skip buttons** can each be switched off separately. Preferences are
stored locally and apply to open YouTube tabs immediately after the initial
update/reload. Existing skip counts are preserved.

The toolbar uses the rabbit icon while an action is enabled, and a grey power
icon with an OFF badge when paused or when both actions are disabled. The
popup distinguishes Paused from No automatic actions. Both actions default
to enabled when no preferences have been saved.

Version 1.2.1 fixes the click-only loop when a visible Skip control is ignored.
Each polling tick independently tries seeking a detected ad and then clicking
the current Skip control. Errors are retried on the next one-second tick; they
do not impose a five-second delay on the other action.

Version 1.2.0 adds an animated popup with daily, weekly, monthly and yearly ad
counts, a seven-day activity chart, and light/dark/system themes. Click the
rabbit icon in Chrome's toolbar to open it. Polling remains once per second.

## Counts and privacy

Counting starts after this update; older versions did not collect these totals.
Today, this calendar month and this calendar year use your computer's local
date. The calendar week runs Monday through Sunday. Calendar periods roll over
automatically; history is kept.

An observed ad is counted after it transitions following our click or seek.
Seeking an ad and dismissing its end card counts once. Repeated attempts and
duplicate storage messages do not increment the count again. Separate observed
ads in a sequence count separately. Ads that finish without an extension action
are not counted. Counts are best effort: very brief transitions, changing
YouTube markup, or closing a tab before completion is observed can miss a count.

Only daily totals, recent random IDs for duplicate protection, the tracking
start date, popup theme and action preferences are stored locally. No video titles, URLs or
browsing history are saved or transmitted. Uninstalling clears this data.
Preserve counts by updating the SAME loaded folder and using Reload; do not
remove the extension or load another folder as a second extension.

The extension continually performs these actions in the active YouTube tab:

1. If a visible video belongs to a player marked ad-showing and has a finite
   duration, try seeking that ad video to its end, even if Skip is visible.
2. Look again for a visible, enabled Skip control and send a browser-level mouse
   click to it using Chrome's input protocol, whether seeking worked or not.
3. Repeat: handle the next ad, an end card, and any further Skip controls.

It checks once per second (1000 ms), with one immediate check when the script
loads. This is 90% fewer scheduled checks than version 1.1.0. RAM use is expected
to remain similar; actual CPU savings have not been measured. After an action,
it checks for the next ad or Skip button on the next polling tick.
There is no one-second wait before seeking an ad. Infinite-duration/live media,
media with no loaded duration, and videos outside an ad-showing player are not
seeked. When seeking is unavailable, it keeps looking for a Skip button.

## Update an existing installation

1. Extract the new ZIP.
2. Replace the files in the SAME folder previously selected with Load unpacked.
3. Open chrome://extensions and click Reload on YouTube Skip Button Clicker.
4. Confirm the version is 1.3.0. Allow the storage permission if Chrome asks.
5. Close YouTube Developer Tools and reload YouTube.

Keep the old Tampermonkey auto-skip script disabled. Do not load a second copy
of this extension.

## First installation

1. Extract the ZIP and open chrome://extensions.
2. Enable Developer mode and choose Load unpacked.
3. Select the youtube-native-skip folder containing manifest.json.
4. Close YouTube Developer Tools and reload YouTube.

## Permissions and behavior

Chrome's debugger permission enables browser-level mouse input. It is powerful
and Chrome gives it a broad permission warning. Explicit host access is limited
to www.youtube.com, youtube.com, and m.youtube.com. The supplied code accepts
requests only from its top-level YouTube content script, rechecks the tab URL,
attaches for a click, and detaches afterward. It makes no network requests and
stores only local count data as described above. Chrome can display a debugging notification during clicks.
An open DevTools session or another debugger can conflict with this method.

Only the active, visible YouTube tab is handled. Embedded videos are excluded.
An ! on the extension icon indicates an error; hover over it to read the error.

## Validation and limits

Local automated checks cover native input commands, permission failures, Skip
priority, seeking only detected ads with finite media, and successive ad/card
stages. A live test in the in-app browser confirmed that a browser-generated
click on a real Skip button dismissed the ad and resumed the main video.

The complete packaged extension cannot be loaded into that test browser and
has NOT been verified end to end. The combined click-and-seek loop was tested
locally with simulated ad transitions. YouTube's page structure and media
behavior can change. Seeking depends on its ad-showing state correctly marking
a separate ad timeline; it cannot force unseekable or server-stitched media to
behave like a separate ad. The extension does not click an advertiser's Play
or Learn more control through the end-card text fallback.

Remove or disable the extension on chrome://extensions.

References:
- https://developer.chrome.com/docs/extensions/reference/api/debugger
- https://chromedevtools.github.io/devtools-protocol/tot/Input/#method-dispatchMouseEvent
