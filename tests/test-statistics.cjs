const fs=require('node:fs');const vm=require('node:vm');const assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..') + require('node:path').sep;
const statsSource=fs.readFileSync(root+'stats.js','utf8');
const trackerSource=fs.readFileSync(root+'tracker.js','utf8');
const ctx=vm.createContext({Date,crypto:require('node:crypto').webcrypto});
vm.runInContext(statsSource+trackerSource,ctx);const S=ctx.SkipStats;const Tracker=ctx.SkipAdTracker;
let checks=0;function test(label,fn){fn();checks++;console.log('PASS '+label);}
const local=(y,m,d,h=12)=>new Date(y,m-1,d,h);
test('day/week/month/year use local calendar and Monday-Sunday',()=>{
 const summary=S.summarize({version:1,days:{'2026-10-25':2,'2026-10-19':3,'2026-10-18':5,'2026-10-01':7,'2026-01-01':11,'2025-12-31':13}},local(2026,10,25));
 assert.equal(summary.today,2);assert.equal(summary.week,5);assert.equal(summary.month,17);assert.equal(summary.year,28);assert.equal(summary.allTime,41);assert.equal(summary.weekDays[0].key,'2026-10-19');
});
test('week spans year boundary without ISO-year confusion',()=>{
 const r=S.summarize({version:1,days:{'2025-12-29':3,'2025-12-31':4,'2026-01-01':5}},local(2026,1,1));assert.equal(r.week,12);assert.equal(r.month,5);assert.equal(r.year,5);
});
test('midnight resets today, preserves history',()=>{
 let s=S.addEvent(null,'event-0001',local(2026,10,25,23)).stats;
 assert.equal(S.summarize(s,local(2026,10,26,0)).today,0);assert.equal(S.summarize(s,local(2026,10,26,0)).month,1);
});
test('duplicate storage event is idempotent',()=>{
 let r=S.addEvent(null,'event-0001',local(2026,10,25));r=S.addEvent(r.stats,'event-0001',local(2026,10,25));assert.equal(r.added,false);assert.equal(r.stats.days['2026-10-25'],1);
});
test('malformed/negative/future counts and invalid timestamps',()=>{
 const r=S.summarize({version:1,days:{'bad':20,'2026-10-25':-2,'2026-10-24':4,'2026-12-01':9},startedAt:'invalid'},local(2026,10,25));assert.equal(r.month,4);assert.equal(r.startedAt,null);
});
test('DST week has seven local dates',()=>{
 const r=S.summarize(null,local(2026,3,8));assert.equal(new Set(r.weekDays.map(d=>d.key)).size,7);assert.equal(r.weekDays[0].key,'2026-03-02');assert.equal(r.weekDays[6].key,'2026-03-08');
});
let serial=0;const sample=(more={})=>({page:'watch?v=test',isAd:true,endCard:false,pod:'1 of 2',src:'ad-one',time:2,loaded:true,seeking:false,...more});
const tracker=()=>new Tracker(()=>`ad-event-${++serial}`);
test('ignored/retried clicks are not immediately counted',()=>{
 const t=tracker();let id=t.observe(sample());t.markAction(id);for(let i=0;i<10;i++)t.observe(sample());assert.equal(t.takeCompleted().length,0);
 t.observe(sample({isAd:false}));assert.equal(t.takeCompleted().length,1);assert.equal(t.takeCompleted().length,0);
});
test('seek plus repeated end-card clicks count one ad',()=>{
 const t=tracker();let id=t.observe(sample());t.markAction(id);id=t.observe(sample({endCard:true,src:'',loaded:false,time:0}));t.markAction(id);
 t.observe(sample({endCard:true,src:'',loaded:false,time:0}));t.observe(sample({isAd:false}));assert.equal(t.takeCompleted().length,1);
});
test('two consecutive ads plus their end cards count twice',()=>{
 const t=tracker();let id=t.observe(sample());t.markAction(id);t.observe(sample({endCard:true}));
 id=t.observe(sample({src:'ad-two',pod:'2 of 2',time:0}));t.markAction(id);t.observe(sample({src:'ad-two',pod:'2 of 2',endCard:true}));t.observe(sample({isAd:false}));assert.equal(t.takeCompleted().length,2);
});
test('brief blank transition before end card does not count twice',()=>{
 const t=tracker();t.markAction(t.observe(sample()));t.observe(sample({isAd:false}));
 const first=t.takeCompleted();t.markAction(t.observe(sample({endCard:true,src:'',loaded:false})));
 t.observe(sample({isAd:false}));assert.equal(first.length,1);assert.equal(t.takeCompleted().length,0);
});
test('end-card visibility flicker is not a new ad',()=>{
 const t=tracker();t.markAction(t.observe(sample({time:3})));t.observe(sample({endCard:true,time:10}));
 t.markAction(t.observe(sample({endCard:false,time:10,loaded:true})));t.observe(sample({isAd:false}));assert.equal(t.takeCompleted().length,1);
});
test('manual ad completion without extension action is not counted',()=>{
 const t=tracker();t.observe(sample());t.observe(sample({isAd:false}));assert.equal(t.takeCompleted().length,0);
});
test('navigation does not count an interrupted ad as skipped',()=>{
 const t=tracker();t.markAction(t.observe(sample()));t.observe(sample({page:'watch?v=other',isAd:false}));assert.equal(t.takeCompleted().length,0);
});
test('same media element with a new source is a new ad',()=>{
 const t=tracker();t.markAction(t.observe(sample()));t.markAction(t.observe(sample({src:'ad-two'})));t.observe(sample({isAd:false}));assert.equal(t.takeCompleted().length,2);
});
test('seek-in-progress rollback does not create a false ad',()=>{
 const t=tracker();t.markAction(t.observe(sample({time:30,seeking:true})));t.observe(sample({time:2,seeking:false}));t.observe(sample({isAd:false}));assert.equal(t.takeCompleted().length,1);
});
async function workerChecks(){
 let stored={};let installed;
 const worker=vm.createContext({URL,Date,Set,console,findYouTubeSkip:()=>null,importScripts:()=>{},
 chrome:{action:{setIcon:async()=>{},setBadgeText:async()=>{},setTitle:async()=>{}},tabs:{},storage:{onChanged:{addListener:()=>{}},local:{get:async()=>{await new Promise(r=>setTimeout(r,1));return structuredClone(stored);},set:async v=>{await new Promise(r=>setTimeout(r,1));Object.assign(stored,structuredClone(v));}}},
 runtime:{onInstalled:{addListener:fn=>{installed=fn;}},onMessage:{addListener:()=>{}}}}});
 vm.runInContext(statsSource,worker);vm.runInContext(fs.readFileSync(root+'settings.js','utf8'),worker);vm.runInContext(fs.readFileSync(root+'background.js','utf8'),worker);
 installed();await vm.runInContext('statsWrites',worker);assert.equal(stored.skipStats.version,1);
 await Promise.all(Array.from({length:40},(_,i)=>vm.runInContext(`recordAd('concurrent-${String(i).padStart(4,'0')}')`,worker)));
 assert.equal(Object.values(stored.skipStats.days).reduce((a,b)=>a+b,0),40);
 await vm.runInContext("recordAd('concurrent-0001')",worker);assert.equal(Object.values(stored.skipStats.days).reduce((a,b)=>a+b,0),40);
 installed();await vm.runInContext('statsWrites',worker);assert.equal(Object.values(stored.skipStats.days).reduce((a,b)=>a+b,0),40);
 const earlier=local(2026,1,1,23);
 await vm.runInContext(`recordAd('delayed-midnight-event',${earlier.getTime()})`,worker);
 assert.equal(stored.skipStats.days['2026-01-01'],1);
 checks+=4;console.log('PASS serialized multi-tab writes, duplicate retry, update persistence and delayed-write date attribution');
}
async function contentChecks(){
 let poll,now=10000,index=0;const stages=['ad-one','card-one','ad-two','card-two','main'];const actions=[],events=[];
 const c=vm.createContext({Date:{now:()=>now},crypto:require('node:crypto').webcrypto,console,document:{visibilityState:'visible'},
 findYouTubeSkip:()=>stages[index]?.startsWith('card')?{x:1,y:1}:null,
 readYouTubeAdState:()=>({page:'watch?v=test',isAd:stages[index]!=='main',endCard:stages[index]?.startsWith('card'),src:index<2?'src-one':'src-two',pod:index<2?'1 of 2':'2 of 2',time:0,loaded:stages[index]?.startsWith('ad'),seeking:false}),
 finishYouTubeAd:()=>{if(!stages[index]?.startsWith('ad'))return false;actions.push('seek:'+stages[index++]);return true;},
 chrome:{storage:{local:{get:async()=>({})},onChanged:{addListener:()=>{}}},runtime:{sendMessage:async message=>{
 if(message.type==='youtube-ad-completed'){events.push(message.id);return{saved:true};}
 actions.push('click:'+stages[index++]);return{clicked:true};}}},setInterval:(fn,ms)=>{assert.equal(ms,1000);poll=fn;}});
 vm.runInContext(trackerSource,c);vm.runInContext(fs.readFileSync(root+'settings.js','utf8'),c);vm.runInContext(fs.readFileSync(root+'content.js','utf8'),c);
 await new Promise(r=>setImmediate(r));for(let i=0;i<6;i++){now+=1000;await poll();}
 assert.deepEqual(actions,['seek:ad-one','click:card-one','seek:ad-two','click:card-two']);assert.equal(events.length,2);assert.equal(new Set(events).size,2);
 checks++;console.log('PASS full content loop: four actions, two confirmed ad counts, one-second polling');
}
(async()=>{await workerChecks();await contentChecks();console.log(`${checks} statistics and tracking scenarios passed in timezone ${Intl.DateTimeFormat().resolvedOptions().timeZone}.`);})().catch(e=>{console.error(e);process.exitCode=1;});
