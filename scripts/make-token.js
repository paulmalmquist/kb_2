import {randomBytes,createHash} from 'node:crypto';
const userId=process.argv[2];
if(!userId||!/^[a-zA-Z0-9_-]+$/.test(userId))throw new Error('Usage: node scripts/make-token.js USER_ID');
const token=randomBytes(32).toString('base64url');
console.log(JSON.stringify({userId,token,tokenHashMapping:{[createHash('sha256').update(token).digest('hex')]:userId}},null,2));
