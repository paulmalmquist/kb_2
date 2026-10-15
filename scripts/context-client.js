/** Trusted integration helper. The caller supplies a credential obtained outside model control. */
export async function prepareContext({origin,token,prompt,appId,scope='auto',budget=4000}) {
  const url=new URL('/api/context/resolve',origin);
  if(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))throw new Error('Context must use HTTPS outside loopback');
  const response=await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({prompt,appId,scope,budget}),signal:AbortSignal.timeout(10000),redirect:'error'});
  if(!response.ok)throw new Error(`Context service returned HTTP ${response.status}; do not continue without the required context.`);
  const packet=await response.json();
  if(packet.status!=='ready'){const error=new Error(`Context requires resolution: ${packet.status}`);error.packet=packet;throw error;}
  return packet;
}
