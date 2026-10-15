export const catalog = [
  { id:'jira', name:'Jira', mark:'J', color:'#6b9dff', category:'Work & delivery', description:'Issues, ownership, project scope, and current work.', route:'Jira Cloud REST v3', capability:'live_inventory', endpoint:'/rest/api/3/search/jql', needs:['Instance URL','Per-user API credential','Project and assignee mapping'], note:'Latest tickets defaults to the authenticated person. Inventory reads up to 25 issues; it does not auto-publish knowledge.', docs:'https://developer.atlassian.com/cloud/jira/platform/rest/v3/api-group-issue-search/' },
  { id:'confluence', name:'Confluence', mark:'C', color:'#8eafff', category:'Knowledge & QMS', description:'General knowledge and controlled procedures, with distinct authority.', route:'Confluence Cloud REST v2', capability:'live_inventory', endpoint:'/wiki/api/v2/pages', needs:['Instance URL','Per-user API credential','QMS approval and effective-revision mapping'], note:'A page is evidence, not automatically an approved standard. QMS lifecycle mapping requires your workflow configuration.', docs:'https://developer.atlassian.com/cloud/confluence/rest/v2/api-group-page/' },
  { id:'gitlab', name:'GitLab', mark:'G', color:'#f7a16b', category:'Code & skills', description:'Repositories, versioned instructions, and reusable skills.', route:'GitLab REST v4', capability:'live_inventory', endpoint:'/api/v4/projects', needs:['Instance URL','Per-user read credential','Approved repository paths'], note:'Discovery lists accessible project metadata. Code is never executed or implicitly certified.', docs:'https://docs.gitlab.com/api/projects/' },
  { id:'manufacturo', name:'Manufacturo', mark:'M', color:'#74d9bc', category:'Manufacturing', description:'Manufacturing records and operational business context.', route:'Approved export or warehouse feed', capability:'file_import', needs:['Integration owner','Supported export/API contract','Work order, lot, and revision keys'], note:'Import normalized JSON exports now. Direct API discovery requires your tenant-specific contract; no endpoint is assumed.' },
  { id:'nx', name:'Siemens NX', mark:'NX', color:'#8bdbde', category:'Design & engineering', description:'Design context, part references, and revision metadata.', route:'Published metadata / PLM export', capability:'file_import', needs:['NX/PLM owner','Teamcenter presence, if any','Released design and effectivity metadata'], note:'Import approved metadata exports. Native CAD interpretation and a live NX/PLM adapter are outside this build.' },
  { id:'bigquery', name:'BigQuery', mark:'BQ', color:'#b3a5ff', category:'Certified data', description:'Data product definitions, approved metrics, and lineage references.', route:'OpenMetadata / warehouse export', capability:'file_import', needs:['Approved project and dataset inventory','Service identity design','Row/column access rules'], note:'Import certified metadata exports. This service does not grant access to warehouse rows or execute SQL.' },
];

