/* Popup reads local totals only. No telemetry, network calls, or sample counts. */
(() => {
 'use strict';
 const byId = id => document.getElementById(id);
 const formatter = new Intl.NumberFormat();
 const shortFormatter = new Intl.NumberFormat(undefined, {notation:'compact', maximumFractionDigits:1});
 const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
 const systemTheme = matchMedia('(prefers-color-scheme: dark)');
 const themeOrder = ['system', 'light', 'dark'];
 const paths = {
  system:'M4 4h16v12H4z M8 20h8 M12 16v4',
  light:'M12 3v2 M12 19v2 M3 12h2 M19 12h2 M5.6 5.6l1.4 1.4 M17 17l1.4 1.4 M5.6 18.4L7 17 M17 7l1.4-1.4 M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
  dark:'M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5'
 };
 let theme = 'system';
 let storedStats;
 let readGeneration = 0;
 let animationFrame;
 const displayed = {today:0,week:0,month:0,year:0};
 let hasRendered = false;
 let loadingMessage;
 function announce(message) {byId('status').textContent = message;}
 function applyTheme() {
  document.documentElement.dataset.theme = theme === 'system' ? (systemTheme.matches ? 'dark' : 'light') : theme;
  const next = themeOrder[(themeOrder.indexOf(theme) + 1) % themeOrder.length];
  byId('theme').setAttribute('aria-label', `Theme: ${theme}. Switch to ${next} theme.`);
  byId('theme').title = `Theme: ${theme}. Switch to ${next}.`;
  byId('theme-path').setAttribute('d', paths[theme]);
 }
 function countUp(summary) {
  cancelAnimationFrame(animationFrame);
  const initial = {...displayed};
  const duration = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--duration-slow')) || 400;
  const start = performance.now();
  function paint(now) {
   const fraction = reduceMotion.matches ? 1 : Math.min(1, (now-start)/duration);
   const progress = 1-Math.pow(1-fraction, 3);
   for (const key of Object.keys(displayed)) {
    displayed[key] = Math.round(initial[key]+(summary[key]-initial[key])*progress);
    const text = key !== 'today' && displayed[key] >= 100000 ? shortFormatter.format(displayed[key]) : formatter.format(displayed[key]);
    byId(key).textContent = text;
    byId(key).title = formatter.format(summary[key]);
    if (key !== 'today') byId(key).setAttribute('aria-label', formatter.format(summary[key]));
   }
   if (fraction < 1) animationFrame = requestAnimationFrame(paint);
  }
  animationFrame = requestAnimationFrame(paint);
 }
 function drawChart(days) {
  const chart = byId('chart');
  const maximum = Math.max(1, ...days.map(day => day.count));
  chart.setAttribute('aria-label', days.map(day => `${day.label}${day.isToday ? ' (today)' : ''}: ${formatter.format(day.count)} ads skipped${day.isFuture ? ', upcoming' : ''}`).join('; '));
  if (chart.children.length !== days.length) {
   chart.replaceChildren();
   for (const day of days) {
    const column = document.createElement('div');
    column.className = 'day';
    column.setAttribute('aria-hidden', 'true');
    const value = document.createElement('span'); value.className = 'day-count';
    const track = document.createElement('div'); track.className = 'bar-space';
    const bar = document.createElement('div'); bar.className = 'bar';
    const label = document.createElement('span'); label.className = 'day-label';
    track.append(bar); column.append(value, track, label); chart.append(column);
   }
  }
  [...chart.children].forEach((column, index) => {
   const day = days[index];
   column.classList.toggle('is-today', day.isToday);
   column.classList.toggle('is-future', day.isFuture);
   column.querySelector('.day-count').textContent = day.isFuture ? '—' : shortFormatter.format(day.count);
   column.querySelector('.day-label').textContent = day.label;
   column.title = `${day.key}: ${formatter.format(day.count)} ads skipped`;
   const bar = column.querySelector('.bar');
   const scale = day.count / maximum;
   requestAnimationFrame(() => {bar.style.transform = `scaleY(${scale})`;});
  });
 }
 function render() {
  const now = new Date();
  const summary = globalThis.SkipStats.summarize(storedStats, now);
  byId('date').textContent = new Intl.DateTimeFormat(undefined, {month:'short', day:'numeric'}).format(now);
  byId('today-accessible').textContent = `${formatter.format(summary.today)} ads skipped today.`;
  byId('daily-note').textContent = summary.today ? 'Fewer interruptions. More video.' : summary.allTime ? 'A fresh day. Ready for your next skip.' : 'Your next skip starts the story.';
  byId('tracking-note').textContent = summary.startedAt ? `Counting since ${new Intl.DateTimeFormat(undefined, {month:'short',day:'numeric',year:'numeric'}).format(new Date(summary.startedAt))}.` : 'Counting starts with this update.';
  byId('popup').setAttribute('aria-busy', 'false');
  delete byId('popup').dataset.failed;
  byId('error').hidden = true;
  byId('retry').disabled = false;
  byId('retry').textContent = 'Try again';
  countUp(summary); drawChart(summary.weekDays);
  if (!hasRendered) announce('Your ad skip counts are loaded.');
  hasRendered = true;
 }
 function showError() {
  clearTimeout(loadingMessage);
  byId('popup').setAttribute('aria-busy', 'false');
  byId('popup').dataset.failed = hasRendered ? 'stale' : 'initial';
  byId('error').hidden = false;
  byId('retry').disabled = false;
  byId('retry').textContent = 'Try again';
  byId('daily-note').textContent = hasRendered ? 'Showing your last loaded counts.' : 'Your saved counts are unavailable.';
  if (!hasRendered) byId('today-accessible').textContent = "Today's count is unavailable.";
  announce("Couldn't load your counts. Choose Try again.");
 }
 async function load() {
  const generation = ++readGeneration;
  clearTimeout(loadingMessage);
  byId('popup').setAttribute('aria-busy', 'true');
  byId('retry').disabled = true;
  byId('retry').textContent = 'Loading…';
  loadingMessage = setTimeout(() => {
   if (generation !== readGeneration) return;
   byId('daily-note').textContent = hasRendered ? 'Refreshing your saved counts…' : 'Still loading your saved counts…';
   announce('Loading your saved counts. This is taking a moment.');
  }, 1000);
  try {
   const data = await chrome.storage.local.get(['skipStats', 'popupTheme']);
   if (generation !== readGeneration) return;
   clearTimeout(loadingMessage);
   storedStats = data.skipStats;
   theme = themeOrder.includes(data.popupTheme) ? data.popupTheme : 'system';
   applyTheme(); render();
  } catch (error) {
   if (generation === readGeneration) showError();
  }
 }
 byId('theme').addEventListener('click', async () => {
  theme = themeOrder[(themeOrder.indexOf(theme)+1)%themeOrder.length];
  applyTheme();
  announce(`${theme.charAt(0).toUpperCase()+theme.slice(1)} theme selected.`);
  try {await chrome.storage.local.set({popupTheme:theme});}
  catch {announce('Theme changed for this popup, but could not be saved. Try switching again.');}
 });
 byId('retry').addEventListener('click', load);
 systemTheme.addEventListener('change', () => {if (theme === 'system') applyTheme();});
 if (globalThis.chrome?.storage?.onChanged) chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes.popupTheme) {theme = themeOrder.includes(changes.popupTheme.newValue) ? changes.popupTheme.newValue : 'system'; applyTheme();}
  if (changes.skipStats) {
   ++readGeneration;
   storedStats = changes.skipStats.newValue;
   try {render(); announce('Ad skip counts updated.');} catch {showError();}
  }
 });
 function refreshPeriods() {if (hasRendered && !document.hidden) {try {render();} catch {showError();}}}
 document.addEventListener('visibilitychange', refreshPeriods);
 window.addEventListener('focus', refreshPeriods);
 setInterval(refreshPeriods, 60000);
 applyTheme(); load();
})();
