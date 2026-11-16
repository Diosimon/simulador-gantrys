// rules.js — LÓGICA DE DECISIÓN de G1 y G2 (prioridades). Es el archivo principal para ajustar el comportamiento.
// Se carga como script clásico (sin módulos) para que funcione abriendo index.html directo.
//
// Patrón de la secuencia real de la línea: TODO es intercambio. En cada lugar un brazo saca y el otro deja,
// y el gantry "aprovecha el viaje": si pasa por el Bufer 2 con un brazo libre, toma un vacío para alimentación
// (G1) o una pieza para descarga / Banco 2 (G2). Los pasos marcados {t:'dyn'} se deciden al llegar ahí.

// ===== utilidades =====
const otherG1=a=>a==='A'?'B':'A';
const otherG2=a=>a==='D'?'C':'D';
const armG2=s=>s.col==='L'?'D':'C';
const b1With=piece=>B1().filter(s=>avail(s,piece)).sort((a,b)=>b.level-a.level||a.col-b.col)[0]||null;
const emptyB2In=col=>B2().find(s=>s.level<=4&&s.col===col&&avail(s,'none'))||null;
const emptyB2forG1=()=>B2().find(s=>s.level<=4&&avail(s,'none'))||null;
const alimFree=()=>!S.ALIM.pallet&&!S.ALIM.res;
const holding=g=>Object.values(g.hold).some(x=>x);
function bkNeedsPiece(bk){ if(bk.fault) return false; const p=bk.pallet; if(bk.res) return false; return !p || p.piece!=='raw'; }
const bk1CanTake=()=>!S.BK1.fault&&!S.BK1.pallet&&!S.BK1.res;
// Nivel 5 = traspaleo en los dos sentidos (punto de entrega entre gantrys): G1 deja la probada y saca el vacío que dejó G2; G2 saca la probada y deja un vacío.
const lv5=col=>b2slot(5,col);
// ¿Puede el brazo `o` de G1 dejar una probada en el nivel 5? Su columna libre, y la otra libre o con un vacío que el otro brazo (si está libre) saca antes.
function lvl5Accepts(o,raFree){ const d=lv5(colOf(o)), e=lv5(colOf(o)==='L'?'R':'L');
  return !d.pallet&&!d.res&&((!e.pallet&&!e.res)||(raFree&&avail(e,'none'))); }
const bk1Done=()=>{const p=S.BK1.pallet;return !!(p&&!p.claimed&&p.piece==='done');};
const bk1DoneReady=()=>bk1Done()&&(lvl5Accepts('A',true)||lvl5Accepts('B',true));
// Bufer 2 = punto de entrega G1→G2 (punto de entrega entre gantrys): G1 mantiene ahí B2_STOCK piezas nuevas LISTAS para el
// Banco 2, así G2 nunca espera a G1. Cuenta las del Bufer 2 (niveles 1–4) y las que G2 ya trae en la mano.
function bk2WantsRaw(){
  if(S.BK2.fault) return false;
  const b2raw=B2().filter(s=>s.level<=4&&s.pallet&&s.pallet.piece==='raw').length;
  const g2raw=Object.values(G.G2.hold).filter(x=>x&&x.piece==='raw').length;
  return b2raw+g2raw < B2_STOCK;
}
// ¿Tiene a dónde ir una pieza nueva que G1 traiga en el brazo `arm`?
const g1RawHasDest=arm=>bk1CanTake()||(!S.BK1.fault&&!!bk1DoneReady())||(bk2WantsRaw()&&(!!b2Free(arm)||b2CanSwap(arm,s=>s.pallet.piece==='none')||b2CanSwap(otherG1(arm),s=>s.pallet.piece==='none')))||!!b1With('none');

// ---- Intercambio en el Bufer 2: los dos brazos en el MISMO NIVEL, uno en cada columna.
// El brazo libre `o` saca un pallet de su columna y el brazo `put` deja el que trae en ese nivel, en su columna.
// Así nunca hay dos pallets en el mismo nivel y no hace falta que haya un nivel libre.
function b2SwapWith(g,put,want){
  const o=g.name==='G1'?otherG1(put):otherG2(put);
  if(!g.hold[put]||g.hold[o]) return null;
  const take=B2().filter(s=>s.level<=4&&s.col===colOf(o)&&s.pallet&&!s.pallet.claimed&&!s.res&&want(s)).sort((a,b)=>b.level-a.level)[0];
  if(!take) return null;
  const dest=b2slot(take.level,colOf(put)); if(dest.pallet||dest.res) return null;
  return {o,take,dest};
}
// Igual que b2SwapWith pero solo pregunta (sin revisar qué traen los brazos hoy).
function b2CanSwap(put,want){
  const oc=colOf(put)==='L'?'R':'L';
  return B2().some(s=>s.level<=4&&s.col===oc&&s.pallet&&!s.pallet.claimed&&!s.res&&want(s)&&(d=>!d.pallet&&!d.res)(b2slot(s.level,colOf(put))));
}
function b2SwapQ(g,put,sw){ claim(sw.take); reserve(sw.dest);
  return [lock(g),...pick(g,sw.o,sw.take),...place(g,put,sw.dest),...unlock(g)]; }
