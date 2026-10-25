const fs=require('node:fs');const vm=require('node:vm');const assert=require('node:assert/strict');
const root=require('node:path').resolve(__dirname,'..') + require('node:path').sep;
async function run(options={}){
 let phase=0,now=10000,poll,clicks=0;const actions=[],events=[];
 const stages=['ad-one','card-one','ad-two','card-two','main'];
 const skip=()=>phase<4?{x:1,y:1}:null;
 const context=vm.createContext({Date:{now:()=>now},crypto:require('node:crypto').webcrypto,console:{warn:()=>{}},document:{visibilityState:'visible'},
 findYouTubeSkip:skip,
 readYouTubeAdState:()=>({page:'watch?v=test',isAd:phase<4,endCard:phase%2===1&&phase<4,src:phase<2?'ad-one':'ad-two',pod:phase<2?'1 of 2':'2 of 2',time:0,loaded:phase%2===0&&phase<4,seeking:false}),
 finishYouTubeAd:()=>{
  if(phase>=4||phase%2===1)return false;
  if(options.unseekableSecond&&phase===2)return false;
  if(options.errorFirstClick&&phase===0&&clicks===0)return false;
  if(options.ignoreFirstClick&&phase===0&&clicks===0)return false;
  actions.push('seek:'+stages[phase]);phase++;return true;
 },
 chrome:{runtime:{sendMessage:async message=>{
  if(message.type==='youtube-ad-completed'){events.push(message.id);return{saved:true};}
  clicks++;actions.push('click:'+stages[phase]);
  if(options.errorFirstClick&&clicks===1)return{error:'Debugger unavailable'};
  if(options.ignoreFirstClick&&clicks===1)return{clicked:true};
  if(phase===2&&options.unseekableSecond)phase=4;else phase++;
  return{clicked:true};
 }}},setInterval:(fn,ms)=>{assert.equal(ms,1000);poll=fn;}});
 vm.runInContext(fs.readFileSync(root+'tracker.js','utf8'),context);
 vm.runInContext(fs.readFileSync(root+'content.js','utf8'),context);
 await new Promise(r=>setImmediate(r));
 for(let i=0;i<10&&phase<4;i++){now+=1000;await poll();}
 now+=1000;await poll();
 return{actions,events,phase};
}
(async()=>{
 let r=await run();assert.deepEqual(r.actions,['seek:ad-one','click:card-one','seek:ad-two','click:card-two']);assert.equal(r.events.length,2);assert.equal(r.phase,4);
 console.log('PASS visible Skip does not block seeking either ad; current end-card button clicked');
 r=await run({unseekableSecond:true});assert.deepEqual(r.actions,['seek:ad-one','click:card-one','click:ad-two']);assert.equal(r.events.length,2);
 console.log('PASS unseekable second ad still gets a native Skip click');
 r=await run({ignoreFirstClick:true});assert.deepEqual(r.actions.slice(0,3),['click:ad-one','seek:ad-one','click:card-one']);assert.equal(r.phase,4);assert.equal(r.events.length,2);
 console.log('PASS ignored click does not trap the loop in click-only mode');
 r=await run({errorFirstClick:true});assert.equal(r.actions[0],'click:ad-one');assert.equal(r.actions[1],'seek:ad-one');assert.equal(r.phase,4);assert.equal(r.events.length,2);
 console.log('PASS debugger error cooldown does not block seeking the next second');
})().catch(e=>{console.error(e);process.exitCode=1;});
