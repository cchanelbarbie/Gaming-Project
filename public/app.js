const $=id=>document.getElementById(id);
let seat=null,state=null,events=null,busy=false,selected=null;
try{seat=JSON.parse(sessionStorage.getItem('crossplay'));}catch{}
async function api(path,data={}){const r=await fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const b=await r.json();if(!r.ok)throw Error(b.error);return b;}
function showError(e){$('error').textContent=e.message||String(e);}
async function action(fn){if(busy)return;busy=true;$('error').textContent='';try{await fn();}catch(e){showError(e);}finally{busy=false;}}
function connect(result){seat={room:result.code,token:result.token,mark:result.mark};try{sessionStorage.setItem('crossplay',JSON.stringify(seat));}catch{}history.replaceState(null,'','/?room='+seat.room);openEvents();render(result);}
function openEvents(){events?.close();$('lobby').hidden=true;$('game').hidden=false;$('room-label').textContent=seat.room;$('connection').textContent='Connecting…';events=new EventSource('/api/events?room='+seat.room+'&token='+seat.token);events.onmessage=e=>{render(JSON.parse(e.data));$('connection').textContent='Live · You command '+(seat.mark==='X'?'Blue':'Red');};events.onerror=()=>{$('connection').textContent='Connection lost. Reconnecting automatically…';};}
function render(s){state=s;$('lobby').hidden=true;$('game').hidden=false;$('room-label').textContent=s.code;
const ready=s.players.length===2;const mine=s.turn===seat.mark;
$('status').textContent=s.winner?(s.winner===seat.mark?'Victory! '+s.reason:'Defeat · '+s.reason):!ready?'Waiting for your friend…':mine?'Your turn · Select a unit':'Your opponent’s turn…';
for(const mark of ['X','O']){const p=s.players.find(p=>p.mark===mark);$('player-'+mark.toLowerCase()).textContent=(mark==='X'?'🔵':'🔴')+' '+(seat.mark===mark?'You':'Opponent')+' · '+(!p?'Waiting':p.connected?'Online':'Offline');$('player-'+mark.toLowerCase()).classList.toggle('active',!s.winner&&s.turn===mark&&ready);}
if(selected!==null&&s.board[selected]?.team!==seat.mark)selected=null;
$('board').replaceChildren(...s.board.map((unit,i)=>{const b=document.createElement('button');b.textContent=unit?(unit.team==='X'?'♟':'♟'):'';if(unit){const health=document.createElement('small');health.textContent='●'.repeat(unit.hp)+'○'.repeat(2-unit.hp);b.append(health);}
const adjacent=selected!==null&&Math.abs(selected%5-i%5)+Math.abs(Math.floor(selected/5)-Math.floor(i/5))===1;
b.className=(unit?.team==='O'?'o ':'')+(i===2||i===22?'hq ':'')+(selected===i?'selected ':'')+(adjacent&&unit?.team!==seat.mark?'target':'');
b.setAttribute('aria-label','Row '+(Math.floor(i/5)+1)+', column '+(i%5+1)+': '+(unit?(unit.team==='X'?'Blue':'Red')+' unit, '+unit.hp+' health':'empty')+(i===2?' Red HQ':i===22?' Blue HQ':''));
b.disabled=!mine||!ready||!!s.winner;
b.onclick=()=>{if(unit?.team===seat.mark){selected=i;render(state);}else if(selected!==null)action(async()=>{const next=await api('move',{...seat,from:selected,to:i});selected=null;render(next);});};return b;}));
$('rematch').hidden=!s.winner;$('rematch').disabled=s.rematch.includes(seat.mark);$('rematch').textContent=s.rematch.includes(seat.mark)?'Waiting for opponent…':s.rematch.length?'Accept rematch ↗':'Play again ↗';}
$('create').onclick=()=>action(async()=>connect(await api('create')));
$('join').onsubmit=e=>{e.preventDefault();action(async()=>connect(await api('join',{room:$('code').value.trim().toUpperCase()})));};
$('rematch').onclick=()=>action(async()=>render(await api('rematch',seat)));
$('copy').onclick=()=>action(async()=>{const link=location.origin+'/?room='+seat.room;try{await navigator.clipboard.writeText(link);$('copy').textContent='Copied!';setTimeout(()=>$('copy').textContent='Copy invite ↗',1800);}catch{$('error').textContent='Share this invite: '+link;}});
$('leave').onclick=()=>{events?.close();seat=null;state=null;try{sessionStorage.removeItem('crossplay');}catch{}history.replaceState(null,'','/');$('game').hidden=true;$('lobby').hidden=false;$('error').textContent='';};
const invite=new URLSearchParams(location.search).get('room');if(seat&&(!invite||seat.room===invite))openEvents();else if(invite){$('code').value=invite.toUpperCase();$('code').focus();}