export function seed(store) {
  if (store.all('users').length) return;
  const units = [
    {id:'org',name:'Relativity Space',kind:'organization',parentId:null,managerId:'alex'},
    {id:'software',name:'Terrestrial Software',kind:'department',parentId:'org',managerId:'morgan'},
    {id:'finance',name:'Finance',kind:'department',parentId:'org',managerId:'jordan'},
    {id:'operations',name:'Operations',kind:'department',parentId:'org',managerId:'casey'},
    {id:'data',name:'#DATA',kind:'team',parentId:'software',managerId:'sam'},
    {id:'accounting',name:'Accounting',kind:'team',parentId:'finance',managerId:'riley'},
    {id:'manufacturing',name:'Manufacturing',kind:'team',parentId:'operations',managerId:'drew'},
  ];
  const users = [
    {id:'paul',name:'Paul Malmquist',title:'Principal Data Architect',unitId:'data'},
    {id:'sam',name:'Sam Chen',title:'Data Team Manager',unitId:'data'},
    {id:'avery',name:'Avery Reed',title:'Data Governance Delegate',unitId:'data'},
    {id:'morgan',name:'Morgan Lee',title:'Software Department Manager',unitId:'software'},
    {id:'riley',name:'Riley Brooks',title:'Accounting Team Manager',unitId:'accounting'},
    {id:'jordan',name:'Jordan Ellis',title:'Finance Department Manager',unitId:'finance'},
    {id:'drew',name:'Drew Parker',title:'Manufacturing Team Manager',unitId:'manufacturing'},
    {id:'casey',name:'Casey Rivera',title:'Operations Department Manager',unitId:'operations'},
    {id:'alex',name:'Alex Taylor',title:'Organization Standards Owner',unitId:'org'},
  ];
  const now = new Date().toISOString();
  const future = new Date(Date.now()+180*864e5).toISOString();
  const base = {version:1,createdAt:now,updatedAt:now,source:null,tetherable:false,ruleKey:'',ruleValue:'',supersedesId:null,originId:null,expiresAt:null,launchUrl:'',dependencies:[]};
  const a = (id,title,kind,ownerId,scopeId,authority,tags,content,extra={}) => ({...base,id,title,kind,ownerId,scopeId,authority,tags,content,status:scopeId===ownerId?'private':'certified',certifiedVersion:scopeId===ownerId?null:1,certifiedAt:scopeId===ownerId?null:now,approvedBy:scopeId===ownerId?null:'seed',...(scopeId===ownerId?{}:{expiresAt:future}),...extra});
  const assets = [
    a('my-jira','My work comes first','knowledge','paul','paul','reference',['jira','tickets','work'],'When I ask for the latest Jira tickets without a qualifier, show issues assigned to me, ordered by most recently updated. If I name a team or department, use that explicit scope.'),
    a('recon-draft','Reconciliation evidence checklist','skill','paul','paul','guidance',['reconciliation','audit','finance'],'Compare source and target totals at the same grain.\nRecord exceptions and the query version.\nSave reconciliation evidence for 30 days.\nAsk a reviewer to validate unexplained variances.',{ruleKey:'reconciliation.evidence_days',ruleValue:'30'}),
    a('data-standard','Certified reconciliation practice','standard','sam','data','mandatory',['reconciliation','audit','finance'],'Compare source and target at an explicitly declared grain.\nRecord query version, source timestamps, and every exception.\nRetain reconciliation evidence for 90 days.\nA second reviewer must sign off before publishing results.',{tetherable:true,ruleKey:'reconciliation.evidence_days',ruleValue:'90'}),
    a('data-guidance','Modeling and metric conventions','skill','sam','data','guidance',['dbt','kimball','metric','data'],'Declare grain before joins. Use conformed dimensions and certified mart models. Resolve metric definitions through the catalog and include lineage in the result.',{tetherable:true}),
    a('software-standard','Review evidence for shared skills','standard','morgan','software','mandatory',['skill','code','deployment'],'Shared executable skills require a named owner, reproducible test evidence, scoped tool permissions, and a rollback plan. Certification of instructions does not authorize code execution.'),
    a('hr-standard','Respectful workplace guidance','standard','alex','org','mandatory',['hr','conduct','behavior','workplace'],'Use respectful, factual language. Handle personnel concerns through the designated HR process. Do not include private employee information in a broadly shared knowledge package.'),
    a('qms-sample','Controlled procedure references','standard','alex','org','mandatory',['qms','quality','manufacturing','procedure'],'Confirm that a procedure is approved, effective, and applicable to the relevant work order and design revision. If conflicting instructions cannot be resolved, identify the conflict for the procedure owner.',{source:{connectorId:'confluence',externalId:'SAMPLE-QMS',revision:'demo-1',uri:'',syncedAt:now}}),
    a('finance-standard','Audit reconciliation review','standard','jordan','finance','mandatory',['audit','reconciliation','finance'],'Reconciliations must identify the accounting period, ledger, source totals, exceptions, and an independent reviewer. Evidence must be retained according to the applicable finance retention schedule.',{tetherable:true}),
    a('mfg-note','Manufacturing exception vocabulary','knowledge','drew','manufacturing','guidance',['manufacturing','quality','exceptions'],'Use work order, operation, material lot, part number, design revision, and disposition as shared context keys.',{tetherable:true}),
    a('private-app','My Workbench','app','paul','paul','reference',['jira','tickets','work'],'A personal view of assigned work and the knowledge needed to move it forward.',{dependencies:['my-jira']}),
    a('recon-app','Reconciliation Studio','app','sam','data','guidance',['reconciliation','audit'],'Compare totals, investigate exceptions, and prepare review evidence.',{dependencies:['data-standard'],tetherable:true}),
    a('qms-app','Procedure Navigator','app','alex','org','guidance',['qms','quality','procedure'],'Locate applicable procedures and inspect their approval and revision context.',{dependencies:['qms-sample']}),
  ];
  store.tx(()=>{
    units.forEach(v=>store.put('units',v)); users.forEach(v=>store.put('users',v));
    assets.forEach(v=>{store.put('assets',v);store.append('revisions',{id:`${v.id}:1`,assetId:v.id,version:1,snapshot:v});});
    catalog.forEach(c=>store.put('connectors',{id:c.id,baseUrl:'',email:'',status:'not_configured',updatedAt:now}));
    store.put('delegations',{id:'delegate-demo',unitId:'data',userId:'avery',grantedBy:'sam',expiresAt:future,status:'active'});
    store.put('tethers',{id:'tether-demo',fromId:'finance',toId:'data',tags:['reconciliation','audit'],status:'active',createdBy:'jordan',acceptedBy:'sam',createdAt:now});
    store.put('proposals',{id:'proposal-demo',assetId:'recon-draft',sourceVersion:1,targetId:'data',submittedBy:'paul',status:'pending',submittedAt:now,baselineId:null,baselineVersion:null,before:assets.find(a=>a.id==='recon-draft'),proposed:{...assets.find(a=>a.id==='recon-draft'),title:'Shared reconciliation evidence checklist',content:'Compare source and target totals at the same declared grain.\nRecord exceptions, query version, and source timestamps.\nRetain reconciliation evidence for 90 days.\nRequire a second reviewer before publishing results.',authority:'guidance',tetherable:true,ruleKey:'reconciliation.evidence_days',ruleValue:'90'},rationale:'Make a repeatable evidence checklist available to the whole #DATA team.',evidence:'Synthetic example: two reconciliations reviewed; reviewer feedback incorporated.',publishConsent:true,history:[],revision:1});
    store.append('events',{id:'seed',at:now,actorId:'system',type:'workspace.seeded',scopeId:'org',detail:'Synthetic workspace initialized. Names, policies, and records are illustrative.'});
  });
}
