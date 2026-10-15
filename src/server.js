import http from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { createHash, timingSafeEqual } from 'node:crypto';
import { Store } from './store.js';
import { seed, catalog } from './seed.js';
import { Engine, Problem, demand } from './engine.js';
import { discover } from './connectors.js';
import { rpc } from './mcp.js';

const root=dirname(dirname(fileURLToPath(import.meta.url)));
export function createApplication({dbPath=join(root,'data','context.sqlite'),demo=true,tokenHashes={},identityFile=null,origin=null}={}){
  if(origin)origin=new URL(origin).origin;
  const store=new Store(dbPath);
  if(demo)seed(store);
  else if(!store.all('users').length){
    demand(identityFile,500,'Authenticated mode requires CONTEXT_IDENTITY_FILE to initialize identities');
    const identity=JSON.parse(readFileSync(identityFile,'utf8'));
    demand(Array.isArray(identity.users)&&Array.isArray(identity.units)&&identity.units.some(x=>x.kind==='organization'),500,'Invalid identity configuration');
    const ids=new Set(identity.units.map(x=>x.id)),users=new Set(identity.users.map(x=>x.id));
    demand(ids.size===identity.units.length&&users.size===identity.users.length&&identity.users.every(x=>ids.has(x.unitId))&&identity.units.every(x=>users.has(x.managerId)&&(!x.parentId||ids.has(x.parentId))),500,'Identity references must be unique and resolvable');
    for(const unit of identity.units){const visited=new Set();let cursor=unit;while(cursor){demand(!visited.has(cursor.id),500,'Org hierarchy must not contain cycles');visited.add(cursor.id);cursor=identity.units.find(x=>x.id===cursor.parentId);}}
    store.tx(()=>{identity.units.forEach(x=>store.put('units',x));identity.users.forEach(x=>store.put('users',x));catalog.forEach(c=>store.put('connectors',{id:c.id,baseUrl:'',status:'not_configured'}));});
  }
  const engine=new Engine(store,{demo});
  const authenticate=req=>{
    if(demo){const user=String(req.headers['x-demo-user']||'paul');engine.user(user);return user;}
    const raw=(req.headers.authorization||'').match(/^Bearer (.+)$/)?.[1];demand(raw,401,'A per-user bearer credential is required');
    const hash=createHash('sha256').update(raw).digest('hex');
    const entry=Object.entries(tokenHashes).find(([known])=>known.length===hash.length&&timingSafeEqual(Buffer.from(known),Buffer.from(hash)));
    demand(entry,401,'Invalid bearer credential');engine.user(entry[1]);return entry[1];
  };
  const send=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(data===null?'':JSON.stringify(data));};
  const body=async req=>{let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;demand(size<=1_000_000,413,'Request body too large');chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString('utf8')||'{}');}catch{throw new Problem(400,'Invalid JSON');}};
  const server=http.createServer(async(req,res)=>{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    try{
      const host=req.headers.host||'', expected=origin||`http://${host}`;
      if(demo)demand(/^(127\.0\.0\.1|localhost|\[::1\])(:\d+)?$/.test(host),403,'Local demo accepts only localhost hosts');
      if(!demo&&origin)demand(host===new URL(origin).host,403,'Unexpected host');
      demand(!req.headers.origin||req.headers.origin===expected,403,'Cross-origin request rejected');
      const path=new URL(req.url,expected).pathname,method=req.method;
      if(path==='/health'&&method==='GET')return send(res,200,{ok:true,mode:demo?'demo':'authenticated'});
      if(path==='/api/mode'&&method==='GET')return send(res,200,{demo});
      if(path==='/mcp'||path.startsWith('/api/')){
        const userId=authenticate(req);
        if(path==='/mcp'){
          if(method!=='POST'){res.setHeader('Allow','POST');return send(res,405,{error:'This stateless MCP server accepts POST; no SSE stream is offered.'});}
          const input=await body(req);const result=rpc(engine,userId,input);return send(res,result===null?202:200,result);
        }
        if(method==='GET'&&path==='/api/bootstrap')return send(res,200,engine.bootstrap(userId));
        if(method==='GET'&&path==='/api/events')return send(res,200,engine.bootstrap(userId).events);
        if(method==='GET'&&path==='/api/bifrost-config')return send(res,200,{mcp:{client_configs:[{name:'dreamcatcher_context',connection_type:'http',connection_string:`${demo?expected:origin}/mcp`,auth_type:demo?'headers':'per_user_headers',...(demo?{headers:{'X-Demo-User':userId}}:{per_user_header_keys:['Authorization']}),tools_to_execute:['resolve_context','search_knowledge','list_apps','get_knowledge']}]}});
        if(method==='GET'&&path.startsWith('/api/knowledge/'))return send(res,200,engine.asset(userId,decodeURIComponent(path.split('/').at(-1))));
        demand(['POST','PUT','DELETE'].includes(method),404,'Endpoint not found');
        const input=await body(req);demand(input&&typeof input==='object'&&!Array.isArray(input),400,'Request body must be a JSON object');let out;const segments=path.split('/').filter(Boolean);
        if(method==='POST'&&path==='/api/knowledge')out=engine.create(userId,input);
        else if(method==='PUT'&&segments[1]==='knowledge'&&segments.length===3)out=engine.update(userId,segments[2],input);
        else if(method==='POST'&&segments[1]==='knowledge'&&segments[3]==='retire')out=engine.retire(userId,segments[2]);
        else if(method==='POST'&&path==='/api/promotions')out=engine.propose(userId,input);
        else if(method==='POST'&&segments[1]==='promotions'&&segments[3]==='review')out=engine.review(userId,segments[2],input);
        else if(method==='POST'&&segments[1]==='promotions'&&segments[3]==='withdraw')out=engine.withdraw(userId,segments[2]);
        else if(method==='POST'&&path==='/api/context/resolve')out=engine.resolve(userId,input);
        else if(method==='POST'&&path==='/api/delegations')out=engine.delegate(userId,input);
        else if(method==='POST'&&segments[1]==='delegations'&&segments[3]==='revoke')out=engine.revokeDelegate(userId,segments[2]);
        else if(method==='POST'&&path==='/api/tethers')out=engine.tether(userId,input);
        else if(method==='POST'&&segments[1]==='tethers'&&segments.length===3)out=engine.decideTether(userId,segments[2],input);
        else if(method==='PUT'&&segments[1]==='connectors'&&segments.length===3)out=engine.saveConnector(userId,segments[2],input);
        else if(method==='POST'&&segments[1]==='connectors'&&segments[3]==='discover')out=await discover(engine,userId,segments[2]);
        else if(method==='POST'&&segments[1]==='connectors'&&segments[3]==='import')out=engine.importRecords(userId,segments[2],input);
        else throw new Problem(404,'Endpoint not found');
        return send(res,200,out);
      }
      const files={'/':['index.html','text/html'],'/app.js':['app.js','text/javascript'],'/style.css':['style.css','text/css'],'/favicon.svg':['favicon.svg','image/svg+xml']};
      demand(method==='GET'&&files[path],404,'Page not found');const [file,type]=files[path];res.writeHead(200,{'Content-Type':`${type}; charset=utf-8`,'Cache-Control':'no-cache'});res.end(readFileSync(join(root,'public',file)));
    }catch(error){if(!(error instanceof Problem))console.error('Request failed:',error.message);if(!res.headersSent)send(res,error.status||500,{error:error instanceof Problem?error.message:'Unexpected server error'});else res.end();}
  });
  server.requestTimeout=15000;server.headersTimeout=10000;
  return {server,engine,store};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const demo=process.env.CONTEXT_MODE!=='authenticated';
  const host=process.env.HOST||'127.0.0.1',port=Number(process.env.PORT||8788);
  if(demo&&!['127.0.0.1','localhost','::1'].includes(host))throw new Error('Demo must bind to loopback. Use authenticated mode for shared deployments.');
  const hashes=JSON.parse(process.env.CONTEXT_TOKEN_HASHES||'{}');
  if(!demo&&!Object.keys(hashes).length)throw new Error('Authenticated mode requires CONTEXT_TOKEN_HASHES');
  if(!demo&&!process.env.CONTEXT_PUBLIC_ORIGIN)throw new Error('Authenticated mode requires CONTEXT_PUBLIC_ORIGIN');
  const dbPath=process.env.CONTEXT_DB||join(root,'data',demo?'demo.sqlite':'context.sqlite');
  const app=createApplication({dbPath,demo,tokenHashes:hashes,identityFile:process.env.CONTEXT_IDENTITY_FILE,origin:process.env.CONTEXT_PUBLIC_ORIGIN});
  app.server.listen(port,host,()=>console.log(`Dreamcatcher Context · ${demo?'synthetic demo':'authenticated'}\nLocal: http://${host}:${port}`));
  for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>app.server.close(()=>{app.store.close();process.exit(0);}));
}