// ¿Algún banco espera pieza que alimentación no tiene lista, y hay piezas en el Bufer 1? (→ usar el vacío para sacar una)
const g1NeedsB1Raw=()=>!avail(S.ALIM,'raw')&&!!b1With('raw')&&(bk1CanTake()||bk2WantsRaw());

// ---- Bufer 1: SIEMPRE lleno (15 pallets, con pieza o vacíos). Toda visita es un INTERCAMBIO en la misma
// posición: un brazo saca el pallet y el otro deja el que trae. B entra en L, A en vertical.
// Plan para que G1 quede con una pieza sin procesar en la mano: {arm, src, q()} o null.
// arm = brazo que queda con la pieza. q() marca (claim) los pallets y devuelve las acciones.
function planRawG1(g){
  // (alimentación NO: ahí solo se toma la pieza por intercambio, trayendo un vacío → ver g1EmptyOut)
  const r=b1With('raw'); if(!r) return null;
  const e=emptyB2forG1(); if(!e) return null;
  const ea=e.col==='L'?'A':'B', ra=otherG1(ea);   // ea trae el vacío, ra saca la pieza
  return {arm:ra,src:'B1',r,e,q:()=>{claim(r);claim(e);
    return [lock(g),...pick(g,ea,e),...unlock(g),...pick(g,ra,r),...place(g,ea,r,false)];}};
}
const srcTxt=pl=>pl.src==='ALIM'?'de alimentación':'del Bufer 1, por intercambio con un vacío del Bufer 2';

