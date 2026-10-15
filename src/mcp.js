import { Problem } from './engine.js';

const tools=[
  {name:'resolve_context',description:'Resolve authorized personal, team, department and organization context for a request. Call before answering work questions. Unqualified latest Jira tickets means the caller’s own issues. Returns evidence, mandatory constraints, conflicts and a scoped tool plan; does not execute upstream Jira queries.',inputSchema:{type:'object',properties:{prompt:{type:'string'},scope:{type:'string',enum:['auto','personal','team','department','organization']},appId:{type:'string'},budget:{type:'integer',minimum:500,maximum:16000}},required:['prompt'],additionalProperties:false}},
  {name:'search_knowledge',description:'Search knowledge the authenticated caller is allowed to access. Does not expose private items owned by other people.',inputSchema:{type:'object',properties:{query:{type:'string'}},required:['query'],additionalProperties:false}},
  {name:'list_apps',description:'List Dreamcatcher apps available to the authenticated caller with audience and certification state.',inputSchema:{type:'object',properties:{},additionalProperties:false}},
  {name:'get_knowledge',description:'Read a specific authorized knowledge item, including source revision and certification status.',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false}},
];

export function rpc(engine,userId,message){
  const failure=(code,msg)=>({jsonrpc:'2.0',id:message?.id??null,error:{code,message:msg}});
  if(!message||typeof message!=='object'||Array.isArray(message)||message.jsonrpc!=='2.0'||typeof message.method!=='string')return failure(-32600,'Invalid Request');
  if(message.id===undefined)return null;
  let result;
  if(message.method==='initialize'){
    const supported=['2025-03-26','2025-06-18','2025-11-25'];
    result={protocolVersion:supported.includes(message.params?.protocolVersion)?message.params.protocolVersion:'2025-03-26',capabilities:{tools:{listChanged:false}},serverInfo:{name:'dreamcatcher-context',version:'1.0.0'},instructions:'Use resolve_context before work questions. Context selection is task-aware. Never widen source permissions or ignore an unresolved standard conflict. Promotion and approval are human UI actions.'};
  }else if(message.method==='ping')result={};
  else if(message.method==='tools/list')result={tools};
  else if(message.method==='tools/call'){
    const name=message.params?.name,spec=tools.find(t=>t.name===name),a=message.params?.arguments||{};
    if(!spec)return failure(-32602,'Unknown tool');
    if(typeof a!=='object'||Array.isArray(a)||Object.keys(a).some(k=>!Object.hasOwn(spec.inputSchema.properties,k))||(spec.inputSchema.required||[]).some(k=>typeof a[k]!=='string'))return failure(-32602,'Invalid tool arguments');
    try{
      let output;
      if(name==='resolve_context')output=engine.resolve(userId,a);
      if(name==='get_knowledge')output=engine.asset(userId,a.id);
      if(name==='list_apps')output=engine.listAssets(userId).filter(x=>x.kind==='app');
      if(name==='search_knowledge')output=engine.listAssets(userId).filter(x=>`${x.title} ${x.content} ${x.tags.join(' ')}`.toLowerCase().includes(a.query.toLowerCase())).slice(0,30);
      result={content:[{type:'text',text:JSON.stringify(output)}],isError:false};
    }catch(error){result={content:[{type:'text',text:error instanceof Problem?error.message:'Tool failed'}],isError:true};}
  }else return failure(-32601,'Method not found');
  return {jsonrpc:'2.0',id:message.id,result};
}
