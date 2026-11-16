// motion.js — Movimientos: secuencias en L / vertical y el ejecutor de acciones de cada gantry.
// Se carga como script clásico (sin módulos) para que funcione abriendo index.html directo.

// ===== motion macros =====
const name=s=>s.kind==='B1'?`Bufer 1 pos ${s.label} (nivel ${s.level})`:s.kind==='B2'?`Bufer 2 pos ${s.label} (nivel ${s.level})`:s.kind==='DESC'?`Descarga espacio ${s.label}`:s.label.charAt(0)+s.label.slice(1).toLowerCase();
const mv=(to,txt)=>({t:'mv',to,txt});
// En L: B en el Bufer 1, y B/C en la columna derecha del Bufer 2. A/D siempre vertical.
function isL(arm,s){return (arm==='B'||arm==='C')&&(s.kind==='B1'||(s.kind==='B2'&&s.col==='R'));}
function pick(g,arm,s,moveY=true){return (isL(arm,s)?seqL:seqV)(g,arm,s,'grab',moveY);}
function place(g,arm,s,moveY=true){return (isL(arm,s)?seqL:seqV)(g,arm,s,'rel',moveY);}
function seqL(g,arm,s,op,moveY){
  const verb=op==='grab'?'toma':'deja';
  return [mv({gy:s.y},`${g.name} viaja en Y a ${name(s)}`),
    mv({[arm+'.z']:s.z+GH+(op==='grab'?0.05:0.09)},`${arm} baja en Z al nivel ${s.level}`),
    mv({[arm+'.x']:s.x},`${arm} entra en X (movimiento en L)`),
    mv({[arm+'.z']:s.z+GH},`${arm} se asienta`),
    {t:op,arm,s,txt:`${arm} ${verb} el pallet en ${name(s)}`},
    ...(op==='grab'?[mv({[arm+'.z']:s.z+GH+0.08},`${arm} levanta el pallet`)]:[]),
    mv({[arm+'.x']:LANE[arm]},`${arm} sale en X`),
    mv({[arm+'.z']:REST},`${arm} sube en Z`)];
}
function seqV(g,arm,s,op,moveY){
  const verb=op==='grab'?'toma':'deja';
  return [...(moveY?[mv({gy:s.y},`${g.name} viaja en Y a ${name(s)}`)]:[]),
    mv({[arm+'.x']:s.x},`${arm} se alinea en X`),
    mv({[arm+'.z']:s.z+GH},`${arm} baja en Z (vertical)`),
    {t:op,arm,s,txt:`${arm} ${verb} el pallet en ${name(s)}`},
    mv({[arm+'.z']:REST},`${arm} sube en Z`),
    mv({[arm+'.x']:LANE[arm]},`${arm} regresa a su carril`)];
}
const lock=g=>({t:'lock',txt:`${g.name} espera que se libere el Bufer 2`});
const unlock=g=>[mv({gy:SAFE[g.name]},`${g.name} sale del Bufer 2`),{t:'unlock'}];
const waitFor=(fn,txt,then)=>({t:'waitfor',fn,txt,then});
function claim(s){if(s.pallet)s.pallet.claimed=true;}
function reserve(s){s.res=true;}