// ===== G1: pasos dinámicos =====
// Dentro del Bufer 2 (con candado): si el brazo `fa` quedó libre, toma un vacío de su columna para alimentación.
function g1TakeEmptyAtB2(g,fa){ return {t:'dyn',fn:()=>{
  if(g.hold[fa]) return [];
  const e=emptyB2In(colOf(fa)); if(!e) return [];
  const forB1=g1NeedsB1Raw();
  // G1 siempre se lleva un vacío: en alimentación solo puede tomar la pieza si deja un vacío a cambio
  claim(e); log(`G1: aprovecha el viaje → ${fa} toma el pallet vacío del Bufer 2 pos ${e.label} ${forB1?'para sacar una pieza del Bufer 1':'para alimentación'}.`);
  return pick(g,fa,e);
}}; }
// Acomoda lo que G1 traiga en las manos.
function g1Continue(g){ return {t:'dyn',fn:()=>{
  for(const a of g.arms){ const p=g.hold[a]; if(!p) continue;
    if(p.piece==='none') return g1EmptyOut(g,a);
    if(p.piece==='raw') return g1RawOut(g,a);
  }
  for(const a of g.arms){ const p=g.hold[a]; if(p&&p.piece==='done') return g1DoneOut(g,a); }
  return [];
}}; }
// G1 trae un vacío en `ea`. Prioridad:
//  1) alimentación con pieza lista → intercambio ahí (toma la nueva, deja el vacío);
//  2) Banco 1 terminó y no hay pieza nueva → intercambio en el banco (saca la probada, deja el vacío) y la probada al nivel 5;
//  3) un banco espera pieza y alimentación no la tiene → intercambio en el Bufer 1 (deja el vacío, saca una pieza);
//  4) alimentación libre → deja el vacío para que el operador cargue.
function g1EmptyOut(g,ea){
  const oa=otherG1(ea), bk=S.BK1;
  if(avail(S.ALIM,'raw') && !g.hold[oa] && g1RawHasDest(oa)){ claim(S.ALIM);
    log(`G1: intercambio en alimentación → ${oa} toma la pieza nueva y ${ea} deja el vacío.`);
    return [...pick(g,oa,S.ALIM),{t:'call',fn:()=>reserve(S.ALIM)},...place(g,ea,S.ALIM,false),g1Continue(g)]; }
  if(!bk.fault && !g.hold[oa] && bk1Done() && !avail(S.ALIM,'raw') && lvl5Accepts(oa,true)){ claim(bk); reserve(bk);
    log(`G1: Banco 1 terminó y no hay pieza nueva → ${oa} saca la probada y ${ea} deja el vacío en el banco.`);
    return [mv({gy:bk.y},`${g.name} viaja en Y al Banco 1`),...pick(g,oa,bk,false),...place(g,ea,bk,false),...g1Lvl5(g,oa)]; }
  if(!g.hold[oa] && g1NeedsB1Raw()){ const r=b1With('raw'); claim(r);
    log(`G1: un banco espera pieza y alimentación no está lista → intercambio en Bufer 1 pos ${r.label}: ${oa} saca la pieza y ${ea} deja el vacío.`);
    return [...pick(g,oa,r),...place(g,ea,r,false),g1Continue(g)]; }
  if(alimFree()){ reserve(S.ALIM); return place(g,ea,S.ALIM); }
  const d=b2Free(ea); if(d){ reserve(d); return [lock(g),...place(g,ea,d),...unlock(g)]; }
  return [waitFor(()=>alimFree()||avail(S.ALIM,'raw')||b2Free(ea)||(!bk.fault&&!g.hold[oa]&&bk1Done()&&lvl5Accepts(oa,true)),`${ea} espera dónde dejar el pallet vacío`,null),{t:'dyn',fn:()=>g1EmptyOut(g,ea)}];
}
// Traspaleo en el nivel 5: `o` trae la probada. Si G2 dejó un vacío en el nivel 5, el otro brazo lo saca primero
// y `o` deja la probada en ese mismo nivel, en su columna. Después, si conviene, cambia el vacío de gripper (niveles 1–4).
function g1Lvl5(g,o){
  const ra=otherG1(o), d=lv5(colOf(o)), e=lv5(colOf(ra)); reserve(d);
  const take=avail(e,'none')&&!g.hold[ra]; if(take) claim(e);
  return [lock(g),...(take?pick(g,ra,e):[]),...place(g,o,d),take?g1FixEmptyArm(g,ra):g1TakeEmptyAtB2(g,ra),...unlock(g),g1Continue(g)];
}
// Cambio de gripper en el Bufer 2 (niveles 1–4): el vacío que sacó `ea` del nivel 5 pasa al otro brazo,
// para que `ea` quede libre y tome la próxima pieza nueva (así el ciclo se repite con los mismos brazos).
function g1FixEmptyArm(g,ea){ return {t:'dyn',fn:()=>{
  const o=otherG1(ea); if(!g.hold[ea]||g.hold[o]) return [];
  const sw=b2SwapWith(g,ea,s=>s.pallet.piece==='none'); if(!sw) return [];
  claim(sw.take); reserve(sw.dest);
  log(`G1: cambio de gripper en Bufer 2 nivel ${sw.take.level} → ${o} toma un vacío y ${ea} deja el suyo.`);
  return [...pick(g,o,sw.take),...place(g,ea,sw.dest)];
}}; }
// Cambio rápido en Banco 1 cuando `ra` ya trae la pieza nueva: el otro brazo saca la probada y la lleva al nivel 5.
function g1BankSwap(g,ra){
  const o=otherG1(ra), bk=S.BK1;
  claim(bk); reserve(bk);
  return [mv({gy:bk.y},`${g.name} viaja en Y al Banco 1`),...pick(g,o,bk,false),...place(g,ra,bk,false),...g1Lvl5(g,o)];
}
// G1 trae una probada en `a` (p. ej. después de un intercambio en el banco): al nivel 5.
function g1DoneOut(g,a){
  const o=otherG1(a);
  if(lvl5Accepts(a,!g.hold[o])) return g1Lvl5(g,a);
  return [waitFor(()=>lvl5Accepts(a,!g.hold[o]),`${a} espera lugar en el nivel 5 del Bufer 2`,null),{t:'dyn',fn:()=>g1DoneOut(g,a)}];
}
// G1 trae una pieza nueva en `ra`: Banco 1 → Bufer 2 (piezas listas para G2) → Bufer 1 (intercambio con un vacío).
function g1RawOut(g,ra){
  const o=otherG1(ra), bk=S.BK1;
  if(bk1CanTake()){ reserve(bk); return place(g,ra,bk); }
  if(!bk.fault && !g.hold[o] && bk1Done()){
    if(lvl5Accepts(o,true)){ log(`G1: Banco 1 terminó → cambio rápido con la pieza que trae ${ra}.`); return g1BankSwap(g,ra); }
    // la probada quedaría en la columna equivocada del nivel 5 → cambio de gripper de la pieza nueva (niveles 1–4)
    const sw=lvl5Accepts(ra,true)?b2SwapWith(g,ra,s=>s.pallet.piece==='raw'):null;
    if(sw){ log(`G1: cambio de gripper en Bufer 2 nivel ${sw.take.level} → ${sw.o} toma una pieza nueva y ${ra} deja la suya (para el cambio rápido en Banco 1).`);
      return [...b2SwapQ(g,ra,sw),g1Continue(g)]; }
    const r1=lvl5Accepts(ra,true)?b1With('raw'):null;   // respaldo: el cambio se hace en el Bufer 1
    if(r1){ claim(r1); log(`G1: cambio de gripper en Bufer 1 pos ${r1.label} → ${o} toma una pieza y ${ra} deja la suya (para el cambio rápido en Banco 1).`);
      return [...pick(g,o,r1),...place(g,ra,r1,false),g1Continue(g)]; }
  }
  if(bk2WantsRaw()){
    const sw=b2SwapWith(g,ra,s=>s.pallet.piece==='none');
    if(sw){ log(`G1: intercambio en Bufer 2 nivel ${sw.take.level} → ${sw.o} saca el vacío y ${ra} deja la pieza nueva para el Banco 2.`);
      return [...b2SwapQ(g,ra,sw),g1Continue(g)]; }
    const d=b2Free(ra); if(d){ reserve(d);
    log(`G1: Banco 2 necesita pieza → ${ra} la deja en el Bufer 2 pos ${d.label}.`);
    return [lock(g),...place(g,ra,d),g1TakeEmptyAtB2(g,ra),...unlock(g),g1Continue(g)]; }
    // vacíos solo en la columna de `ra` → cambio de gripper (toma una pieza con el otro brazo) para poder intercambiar
    const ch=b2CanSwap(o,s=>s.pallet.piece==='none')?b2SwapWith(g,ra,s=>s.pallet.piece==='raw'):null;
    if(ch){ log(`G1: cambio de gripper en Bufer 2 nivel ${ch.take.level} → ${ch.o} toma una pieza y ${ra} deja la suya.`);
      return [...b2SwapQ(g,ra,ch),g1Continue(g)]; }
    const r1=!g.hold[o]&&b2CanSwap(o,s=>s.pallet.piece==='none')?b1With('raw'):null;
    if(r1){ claim(r1); log(`G1: cambio de gripper en Bufer 1 pos ${r1.label} → ${o} toma una pieza y ${ra} deja la suya (en el Bufer 2 no se pudo).`);
      return [...pick(g,o,r1),...place(g,ra,r1,false),g1Continue(g)]; }
  }
  const f=!g.hold[o]?b1With('none'):null;
  if(f){ claim(f); log(`G1: el Bufer 1 acumula → ${ra} deja la pieza en pos ${f.label} y ${o} saca el vacío.`);
    return [...pick(g,o,f),...place(g,ra,f,false),g1Continue(g)]; }
  return [waitFor(()=>bk1CanTake()||(!bk.fault&&!g.hold[o]&&bk1Done()&&(lvl5Accepts(o,true)||(lvl5Accepts(ra,true)&&(b2SwapWith(g,ra,s=>s.pallet.piece==='raw')||b1With('raw')))))||(bk2WantsRaw()&&(b2Free(ra)||b2SwapWith(g,ra,s=>s.pallet.piece==='none')||b2SwapWith(g,ra,s=>s.pallet.piece==='raw')||(!g.hold[o]&&b2CanSwap(o,s=>s.pallet.piece==='none')&&b1With('raw'))))||(!g.hold[o]&&b1With('none')),
    `${ra} espera con pieza nueva (Banco 1, Bufer 2 o Bufer 1)`,null),{t:'dyn',fn:()=>g1RawOut(g,ra)}];
}

