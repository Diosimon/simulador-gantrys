// ui.js — Interfaz: botones, toques en pantalla, panel "Ahora", estadísticas y ciclo principal.
// Se carga como script clásico (sin módulos) para que funcione abriendo index.html directo.

// ===== UI =====
let running=true, stepMode=false, speed=1, last=performance.now();
const $=id=>document.getElementById(id);
function setPlay(on){running=on; $('play').textContent=on?'⏸ Pausa':'▶ Play'; $('play').classList.toggle('on',on);}
$('play').onclick=()=>{stepMode=false; setPlay(!running);};
$('step').onclick=()=>{stepMode=true; running=true; $('play').textContent='▶ Play'; $('play').classList.remove('on');};
$('reset').onclick=()=>{initScenario($('scn').value);};
$('scn').onchange=()=>{initScenario($('scn').value);};
// Tiempos: se aplican al momento, sin reiniciar (el avance del banco va en %, así que se ajusta solo).
['vY','vX','vZ'].forEach(id=>$(id).addEventListener('input',()=>{leerVelocidad(); log(`Velocidad gantrys: Y ${$('vY').value} % · X ${$('vX').value} % · Z ${$('vZ').value} %.`);}));
$('sentido').addEventListener('change',()=>{ESPEJO=$('sentido').value==='der'; log(ESPEJO?'Vista: la línea empieza a la derecha (Bufer 1) y termina a la izquierda (Descarga).':'Vista: Bufer 1 a la izquierda, Descarga a la derecha.');});
$('nB2').addEventListener('change',()=>initScenario($('scn').value));   // cambia el arranque → reinicia
['tProc','tLoad','tUnload'].forEach(id=>$(id).addEventListener('input',()=>{leerTiempos(); log(`Tiempos: prueba ${PROC} s · carga ${LOAD} s · descarga ${UNLOAD} s.`);}));
document.querySelectorAll('#spd button').forEach(b=>b.onclick=()=>{speed=+b.dataset.s;document.querySelectorAll('#spd button').forEach(x=>x.classList.toggle('on',x===b));});
document.querySelectorAll('#cam button').forEach(b=>b.onclick=()=>{camKey=b.dataset.c;document.querySelectorAll('#cam button').forEach(x=>x.classList.toggle('on',x===b));});
function syncFaultBtns(){$('fb1').classList.toggle('on',S.BK1.fault);$('fb2').classList.toggle('on',S.BK2.fault);}
function toggleFault(s){s.fault=!s.fault; log(`${s.label.charAt(0)+s.label.slice(1).toLowerCase()} ${s.fault?'<span style="color:#ee4d47">EN FALLA</span>':'reparado'}.`); syncFaultBtns();}
$('fb1').onclick=()=>toggleFault(S.BK1); $('fb2').onclick=()=>toggleFault(S.BK2);
cv.addEventListener('click',e=>{
  const r=cv.getBoundingClientRect(), mx=e.clientX-r.left, my=e.clientY-r.top;
  let best=null,bd=1e9;
  for(const s of Object.values(S)){const q=P(s.x,s.y,s.z+0.22);const d=Math.hypot(q[0]-mx,q[1]-my);if(d<bd){bd=d;best=s;}}
  if(!best||bd>Math.max(22,cam.k*0.38)) return;
  if(best.kind==='BK'){toggleFault(best);return;}
  if(best.res||(best.pallet&&best.pallet.claimed)){toast(`${name(best)} está en uso por un gantry`);return;}
  const order=[null,'none','raw','done']; const cur=best.pallet?best.pallet.piece:null; const nx=order[(order.indexOf(cur)+1)%4];
  best.pallet=nx?pal(nx):null; best.timer=0;
  const lbl={null:'vacía',none:'pallet vacío',raw:'pieza sin procesar',done:'pieza procesada'};
  toast(`${name(best)}: ${lbl[nx]}`); log(`Cambio manual: ${name(best)} → ${lbl[nx]}.`);
});

function updatePanel(){
  for(const k of ['G1','G2']){const g=G[k]; $(k.toLowerCase()+'a').textContent=g.txt; $(k.toLowerCase()+'r').textContent='Regla: '+g.rule;}
  const bad=[1,2,3,4,5].filter(n=>S['B2-'+String(n).padStart(3,'0')].pallet&&S['B2-'+String(n+5).padStart(3,'0')].pallet);
  const w=$('warn'); if(bad.length){w.style.display='block'; w.textContent='⚠ Regla rota en Bufer 2: '+bad.map(n=>`${String(n).padStart(3,'0')} y ${String(n+5).padStart(3,'0')}`).join(', ')+' ocupadas al mismo tiempo (solo puede haber un pallet por nivel).';} else w.style.display='none';
  $('palTot').textContent='· total '+__sim.get().pal+' pallets'; $('sDone').textContent=stats.done; $('sLoad').textContent=stats.load; $('sTime').textContent=fmt(simT); $('sRate').textContent=simT>5?(stats.done/simT*60).toFixed(1):'0.0';
}
let panelT=0;
function loop(now){
  const rdt=Math.min(0.05,(now-last)/1000); last=now;
  if(running){ let dt=rdt*speed; actionDone=false;
    const sub=0.02; while(dt>0){const d=Math.min(sub,dt); stepWorld(d); dt-=d; if(stepMode&&actionDone){setPlay(false);break;}} }
  const t=camTarget(); cam.yc+=(t.yc-cam.yc)*Math.min(1,rdt*5); cam.k+=(t.k-cam.k)*Math.min(1,rdt*5);
  draw(); panelT-=rdt; if(panelT<=0){updatePanel();panelT=0.15;}
  requestAnimationFrame(loop);
}
initScenario('normal');
cam=camTarget();
window.__sim={run:(T)=>{for(let t=0;t<T;t+=0.02)stepWorld(0.02);},get:()=>({done:stats.done,b1:B1().filter(s=>s.pallet).length,b1raw:B1().filter(s=>s.pallet&&s.pallet.piece==='raw').length,pal:Object.values(S).filter(x=>x.pallet).length+[G.G1,G.G2].reduce((n,g)=>n+Object.values(g.hold).filter(x=>x).length,0),alimVac:+(stats.alimVac||0).toFixed(1),desc:[S.D1,S.D2].filter(x=>x.pallet).length,t:simT,g1:G.G1.txt,g2:G.G2.txt,lock:lockOwner}),init:initScenario,dump:()=>Object.values(S).filter(s=>s.pallet||s.res).map(s=>s.id+":"+(s.pallet?s.pallet.piece+(s.pallet.claimed?"*":""):"-")+(s.res?"R":"")).join(" ")+" | hold "+JSON.stringify([G.G1.hold,G.G2.hold])};
requestAnimationFrame(loop);