// ===== executor =====
let actionDone=false;
function startAction(g,a){
  g.cur=a; g.el=0; g.txt=a.txt||g.txt;
  if(a.t==='mv'){ g.frm={...g.v}; let d=0;
    for(const k in a.to){const r=k==='gy'?VEL.y:(k.endsWith('.x')?VEL.x:VEL.z); d=Math.max(d,Math.abs(a.to[k]-g.frm[k])/r);}
    g.dur=d>0.001?0.15+d:0; }
  else if(a.t==='grab'||a.t==='rel'){g.dur=0.35;g.ev=false;}
  else g.dur=0;
}
function stepGantry(g,dt){
  let guard=0;
  while(dt>0 && guard++<50){
    if(!g.cur){
      if(!g.q.length){
        g.wait-=dt; if(g.wait>0) return; g.wait=0.25;
        const d=(g.name==='G1'?decideG1:decideG2)(g);
        if(d){g.q=d.q; g.rule=d.rule; log(`<b>${g.name}</b>: ${d.rule}`);}
        else { const home=g.name==='G1'?5.2:10.6; if(Math.abs(g.v.gy-home)>0.05 && !Object.values(g.hold).some(x=>x)){g.q=[mv({gy:home},`${g.name} regresa a su posición de espera`)];g.rule='Sin tarea pendiente.';} else {g.txt='Esperando tarea';g.rule='Sin tarea pendiente.';return;} }
      }
      const a=g.q.shift();
      if(a.t==='dyn'){g.q.unshift(...a.fn());continue;}
      startAction(g,a);
    }
    const a=g.cur;
    if(a.t==='lock'){ if(lockOwner===null||lockOwner===g.name){lockOwner=g.name;g.cur=null;continue;} g.txt=a.txt; return; }
    if(a.t==='call'){ a.fn(); g.cur=null; continue; }
    if(a.t==='unlock'){ if(lockOwner===g.name)lockOwner=null; g.cur=null; continue; }
    if(a.t==='waitfor'){ if(a.fn()){ if(a.then)a.then(); g.cur=null; continue; } g.txt=a.txt; return; }
    const use=Math.min(dt,Math.max(0,g.dur-g.el)); g.el+=use; dt-=use;
    const k=g.dur>0?Math.min(1,g.el/g.dur):1;
    if(a.t==='mv'){const e=k*k*(3-2*k); for(const key in a.to) g.v[key]=g.frm[key]+(a.to[key]-g.frm[key])*e;}
    if((a.t==='grab'||a.t==='rel')&&k>=0.5&&!g.ev){ g.ev=true;
      if(a.t==='grab'){const p=a.s.pallet; if(!p){log(`<span style="color:#ee4d47">${g.name}: no encontró pallet en ${name(a.s)} (se movió a mano).</span>`); } else {p.claimed=false;g.hold[a.arm]=p;a.s.pallet=null;a.s.res=null;}}
      else {const p=g.hold[a.arm]; g.hold[a.arm]=null; if(p){ if(a.s.pallet){log(`<span style="color:#ee4d47">${g.name}: ${name(a.s)} ocupada, regresa el pallet.</span>`); g.hold[a.arm]=p; } else {a.s.pallet=p;a.s.res=null;a.s.timer=0; if(a.s.kind==='BK'&&p.piece==='raw'){a.s.prog=0;}}}}
    }
    if(g.el>=g.dur-1e-9){ g.cur=null; if(g.dur>0) actionDone=true; }
  }
}
function stepWorld(dt){
  simT+=dt;
  for(const s of [S.BK1,S.BK2]){ const p=s.pallet;
    if(p&&p.piece==='raw'&&!s.fault&&!p.claimed){ s.prog+=dt/PROC; if(s.prog>=1){s.prog=1;p.piece='done';log(`${s.label.charAt(0)+s.label.slice(1).toLowerCase()} terminó la pieza.`);} } }
  // control: cuánto tiempo seguido queda alimentación sin pallet (debe ser solo el instante del intercambio)
  if(!S.ALIM.pallet){ S.ALIM.vac=(S.ALIM.vac||0)+dt; stats.alimVac=Math.max(stats.alimVac||0,S.ALIM.vac); } else S.ALIM.vac=0;
  const a=S.ALIM.pallet; if(a&&a.piece==='none'&&!a.claimed){S.ALIM.timer+=dt; if(S.ALIM.timer>=LOAD){a.piece='raw';S.ALIM.timer=0;stats.load++;log('Operador cargó pieza nueva en alimentación.');}} else if(!a||a.piece!=='none') S.ALIM.timer=0;
  for(const s of [S.D1,S.D2]){const p=s.pallet; if(p&&p.piece==='done'&&!p.claimed){s.timer+=dt; if(s.timer>=UNLOAD){p.piece='none';s.timer=0;stats.done++;log(`Operador descargó la pieza en descarga espacio ${s.label}.`);}} else s.timer=0;}
  stepGantry(G.G1,dt); stepGantry(G.G2,dt);
}
