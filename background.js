importScripts('find-skip.js', 'stats.js');
const busyTabs = new Set();
let statsWrites = Promise.resolve();

function recordAd(id, completedAt = Date.now()) {
  const date = Number.isFinite(completedAt) && completedAt>=0 && completedAt<=Date.now()+60000 ? new Date(completedAt) : new Date();
  const task = statsWrites.then(async () => {
    const stored = await chrome.storage.local.get('skipStats');
    const result = SkipStats.addEvent(stored.skipStats, id, date);
    if (result.added) await chrome.storage.local.set({skipStats:result.stats});
    return {saved:true,added:result.added};
  });
  // One writer prevents simultaneous tabs from overwriting each other's counts.
  statsWrites = task.catch(() => {});
  return task;
}

chrome.runtime.onInstalled?.addListener(() => {
  const task = statsWrites.then(async () => {
    const stored=await chrome.storage.local.get('skipStats');
    if (!stored.skipStats) await chrome.storage.local.set({skipStats:SkipStats.empty()});
  });
  statsWrites=task.catch(error=>console.warn('[YouTube Skip] Could not initialize counts.',error));
});

function isYouTube(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' &&
      ['www.youtube.com', 'youtube.com', 'm.youtube.com'].includes(parsed.hostname);
  } catch { return false; }
}

async function clickSkip(tabId) {
  const target = { tabId };
  let attached = false;
  try {
    const tab = await chrome.tabs.get(tabId);
    if (!tab.url) throw new Error('YouTube site access is missing. Allow YouTube access in this extension\'s settings, then reload the tab.');
    if (!tab.active || !isYouTube(tab.url)) return { clicked: false };
    await chrome.debugger.attach(target, '1.3');
    attached = true;
    // Recompute coordinates after attach. Never use coordinates from an
    // earlier content-script snapshot or accept coordinates from a message.
    const response = await chrome.debugger.sendCommand(target, 'Runtime.evaluate', {
      expression: `(${findYouTubeSkip.toString()})()`, returnByValue: true,
    });
    if (response.exceptionDetails) throw new Error('Could not inspect the Skip control.');
    const point = response.result?.value;
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) || !isYouTube(point.url)) {
      return { clicked: false };
    }
    const current = await chrome.tabs.get(tabId);
    if (!current.url) throw new Error('YouTube site access is missing. Reload the extension and allow access to YouTube.');
    if (!current.active || current.url !== point.url) return { clicked: false };
    await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
      type: 'mousePressed', x: point.x, y: point.y,
      button: 'left', buttons: 1, clickCount: 1,
    });
    await chrome.debugger.sendCommand(target, 'Input.dispatchMouseEvent', {
      type: 'mouseReleased', x: point.x, y: point.y,
      button: 'left', buttons: 0, clickCount: 1,
    });
    await chrome.action.setBadgeText({ tabId, text: '' });
    await chrome.action.setTitle({ tabId, title: 'YouTube Skip: browser click sent' });
    return { clicked: true };
  } catch (error) {
    const message = error?.message || String(error);
    await chrome.action.setBadgeText({ tabId, text: '!' }).catch(() => {});
    await chrome.action.setTitle({ tabId, title: `YouTube Skip: ${message}` }).catch(() => {});
    return { error: message };
  } finally {
    if (attached) await chrome.debugger.detach(target).catch(() => {});
  }
}

chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (!['click-youtube-skip','youtube-ad-completed'].includes(message?.type) || sender.frameId !== 0 ||
      !sender.tab || !isYouTube(sender.url)) return;
  if (message.type === 'youtube-ad-completed') {
    recordAd(message.id,message.completedAt).then(reply, () => reply({saved:false}));
    return true;
  }
  const tabId = sender.tab.id;
  if (busyTabs.has(tabId)) { reply({ clicked: false }); return; }
  busyTabs.add(tabId);
  clickSkip(tabId).then(reply, error => reply({ error: String(error) }))
    .finally(() => busyTabs.delete(tabId));
  return true;
});
