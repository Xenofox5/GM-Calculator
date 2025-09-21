// script.js - auto-save to Supabase, require name at start, silent save on successful calc

// ----- REPLACE THESE if you rotate keys -----
const SUPABASE_URL = "https://hyidvehmownubiilljoi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5aWR2ZWhtb3dudWJpaWxsam9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NDY0OTMsImV4cCI6MjA3NDAyMjQ5M30.nuw3iol_2p7YBAW4HI7xC68gdLi4vbf-xPlE7K-MhU8";
// --------------------------------------------

const MAX_ALLOWED = 50;
const WEIGHTS = { eng:0.14, math:0.14, sci:0.14, ac1:0.14, ac2:0.14, oe1:0.11, oe2:0.11, pe:0.08 };
const SUBJECTS = [
  { key:'eng', pairs:[['engT1','engT1Max'],['engT2','engT2Max'],['engT3','engT3Max']] },
  { key:'math', pairs:[['mathT1','mathT1Max'],['mathT2','mathT2Max'],['mathT3','mathT3Max']] },
  { key:'sci', pairs:[['sciT1','sciT1Max'],['sciT2','sciT2Max'],['sciT3','sciT3Max']] },
  { key:'ac1', pairs:[['ac1T1','ac1T1Max'],['ac1T2','ac1T2Max'],['ac1T3','ac1T3Max']] },
  { key:'ac2', pairs:[['ac2T1','ac2T1Max'],['ac2T2','ac2T2Max'],['ac2T3','ac2T3Max']] },
  { key:'oe1', pairs:[['oe1T1','oe1T1Max'],['oe1T2','oe1T2Max'],['oe1T3','oe1T3Max']] },
  { key:'oe2', pairs:[['oe2T1','oe2T1Max'],['oe2T2','oe2T2Max'],['oe2T3','oe2T3Max']] },
  { key:'pe', pairs:[['peT1','peT1Max'],['peT2','peT2Max'],['peT3','peT3Max']] }
];

const $ = id => document.getElementById(id);

// Initialize supabase client
let supabase = null;
if (typeof window.supabase !== 'undefined' && SUPABASE_URL && SUPABASE_ANON_KEY) {
  supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  console.warn('Supabase client not available. Ensure script tag is included before script.js and keys are set.');
}

// Hide overlays on load
window.addEventListener('load', ()=> {
  $('loadingOverlay')?.classList.add('hidden'); $('loadingOverlay')?.setAttribute('aria-hidden','true');
  $('resultOverlay')?.classList.add('hidden'); $('resultOverlay')?.setAttribute('aria-hidden','true');
});

// Require name at start
const initNameInput = $('initName');
let currentUserName = '';
initNameInput?.addEventListener('input', (e)=>{
  const v = (e.target.value||'').trim();
  $('startBtn').disabled = v === '';
});
$('startBtn')?.addEventListener('click', ()=>{
  currentUserName = (initNameInput?.value||'').trim() || 'Anonymous';
  document.getElementById('hero')?.classList.add('hidden');
  document.getElementById('app')?.classList.remove('hidden');
  showStep(1);
  setTimeout(()=> $('engT1')?.focus(),160);
});

// Stepper and helpers
let step = 1;
function showStep(n) { step = Math.min(Math.max(1,n),5); document.querySelectorAll('.step').forEach(el=>el.classList.toggle('active', Number(el.dataset.step)===step)); document.querySelectorAll('.page').forEach(p=>p.classList.toggle('hidden', Number(p.dataset.step)!==step)); }

function readInt(id){ const el=$(id); if(!el) return null; const s=(el.value||'').trim(); if(s==='') return null; const n=Number(s); return Number.isFinite(n)?n:null; }
function clearInvalid(){ document.querySelectorAll('.invalid').forEach(n=>n.classList.remove('invalid')); document.querySelectorAll('.invalid-row').forEach(n=>n.classList.remove('invalid-row')); document.querySelectorAll('.input-shake').forEach(n=>n.classList.remove('input-shake')); }
function setInvalid(ids){ ids.forEach(id=>{ const el=$(id); if(!el) return; el.classList.add('invalid'); const row=el.closest('.row'); if(row){ row.classList.add('invalid-row'); el.classList.add('input-shake'); setTimeout(()=>el.classList.remove('input-shake'),300);} }); }
function pageAncestor(el){ return el ? el.closest('.page') : null; }

