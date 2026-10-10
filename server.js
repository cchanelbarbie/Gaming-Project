import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const rooms = new Map();
const distance=(a,b)=>Math.abs(a%5-b%5)+Math.abs(Math.floor(a/5)-Math.floor(b/5));
const token = () => randomBytes(24).toString('hex');
const view = r => ({code:r.code,board:r.board,turn:r.turn,winner:r.winner,reason:r.reason,players:r.players.map(p=>({mark:p.mark,connected:p.streams.size>0})),rematch:r.rematch,round:r.round});
const send = r => {for(const p of r.players) for(const s of p.streams) s.write(`data: ${JSON.stringify(view(r))}\n\n`);};
function reset(r) {r.board=Array(25).fill(null);for(const cell of [20,21,23])r.board[cell]={team:'X',hp:2};for(const cell of [1,3,4])r.board[cell]={team:'O',hp:2};r.turn=r.round%2 ? 'X':'O';r.winner=null;r.reason=null;r.rematch=[];}
function error(status,message) {return Object.assign(new Error(message),{status});}
export function createServer() {
 return http.createServer(async(req,res)=>{
 try {
 const url=new URL(req.url,'http://localhost');
 const json=(status,body)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));};
 if(url.pathname==='/health') return json(200,{ok:true});
 if(url.pathname==='/api/events' && req.method==='GET') {
 const r=rooms.get(url.searchParams.get('room'));const p=r?.players.find(p=>p.token===url.searchParams.get('token'));
 if(!p) throw error(401,'Your seat could not be found. Join a room again.');
 res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-cache, no-transform','Connection':'keep-alive','X-Accel-Buffering':'no'});
 p.streams.add(res);r.touched=Date.now();send(r);
 const beat=setInterval(()=>{res.write(': heartbeat\n\n');r.touched=Date.now();},20000);
 req.on('close',()=>{clearInterval(beat);p.streams.delete(res);send(r);});return;
 }
 if(url.pathname.startsWith('/api/') && req.method==='POST') {
 let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2048) throw error(413,'Request too large.');}
 let b;try{b=JSON.parse(raw||'{}');}catch{throw error(400,'Invalid request.');}
 if(url.pathname==='/api/create') {
 if(rooms.size>=10000) throw error(503,'Rooms are busy. Try again later.');
 let code;do{code=randomBytes(4).toString('hex').toUpperCase();}while(rooms.has(code));
 const p={token:token(),mark:'X',streams:new Set()};const r={code,players:[p],round:1,touched:Date.now()};reset(r);rooms.set(code,r);
 return json(201,{token:p.token,mark:p.mark,...view(r)});
 }
 const r=rooms.get(String(b.room||'').toUpperCase());if(!r) throw error(404,'Room not found. Check the code or create a new room.');
 r.touched=Date.now();
 if(url.pathname==='/api/join') {
 if(r.players.length===2) throw error(409,'This room already has two players.');
 const p={token:token(),mark:'O',streams:new Set()};r.players.push(p);send(r);return json(200,{token:p.token,mark:p.mark,...view(r)});
 }
 const p=r.players.find(p=>p.token===b.token);if(!p) throw error(401,'Your seat could not be found. Join a room again.');
 if(url.pathname==='/api/move') {
 if(r.players.length<2) throw error(409,'Wait for your opponent to join.');
 if(r.winner) throw error(409,'This round has ended. Request a rematch.');
 if(r.turn!==p.mark) throw error(409,'It is your opponent’s turn.');
 if(!Number.isInteger(b.from)||!Number.isInteger(b.to)||b.from<0||b.from>24||b.to<0||b.to>24)throw error(400,'Select a unit and an adjacent square.');
 const unit=r.board[b.from],target=r.board[b.to];
 if(!unit||unit.team!==p.mark)throw error(400,'Select one of your own units.');
 if(distance(b.from,b.to)!==1)throw error(400,'Move or attack one square horizontally or vertically.');
 if(target?.team===p.mark)throw error(400,'That square contains a friendly unit.');
 if(target){target.hp--;if(target.hp===0)r.board[b.to]=null;}else{r.board[b.to]=unit;r.board[b.from]=null;}
 const enemy=p.mark==='X'?'O':'X';const enemyHQ=p.mark==='X'?2:22;
 if(r.board[enemyHQ]?.team===p.mark){r.winner=p.mark;r.reason='Enemy headquarters captured';}
 else if(!r.board.some(u=>u?.team===enemy)){r.winner=p.mark;r.reason='Enemy squad eliminated';}
 r.turn=enemy;
 } else if(url.pathname==='/api/rematch') {
 if(!r.winner) throw error(409,'Finish this round first.');
 if(!r.rematch.includes(p.mark))r.rematch.push(p.mark);
 if(r.rematch.length===2){r.round++;reset(r);}
 }else throw error(404,'Endpoint not found.');
 send(r);return json(200,view(r));
 }
 if(req.method!=='GET') throw error(405,'Method not allowed.');
 const files={'/':'index.html','/app.js':'app.js','/style.css':'style.css'};const file=files[url.pathname];if(!file)throw error(404,'Page not found.');
 res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html','Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; connect-src 'self'; style-src 'self'; script-src 'self'; base-uri 'none'; frame-ancestors 'none'"});res.end(await readFile(new URL(`./public/${file}`,import.meta.url)));
 }catch(e){if(!res.headersSent){res.writeHead(e.status||500,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.status?e.message:'Something went wrong. Please try again.'}));}else res.end();}
 });
}
const cleanup=setInterval(()=>{for(const [code,r]of rooms)if(Date.now()-r.touched>24*60*60*1000&&!r.players.some(p=>p.streams.size))rooms.delete(code);},60000);cleanup.unref();
if(process.argv[1]===fileURLToPath(import.meta.url))createServer().listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('Crossplay server ready'));
