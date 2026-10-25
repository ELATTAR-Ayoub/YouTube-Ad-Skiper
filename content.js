(() => {
  let busy = false;
  const tracker = new SkipAdTracker();
  const pending = [];
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
    if (busy || document.visibilityState !== 'visible') return;
    busy = true;
    try {
      await saveCompleted();
      let adId = tracker.observe(readYouTubeAdState());
      // These are independent actions. A visible but ineffective Skip button
      // must never prevent seeking a detected ad on the next one-second tick.
      if (finishYouTubeAd()) tracker.markAction(adId);
      // Seeking may reveal an end card or the next ad. Use its current control,
      // not the button/coordinates that existed before the seek.
      const skip = findYouTubeSkip();
      adId = tracker.observe(readYouTubeAdState(skip));
      if (skip) {
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
  check();
})();
