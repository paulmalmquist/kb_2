// Usage: node scale.mjs <root> <assets> <events>
import { join } from 'node:path';
import { mkdtempSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
const [root,nA,nE]=[process.argv[2],Number(process.argv[3]),Number(process.argv[4])];
const { Store } = await import(join(root,'src/store.js'));
const { seed } = await import(join(root,'src/seed.js'));
const { Engine } = await import(join(root,'src/engine.js'));
const dir=mkdtempSync(join(tmpdir(),'scale-')),file=join(dir,'s.sqlite');
const s=new Store(file);seed(s);const e=new Engine(s);
const users=['paul','sam','avery','riley','drew'];
const now=new Date().toISOString();
s.tx(()=>{for(let i=0;i<nA;i++){const owner=users[i%users.length];const team=i%7===0;s.put('assets',{id:`bulk-${i}`,title:`Bulk note ${i} about topic${i%50}`,kind:'knowledge',ownerId:owner,scopeId:team?'data':owner,authority:'reference',tags:[`topic${i%50}`],content:`Body ${i} discussing topic${i%50} and reconciliation details `.repeat(5),status:team?'certified':'private',version:1,certifiedVersion:team?1:null,expiresAt:team?new Date(Date.now()+9e9).toISOString():null,createdAt:now,updatedAt:now,source:null,tetherable:false,ruleKey:'',ruleValue:'',dependencies:[],launchUrl:''});}
for(let i=0;i<nE;i++)s.append('events',{id:`ev-bulk-${i}`,at:now,actorId:users[i%5],type:'context.resolved',scopeId:users[i%5],detail:'personal focus; 1 items; ready'});});
const time=(label,fn,n=5)=>{fn();const t0=performance.now();let out;for(let i=0;i<n;i++)out=fn();const ms=(performance.now()-t0)/n;console.log(`${label}: ${ms.toFixed(1)} ms`);return out;};
time('bootstrap(paul)',()=>e.bootstrap('paul'),3);
const p=time('resolve(paul,"reconciliation evidence")',()=>e.resolve('paul',{prompt:'reconciliation evidence'}),3);
console.log(`packet JSON chars=${JSON.stringify(p).length} estimatedTokens=${p.estimatedTokens} elapsedMs(self-reported)=${p.elapsedMs} skipped=${p.skipped.length}`);
s.close();console.log(`db bytes=${statSync(file).size}`);rmSync(dir,{recursive:true,force:true});
