"""Two users with disjoint private knowledge through the official MCP Python SDK over Streamable HTTP.
Usage: python3 mcp_two_users.py <mcp-url> <kim-token> <lee-token> <kim-private-id> <lee-private-id>"""
import asyncio, json, sys
from mcp import ClientSession
from mcp.client.streamable_http import streamable_http_client, create_mcp_http_client

url, kim, lee, kim_item, lee_item = sys.argv[1:6]
checks = []
def check(name, ok, detail=''):
    checks.append({'name': name, 'ok': bool(ok), 'detail': detail}); print(('PASS ' if ok else 'FAIL ') + name + (f' — {detail}' if detail else ''))

async def session(token):
    client = create_mcp_http_client(headers={'Authorization': f'Bearer {token}'} if token else {})
    return client, streamable_http_client(url, http_client=client)

async def run(token, fn):
    client, transport = await session(token)
    async with client:
        async with transport as streams:
            read, write = streams[0], streams[1]
            async with ClientSession(read, write) as s:
                init = await s.initialize()
                return await fn(s, init)

def text(result):
    return result.content[0].text if result.content else ''

async def main():
    async def kim_flow(s, init):
        check('SDK initialize negotiates a protocol version the server supports', init.protocol_version in ('2025-03-26', '2025-06-18', '2025-11-25'), init.protocol_version)
        tools = [t.name for t in (await s.list_tools()).tools]
        check('tools/list exposes four read-only tools and no promotion tools', sorted(tools) == ['get_knowledge', 'list_apps', 'resolve_context', 'search_knowledge'], ','.join(tools))
        own = json.loads(text(await s.call_tool('get_knowledge', {'id': kim_item})))
        check("Kim reads her own private item, labeled personal", own.get('id') == kim_item and own.get('governance', {}).get('audience') == 'personal')
        other = await s.call_tool('get_knowledge', {'id': lee_item})
        check("Kim cannot read Lee's private item", other.is_error and 'unavailable' in text(other), text(other))
        found = json.loads(text(await s.call_tool('search_knowledge', {'query': 'zebra'})))
        check("Kim's search never returns Lee's private item", all(x['id'] != lee_item for x in found) and any(x['id'] == kim_item for x in found), f'{len(found)} results')
        packet = json.loads(text(await s.call_tool('resolve_context', {'prompt': 'zebra crossing checklist'})))
        check('resolve_context principal is Kim and excludes Lee', packet['principal']['id'] == 'kim' and lee_item not in json.dumps(packet), packet['status'])
        try:
            spoof = await s.call_tool('resolve_context', {'prompt': 'zebra', 'userId': 'lee'})
            check('A model-supplied userId argument is rejected', spoof.is_error, text(spoof)[:80])
        except Exception as e:  # the server answers with JSON-RPC -32602, which the SDK raises
            check('A model-supplied userId argument is rejected', 'Invalid tool arguments' in str(e), f'{type(e).__name__}: {e}')
    await run(kim, kim_flow)

    async def lee_flow(s, init):
        packet = json.loads(text(await s.call_tool('resolve_context', {'prompt': 'zebra crossing checklist'})))
        check('Same prompt as Lee returns Lee’s context, not Kim’s', packet['principal']['id'] == 'lee' and kim_item not in json.dumps(packet) and any(x['id'] == lee_item for x in packet['context']))
    await run(lee, lee_flow)

    try:
        await run(None, lambda s, i: s.list_tools())
        check('No credential is refused at the transport', False, 'session opened without a token')
    except BaseException as e:  # SDK raises inside a task group
        check('No credential: the SDK cannot open a session (raw HTTP status is checked separately)', 'error response' in repr(e) or '401' in repr(e), repr(e)[:120])

asyncio.run(main())
print(f"{sum(c['ok'] for c in checks)}/{len(checks)} MCP SDK checks passed")
json.dump(checks, open(sys.argv[6] if len(sys.argv) > 6 else 'mcp-sdk-results.json', 'w'), indent=2)
