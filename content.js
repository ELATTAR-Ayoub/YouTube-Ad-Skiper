(() => {
  let busy = false;
  const tracker = new SkipAdTracker();
  const pending = [];
  let settings=SkipSettings.normalize();
  let settingsReady=false;
  let settingsRevision=0;
  function applySettings(value) {
    settings=SkipSettings.normalize(value);
    settingsReady=true;
    if (!SkipSettings.active(settings)) tracker.reset();
  }
  chrome.storage.onChanged.addListener((changes,area)=>{
    if (area!=='local' || !changes.skipSettings) return;
    ++settingsRevision;
    applySettings(changes.skipSettings.newValue);
  });
  async function initializeSettings() {
    const revision=settingsRevision;
    try {
      const stored=await chrome.storage.local.get('skipSettings');
      if (revision===settingsRevision) applySettings(stored.skipSettings);
      check();
    } catch (error) {
      // No automatic action until preferences can be read successfully.
      console.warn('[YouTube Skip] Could not load settings. Reload the tab to retry.',error);
    }
  }
  async function saveCompleted() {
    pending.push(...tracker.takeCompleted());
    while (pending.length) {
      try {
        const reply = await chrome.runtime.sendMessage({type:'youtube-ad-completed',id:pending[0].id,completedAt:pending[0].completedAt});
        if (!reply?.saved) break;
        pending.shift();
      } catch { break; }
    }
  }
  async function check() {
    if (busy || !settingsReady || !SkipSettings.active(settings) || document.visibilityState !== 'visible') return;
    busy = true;
    try {
      await saveCompleted();
      if (!SkipSettings.active(settings)) return;
      let adId = tracker.observe(readYouTubeAdState());
      // These are independent actions. A visible but ineffective Skip button
      // must never prevent seeking a detected ad on the next one-second tick.
      if (settings.seekAds && finishYouTubeAd()) tracker.markAction(adId);
      // Seeking may reveal an end card or the next ad. Use its current control,
      // not the button/coordinates that existed before the seek.
      const skip = findYouTubeSkip();
      adId = tracker.observe(readYouTubeAdState(skip));
      if (skip && settings.enabled && settings.clickSkip) {
        const result = await chrome.runtime.sendMessage({ type: 'click-youtube-skip' });
        if (result?.clicked) tracker.markAction(adId);
        if (result?.error) console.warn('[YouTube Skip]', result.error);
      }
      // An action can immediately reveal another ad or main content.
      tracker.observe(readYouTubeAdState());
      await saveCompleted();
    } catch (error) {
      console.warn('[YouTube Skip] Reload this tab after updating the extension.', error);
    } finally {
      busy = false;
    }
  }
  setInterval(check, 1000);
  initializeSettings();
})();