// ¿De dónde saca G1 un vacío para llevar a alimentación? Banco 1 (pallet vacío) → nivel 5 → niveles 1–4 del Bufer 2.
function g1EmptySource(){
  const bk=S.BK1;
  if(!bk.fault&&!bk.res&&avail(bk,'none')) return {s:bk,arm:'A',txt:'del Banco 1'};
  for(const c of ['L','R']){ const s=lv5(c); if(avail(s,'none')) return {s,arm:c==='L'?'A':'B',b2:true,txt:`del Bufer 2 pos ${s.label} (nivel 5)`}; }
  const e=emptyB2forG1(); if(e) return {s:e,arm:e.col==='L'?'A':'B',b2:true,txt:`del Bufer 2 pos ${e.label}`};
  return null;
}
function decideG1(g){
  if(holding(g)) return {rule:'G1 trae un pallet en la mano → lo acomoda.',q:[g1Continue(g)]};
  const bk=S.BK1, p=bk.pallet;
  // 0: en alimentación SIEMPRE es intercambio (toma la pieza, deja un vacío) → si G1 no trae vacío, primero va por uno
  const ap=S.ALIM.pallet;
  if(ap&&!ap.claimed){ const src=g1EmptySource();
    if(src&&(src.s===bk||g1RawHasDest(otherG1(src.arm))||bk1Done())){ claim(src.s);
      return {rule:`Para tomar la pieza de alimentación hay que dejar un vacío → ${src.arm} toma un pallet vacío ${src.txt}.`,
        q:[...(src.b2?[lock(g),...pick(g,src.arm,src.s),...unlock(g)]:pick(g,src.arm,src.s)),g1Continue(g)]}; } }
  // 1: Banco 1 terminó y nivel 5 libre → cambio rápido; la probada va al nivel 5 y el brazo libre trae un vacío
  if(bk1DoneReady()){
    const pl=!bk.fault?planRawG1(g):null;
    if(pl){ let ra=pl.arm;
      if(pl.src==='ALIM'&&!lvl5Accepts(otherG1(ra),true)) ra=otherG1(ra);   // alimentación: toma la pieza el brazo que deja bien el nivel 5
      if(lvl5Accepts(otherG1(ra),true)){ const o=otherG1(ra);
        const q=pl.src==='ALIM'?(claim(S.ALIM),pick(g,ra,S.ALIM)):pl.q();
        return {rule:`Banco 1 terminó y hay pieza nueva ${srcTxt(pl)} → CAMBIO RÁPIDO: ${ra} trae la nueva y ${o} saca la probada al nivel 5 (traspaleo); ${ra} saca el vacío que dejó G2.`,
          q:[...q,...g1BankSwap(g,ra)]}; }
    }
    const o=['A','B'].find(x=>lvl5Accepts(x,true)); claim(bk);
    return {rule:`Banco 1 terminó (no hay pieza nueva lista) → ${o} saca la probada al nivel 5 del Bufer 2 (traspaleo).`,
      q:[...pick(g,o,bk),...g1Lvl5(g,o)]};
  }
  // 2: Banco 1 con pallet vacío
  if(p && !p.claimed && p.piece==='none'){
    const r=!bk.fault?b1With('raw'):null;
    if(r){ claim(bk); claim(r); reserve(bk);
      return {rule:`Banco 1 tiene pallet vacío → A lo lleva al Bufer 1 pos ${r.label}: B saca la pieza, A deja el vacío y B carga el banco.`,
        q:[...pick(g,'A',bk),...pick(g,'B',r),...place(g,'A',r,false),...place(g,'B',bk)]};
    }
    if(alimFree()){ claim(bk); reserve(S.ALIM); return {rule:'Banco 1 tiene pallet vacío → A lo regresa a alimentación.',q:[...pick(g,'A',bk),...place(g,'A',S.ALIM)]}; }
    const d=b2Free('A'); if(d){ claim(bk); reserve(d); return {rule:'Banco 1 tiene pallet vacío → A lo sube al Bufer 2.',q:[...pick(g,'A',bk),lock(g),...place(g,'A',d),...unlock(g)]}; }
  }
  // 3: Banco 1 vacío → cargarlo
  if(!p && !bk.res && !bk.fault){ const pl=planRawG1(g);
    if(pl){ reserve(bk);
      return {rule:`Banco 1 vacío → ${pl.arm} lo carga con pieza sin procesar ${srcTxt(pl)}.`,q:[...pl.q(),...place(g,pl.arm,bk)]};} }
  // 4: Banco 1 ocupado y Banco 2 necesita pieza → mandarla al Bufer 2 y traer un vacío de regreso
  if(bk2WantsRaw()){
    const pl=planRawG1(g);
    if(pl){ // si sale del Bufer 1, el vacío que se tomó del Bufer 2 deja libre su nivel: la pieza va ahí
      let d=pl.src==='ALIM'?b2Free(pl.arm):b2slot(pl.e.level,colOf(pl.arm));
      if(d&&(d.pallet||d.res)) d=null;
      if(d){ const q=pl.q(); reserve(d);
        return {rule:`Banco 1 ocupado y Banco 2 necesita pieza → ${pl.arm} manda una sin procesar ${srcTxt(pl)} al Bufer 2 (${colOf(pl.arm)==='R'?'columna derecha, en L':'columna izquierda, vertical'}) y aprovecha para traer un vacío.`,
          q:[...q,lock(g),...place(g,pl.arm,d),g1TakeEmptyAtB2(g,pl.arm),...unlock(g),g1Continue(g)]};}
    }
  }
  // 6: Regresar vacío del Bufer 2 a alimentación
  if(alimFree()){
    const e=emptyB2forG1();
    if(e){const arm=e.col==='L'?'A':'B'; claim(e);reserve(S.ALIM);
      return {rule:`Hay pallet vacío en el Bufer 2 y alimentación libre → ${arm} lo regresa para cargar otra pieza.`,q:[lock(g),...pick(g,arm,e),...unlock(g),...place(g,arm,S.ALIM)]};}
  }
  return null;
}

