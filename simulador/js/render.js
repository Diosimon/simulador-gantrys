// render.js — Dibujo isométrico en canvas (proyección X/Y/Z, estaciones, gantrys, etiquetas).
// Se carga como script clásico (sin módulos) para que funcione abriendo index.html directo.

// ===== canvas =====
const cv=document.getElementById('cv'), ctx=cv.getContext('2d');
let CW=400,CH=420,DPR=1;
function resize(){
  CW=cv.parentElement.clientWidth; CH=Math.round(Math.min(CW*1.08, window.innerHeight*0.62)); if(CH<CW*0.75)CH=Math.round(CW*0.75);
  DPR=window.devicePixelRatio||1; cv.width=CW*DPR; cv.height=CH*DPR; cv.style.height=CH+'px'; ctx.setTransform(DPR,0,0,DPR,0,0);
}
window.addEventListener('resize',resize); resize();

const CAMS={all:{yc:6.4,kf:12.6},g1:{yc:3.6,kf:6.6},b2:{yc:8.1,kf:4.4},g2:{yc:11.0,kf:5.4}};
let camKey='all', cam={yc:6.4,k:CW/12.6};
function camTarget(){const c=CAMS[camKey]; return {yc:c.yc,k:CW/c.kf};}
function P(x,y,z){
  let u=(y-cam.yc)*0.88-x*0.50; if(ESPEJO) u=-u;   // espejo: Bufer 1 a la derecha, Descarga a la izquierda
  const v=(y-cam.yc)*0.34+x*0.40-z*0.92;
  const cy0=CH*0.50+cam.k*2.10;
  return [CW/2+cam.k*u, cy0+cam.k*v];
}
const rgba=(c,a=1)=>`rgba(${c[0]*255|0},${c[1]*255|0},${c[2]*255|0},${a})`;
const sh=(c,f)=>[c[0]*f,c[1]*f,c[2]*f];
function poly(pts,col,a=1){ctx.beginPath();pts.forEach((p,i)=>{const s=P(...p);i?ctx.lineTo(s[0],s[1]):ctx.moveTo(s[0],s[1]);});ctx.closePath();ctx.fillStyle=rgba(col,a);ctx.fill();}
function box(x0,x1,y0,y1,z0,z1,col,a=1){
  poly([[x1,y0,z0],[x1,y1,z0],[x1,y1,z1],[x1,y0,z1]],sh(col,.80),a);
  poly([[x0,y1,z0],[x1,y1,z0],[x1,y1,z1],[x0,y1,z1]],sh(col,.62),a);
  poly([[x0,y0,z1],[x1,y0,z1],[x1,y1,z1],[x0,y1,z1]],col,a);
}
function line3(a,b,col,w,al=1){const p=P(...a),q=P(...b);ctx.beginPath();ctx.moveTo(p[0],p[1]);ctx.lineTo(q[0],q[1]);ctx.strokeStyle=rgba(col,al);ctx.lineWidth=w;ctx.stroke();}
function rr(x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();}
function tag(sx,sy,s,bg,fg,size=12){
  ctx.font=`600 ${size}px Oswald, sans-serif`; const w=ctx.measureText(s).width+12;
  rr(sx-w/2,sy-size-2,w,size+7,4); ctx.fillStyle=bg; ctx.fill(); ctx.fillStyle=fg; ctx.textAlign='center'; ctx.fillText(s,sx,sy+1);
}

