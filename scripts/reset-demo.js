import {existsSync,renameSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
if(!process.argv.includes('--confirm'))throw new Error('Stop the server, then run npm run demo:reset -- --confirm. This backs up the demo database.');
const root=dirname(dirname(fileURLToPath(import.meta.url))),file=join(root,'data','demo.sqlite');
const stamp=new Date().toISOString().replaceAll(':','-');
for(const suffix of ['','-wal','-shm'])if(existsSync(file+suffix))renameSync(file+suffix,`${file}.${stamp}.bak${suffix}`);
console.log('Demo database backed up. The next start will restore synthetic sample data.');
