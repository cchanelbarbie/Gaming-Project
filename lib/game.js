import {randomBytes} from 'node:crypto';
const id=()=>randomBytes(24).toString('hex');
const fail=(status,message)=>{throw Object.assign(Error(message),{status});};
const distance=(a,b)=>Math.abs(a%5-b%5)+Math.abs(Math.floor(a/5)-Math.floor(b/5));
function reset(r){r.board=Array(25).fill(null);for(const c of [20,21,23])r.board[c]={team:'X',hp:2};for(const c of [1,3,4])r.board[c]={team:'O',hp:2};r.turn=r.round%2?'X':'O';r.winner=null;r.reason=null;r.rematch=[];}
function view(r){return {code:r.code,board:r.board,turn:r.turn,winner:r.winner,reason:r.reason,players:r.players.map(p=>({mark:p.mark,connected:true})),round:r.round,rematch:r.rematch,scores:r.scores,matchWinner:r.matchWinner,revision:r.revision};}
const json=(status,b)=>Response.json(b,{status,headers:{'Cache-Control':'no-store'}});
export function gameHandler(store){return async request=>{
try{
const u=new URL(request.url);let b;
if(request.method==='GET')b={action:'state',room:u.searchParams.get('room'),token:u.searchParams.get('token')};
else if(request.method==='POST'){const text=await request.text();if(text.length>4096)fail(413,'Request too large.');try{b=JSON.parse(text);}catch{fail(400,'Invalid request.');}if(!b||typeof b!=='object')fail(400,'Invalid request.');}
else return json(405,{error:'Use GET or POST.'});
if(!['create','join','state','move','rematch'].includes(b.action))fail(400,'Unknown action.');
if(b.action==='create'){
for(let i=0;i<5;i++){const code=randomBytes(4).toString('hex').toUpperCase();const p={mark:'X',token:id()};const r={code,players:[p],round:1,scores:{X:0,O:0},matchWinner:null,revision:0,requests:[],created:Date.now()};reset(r);const result=await store.setJSON(code,r,{onlyIfNew:true});if(result.modified)return json(201,{...view(r),token:p.token,mark:p.mark});}
fail(503,'Could not create a room. Try again.');
}
const code=String(b.room||'').toUpperCase();if(!/^[A-F0-9]{8}$/.test(code))fail(404,'Room not found. Check the code.');
for(let attempt=0;attempt<6;attempt++){
const entry=await store.getWithMetadata(code,{type:'json',consistency:'strong'});if(!entry)fail(404,'Room not found. Create a new room.');const r=entry.data;
if(Date.now()-r.created>7*86400000)fail(410,'This room has expired. Create a new room.');
let p=r.players.find(p=>p.token===b.token);
if(b.action==='state'){if(!p)fail(401,'Your seat could not be found. Rejoin or create a room.');return json(200,view(r));}
if(typeof b.requestId!=='string'||! /^[A-Za-z0-9-]{8,80}$/.test(b.requestId))fail(400,'A request ID is required.');
if(b.action==='join'){
p=r.players.find(p=>p.joinId===b.requestId);if(p)return json(200,{...view(r),token:p.token,mark:p.mark});
if(r.players.length===2)fail(409,'This room already has two players.');p={mark:'O',token:id(),joinId:b.requestId};r.players.push(p);
}else{
if(!p)fail(401,'Your seat could not be found. Rejoin or create a room.');
if(r.requests.some(q=>q.id===b.requestId&&q.mark===p.mark))return json(200,view(r));
if(b.revision!==r.revision)fail(409,'The battlefield changed. Try your action again.');
if(b.action==='move'){
if(r.players.length<2)fail(409,'Wait for your opponent to join.');if(r.winner)fail(409,'This round has ended.');if(r.turn!==p.mark)fail(409,'It is your opponent’s turn.');
if(!Number.isInteger(b.from)||!Number.isInteger(b.to)||b.from<0||b.from>24||b.to<0||b.to>24)fail(400,'Select a unit and adjacent square.');
const unit=r.board[b.from],target=r.board[b.to];if(unit?.team!==p.mark)fail(400,'Select your own unit.');if(distance(b.from,b.to)!==1)fail(400,'Move or attack one square horizontally or vertically.');if(target?.team===p.mark)fail(400,'That square contains a friendly unit.');
if(target){if(--target.hp===0)r.board[b.to]=null;}else{r.board[b.to]=unit;r.board[b.from]=null;}
const enemy=p.mark==='X'?'O':'X';const hq=p.mark==='X'?2:22;
if(r.board[hq]?.team===p.mark){r.winner=p.mark;r.reason='Enemy headquarters captured';}else if(!r.board.some(u=>u?.team===enemy)){r.winner=p.mark;r.reason='Enemy squad eliminated';}
r.turn=enemy;
if(r.winner){r.scores[r.winner]++;if(r.round===3)r.matchWinner=r.scores.X>r.scores.O?'X':'O';}
}else{
if(!r.winner)fail(409,'Finish this round first.');if(r.matchWinner)fail(409,'The three-round match has finished. Create a new room.');
if(!r.rematch.includes(p.mark))r.rematch.push(p.mark);if(r.rematch.length===2){r.round++;reset(r);}
}
r.requests.push({id:b.requestId,mark:p.mark});r.requests=r.requests.slice(-100);
}
r.revision++;
const saved=await store.setJSON(code,r,{onlyIfMatch:entry.etag});if(saved.modified)return json(200,{...view(r),...(b.action==='join'?{token:p.token,mark:p.mark}:{})});
}
fail(409,'Another action arrived first. Refresh and try again.');
}catch(e){if(!e.status)console.error('Game storage request failed:',e.message);return json(e.status||503,{error:e.status?e.message:'Room storage is temporarily unavailable. Please retry.'});}
};}