// VALIDATION (visible page only for Next)
function validateVisiblePage(){
  clearInvalid();
  const bad = new Set();
  const pageEl = document.querySelector(`.page[data-step="${step}"]`);
  if(!pageEl) return { ok:true, bad:[] };

  SUBJECTS.forEach(s=>{
    s.pairs.forEach(([gotId,maxId])=>{
      const gotEl=$(gotId), maxEl=$(maxId);
      if(!gotEl && !maxEl) return;
      const ancestor = pageAncestor(gotEl) || pageAncestor(maxEl);
      if(ancestor !== pageEl) return;

      const got = readInt(gotId), max = readInt(maxId);
      const termMatch = gotId.match(/T[123]$/i); const term = termMatch ? termMatch[0].toUpperCase() : '';
      const isOptional = (s.key==='math' && term==='T1');
      const isRequired = (()=>{ switch(s.key){ case 'eng': case 'sci': case 'ac1': case 'ac2': case 'pe': case 'oe1': case 'oe2': return (term==='T1'||term==='T2'); case 'math': return (term==='T2'||term==='T3'); default: return false; } })();

      if(!gotEl && maxEl) bad.add(gotId);
      if(gotEl && !maxEl) bad.add(maxId);
      if(isOptional && got===null && max===null) return;
      if(isRequired){ if((gotEl && got===null) || (maxEl && max===null)){ if(gotEl) bad.add(gotId); if(maxEl) bad.add(maxId); } }

      if(!isRequired && term==='T3' && got!==null && max===null) { /* allowed */ }
      else { if(!isRequired && got!==null && !maxEl) bad.add(maxId); }

      if(got!==null && (!Number.isFinite(got) || got<0)) bad.add(gotId);
      if(max!==null && (!Number.isFinite(max) || max<=0 || max>MAX_ALLOWED)) bad.add(maxId);
      if(got!==null && max!==null && got>max) bad.add(gotId);
    });
  });

  setInvalid(Array.from(bad));
  if(bad.size>0){ const first=Array.from(bad)[0]; const el=$(first); if(el){ el.scrollIntoView({behavior:'smooth', block:'center'}); setTimeout(()=>el.focus(),250); } }
  return { ok: bad.size===0, bad: Array.from(bad) };
}

// VALIDATE all pages before final calculation
function validateAllPagesForCalculation(){
  clearInvalid();
  const bad = new Set();
  const pages = document.querySelectorAll('.page');
  pages.forEach(pageEl=>{
    SUBJECTS.forEach(s=>{
      s.pairs.forEach(([gotId,maxId])=>{
        const gotEl=$(gotId), maxEl=$(maxId);
        if(!gotEl && !maxEl) return;
        const ancestor = pageAncestor(gotEl) || pageAncestor(maxEl);
        if(ancestor !== pageEl) return;
        const got=readInt(gotId), max=readInt(maxId);
        const termMatch = gotId.match(/T[123]$/i); const term = termMatch ? termMatch[0].toUpperCase() : '';
        const isOptional = (s.key==='math' && term==='T1');
        const isRequired = (()=>{ switch(s.key){ case 'eng': case 'sci': case 'ac1': case 'ac2': case 'pe': case 'oe1': case 'oe2': return (term==='T1'||term==='T2'); case 'math': return (term==='T2'||term==='T3'); default: return false; } })();

        if(!gotEl && maxEl) bad.add(gotId);
        if(gotEl && !maxEl) bad.add(maxId);
        if(isOptional && got===null && max===null) return;
        if(isRequired){ if((gotEl && got===null) || (maxEl && max===null)){ if(gotEl) bad.add(gotId); if(maxEl) bad.add(maxId); } }
        if(!isRequired && term==='T3' && got!==null && max===null) {}
        else { if(!isRequired && got!==null && !maxEl) bad.add(maxId); }
        if(got!==null && (!Number.isFinite(got) || got<0)) bad.add(gotId);
        if(max!==null && (!Number.isFinite(max) || max<=0 || max>MAX_ALLOWED)) bad.add(maxId);
        if(got!==null && max!==null && got>max) bad.add(gotId);
      });
    });
  });
  setInvalid(Array.from(bad));
  if(bad.size>0){ const first=Array.from(bad)[0]; const el=$(first); if(el){ el.scrollIntoView({behavior:'smooth', block:'center'}); setTimeout(()=>el.focus(),250); } }
  return { ok: bad.size===0, bad: Array.from(bad) };
}

