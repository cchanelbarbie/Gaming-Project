import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import handler from '../.netlify/functions/game/game.mjs';
// Exercise the production bundle and real Blobs SDK against an in-memory HTTP
// implementation of strong reads and ETag conditional writes. No live storage.
let savedFetch,savedContext,rows=new Map(),serial=0,requests=[],conflicts=0;
before(()=>{
savedFetch=globalThis.fetch;savedContext=globalThis.netlifyBlobsContext;
globalThis.netlifyBlobsContext=Buffer.from(JSON.stringify({siteID:'test-site',token:'test-only',edgeURL:'https://cached.test',uncachedEdgeURL:'https://strong.test'})).toString('base64');
globalThis.fetch=async(url,options={})=>{const u=new URL(url);assert.equal(u.hostname,'strong.test','all reads/writes must use strong endpoint');const key=u.pathname;const method=options.method.toUpperCase(),h=new Headers(options.headers);requests.push({method,h});const row=rows.get(key);
if(method==='GET')return row?Response.json(row.data,{headers:{etag:row.etag}}):new Response(null,{status:404});
assert.equal(method,'PUT');const match=h.get('if-match'),fresh=h.get('if-none-match');assert.ok(match||fresh,'every write must be conditional');
if((fresh==='*'&&row)||(match&&match!==row?.etag))return new Response(null,{status:412});
if(match&&conflicts>0){conflicts--;return new Response(null,{status:412});}
const etag='"'+(++serial)+'"';rows.set(key,{data:JSON.parse(options.body),etag});return new Response(null,{status:200,headers:{etag}});
};});
after(()=>{globalThis.fetch=savedFetch;globalThis.netlifyBlobsContext=savedContext;});
async function call(action,data={}){const r=await handler(new Request('https://game.test/.netlify/functions/game',{method:'POST',body:JSON.stringify({action,requestId:randomUUID(),...data})}));return {status:r.status,data:await r.json()};}
async function state(p){const r=await handler(new Request('https://game.test/.netlify/functions/game?room='+p.code+'&token='+p.token));assert.equal(r.status,200);return r.json();}
async function room(){const {data:x}=await call('create');const {data:o}=await call('join',{room:x.code});assert.notEqual(x.token,o.token);return {x,o};}
async function move(p,from,to,extra={}){const s=await state(p);return call('move',{room:p.code,token:p.token,revision:s.revision,from,to,...extra});}
async function vote(p){const s=await state(p);const r=await call('rematch',{room:p.code,token:p.token,revision:s.revision});assert.equal(r.status,200);return r.data;}
async function capture(winner,loser){const blue=winner.mark==='X';const route=blue?[[21,16],[16,11],[11,6],[6,7],[7,2]]:[[3,8],[8,13],[13,18],[18,17],[17,22]];let result;for(let i=0;i<route.length;i++){result=await move(winner,...route[i]);assert.equal(result.status,200);if(i<route.length-1){const filler=blue?(i%2?[9,4]:[4,9]):(i%2?[15,20]:[20,15]);assert.equal((await move(loser,...filler)).status,200);}}return result.data;}
test('complete three-round match for two seats scores 2–1 and locks final winner',async()=>{const {x,o}=await room();let s=await capture(x,o);assert.equal(s.winner,'X');assert.deepEqual(s.scores,{X:1,O:0});assert.equal(s.matchWinner,null);assert.equal((await move(o,4,9)).status,409);await vote(x);s=await vote(o);assert.equal(s.round,2);assert.equal(s.turn,'O');assert.equal(s.board.filter(Boolean).length,6);s=await capture(o,x);assert.equal(s.winner,'O');assert.deepEqual(s.scores,{X:1,O:1});await vote(o);s=await vote(x);assert.equal(s.round,3);s=await capture(x,o);assert.deepEqual(s.scores,{X:2,O:1});assert.equal(s.matchWinner,'X');assert.equal((await call('rematch',{room:x.code,token:x.token,revision:s.revision})).status,409);assert.equal((await state(o)).matchWinner,'X');});
test('turn, unit, movement and seat validation; two-hit combat',async()=>{const {x,o}=await room();assert.equal((await call('join',{room:x.code})).status,409);assert.equal((await move(o,3,8)).status,409);assert.equal((await move(x,21,15)).status,400);assert.equal((await move(x,20,21)).status,400);assert.equal((await call('move',{room:x.code,token:'bad'})).status,401);for(const [i,step]of [[23,18],[18,13],[13,8]].entries()){assert.equal((await move(x,...step)).status,200);assert.equal((await move(o,...(i%2?[9,4]:[4,9]))).status,200);}let r=await move(x,8,3);assert.equal(r.data.board[3].hp,1);await move(o,9,14);r=await move(x,8,3);assert.equal(r.data.board[3],null);assert.equal(r.data.board[8].team,'X');});
test('simultaneous moves cannot overwrite state, duplicate request is idempotent',async()=>{const {x,o}=await room();const s=await state(x);const body={room:x.code,token:x.token,revision:s.revision,from:21,to:16,requestId:randomUUID()};const results=await Promise.all([call('move',body),call('move',{...body,from:23,to:18,requestId:randomUUID()})]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);const won=results[0].status===200;if(won){const duplicate=await call('move',body);assert.equal(duplicate.status,200);assert.equal(duplicate.data.revision,s.revision+1);}const fresh=await state(o);assert.equal(fresh.revision,s.revision+1);assert.equal(fresh.turn,'O');});
test('conditional write conflict retries safely and unauthorized state stays private',async()=>{const {x}=await room();conflicts=1;assert.equal((await move(x,21,16)).status,200);const bad=await handler(new Request('https://game.test/.netlify/functions/game?room='+x.code+'&token=bad'));assert.equal(bad.status,401);assert.ok(requests.some(r=>r.h.get('if-none-match')==='*'));assert.ok(requests.some(r=>r.h.get('if-match')));});
