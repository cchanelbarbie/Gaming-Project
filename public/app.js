const $=id=>document.getElementById(id);
const ENDPOINT='/.netlify/functions/game';
let seat=null,state=null,busy=false,selected=null,timer=null,polling=false;
try{seat=JSON.parse(sessionStorage.getItem('frontline'));}catch{}
async function api(action,data={}){const r=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,requestId:crypto.randomUUID(),revision:state?.revision,...data})});const b=await r.json();if(!r.ok)throw Error(b.error);return b;}
async function poll(){if(!seat||polling||busy)return;polling=true;const current=seat;try{const r=await fetch(ENDPOINT+'?room='+seat.room+'&token='+seat.token,{cache:'no-store'});const b=await r.json();if(!r.ok)throw Error(b.error);if(current!==seat)return;if(!state||b.revision>=state.revision)render(b);$('connection').textContent='Live · You command '+(seat.mark==='X'?'Blue':'Red');}catch(e){if(current===seat)$('connection').textContent='Reconnecting… '+e.message;}finally{polling=false;}}
function showError(e){$('error').textContent=e.message||String(e);}
async function action(fn){if(busy)return;busy=true;$('error').textContent='';try{await fn();}catch(e){showError(e);}finally{busy=false;poll();}}
function connect(result){seat={room:result.code,token:result.token,mark:result.mark};try{sessionStorage.setItem('frontline',JSON.stringify(seat));}catch{}history.replaceState(null,'','/?room='+seat.room);openEvents();render(result);}
function openEvents(){clearInterval(timer);state=null;selected=null;$('lobby').hidden=true;$('game').hidden=false;$('room-label').textContent=seat.room;$('connection').textContent='Connecting…';timer=setInterval(poll,1500);poll();}
function render(s){if(state&&s.revision<state.revision)return;state=s;$('lobby').hidden=true;$('game').hidden=false;$('room-label').textContent=s.code;
const ready=s.players.length===2;const mine=s.turn===seat.mark;
$('status').textContent=s.matchWinner?(s.matchWinner===seat.mark?'You win the match!':'Your opponent wins the match.') :s.winner?(s.winner===seat.mark?'Victory! '+s.reason:'Defeat · '+s.reason):!ready?'Waiting for your friend…':mine?'Your turn · Select a unit':'Your opponent’s turn…';
for(const mark of ['X','O']){const p=s.players.find(p=>p.mark===mark);$('player-'+mark.toLowerCase()).textContent=(mark==='X'?'🔵':'🔴')+' '+(seat.mark===mark?'You':'Opponent')+' · '+(!p?'Waiting':p.connected?'Joined':'Away');$('player-'+mark.toLowerCase()).classList.toggle('active',!s.winner&&s.turn===mark&&ready);}
if(selected!==null&&s.board[selected]?.team!==seat.mark)selected=null;
$('board').replaceChildren(...s.board.map((unit,i)=>{const b=document.createElement('button');b.textContent=unit?(unit.team==='X'?'♟':'♟'):'';if(unit){const health=document.createElement('small');health.textContent='●'.repeat(unit.hp)+'○'.repeat(2-unit.hp);b.append(health);}
const adjacent=selected!==null&&Math.abs(selected%5-i%5)+Math.abs(Math.floor(selected/5)-Math.floor(i/5))===1;
b.className=(unit?.team==='O'?'o ':'')+(i===2||i===22?'hq ':'')+(selected===i?'selected ':'')+(adjacent&&unit?.team!==seat.mark?'target':'');
b.setAttribute('aria-label','Row '+(Math.floor(i/5)+1)+', column '+(i%5+1)+': '+(unit?(unit.team==='X'?'Blue':'Red')+' unit, '+unit.hp+' health':'empty')+(i===2?' Red HQ':i===22?' Blue HQ':''));
b.disabled=!mine||!ready||!!s.winner;
b.onclick=()=>{if(unit?.team===seat.mark){selected=i;render(state);}else if(selected!==null)action(async()=>{const next=await api('move',{...seat,from:selected,to:i});selected=null;render(next);});};return b;}));
$('score').textContent='Round '+s.round+' / 3 · Blue '+s.scores.X+' — '+s.scores.O+' Red';
$('rematch').hidden=!s.winner||!!s.matchWinner;$('rematch').disabled=s.rematch.includes(seat.mark);$('rematch').textContent=s.rematch.includes(seat.mark)?'Waiting for opponent…':s.rematch.length?'Accept next round ↗':'Next round ↗';}
$('create').onclick=()=>action(async()=>connect(await api('create')));
$('join').onsubmit=e=>{e.preventDefault();action(async()=>connect(await api('join',{room:$('code').value.trim().toUpperCase()})));};
$('rematch').onclick=()=>action(async()=>render(await api('rematch',seat)));
$('copy').onclick=()=>action(async()=>{const link=location.origin+'/?room='+seat.room;try{await navigator.clipboard.writeText(link);$('copy').textContent='Copied!';setTimeout(()=>$('copy').textContent='Copy invite ↗',1800);}catch{$('error').textContent='Share this invite: '+link;}});
$('leave').onclick=()=>{clearInterval(timer);seat=null;state=null;selected=null;try{sessionStorage.removeItem('frontline');}catch{}history.replaceState(null,'','/');$('game').hidden=true;$('lobby').hidden=false;$('error').textContent='';};
const invite=new URLSearchParams(location.search).get('room');if(seat&&(!invite||seat.room===invite))openEvents();else if(invite){$('code').value=invite.toUpperCase();$('code').focus();}