// compute percent
function computeSubjectPercent(sub){ let sumGot=0,sumMax=0,any=false; sub.pairs.forEach(([gotId,maxId])=>{ const g=readInt(gotId), m=readInt(maxId); if(g!==null && m!==null){ sumGot+=g; sumMax+=m; any=true; } }); if(!any||sumMax===0) return null; return (sumGot/sumMax)*100; }

// gmChancePercent
function gmChancePercent(x){ const k=0.8,x0=92.0; if(x<88.5) return 0; let p=100/(1+Math.exp(-k*(x-x0))); p*=0.9; if(p>=99.99) p=99.99; return Math.round(p*100)/100; }

// animate loading
function animateLoading(targetPercent,messages=[]){ return new Promise(resolve=>{ const overlay=$('loadingOverlay'), fill=$('loadingFill'), msg=$('loadingMsg'); if(!overlay||!fill||!msg) return resolve(); overlay.classList.remove('hidden'); overlay.setAttribute('aria-hidden','false'); fill.classList.remove('errorFill'); fill.style.width='0%'; msg.textContent='Preparing...'; const total=7000, steps=messages.length; let elapsed=0, base=Math.floor(total/(steps+1)); messages.forEach((m,i)=>{ const jitter=Math.floor((Math.random()-0.5)*120); setTimeout(()=>{ msg.textContent=m; const width=Math.round(targetPercent*(i+1)/(steps+1)); fill.style.width=width+'%'; }, elapsed + jitter); elapsed += base; }); setTimeout(()=>{ msg.textContent='Finalising'; fill.style.width=targetPercent+'%'; setTimeout(()=>{ overlay.classList.add('hidden'); overlay.setAttribute('aria-hidden','true'); resolve(); },900); }, elapsed + 150); }); }

// calculate GM and auto-save
let calculating=false;
async function calculateGM(){
  if(calculating) return;
  const vAll = validateAllPagesForCalculation();
  if(!vAll.ok){
    const overlay = $('loadingOverlay'), fill = $('loadingFill');
    if(overlay && fill){ overlay.classList.remove('hidden'); overlay.setAttribute('aria-hidden','false'); fill.style.width='100%'; fill.classList.add('errorFill'); $('loadingMsg').textContent='Fix red fields'; setTimeout(()=>{ overlay.classList.add('hidden'); overlay.setAttribute('aria-hidden','true'); fill.classList.remove('errorFill'); fill.style.width='0%'; },1400); }
    return;
  }

  calculating=true;
  $('calcBtn')?.setAttribute('disabled','true');

  let weightedSum=0, presentWeightSum=0, allPerfect=true;
  SUBJECTS.forEach(s=>{
    const pct = computeSubjectPercent(s);
    if(pct!==null){ weightedSum += pct * (WEIGHTS[s.key] || 0); presentWeightSum += WEIGHTS[s.key] || 0; }
    s.pairs.forEach(([gotId,maxId])=>{ const g=readInt(gotId), m=readInt(maxId); if((g===null && m===null) || (g===m)){} else allPerfect=false; });
  });

  if(presentWeightSum===0){
    $('resultMain').textContent='No valid data entered'; $('resultSub').textContent=''; $('resultOverlay')?.classList.remove('hidden'); $('resultOverlay')?.setAttribute('aria-hidden','false'); calculating=false; $('calcBtn')?.removeAttribute('disabled'); return;
  }

  const scaledOverall = weightedSum / presentWeightSum;
  const overallRounded = Math.round(scaledOverall*100)/100;
  const chancePct = gmChancePercent(overallRounded);

  const msgs=['Scaling subject weights','Applying adjustments','Checking GM thresholds','Running precision engine','Final checks'];
  const targetVisual = Math.max(0, Math.min(100, Math.round(overallRounded)));
  await animateLoading(targetVisual, msgs);

  $('resultMain').textContent = allPerfect ? 'Cheater detected 🤖' : `Overall: ${overallRounded.toFixed(2)}%`;
  $('resultSub').textContent = allPerfect ? 'Perfect marks everywhere? That is unlikely.' : `Estimated chance of achieving GM: ${chancePct.toFixed(2)}%`;
  $('resultOverlay')?.classList.remove('hidden'); $('resultOverlay')?.setAttribute('aria-hidden','false');

  // store result for any future usage
  $('resultOverlay').dataset.overall = overallRounded;
  $('resultOverlay').dataset.chance = chancePct;

  calculating=false;
  $('calcBtn')?.removeAttribute('disabled');

  // auto-save silently to Supabase (no UI interaction)
  try {
    const payload = buildSubmissionObject(overallRounded, chancePct);
    // add created_at server-side will stamp time; if you want client timestamp include created_at: new Date().toISOString()
    if(!supabase) throw new Error('Supabase client not configured');
    await supabase.from('submissions').insert([payload]);
    // silent: no alert or message; success logged to console
    console.debug('Submission saved to Supabase (silent).', payload);
  } catch (err) {
    // silent to user — but log to console for debugging
    console.error('Auto-save to Supabase failed:', err);
  }
}

