const {spawnSync}=require('node:child_process');
const path=require('node:path');
const scripts=['check-native.cjs','check-ad-loop.cjs','test-dual-loop.cjs','test-statistics.cjs','test-settings.cjs'];
for(const name of scripts){
 const result=spawnSync(process.execPath,[path.join(__dirname,name)],{stdio:'inherit'});
 if(result.error){console.error(result.error.message);process.exit(1);}
 if(result.status!==0)process.exit(result.status||1);
}
