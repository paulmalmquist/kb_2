import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { createHash } from 'node:crypto';
import { createApplication } from '../src/server.js';
import { Store } from '../src/store.js';
import { seed } from '../src/seed.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Exercise the actual HTTP request handler without opening a network socket.
function request(app,path,{method='GET',headers={},body}={}){return new Promise((resolve,reject)=>{
  const req=Readable.from(body===undefined?[]:[Buffer.from(typeof body==='string'?body:JSON.stringify(body))]);req.method=method;req.url=path;req.headers={host:'127.0.0.1:8788',...headers};
  const res={headers:{},headersSent:false,status:200,setHeader(k,v){this.headers[k]=v;},writeHead(status,h){this.status=status;Object.assign(this.headers,h);this.headersSent=true;},end(text){let data;try{data=JSON.parse(text||'null');}catch{data=text?.toString();}resolve({status:this.status,headers:this.headers,data});}};
  try{app.server.emit('request',req,res);}catch(e){reject(e);}
});}
function setup(t){const app=createApplication({dbPath:':memory:'});t.after(()=>app.store.close());return app;}
test('HTTP serves the real UI and scoped bootstrap',async t=>{const app=setup(t);const ui=await request(app,'/');assert.equal(ui.status,200);assert.ok(ui.data.includes('Dreamcatcher'));const boot=await request(app,'/api/bootstrap');assert.equal(boot.data.user.id,'paul');assert.ok(boot.headers['Content-Security-Policy'].includes("script-src 'self'"));});
test('HTTP rejects a hostile Origin and demo DNS rebinding host',async t=>{const app=setup(t);assert.equal((await request(app,'/api/bootstrap',{headers:{origin:'https://evil.example'}})).status,403);assert.equal((await request(app,'/api/bootstrap',{headers:{host:'evil.example'}})).status,403);});
test('HTTP creates private knowledge and completes review as a different identity',async t=>{const app=setup(t);const create=await request(app,'/api/knowledge',{method:'POST',body:{title:'HTTP workflow',kind:'knowledge',content:'Review the evidence.',tags:['audit']}});assert.equal(create.status,200);const a=create.data;const p=await request(app,'/api/promotions',{method:'POST',body:{assetId:a.id,version:1,targetId:'data',rationale:'Useful to all data engineers.',evidence:'Representative example reviewed.',publishConsent:true}});assert.equal(p.status,200);const deny=await request(app,`/api/promotions/${p.data.id}/review`,{method:'POST',body:{revision:1,decision:'approve',comment:'Own submission'}});assert.equal(deny.status,403);const approve=await request(app,`/api/promotions/${p.data.id}/review`,{method:'POST',headers:{'x-demo-user':'sam'},body:{revision:1,decision:'approve',comment:'Reviewed and approved.'}});assert.equal(approve.status,200);assert.equal(approve.data.asset.status,'certified');});
test('HTTP MCP handles initialize, tool invocation, notifications and unsupported streaming',async t=>{const app=setup(t);const init=await request(app,'/mcp',{method:'POST',body:{jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26'}}});assert.equal(init.data.result.protocolVersion,'2025-03-26');const r=await request(app,'/mcp',{method:'POST',body:{jsonrpc:'2.0',id:2,method:'tools/call',params:{name:'resolve_context',arguments:{prompt:'Latest Jira tickets'}}}});assert.equal(JSON.parse(r.data.result.content[0].text).focus.scope,'personal');assert.equal((await request(app,'/mcp',{method:'POST',body:{jsonrpc:'2.0',method:'notifications/initialized'}})).status,202);assert.equal((await request(app,'/mcp')).status,405);});
test('HTTP validates malformed and oversized bodies and unavailable endpoints',async t=>{const app=setup(t);assert.equal((await request(app,'/api/knowledge',{method:'POST',body:'{'})).status,400);assert.equal((await request(app,'/api/knowledge',{method:'POST',body:'x'.repeat(1_000_001)})).status,413);assert.equal((await request(app,'/api/nope')).status,404);assert.equal((await request(app,'/api/knowledge/my-jira',{headers:{'x-demo-user':'sam'}})).status,404);});
test('authenticated deployment uses token identity and ignores spoofed demo/body identities',async t=>{const dir=mkdtempSync(join(tmpdir(),'dc-auth-')),file=join(dir,'test.sqlite'),s=new Store(file);seed(s);s.close();const key='test-only-random-token',hash=createHash('sha256').update(key).digest('hex');const app=createApplication({dbPath:file,demo:false,tokenHashes:{[hash]:'paul'},origin:'https://context.example.test'});t.after(()=>{app.store.close();rmSync(dir,{recursive:true,force:true});});const headers={host:'context.example.test',origin:'https://context.example.test',Authorization:`Bearer ${key}`};
  // Node normalizes header keys; the request adapter must do the same.
  headers.authorization=headers.Authorization;delete headers.Authorization;
  assert.equal((await request(app,'/api/bootstrap',{headers:{host:'context.example.test','x-demo-user':'alex'}})).status,401);
  const boot=await request(app,'/api/bootstrap',{headers:{...headers,'x-demo-user':'alex'}});assert.equal(boot.data.user.id,'paul');assert.equal(boot.data.mode,'authenticated');
  const out=await request(app,'/api/context/resolve',{method:'POST',headers,body:{prompt:'Latest Jira tickets',userId:'alex'}});assert.equal(out.data.principal.id,'paul');
  const config=await request(app,'/api/bifrost-config',{headers});assert.equal(config.data.mcp.client_configs[0].auth_type,'per_user_headers');
});
