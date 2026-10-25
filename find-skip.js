// Self-contained so the worker can run the same search after attaching.
function findYouTubeSkip() {
  if (location.protocol !== 'https:' ||
      !['www.youtube.com', 'youtube.com', 'm.youtube.com'].includes(location.hostname)) return null;
  const known = [
    '.ytp-skip-ad-button', '.ytp-skip-ad-button-modern',
    '.ytp-ad-skip-button', '.ytp-ad-skip-button-modern',
    '.ytp-ad-skip-button-slot button', '.ytp-ad-skip-button-container button',
  ].join(',');
  const candidates = new Set(document.querySelectorAll(known));
  // Restrict label matching to ad UI, never the advertiser's Play button.
  const adControls = document.querySelectorAll([
    '.video-ads button', '.video-ads [role="button"]',
    '.ytp-ad-action-interstitial button',
    '.ytp-video-interstitial-buttoned-centered-layout button',
  ].join(','));
  for (const button of adControls) {
    const label = (button.getAttribute('aria-label') || '').trim();
    const text = (button.textContent || '').replace(/\s+/g, ' ').trim();
    if (/^skip(?: ads?)?$/i.test(label) || /^skip(?: ads?)?$/i.test(text)) candidates.add(button);
  }
  for (const candidate of candidates) {
    const button = candidate.closest('button, [role="button"]') ||
      candidate.querySelector('button, [role="button"]') || candidate;
    if (button.matches(':disabled') ||
        button.closest('[hidden], [inert], [aria-disabled="true"]')) continue;
    const style = getComputedStyle(button);
    if (style.display === 'none' || style.visibility !== 'visible' ||
        style.pointerEvents === 'none' || Number(style.opacity) === 0) continue;
    const rect = button.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    const x = rect.left + rect.width / 2;
    const y = rect.top + rect.height / 2;
    if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
    // Do not click through a menu or an overlay covering the button.
    const hit = document.elementFromPoint(x, y);
    if (!hit || (hit !== button && !button.contains(hit))) continue;
    return { x, y, url: location.href };
  }
  return null;
}

function finishYouTubeAd() {
  if (location.protocol !== 'https:' ||
      !['www.youtube.com', 'youtube.com', 'm.youtube.com'].includes(location.hostname)) return false;
  // Seek detected ad media even if Skip is present: its click may be ignored.
  // The content loop checks for the current Skip control again after this.
  for (const player of document.querySelectorAll('.html5-video-player.ad-showing')) {
    for (const video of player.querySelectorAll('video')) {
      const rect = video.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0 || video.readyState < 1 ||
          video.seeking || video.ended || !Number.isFinite(video.duration) ||
          video.duration <= 0 || video.currentTime >= video.duration - 0.05) continue;
      // This runs synchronously in the content script: ad state and media
      // cannot change between this check and the assignment via an async wait.
      if (!player.classList.contains('ad-showing')) continue;
      try {
        video.currentTime = video.duration;
        return true;
      } catch {
        // Unseekable media: let YouTube continue and check for Skip next tick.
      }
    }
  }
  return false;
}

function readYouTubeAdState(skip = findYouTubeSkip()) {
  const shown = element => {
    const rect=element.getBoundingClientRect();
    return rect.width>0 && rect.height>0 && getComputedStyle(element).visibility==='visible';
  };
  const adPlayer=[...document.querySelectorAll('.html5-video-player.ad-showing')].find(shown);
  const card=[...document.querySelectorAll('.ytp-ad-action-interstitial, .ytp-video-interstitial-buttoned-centered-layout')].find(shown);
  const player=adPlayer || card?.closest('.html5-video-player') || document.querySelector('#movie_player');
  const video=player?.querySelector('video');
  const pod=player?.innerText.match(/\b(\d+)\s+of\s+(\d+)\b/i)?.[0] || '';
  return {page:location.pathname+'?v='+new URL(location.href).searchParams.get('v'),
    isAd:!!(adPlayer || card || skip),endCard:!!card,pod,
    src:video?.currentSrc || '',time:video?.currentTime || 0,
    loaded:!!video && Number.isFinite(video.duration) && video.duration>0,
    seeking:!!video?.seeking};
}
