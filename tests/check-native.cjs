const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const dir = require('node:path').resolve(__dirname,'..') + require('node:path').sep;
const locator = fs.readFileSync(dir + 'find-skip.js', 'utf8');
const worker = fs.readFileSync(dir + 'background.js', 'utf8');
function locate(options = {}) {
  const button = {
    textContent: options.text || 'Skip', getAttribute: () => null,
    closest: selector => selector.startsWith('button') ? button : null,
    matches: () => !!options.disabled, contains: () => false,
    getBoundingClientRect: () => ({left:10, top:20, width:options.hidden ? 0 : 60, height:30}),
  };
  const context = vm.createContext({
    location: {protocol:'https:',hostname:options.hostname || 'www.youtube.com',href:'https://www.youtube.com/watch?v=test'},
    innerWidth:800, innerHeight:600,
    getComputedStyle: () => ({display:'block',visibility:'visible',pointerEvents:'auto',opacity:'1'}),
    document: {
      querySelectorAll: selector => options.endCard
        ? (selector.includes('interstitial') ? [button] : [])
        : (selector.includes('.ytp-skip-ad-button') ? [button] : []),
      elementFromPoint: () => options.covered ? {} : button,
    },
  });
  vm.runInContext(locator, context);
  return vm.runInContext('findYouTubeSkip()', context);
}
function service(options = {}) {
  const calls = [];
  let listener, reads = 0;
  const context = vm.createContext({ URL, Set, importScripts: () => {}, findYouTubeSkip: () => null,
    chrome: {
      tabs: {get: async () => ({active: !options.inactive,
        url: options.missingURL ? undefined : options.navigate && ++reads > 1 ? 'https://www.youtube.com/watch?v=other' : 'https://www.youtube.com/watch?v=test'})},
      debugger: {
        attach: async () => {calls.push('attach');},
        detach: async () => {calls.push('detach');},
        sendCommand: async (_, command, args) => {
          calls.push(command === 'Input.dispatchMouseEvent' ? args.type : command);
          if (command === 'Runtime.evaluate') return {result:{value:options.noButton ? null : {x:40,y:35,url:'https://www.youtube.com/watch?v=test'}}};
          if (options.failPress && args.type === 'mousePressed') throw Error('Input failure');
        },
      },
      action: {setBadgeText:async () => {}, setTitle:async () => {}},
      runtime: {onMessage:{addListener:fn => {listener=fn;}}},
    },
  });
  vm.runInContext(worker, context);
  return { calls, run: () => vm.runInContext('clickSkip(42)', context), listener };
}
(async () => {
  assert.equal(locate().x, 40);
  for (const options of [{disabled:true}, {hidden:true}, {covered:true}, {hostname:'example.com'}]) assert.equal(locate(options), null);
  assert.equal(locate({endCard:true}).x, 40);
  assert.equal(locate({endCard:true,text:'Play'}), null);
  const ok = service(); assert.equal((await ok.run()).clicked,true);
  assert.deepEqual(ok.calls,['attach','Runtime.evaluate','mousePressed','mouseReleased','detach']);
  const inactive = service({inactive:true}); await inactive.run(); assert.equal(inactive.calls.length,0);
  for (const options of [{noButton:true}, {navigate:true}]) {
    const s = service(options); assert.equal((await s.run()).clicked,false);
    assert.deepEqual(s.calls,['attach','Runtime.evaluate','detach']);
  }
  const failed=service({failPress:true}); assert.ok((await failed.run()).error); assert.equal(failed.calls.at(-1),'detach');
  const blocked=service();
  blocked.listener({type:'click-youtube-skip'},{frameId:0,url:'https://example.com',tab:{id:42}},()=>{});
  blocked.listener({type:'click-youtube-skip'},{frameId:1,url:'https://www.youtube.com',tab:{id:42}},()=>{});
  assert.equal(blocked.calls.length,0);
  const manifest=JSON.parse(fs.readFileSync(dir+'manifest.json','utf8'));
  assert.deepEqual(manifest.permissions,['debugger','storage']);
  assert.deepEqual(manifest.host_permissions, manifest.content_scripts[0].matches);
  const missing = service({missingURL:true});
  assert.match((await missing.run()).error, /site access is missing/);
  assert.equal(missing.calls.length,0);
  console.log('Passed permission regression checks and input/targeting checks. No live YouTube verification.');
})().catch(error => {console.error(error);process.exitCode=1;});
