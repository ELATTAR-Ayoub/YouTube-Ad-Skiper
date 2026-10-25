# YouTube Ad Skiper

<img src="icons/rabbit-128.png" alt="Orange rabbit logo" width="80" height="80">

A local Chrome extension that advances detected YouTube ads and clicks their
Skip buttons, with an animated popup showing your daily, weekly, monthly and
yearly skip counts.

## Install in Chrome

No build step or Tampermonkey is required.

1. On this repository's GitHub page, choose **Code → Download ZIP**.
2. Extract the ZIP to a permanent folder. Keep the extracted files there;
   Chrome loads the extension from that folder.
3. Open **`chrome://extensions`** in Chrome's address bar.
4. Turn on **Developer mode** at the top right.
5. Click **Load unpacked** and select the extracted folder that contains
   **`manifest.json`**. Select the folder, not the ZIP file.
6. Review Chrome's permission prompt and enable the extension. If Chrome asks
   about site access, allow it on YouTube.
7. Disable any older YouTube auto-skip userscript or duplicate extension.
8. Close YouTube's Developer Tools and reload any open YouTube tabs.

Open a YouTube video to use it. To see your counts, click Chrome's puzzle-piece
**Extensions** menu and select **YouTube Skip Button Clicker**. Pin its rabbit
icon for quicker access, then click the rabbit to open the popup.

## How it works

While a YouTube tab is active and visible, the extension checks once per second:

1. If YouTube marks the player as showing an ad and the ad video has a finite,
   loaded duration, try advancing it to the end.
2. Look again for an available Skip button and send a browser-level mouse
   press and release to it, whether the seek worked or not.
3. Repeat for the next ad, another Skip button or an advertiser end card.

It does not click advertiser **Play** or **Learn more** buttons through the
end-card text fallback. It does not seek videos outside a player marked as
showing an ad. Embedded players on other websites and background tabs are
outside its scope. A failed action is retried on the next polling tick.

## Your skip counts

- The popup shows **today**, **this week**, **this month** and **this year**,
  plus a seven-day activity chart.
- Weeks run **Monday–Sunday**. All periods follow your computer's local date.
- Counts begin when this version is installed; earlier versions did not record
  totals, so there is no historical backfill.
- An observed ad counts after it transitions following an extension action.
  Repeated attempts and seeking followed by dismissing the same ad's end card
  are deduplicated. Separate observed ads in a sequence count separately.
- Counts are best effort. Very brief transitions, changing YouTube markup or
  closing a tab before completion is observed can cause missed counts.

The popup supports light, dark and system themes, count-up animation, and
reduced-motion preferences.

## Privacy and permissions

The extension makes **no network requests of its own** and uses no analytics,
remote libraries or external fonts. YouTube still downloads its own videos and
ad data.

Only daily totals, a bounded list of random IDs for duplicate protection, the
tracking start date and your popup theme are stored in **`chrome.storage.local`**.
Video titles, video URLs, credentials and browsing history are not saved by the
extension. Uninstalling it clears its local data.

| Permission | Purpose |
| --- | --- |
| `debugger` | Send browser-level input to the Skip button. Chrome grants this a broad capability and may show a debugging notification during clicks. The code attaches briefly to the checked YouTube tab and detaches afterward. |
| `storage` | Keep your counts and theme locally across browser restarts. |
| YouTube host access | Run the content script and check tab URLs on `youtube.com`, `www.youtube.com` and `m.youtube.com`. |

The debugger permission is powerful and is **not restricted by the YouTube
host patterns**. Review the source before installing. This implementation
accepts input requests only from its top-level YouTube content script and
checks the tab's URL again before sending input.

## Update without losing counts

1. Download and extract the new version.
2. Copy the new files into the **same folder Chrome already loads**, replacing
   the old files. Keep its location unchanged.
3. Open `chrome://extensions` and click **Reload** on the extension's card.
4. Review any new permission request, then reload YouTube.

Do not remove the extension or load the update from a different folder as a new
extension if you want to preserve its existing local counts.

## Troubleshooting

**An ad remains on screen:** reload YouTube after installing/updating. Close
YouTube Developer Tools, check site access and make sure the extension is
enabled. If the rabbit icon shows **!**, hover over it to read the error.

**A second ad or end card appears:** the extension keeps checking every second.
If YouTube cannot seek that media, it continues looking for a Skip button.

**Counts are zero:** counting starts with this version. Counts increase after
an ad transition is observed, not immediately after every attempted click.

**A debugging notification appears:** Chrome displays it when the extension
uses its input API. Another debugger or an open DevTools session can interfere.

YouTube may change its player, refuse a seek or use a shared/server-stitched
timeline. The extension relies on its ad-state markers and cannot guarantee
skipping every ad. It is independent software, not affiliated with YouTube or
Google.

## Development and checks

The extension uses plain JavaScript, HTML and CSS. It has no runtime package
dependencies and does not need a build. Node.js 18+ is required only to run the
automated checks:

```sh
npm test
```

Tests cover targeting, input commands, seeking guards, successive ad/end-card
stages, counting, concurrent storage updates and calendar boundaries. They use
simulated browser APIs. See [TESTING.md](TESTING.md) for the exact verification
scope; a passing local test is not a guarantee about live YouTube behavior.

## Credits

- Rabbit icon: generated for this extension using image generation.
- [Inter](https://github.com/rsms/inter): bundled under the
  [SIL Open Font License](fonts/OFL.txt).