// ===== drawing =====
function pallet3(x,y,z,piece,a=1){
  box(x-.40,x+.40,y-.30,y+.30,z,z+.11,C.wood,a);
  if(piece==='none')return;
  const col=piece==='done'?C.gr:C.raw;
  box(x-.26,x+.26,y-.20,y+.20,z+.11,z+.34,col,a);
  box(x-.12,x+.12,y-.09,y+.09,z+.34,z+.40,sh(col,.75),a);
}
function floor(){
  poly([[1.9,-0.8,0],[1.9,13.8,0],[-1.9,13.8,0],[-1.9,-0.8,0]],[.17,.18,.21]);
  for(let y=0;y<14;y++) line3([1.9,y-.3,0],[-1.9,y-.3,0],[1,1,1],1,.05);
  line3([1.75,-0.8,0],[1.75,13.8,0],C.ye,2,.6);
}
const POSTS=[-0.5,5.05,9.3,13.5];
// Riel único (eje Y): viga gris atrás de las estaciones, sobre postes. Los dos gantrys corren sobre ella.
const RAIL_X=-2.0, RAIL_Z0=4.05, RAIL_Z1=4.55;
function rail(){
  POSTS.forEach(py=>{ box(RAIL_X-.12,RAIL_X+.12,py-.12,py+.12,0,RAIL_Z0,[.50,.52,.56]); box(RAIL_X-.22,RAIL_X+.22,py-.22,py+.22,0,.06,[.40,.42,.45]); });
  box(RAIL_X-.22,RAIL_X+.22,-0.9,13.9,RAIL_Z0,RAIL_Z1,[.56,.58,.62]);                 // viga
  box(RAIL_X-.16,RAIL_X+.16,-0.9,13.9,RAIL_Z1,RAIL_Z1+.05,[.78,.80,.83]);             // guía lineal arriba
}
function towerCol(slots,yc,half,first,last,y0,y1,kind){
  const zt=2.95, x0=-.52,x1=.52;
  if(first) box(x0-.03,x0+.03,y0-.03,y0+.03,0,zt,C.frame);
  for(let n=5;n>=1;n--){
    const s=slots.find(q=>q.level===n); const z=LV(n);
    const hi=kind==='B2'&&n===5;
    box(x0,x1,yc-half,yc+half,z-.04,z,hi?[.95,.62,.25]:[.55,.58,.63],.95);
    if(s.pallet){ pallet3(s.x,s.y,s.z,s.pallet.piece);
      if(kind==='B2'&&pairOf(s).pallet){ const a=P(.4,s.y-.3,s.z),b=P(.4,s.y+.3,s.z+.45); ctx.strokeStyle='#ee4d47';ctx.lineWidth=3;ctx.strokeRect(Math.min(a[0],b[0])-4,Math.min(a[1],b[1])-4,Math.abs(b[0]-a[0])+8,Math.abs(b[1]-a[1])+8);} }
    if(s.res&&!s.pallet){ const q=P(.3,s.y,s.z+.2); ctx.fillStyle='rgba(245,197,66,.35)';ctx.beginPath();ctx.arc(q[0],q[1],Math.max(4,cam.k*.08),0,7);ctx.fill(); }
    if(cam.k>CW/7.5){ const q=P(.55,s.y,s.z+.02); tag(q[0],q[1]+cam.k*.07,s.label,'rgba(20,22,25,.85)',hi?'#f5c542':'#cfd3d8',Math.max(9,Math.min(13,cam.k*.11))); }
  }
  box(x0,x1,yc-half,yc+half,zt-.05,zt,C.frame,.9);
  if(last){ box(x1-.03,x1+.03,y0-.03,y0+.03,0,zt,C.ye); box(x1-.03,x1+.03,y1-.03,y1+.03,0,zt,C.ye); box(x0-.03,x0+.03,y1-.03,y1+.03,0,zt,C.frame); poly([[x1,y0,0],[x1,y1,0],[x1,y1,zt],[x1,y0,zt]],[.6,.75,.9],.06);}
}
function banco(s){
  const yc=s.y, p=s.pallet, working=p&&p.piece==='raw'&&!s.fault;
  box(-.6,.6,yc-.6,yc+.6,0,.95,[.58,.61,.66]);
  box(-.42,.42,yc-.40,yc+.40,.95,1.0,[.32,.34,.38]);
  box(-.6,-.30,yc-.6,yc+.6,.95,2.25,s.fault?[.75,.30,.25]:[.92,.70,.18]);
  const glow=working?[.55,.85,1]:[.2,.22,.25];
  poly([[-.30,yc-.40,1.35],[-.30,yc+.40,1.35],[-.30,yc+.40,2.05],[-.30,yc-.40,2.05]],glow,.9);
  box(-.48,-.40,yc+.42,yc+.50,2.25,2.55,[.3,.3,.32]);
  let lamp=s.fault?((simT*4|0)%2?C.re:sh(C.re,.5)):working?C.gr:C.ye;
  box(-.50,-.38,yc+.40,yc+.52,2.55,2.70,lamp);
  if(p) pallet3(0,yc,1.0,p.piece);
}
function alim(){
  const yc=4.3;
  [-.45,.45].forEach(lx=>{box(lx-.05,lx+.05,yc-.5,yc-.42,0,.62,[.4,.42,.46]);box(lx-.05,lx+.05,yc+.42,yc+.5,0,.62,[.4,.42,.46]);});
  box(-.75,.55,yc-.48,yc+.48,.62,.78,[.42,.45,.50]);
  for(let i=0;i<7;i++){const xx=-.65+i*.19; line3([xx,yc-.44,.785],[xx,yc+.44,.785],[.75,.77,.8],2,.8);}
  if(S.ALIM.pallet) pallet3(0,yc,.80,S.ALIM.pallet.piece);
  if(S.ALIM.res&&!S.ALIM.pallet){const q=P(0,yc,1);ctx.fillStyle='rgba(245,197,66,.35)';ctx.beginPath();ctx.arc(q[0],q[1],cam.k*.12,0,7);ctx.fill();}
}
function descarga(){
  box(-.55,.55,11.3,13.1,0,.7,[.45,.48,.53]);
  line3([.55,12.2,.71],[-.55,12.2,.71],[1,1,1],2,.25);
  for(const s of [S.D1,S.D2]){ if(s.pallet) pallet3(0,s.y,.7,s.pallet.piece);
    const q=P(.56,s.y,.35); tag(q[0],q[1],'ESP. '+s.label,'rgba(20,22,25,.85)','#cfd3d8',Math.max(9,Math.min(13,cam.k*.11))); }
}
// Gantry lineal: carro sobre el riel (eje Y) + brazo en voladizo (eje X) + dos columnas verticales (eje Z), una por gripper.
// Gantry lineal: riel principal (fijo) → carro del eje Y (lo comparten los 2 grippers) → encima, un eje X por gripper:
// una viga que SALE hacia el frente deslizándose sobre el carro → en su punta, la columna del eje Z con el gripper.
const XB_L=3.0, XB_Z0=RAIL_Z1+.32, XB_Z1=XB_Z0+.20, MAST_TOP=XB_Z1+.45, CAR_Z1=XB_Z0;
function drawGantry(g){
  const gy=g.v.gy, col=g.col, dark=[.13,.13,.15];
  // eje Y: carro sobre el riel principal, con su motor y la cadena portacables
  box(RAIL_X-.34,RAIL_X+.34,gy-.48,gy+.48,RAIL_Z1+.05,CAR_Z1,col);
  box(RAIL_X-.30,RAIL_X-.08,gy-.44,gy-.26,CAR_Z1,CAR_Z1+.30,dark);
  box(RAIL_X-.10,RAIL_X+.06,gy-1.0,gy-.48,RAIL_Z1+.10,RAIL_Z1+.20,dark);
  // un eje X por gripper (el de atrás A/D a un lado, el de adelante B/C al otro), en orden de profundidad
  const yo=YOFF;
  const arms=[...g.arms].sort((a,b)=>yo[a]-yo[b]);
  for(const arm of arms){
    const ax=g.v[arm+'.x'], az=g.v[arm+'.z'], p=g.hold[arm], yb=gy+yo[arm];
    // viga del eje X: se desliza sobre el carro y sale hasta la posición del gripper
    box(ax-.24-XB_L,ax-.14,yb-.11,yb+.11,XB_Z0,XB_Z1,sh(col,.95));
    box(ax-.24-XB_L,ax-.14,yb-.07,yb+.07,XB_Z1,XB_Z1+.03,[.80,.82,.85]);
    // eje Z en la punta de la viga: columna con cadena portacables, motor arriba y vástago que baja al gripper
    const mx=ax-.24;   // la columna queda atrás; el gripper sale de ella hacia el frente
    box(mx-.10,mx+.10,yb-.13,yb+.13,XB_Z0-.10,XB_Z1,sh(col,.72));   // unión X–Z
    box(mx-.045,mx+.045,yb-.045,yb+.045,az+.10,XB_Z0-.80,[.82,.84,.87]);
    box(mx-.08,mx+.08,yb-.08,yb+.08,XB_Z0-.80,MAST_TOP-.22,col);
    box(mx-.035,mx+.035,yb+.08,yb+.15,XB_Z0-.65,MAST_TOP-.30,dark);
    box(mx-.10,mx+.10,yb-.10,yb+.10,MAST_TOP-.22,MAST_TOP,dark);
    // gripper volteado hacia enfrente: placa que sale de la columna, dedos a los lados del pallet
    if(p) pallet3(ax,yb,az-GH,p.piece);
    box(mx-.08,ax+.36,yb-.10,yb+.10,az+.07,az+.14,sh(g.col,.8));
    box(ax-.30,ax+.30,yb-.34,yb+.34,az,az+.07,sh(g.col,.65));
    const jo=p?.33:.38; [-1,1].forEach(s=>box(ax-.24,ax+.24,yb+s*jo-.03,yb+s*jo+.03,az-.22,az,[.85,.87,.9]));
    const q=P(mx,yb,MAST_TOP+.32), r=Math.max(9,cam.k*.12);
    ctx.beginPath();ctx.arc(q[0],q[1],r,0,7);ctx.fillStyle='#1d1e21';ctx.fill();ctx.lineWidth=2.5;ctx.strokeStyle=rgba(g.col);ctx.stroke();
    ctx.fillStyle='#fff';ctx.font=`700 ${r*1.2}px Oswald`;ctx.textAlign='center';ctx.fillText(arm,q[0],q[1]+r*.42);
  }
  const q=P(RAIL_X,gy,CAR_Z1+.75); tag(q[0],q[1],g.name,rgba(g.col),'#1d1d1f',Math.max(11,cam.k*.16));
}
function stationTags(){
  const items=[['BUFER 1',1.5,3.25,()=>`${B1().filter(s=>s.pallet&&s.pallet.piece==='raw').length} piezas · ${B1().filter(s=>s.pallet).length}/15 pallets`],['ALIMENTACIÓN',4.3,1.4,()=>S.ALIM.pallet&&S.ALIM.pallet.piece==='none'?`CARGANDO ${Math.round(S.ALIM.timer/LOAD*100)}%`:''],
    ['BANCO 1',6.2,2.95,()=>bkTxt(S.BK1)],['BUFER 2',8.1,3.25,()=>`${B2().filter(s=>s.pallet).length}/10`],['BANCO 2',10.0,2.95,()=>bkTxt(S.BK2)],['DESCARGA',12.2,1.3,()=>`${stats.done} PZAS`]];
  for(const [n,y,z,f] of items){ const q=P(0,y,z+.35); const ex=f(); const isF=(n==='BANCO 1'&&S.BK1.fault)||(n==='BANCO 2'&&S.BK2.fault);
    tag(q[0],q[1],n+(ex?' · '+ex:''),isF?'#ee4d47':'rgba(48,52,58,.95)',isF?'#fff':'#fff',Math.max(10,Math.min(15,cam.k*.14))); }
}
function bkTxt(s){ if(s.fault) return 'FALLA'; const p=s.pallet; if(!p) return 'VACÍO'; if(p.piece==='raw') return `${Math.round(s.prog*100)}%`; if(p.piece==='done') return 'TERMINÓ'; return 'PALLET VACÍO'; }
function draw(){
  ctx.fillStyle='#23262b'; ctx.fillRect(0,0,CW,CH);
  ctx.strokeStyle='rgba(255,255,255,.035)';ctx.lineWidth=1;for(let x=0;x<CW;x+=24){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,CH);ctx.stroke();}for(let y=0;y<CH;y+=24){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(CW,y);ctx.stroke();}
  floor();
  poly([[1.6,-0.6,.01],[1.6,7.4,.01],[-1.6,7.4,.01],[-1.6,-0.6,.01]],C.or,.07);
  poly([[1.6,8.8,.01],[1.6,13.6,.01],[-1.6,13.6,.01],[-1.6,8.8,.01]],C.bl,.07);
  poly([[1.6,7.4,.01],[1.6,8.8,.01],[-1.6,8.8,.01],[-1.6,7.4,.01]],lockOwner==='G1'?C.or:lockOwner==='G2'?C.bl:[.6,.6,.6],lockOwner?.18:.06);
  rail();
  const b1=B1(), b2=B2();
  const items=[];
  for(let p=0;p<3;p++) items.push([0.5+p,()=>towerCol(b1.filter(s=>s.col===p),0.5+p,0.5,p===0,p===2,-0.05,3.05,'B1')]);
  items.push([4.3,alim]); items.push([6.2,()=>banco(S.BK1)]);
  items.push([7.75,()=>towerCol(b2.filter(s=>s.col==='L'),7.75,0.35,true,false,7.4,8.8,'B2')]);
  items.push([8.45,()=>towerCol(b2.filter(s=>s.col==='R'),8.45,0.35,false,true,7.4,8.8,'B2')]);
  items.push([10.0,()=>banco(S.BK2)]); items.push([12.2,descarga]);
  for(const g of [G.G1,G.G2]) items.push([g.v.gy+0.05,()=>drawGantry(g)]);
  items.sort((a,b)=>a[0]-b[0]).forEach(i=>i[1]());
  stationTags();
  // axes gizmo
  const ox=CW-62, oy=58, L=34; const sx=ESPEJO?-1:1; const dirs=[['X',-.50*1.2*sx,.40*1.2],['Y',.88*sx,.34],['Z',0,-1.0]];
  for(const [k,dx,dy] of dirs){const n=Math.hypot(dx,dy),ex=ox+dx/n*L,ey=oy+dy/n*L;ctx.strokeStyle='#fff';ctx.lineWidth=2.5;ctx.beginPath();ctx.moveTo(ox,oy);ctx.lineTo(ex,ey);ctx.stroke();ctx.fillStyle='#f5c542';ctx.font='700 13px Oswald';ctx.textAlign='center';ctx.fillText(k,ox+dx/n*(L+11),oy+dy/n*(L+11)+5);}
  if(!running){ctx.fillStyle='rgba(0,0,0,.45)';rr(10,10,92,26,6);ctx.fill();ctx.fillStyle='#f5c542';ctx.font='600 14px Oswald';ctx.textAlign='left';ctx.fillText(stepMode?'MODO PASO':'EN PAUSA',20,28);}
}