// ===== G2: pasos dinámicos =====
// Descarga: 2 espacios pero SIEMPRE un solo pallet. G2 toma el vacío de un espacio y deja la pieza en el otro.
const dFreeSpot=()=>[S.D1,S.D2].find(s=>!s.pallet&&!s.res)||null;
const dEmptySpot=()=>[S.D1,S.D2].find(s=>avail(s,'none'))||null;
const dCount=()=>[S.D1,S.D2].filter(s=>s.pallet||s.res).length;
const bk2Park=()=>(!S.BK2.pallet&&!S.BK2.res&&!S.BK2.fault)?S.BK2:null;
// ¿Puede G2 recibir una pieza nueva? (Banco 2 libre, o con pallet listo para cambio rápido)
const g2RawCanGo=()=>!S.BK2.fault&&!S.BK2.res&&(!S.BK2.pallet||(!S.BK2.pallet.claimed&&S.BK2.pallet.piece!=='raw'));
// ¿Puede G2 entregar en descarga una pieza que trae en `arm`? (el otro brazo toma el vacío; la pieza va al otro espacio)
const g2CanDeliver=arm=>!!dFreeSpot()&&((!!dEmptySpot()&&!G.G2.hold[otherG2(arm)])||dCount()===0);
// Entrega en descarga. `parkOK` permite dejar el vacío en Banco 2 aunque hoy esté ocupado (G2 lo está vaciando en esta tarea).
// Si el vacío no tiene a dónde ir, G2 se queda con él en un gripper. Reserva al decidir. Devuelve acciones o null.
function g2Deliver(g,arm,parkOK){
  const o=otherG2(arm), de=dEmptySpot(), df=dFreeSpot();
  if(de && df && !g.hold[o]){ claim(de); reserve(df);
    const q=[...pick(g,o,de),...place(g,arm,df)];
    const dest=b2Free(o)||bk2Park()||(parkOK&&!S.BK2.fault?S.BK2:null);
    if(dest){ reserve(dest);
      if(dest===S.BK2) q.push(...place(g,o,S.BK2));
      else q.push(lock(g),...place(g,o,dest),g2PickAtB2(g),...unlock(g),g2Continue(g)); }
    else q.push(g2Continue(g));
    return q; }
  if(dCount()===0 && df){ reserve(df); return place(g,arm,df); }
  return null;
}
// Dentro del Bufer 2 (con candado), con las manos libres: toma la pieza probada del nivel 5 (para descarga)
// o una pieza nueva para el Banco 2 si está libre.
function g2PickAtB2(g){ return {t:'dyn',fn:()=>{
  const done=B2().find(s=>avail(s,'done'));
  if(done){ const a=armG2(done); if(!g.hold[a]&&g2CanDeliver(a)){ claim(done);
    log(`G2: aprovecha el viaje → ${a} toma la pieza probada del Bufer 2 pos ${done.label} para descarga.`); return pick(g,a,done);} }
  const raw=B2().find(s=>s.level<=4&&avail(s,'raw'));
  if(raw && bk2Park()){ const a=armG2(raw); if(!g.hold[a]){ claim(raw); reserve(S.BK2);
    log(`G2: aprovecha el viaje → ${a} toma la pieza nueva del Bufer 2 pos ${raw.label} para el Banco 2.`); return pick(g,a,raw);} }
  return [];
}}; }
// G2 con un vacío en `a`: ¿qué puede hacer? Devuelve acciones (y marca/reserva) o null. `dry` = solo preguntar.
function g2EmptyOpts(g,a,dry){
  const o=otherG2(a), free=!g.hold[o];
  // 1) lugar libre en Bufer 2 o Banco 2 libre
  const d=b2Free(a)||bk2Park();
  if(d){ if(dry) return true; reserve(d);
    return d===S.BK2?place(g,a,d):[lock(g),...place(g,a,d),g2PickAtB2(g),...unlock(g),g2Continue(g)]; }
  // 2) traspaleo en nivel 5: `o` saca la probada del G1 y `a` deja el vacío en ese nivel, en su columna
  const t=lv5(colOf(o)), tv=lv5(colOf(a));
  if(free&&avail(t,'done')&&!tv.pallet&&!tv.res){ if(dry) return true; claim(t); reserve(tv);
    log(`G2: traspaleo en nivel 5 → ${o} saca la pieza probada del G1 y ${a} deja el vacío.`);
    return [lock(g),...pick(g,o,t),...place(g,a,tv),...unlock(g),g2Continue(g)]; }
  // 3) intercambio en niveles 1–4: `o` saca una pieza nueva y `a` deja el vacío
  const sw=g2RawCanGo()?b2SwapWith(g,a,s=>s.pallet.piece==='raw'):null;
  if(sw){ if(dry) return true; log(`G2: intercambio en Bufer 2 nivel ${sw.take.level} → ${sw.o} saca la pieza nueva y ${a} deja el vacío.`);
    return [...b2SwapQ(g,a,sw),g2Continue(g)]; }
  // 4) Banco 2 terminó → `o` saca la probada y `a` deja el vacío en el banco
  const bp=S.BK2.pallet;
  if(free&&!S.BK2.fault&&!S.BK2.res&&bp&&!bp.claimed&&bp.piece==='done'){ if(dry) return true; claim(S.BK2); reserve(S.BK2);
    log(`G2: Banco 2 terminó → ${o} saca la probada y ${a} deja el vacío en el banco.`);
    return [mv({gy:S.BK2.y},'G2 viaja en Y al Banco 2'),...pick(g,o,S.BK2,false),...place(g,a,S.BK2,false),g2Continue(g)]; }
  // 5) cambio de gripper en niveles 1–4: el vacío pasa al otro brazo si eso permite el traspaleo o tomar una pieza nueva
  const needFlip=(avail(tv,'done')&&!t.pallet&&!t.res)||(g2RawCanGo()&&b2CanSwap(o,s=>s.pallet.piece==='raw'));
  const ch=free&&needFlip?b2SwapWith(g,a,s=>s.pallet.piece==='none'):null;
  if(ch){ if(dry) return true; log(`G2: cambio de gripper en Bufer 2 nivel ${ch.take.level} → ${ch.o} toma un vacío y ${a} deja el suyo.`);
    return [...b2SwapQ(g,a,ch),g2Continue(g)]; }
  // si en el Bufer 2 no se puede, el cambio se hace sobre el vacío de descarga o del Banco 2 (mismo lugar, sigue habiendo un pallet)
  if(free&&needFlip){
    const bkE=S.BK2.pallet&&!S.BK2.fault&&!S.BK2.res&&avail(S.BK2,'none')?S.BK2:null;
    const sp=dEmptySpot()||bkE;
    if(sp){ if(dry) return true; claim(sp);
      log(`G2: cambio de gripper en ${sp===S.BK2?'Banco 2':'descarga '+sp.label} → ${o} toma ese vacío y ${a} deja el suyo en el mismo lugar.`);
      return [...pick(g,o,sp),{t:'call',fn:()=>reserve(sp)},...place(g,a,sp,false),g2Continue(g)]; }
  }
  return dry?false:null;
}
// Acomoda lo que G2 traiga en las manos.
function g2Continue(g){ return {t:'dyn',fn:()=>{
  for(const a of g.arms){ const p=g.hold[a]; if(!p) continue;
    if(p.piece==='done'){ const q=g2Deliver(g,a,false); if(q) return q;
      return [waitFor(()=>g2CanDeliver(a),`${a} espera el vacío en descarga`,null),g2Continue(g)]; }
    if(p.piece==='raw'){ if(S.BK2.res&&!S.BK2.pallet) return place(g,a,S.BK2);
      const o=otherG2(a), bp=S.BK2.pallet;
      if(!S.BK2.fault&&!g.hold[o]&&bp&&!bp.claimed&&bp.piece!=='raw'&&!S.BK2.res){ claim(S.BK2); reserve(S.BK2);
        log(`G2: cambio rápido en Banco 2 → ${o} saca el pallet y ${a} mete la pieza nueva.`);
        return [mv({gy:S.BK2.y},'G2 viaja en Y al Banco 2'),...pick(g,o,S.BK2,false),...place(g,a,S.BK2,false),g2Continue(g)]; }
      if(bk2Park()){ reserve(S.BK2); return place(g,a,S.BK2); }
      const d=b2Free(a); if(d){ reserve(d); return [lock(g),...place(g,a,d),...unlock(g)]; }
      return [waitFor(()=>bk2Park()||b2Free(a)||(S.BK2.pallet&&!S.BK2.pallet.claimed&&S.BK2.pallet.piece!=='raw'&&!g.hold[otherG2(a)]),`${a} espera dónde dejar la pieza`,null),g2Continue(g)]; }
    if(p.piece==='none'){ const q=g2EmptyOpts(g,a,false); if(q) return q;
      return [waitFor(()=>g2EmptyOpts(g,a,true),`${a} espera con el vacío (Bufer 2 o Banco 2)`,null),g2Continue(g)]; }
  }
  return [];
}}; }

