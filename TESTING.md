# Version 1.3.0 verification

- Added settings regressions for every effective action combination, live
  pause/resume with preserved preferences, safe startup while settings load,
  stale initial reads, disabled native-click requests, pausing during native
  inspection, and toolbar icon/badge changes. All pass.
- Browser preview verified master pause, independent controls, no-actions
  status, Escape/back navigation, save-failure rollback and successful Retry.
  Settings measured 400px wide, 518px high; its failed-save state fits at 596px.
  Preview storage was simulated outside the packaged extension.

- Added four simulated regressions for a visible Skip button on both ads,
  unseekable second-ad media, an ignored click, and a debugger error. All pass
  through to main content; the corresponding two ads count once each.
- Seeking guard tests pass, including seeking while Skip is visible. The
  one-second interval remains; errors do not add a multi-second backoff.

- JavaScript syntax checks passed for the content script, worker, tracker,
  calendar helpers and popup.
- 20 automated tracking/storage/calendar scenarios passed in Asia/Taipei and
  America/New_York, including DST, Monday/Sunday weeks, month/year boundaries,
  midnight, duplicate messages, repeated clicks, seek plus end-card dismissal,
  end-card flicker, multiple ad sequences and serialized concurrent tab writes.
- Existing native-input targeting and permission regression checks passed.
- The actual popup HTML/CSS/JS was served locally with a separate test-only
  Chrome-storage adapter. That adapter and its sample counts are NOT packaged.
- Visually reviewed light and dark at 400px wide, 584px high. Checked empty,
  large-count, loading-over-one-second, initial storage failure and Retry states.
  Error layout measured 410px high; no horizontal overflow at 400px.
- Browser logs showed no errors or warnings in the popup preview. Theme changes
  worked, the keyboard reached the theme control with a visible focus ring,
  and its target measured 44px. Count-up motion was observed during loading.
- Measured text contrast in the browser: dark foreground 19.06:1, muted text
  on the daily surface 10.08:1, daily number 12.76:1; light foreground 19.90:1,
  muted text on the daily surface 5.50:1, daily number 4.54:1. Footer contrast:
  13.46:1 dark, 6.04:1 light.
- Reduced-motion CSS and the JavaScript reduced-motion branch are present;
  an OS-level reduced-motion setting was not toggled during this preview.
- Elattar's framework checks report 'Not a shadcn project' for this plain
  HTML/JavaScript Chrome extension. They are not claimed as passing. UI tokens,
  local font and interaction principles were ported without a framework.

The complete extension's new statistics have not been verified against live
YouTube ad transitions in an installed Chrome session. The new tracking loop
was exercised with simulated ad transitions; the native click method had a
separate earlier live YouTube test. No end-to-end pass is claimed here.
