// Shared calendar calculations for the worker and popup. No browsing history.
(() => {
  const dayKey = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  function empty(now = new Date()) {
    return {version:1, days:{}, recent:[], startedAt:now.toISOString()};
  }
  function normalize(value, now = new Date()) {
    const result = empty(now);
    if (value?.version !== 1) return result;
    for (const [key, count] of Object.entries(value.days || {})) {
      if (/^\d{4}-\d{2}-\d{2}$/.test(key) && Number.isSafeInteger(count) && count >= 0) result.days[key] = count;
    }
    result.recent = Array.isArray(value.recent) ? value.recent.filter(id => typeof id === 'string').slice(-512) : [];
    if (typeof value.startedAt === 'string' && Number.isFinite(Date.parse(value.startedAt))) result.startedAt = value.startedAt;
    return result;
  }
  function addEvent(value, id, now = new Date()) {
    if (typeof id !== 'string' || !/^[a-zA-Z0-9-]{8,128}$/.test(id)) throw new Error('Invalid ad event ID');
    const result = normalize(value, now);
    if (result.recent.includes(id)) return {stats:result, added:false};
    const key = dayKey(now);
    result.days[key] = (result.days[key] || 0) + 1;
    result.recent = [...result.recent, id].slice(-512);
    return {stats:result, added:true};
  }
  function summarize(value, now = new Date()) {
    const stats = normalize(value, now);
    const todayKey = dayKey(now);
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    monday.setDate(monday.getDate() - (monday.getDay()+6)%7);
    const weekDays = Array.from({length:7}, (_,index) => {
      const date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate()+index);
      const key = dayKey(date);
      return {key,label:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'][index],count:key>todayKey ? 0 : stats.days[key] || 0,isToday:key===todayKey,isFuture:key>todayKey};
    });
    const monthKey = todayKey.slice(0,7);
    const yearKey = todayKey.slice(0,4);
    let month=0, year=0, allTime=0;
    for (const [key,count] of Object.entries(stats.days)) {
      if (key > todayKey) continue;
      allTime += count;
      if (key.startsWith(yearKey+'-')) year += count;
      if (key.startsWith(monthKey+'-')) month += count;
    }
    return {today:stats.days[todayKey] || 0,
      week:weekDays.filter(day=>!day.isFuture).reduce((sum,day)=>sum+day.count,0),
      month,year,allTime,weekDays,
      startedAt:typeof value?.startedAt==='string' && Number.isFinite(Date.parse(value.startedAt)) ? value.startedAt : null};
  }
  globalThis.SkipStats = {dayKey,empty,normalize,addEvent,summarize};
})();
