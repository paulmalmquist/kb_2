import { Problem, demand } from './engine.js';
import { catalog } from './seed.js';

async function boundedJSON(response) {
  demand(response.ok,502,`Source returned HTTP ${response.status}. Check the caller's credential and source permissions.`);
  const reader=response.body.getReader();let count=0;const parts=[];
  for(;;){const {done,value}=await reader.read();if(done)break;count+=value.length;if(count>2_000_000){await reader.cancel();throw new Problem(502,'Source response exceeded the discovery limit');}parts.push(value);}
  try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw new Problem(502,'Source did not return valid JSON');}
}
const credentialSuffix=userId=>userId.replace(/[^a-z0-9]/gi,'_').toUpperCase();
export async function discover(engine,userId,connectorId,{env=process.env,fetcher=fetch}={}) {
  const spec=catalog.find(c=>c.id===connectorId);demand(spec,404,'Unknown source');
  demand(spec.capability==='live_inventory',409,'This source uses the normalized export adapter. Import its metadata JSON instead.');
  const config=engine.s.get('connectors',connectorId);demand(config?.baseUrl,409,'Configure the instance URL first');
  const base=new URL(config.baseUrl);const allowed=(env.DC_CONNECTOR_HOSTS||'').split(',').map(x=>x.trim()).filter(Boolean);
  demand(base.protocol==='https:'&&allowed.includes(base.host),403,'The instance host must be listed in DC_CONNECTOR_HOSTS by the deployment owner');
  const suffix=credentialSuffix(userId);
  // Distinct people must never share one credential slot (e.g. "pat-lee" and "pat_lee"). Fail closed instead.
  demand(!engine.s.all('users').some(u=>u.id!==userId&&credentialSuffix(u.id)===suffix),409,'This identity maps to the same credential name as another person. Ask the deployment owner to assign distinct user IDs.');
  const prefix=`DC_${connectorId.toUpperCase()}_${suffix}`;const secret=env[`${prefix}_TOKEN`];
  demand(secret,409,`The authenticated user has no ${spec.name} credential configured on this server`);
  const email=env[`${prefix}_EMAIL`];
  demand(connectorId==='gitlab'||email,409,'Atlassian discovery requires this user’s email and API token');
  const headers={Accept:'application/json',Authorization:connectorId==='gitlab'?`Bearer ${secret}`:`Basic ${Buffer.from(`${email}:${secret}`).toString('base64')}`};
  const url=new URL(base.origin+base.pathname.replace(/\/$/,'')+spec.endpoint);
  if(connectorId==='jira'){url.searchParams.set('jql','assignee = currentUser() ORDER BY updated DESC');url.searchParams.set('maxResults','25');url.searchParams.set('fields','summary,status,updated,assignee,project');}
  if(connectorId==='confluence'){url.searchParams.set('limit','25');}
  if(connectorId==='gitlab'){url.searchParams.set('membership','true');url.searchParams.set('per_page','25');url.searchParams.set('order_by','last_activity_at');}
  let data;
  try{data=await boundedJSON(await fetcher(url,{headers,redirect:'error',signal:AbortSignal.timeout(8000)}));}
  catch(error){if(error instanceof Problem)throw error;throw new Problem(502,'Source could not be reached. Check its base URL, allowlist, and credential.');}
  // Upstream payloads are untrusted: wrong shapes are a source error, not a crash or a half-read inventory.
  const rows=connectorId==='jira'?data?.issues:connectorId==='confluence'?data?.results:data;
  demand(Array.isArray(rows)&&rows.every(x=>x&&typeof x==='object'),502,`${spec.name} returned an unexpected payload shape. Nothing was recorded.`);
  const text=(v,fallback='')=>typeof v==='string'||typeof v==='number'?String(v).slice(0,500):fallback;
  let items=[];
  if(connectorId==='jira')items=rows.map(x=>({externalId:text(x.key),title:text(x.fields?.summary,text(x.key)),revision:text(x.fields?.updated),summary:text(x.fields?.status?.name,'Issue'),tags:['jira','tickets'],uri:`${base.origin}/browse/${encodeURIComponent(text(x.key))}`}));
  if(connectorId==='confluence')items=rows.map(x=>({externalId:text(x.id),title:text(x.title,'Untitled page'),revision:text(x.version?.number,'unknown'),summary:`Page metadata · ${text(x.status,'unknown lifecycle')} (publication status, not QMS approval)`,tags:['confluence'],uri:''}));
  if(connectorId==='gitlab')items=rows.map(x=>({externalId:text(x.id),title:text(x.name_with_namespace,text(x.name)),revision:text(x.last_activity_at),summary:text(x.description,'Repository metadata'),tags:['gitlab','code'],uri:text(x.web_url)}));
  demand(items.every(x=>x.externalId),502,`${spec.name} returned records without identifiers. Nothing was recorded.`);
  engine.audit(userId,'source.discovered',userId,`${spec.name}: ${items.length} accessible metadata records`);
  return {source:connectorId,items,truncated:items.length>=25,scope:'authenticated_user',observedAt:new Date().toISOString(),note:'Bounded live inventory only. No knowledge was imported or shared.'};
}
