// The master switch preserves the two independent action preferences.
(() => {
  const defaults=Object.freeze({enabled:true,seekAds:true,clickSkip:true});
  function normalize(value) {
    return Object.fromEntries(Object.entries(defaults).map(([key,fallback])=>
      [key,typeof value?.[key]==='boolean'?value[key]:fallback]));
  }
  function active(value) {
    const settings=normalize(value);
    return settings.enabled && (settings.seekAds || settings.clickSkip);
  }
  globalThis.SkipSettings={defaults,normalize,active};
})();