function decideG2(g){
  if(holding(g)) return {rule:'G2 trae un pallet en la mano → lo acomoda.',q:[g2Continue(g)]};
  const bk=S.BK2, p=bk.pallet;
  const rawB2=B2().find(s=>s.level<=4&&avail(s,'raw'));
  const doneB2=B2().find(s=>avail(s,'done'));
  // 0: Descarga sin espacio libre, con vacío, y nada que entregar → retirar el vacío (y aprovechar el viaje al Bufer 2)
  const de=dEmptySpot();
  if(!dFreeSpot() && de && !(p&&p.piece==='done') && !doneB2){
    for(const arm of ['D','C']){
      const dest=b2Free(arm)||bk2Park();
      if(dest){ claim(de); reserve(dest);
        const q=[...pick(g,arm,de)];
        if(dest===bk) q.push(...place(g,arm,bk)); else q.push(lock(g),...place(g,arm,dest),g2PickAtB2(g),...unlock(g),g2Continue(g));
        return {rule:`Descarga sin espacio libre → ${arm} retira el pallet vacío y lo deja en ${dest===bk?'el Banco 2 (libre)':'el Bufer 2'}.`,q};
      }
    }
  }
  // 1: Banco 2 terminó
  if(p && !p.claimed && p.piece==='done'){
    if(rawB2 && !bk.fault){ const a=armG2(rawB2), o=otherG2(a);
      if(g2CanDeliver(o)){ claim(bk); claim(rawB2); reserve(bk);
        const head=[lock(g),...pick(g,a,rawB2),...unlock(g),mv({gy:bk.y},'G2 viaja en Y al Banco 2'),...pick(g,o,bk,false),...place(g,a,bk,false)];
        const tail=g2Deliver(g,o,false);
        return {rule:`Banco 2 terminó y hay pieza en Bufer 2 → CAMBIO RÁPIDO: ${a} trae la nueva y ${o} saca la probada; en descarga, ${a} toma el vacío de un espacio y ${o} deja la probada en el otro.`,
          q:[...head,...tail]};}
    }
    if(g2CanDeliver('D')||(dEmptySpot()&&!bk.fault)){ claim(bk);
      const tail=g2Deliver(g,'D',true);
      if(tail) return {rule:'Banco 2 terminó → D saca la probada; en descarga C toma el vacío y D deja la probada (intercambio).',q:[...pick(g,'D',bk),...tail]};
      p.claimed=false;
    }
  }
  // 2: Banco 2 con pallet vacío o vacío
  if(rawB2 && !bk.fault && !bk.res){
    if(p && !p.claimed && p.piece==='none'){
      const a=armG2(rawB2), o=otherG2(a), same=b2slot(rawB2.level,colOf(o));
      const d=b2Free(o)||((!same.pallet&&!same.res)?same:null);   // si no hay nivel libre: el que deja la pieza nueva
      if(d){ claim(rawB2); claim(bk); reserve(bk); reserve(d);
        return {rule:`Banco 2 tiene pallet vacío → ${a} trae pieza sin procesar, ${o} saca el vacío y lo sube al Bufer 2.`,
          q:[lock(g),...pick(g,a,rawB2),...unlock(g),mv({gy:bk.y},'G2 viaja en Y al Banco 2'),...pick(g,o,bk,false),...place(g,a,bk,false),lock(g),...place(g,o,d),g2PickAtB2(g),...unlock(g),g2Continue(g)]};}
    }
    if(!p){ const a=armG2(rawB2); claim(rawB2); reserve(bk);
      return {rule:`Banco 2 vacío → ${a} trae la pieza sin procesar del Bufer 2.`,q:[lock(g),...pick(g,a,rawB2),...unlock(g),...place(g,a,bk)]};}
  }
  // 2b: Bufer 2 sin ningún nivel libre (1–4), lleno de vacíos, y G1 no puede dejar piezas → G2 saca un vacío al Banco 2 libre
  if(bk2Park() && ![1,2,3,4].some(pairFree) && bk2WantsRaw() && !rawB2){
    const e=B2().filter(s=>s.level<=4&&avail(s,'none')).sort((x,y)=>y.level-x.level)[0];
    if(e){ const a=armG2(e); claim(e); reserve(bk);
      return {rule:`Bufer 2 lleno de vacíos → ${a} estaciona uno en el Banco 2 para dejar lugar a una pieza nueva.`,q:[lock(g),...pick(g,a,e),...unlock(g),...place(g,a,bk)]}; }
  }
  // 3: Pieza probada en Bufer 2 (traspaleo) → descarga, con intercambio
  if(doneB2){ const a=armG2(doneB2);
    if(g2CanDeliver(a)){ claim(doneB2);
      const head=[lock(g),...pick(g,a,doneB2),...unlock(g)];
      const tail=g2Deliver(g,a,false);
      return {rule:`Pieza probada en Bufer 2 pos ${doneB2.label} (traspaleo) → ${a} la lleva a descarga; ahí ${otherG2(a)} toma el vacío de un espacio y ${a} deja la pieza en el otro.`,q:[...head,...tail]};}
  }
  return null;
}