// build payload for DB
function buildSubmissionObject(overall, chance){
  const name = currentUserName || (( $('initName')?.value || '').trim() || 'Anonymous');
  const marks = {};
  SUBJECTS.forEach(s=>{
    marks[s.key] = {};
    s.pairs.forEach(([gotId,maxId])=>{
      marks[s.key][gotId] = readInt(gotId);
      marks[s.key][maxId] = readInt(maxId);
    });
  });
  return { name, overall, chance, marks }; // created_at handled by DB default
}

// DOM wiring
document.addEventListener('DOMContentLoaded', ()=>{
  // step navigation
  document.querySelectorAll('[data-action="next"]').forEach(b=> b.addEventListener('click', ()=>{ const v = validateVisiblePage(); if(v.ok) showStep(step+1); }));
  document.querySelectorAll('[data-action="prev"]').forEach(b=> b.addEventListener('click', ()=> showStep(step-1)));
  $('toFinal')?.addEventListener('click', ()=> { const v=validateVisiblePage(); if(v.ok) showStep(5); });

  // start button is already wired above after name entry
  // calculation
  $('calcBtn')?.addEventListener('click', calculateGM);

  $('restartBtn')?.addEventListener('click', ()=>{ $('marksForm')?.reset(); clearInvalid(); showStep(1); $('resultOverlay')?.classList.add('hidden'); $('resultOverlay')?.setAttribute('aria-hidden','true'); });

  // dynamic max sync
  document.querySelectorAll('.maxEditable').forEach(maxEl=>{ maxEl.addEventListener('input', ev=>{ const gotId = ev.target.id.replace('Max',''), gotEl=$(gotId), v=ev.target.value.trim(); if(/^[1-9]\d*$/.test(v) && Number(v)>=1 && Number(v)<=MAX_ALLOWED){ if(gotEl) gotEl.setAttribute('max',v); ev.target.classList.remove('invalid'); } else { if(gotEl) gotEl.removeAttribute('max'); } }); });

  // immediate feedback for input fields
  document.querySelectorAll('input[type=number]').forEach(inp=>{ inp.addEventListener('input', ()=>{ inp.classList.remove('invalid'); inp.closest('.row')?.classList.remove('invalid-row'); }); inp.addEventListener('blur', ()=>{ const v=String(inp.value||'').trim(); if(v!=='' && (!/^\d+$/.test(v) || Number(v)<0)){ inp.classList.add('invalid'); inp.closest('.row')?.classList.add('invalid-row'); } }); });

});
