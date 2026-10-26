const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const source=file=>fs.readFileSync(path.join(root,file),'utf8');
const wait=()=>new Promise(resolve=>setImmediate(resolve));
async function contentFixture(initial,options={}) {
 let tick,changed,release,settings=initial;
 const actions=[];
 const context=vm.createContext({Date,crypto:require('node:crypto').webcrypto,console:{warn:()=>{}},document:{visibilityState:'visible'},
 findYouTubeSkip:()=>({x:1,y:1}),
 readYouTubeAdState:()=>({page:'test',isAd:true,src:'ad',pod:'1 of 2',time:2,seeking:false,endCard:false}),
 finishYouTubeAd:()=>{actions.push('seek');return true;},
 chrome:{storage:{local:{get:options.delayed?()=>new Promise(resolve=>{release=()=>resolve({skipSettings:initial});}):async()=>({skipSettings:settings})},onChanged:{addListener:fn=>{changed=fn;}}},runtime:{sendMessage:async message=>{if(message.type==='click-youtube-skip')actions.push('click');return{clicked:true,saved:true};}}},
 setInterval:(fn,ms)=>{assert.equal(ms,1000);tick=fn;}});
 for(const file of ['settings.js','tracker.js','content.js'])vm.runInContext(source(file),context);
 await wait();
 return {actions,tick,release,change(value){settings=value;changed({skipSettings:{newValue:value}},'local');}};
}
async function workerFixture(initial,disableDuringInspection=false) {
 let settings=initial;const calls=[];let changeListener;
 const context=vm.createContext({URL,Set,Date,console,importScripts:()=>{},findYouTubeSkip:()=>null,
 chrome:{storage:{local:{get:async()=>({skipSettings:settings})},onChanged:{addListener:fn=>{changeListener=fn;}}},
 tabs:{get:async()=>({active:true,url:'https://www.youtube.com/watch?v=test'})},
 debugger:{attach:async()=>calls.push('attach'),detach:async()=>calls.push('detach'),sendCommand:async(_,name,params)=>{
   if(name==='Runtime.evaluate'){calls.push('inspect');if(disableDuringInspection)settings={...settings,enabled:false};return{result:{value:{x:10,y:10,url:'https://www.youtube.com/watch?v=test'}}};}
   calls.push(params.type);
 }},action:{setIcon:async options=>calls.push(options.path[16]),setBadgeText:async options=>calls.push('badge:'+options.text),setTitle:async()=>{}},runtime:{onMessage:{addListener:()=>{}}}}});
 vm.runInContext(source('settings.js'),context);vm.runInContext(source('background.js'),context);await wait();calls.length=0;
 return {calls,run:()=>vm.runInContext('clickSkip(1)',context),async toolbar(value){settings=value;changeListener({skipSettings:{newValue:value}},'local');await wait();}};
}
(async()=>{
 const defaults={enabled:true,seekAds:true,clickSkip:true};
 for(const [settings,expected] of [[defaults,['seek','click']],[{...defaults,enabled:false},[]],[{...defaults,seekAds:false},['click']],[{...defaults,clickSkip:false},['seek']],[{...defaults,seekAds:false,clickSkip:false},[]]]){
  const fixture=await contentFixture(settings);assert.deepEqual(fixture.actions,expected);
 }
 console.log('PASS all master/seek/click combinations');
 const live=await contentFixture(defaults);live.actions.length=0;live.change({...defaults,enabled:false});await live.tick();assert.equal(live.actions.length,0);
 live.change({...defaults,enabled:false,seekAds:false});await live.tick();assert.equal(live.actions.length,0);
 live.change({...defaults,seekAds:false});await live.tick();assert.deepEqual(live.actions,['click']);
 console.log('PASS live pause/resume preserves independent action preferences');
 const late=await contentFixture(defaults,{delayed:true});await late.tick();assert.equal(late.actions.length,0);
 late.change({...defaults,enabled:false});late.release();await wait();await late.tick();assert.equal(late.actions.length,0);
 console.log('PASS no action before settings load and no stale-read override');
 for(const settings of [{...defaults,enabled:false},{...defaults,clickSkip:false}]){
  const worker=await workerFixture(settings);assert.equal((await worker.run()).disabled,true);assert.equal(worker.calls.length,0);
 }
 console.log('PASS worker rejects disabled clicks without attaching debugger');
 const inFlight=await workerFixture(defaults,true);assert.equal((await inFlight.run()).disabled,true);assert.deepEqual(inFlight.calls,['attach','inspect','detach']);
 console.log('PASS pause during inspection prevents mouse press');
 const toolbar=await workerFixture(defaults);await toolbar.toolbar({...defaults,enabled:false});assert.ok(toolbar.calls.includes('icons/paused-16.png'));assert.ok(toolbar.calls.includes('badge:OFF'));
 toolbar.calls.length=0;await toolbar.toolbar(defaults);assert.ok(toolbar.calls.includes('icons/rabbit-16.png'));assert.ok(toolbar.calls.includes('badge:'));
 console.log('PASS toolbar icon and badge reflect active/paused state');
})().catch(error=>{console.error(error);process.exitCode=1;});
