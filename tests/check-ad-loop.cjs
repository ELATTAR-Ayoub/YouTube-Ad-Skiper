const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = require('node:path').resolve(__dirname,'..') + require('node:path').sep;
const source = fs.readFileSync(root+'find-skip.js','utf8');
function seekTest(options = {}) {
  let seeks=0, time=options.time ?? 1;
  const video={ duration:options.duration ?? 30, readyState:options.loading?0:4,
    seeking:!!options.seeking, ended:!!options.ended,
    get currentTime(){return time;}, set currentTime(value){if(options.throwSeek)throw Error('unseekable');seeks++;time=value;},
    getBoundingClientRect:()=>({width:options.hidden?0:600,height:340}),
  };
  const player={classList:{contains:()=>!options.lostAdState}, querySelectorAll:()=>[video]};
  const context=vm.createContext({
    location:{protocol:'https:',hostname:options.hostname||'www.youtube.com'},
    document:{querySelectorAll:selector=>selector==='.html5-video-player.ad-showing'&&!options.normal?[player]:[]},
  });
  vm.runInContext(source,context);
  vm.runInContext('findYouTubeSkip = () => '+(options.skip?'({x:1,y:1})':'null'),context);
  const result=vm.runInContext('finishYouTubeAd()',context);
  vm.runInContext('finishYouTubeAd()',context);
  return {result,seeks,time};
}
(async()=>{
  assert.deepEqual(seekTest(),{result:true,seeks:1,time:30});
  for(const options of [{normal:true},{duration:Infinity},{duration:NaN},
    {loading:true},{seeking:true},{ended:true},{hidden:true},{lostAdState:true},
    {time:30},{throwSeek:true},{hostname:'example.com'}]) {
    assert.equal(seekTest(options).seeks,0,JSON.stringify(options));
  }
  assert.equal(seekTest({skip:true}).seeks,1);
  console.log('Seek guards passed, including seeking with Skip visible.');
})();
