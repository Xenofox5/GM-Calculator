// script.js — fixed version
// Dark-only UI, stable alignment, validation, presets, supabase autosave

const SUPABASE_URL = "https://hyidvehmownubiilljoi.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5aWR2ZWhtb3dudWJpaWxsam9pIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg0NDY0OTMsImV4cCI6MjA3NDAyMjQ5M30.nuw3iol_2p7YBAW4HI7xC68gdLi4vbf-xPlE7K-MhU8";

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

const SUBJECT_PRESETS = {
  geog:  { t1:25, t2:25, t3:25 },
  hist:  { t1:null, t2:null, t3:null },
  lang:  { t1:null, t2:null, t3:null },
  art:   { t1:25, t2:25, t3:25 },
  music: { t1:null, t2:null, t3:null },
  design:{ t1:35, t2:15, t3:35 },
  drama: { t1:25, t2:25, t3:null }
};

const $ = id => document.getElementById(id);

// init supabase client if available
let supabase = null;
if (typeof window.supabase !== 'undefined' && SUPABASE_URL && SUPABASE_ANON_KEY) {
  try { supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY); }
  catch(e){ console.warn('Supabase init failed', e); supabase = null; }
}

function readInt(id){
  const el = $(id);
  if(!el) return null;
  const s = (el.value||'').trim();
  if(s==='') return null;
  if(s.includes('.') || !/^\d+$/.test(s)) return NaN;
  return Number(s);
}
function clearInvalid(){ document.querySelectorAll('.invalid').forEach(n=>n.classList.remove('invalid')); document.querySelectorAll('.invalid-row').forEach(n=>n.classList.remove('invalid-row')); }
function setInvalid(ids){ ids.forEach(id=>{ const el=$(id); if(!el) return; el.classList.add('invalid'); const row=el.closest('.row'); if(row) row.classList.add('invalid-row'); }); }
function pageAncestor(el){ return el ? el.closest('.page') : null; }

let step = 1;
function showStep(n){ step = Math.min(Math.max(1,n),5); document.querySelectorAll('.step').forEach(el=>el.classList.toggle('active', Number(el.dataset.step)===step)); document.querySelectorAll('.page').forEach(p=>p.classList.toggle('hidden', Number(p.dataset.step)!==step)); }

function applySubjectPreset(selectId, prefix){
  const sel = $(selectId);
  if(!sel) return;
  sel.addEventListener('change', ()=>{
    const v = sel.value;
    const preset = SUBJECT_PRESETS[v] || { t1:null, t2:null, t3:null };
    const m1 = $(prefix+'T1Max'), m2 = $(prefix+'T2Max'), m3 = $(prefix+'T3Max');
    const g1 = $(prefix+'T1'), g2 = $(prefix+'T2'), g3 = $(prefix+'T3');
    if(m1) m1.value = preset.t1!=null ? String(preset.t1) : '';
    if(m2) m2.value = preset.t2!=null ? String(preset.t2) : '';
    if(m3) m3.value = preset.t3!=null ? String(preset.t3) : '';
    if(g1) preset.t1!=null ? g1.setAttribute('max', preset.t1) : g1.removeAttribute('max');
    if(g2) preset.t2!=null ? g2.setAttribute('max', preset.t2) : g2.removeAttribute('max');
    if(g3) preset.t3!=null ? g3.setAttribute('max', preset.t3) : g3.removeAttribute('max');
  });
}

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

      const gotRaw = (gotEl && (gotEl.value||'').trim()) || '';
      const maxRaw = (maxEl && (maxEl.value||'').trim()) || '';

      if(gotRaw !== '' && (gotRaw.includes('.') || !/^\d+$/.test(gotRaw))) { if(gotEl) bad.add(gotId); }
      if(gotRaw !== '' && maxRaw === '') { if(maxEl) bad.add(maxId); }
      if(maxRaw !== '' && !/^[1-9]\d*$/.test(maxRaw)) { if(maxEl) bad.add(maxId); }
      if(maxRaw !== '' && Number(maxRaw) > MAX_ALLOWED) { if(maxEl) bad.add(maxId); }
      if(gotRaw !== '' && maxRaw !== '' && /^\d+$/.test(gotRaw) && /^\d+$/.test(maxRaw)){
        if(Number(gotRaw) > Number(maxRaw)) { if(gotEl) bad.add(gotId); }
      }

      const termMatch = gotId.match(/T([123])$/i); const term = termMatch ? termMatch[1] : null;
      const isRequired = (()=>{ const k=s.key; if(['eng','sci','ac1','ac2','pe','oe1','oe2'].includes(k)) return (term==='1'||term==='2'); if(k==='math') return (term==='2'||term==='3'); return false; })();

      if(isRequired){
        if((gotEl && gotRaw==='') || (maxEl && maxRaw==='')){ if(gotEl) bad.add(gotId); if(maxEl) bad.add(maxId); }
      }

      if(term==='3' && gotRaw!=='' && maxRaw==='') { bad.delete(maxId); }
    });
  });

  setInvalid(Array.from(bad));
  if(bad.size>0){ const first=Array.from(bad)[0]; const el=$(first); if(el){ el.scrollIntoView({behavior:'smooth', block:'center'}); setTimeout(()=>el.focus(),250); } }
  return { ok: bad.size===0, bad: Array.from(bad) };
}

function validateAllPagesForCalculation(){
  clearInvalid();
  const bad = new Set();
  const pages = document.querySelectorAll('.page');
  const originalStep = step;
  pages.forEach(p=>{
    step = Number(p.dataset.step);
    const r = validateVisiblePage();
    r.bad.forEach(id=>bad.add(id));
  });
  step = originalStep;
  setInvalid(Array.from(bad));
  if(bad.size>0){ const el = $(Array.from(bad)[0]); if(el){ el.scrollIntoView({behavior:'smooth', block:'center'}); setTimeout(()=>el.focus(),250); } }
  return { ok: bad.size===0, bad: Array.from(bad) };
}

function computeSubjectPercent(sub){
  let sumGot=0, sumMax=0, any=false;
  sub.pairs.forEach(([gotId,maxId])=>{
    const g = readInt(gotId), m = readInt(maxId);
    if(Number.isNaN(g) || Number.isNaN(m)) return;
    if(g !== null && m !== null){ sumGot += g; sumMax += m; any = true; }
  });
  if(!any || sumMax===0) return null;
  return (sumGot/sumMax)*100;
}

function gmChancePercent(x){
  if(x < 88.5) return 0;
  if(x >= 100) return 99.99;
  const k = 0.9, x0 = 92.0;
  const p = 1 / (1 + Math.exp(-k*(x - x0)));
  const p88 = 1 / (1 + Math.exp(-k*(88.5 - x0)));
  let norm = (p - p88) / (1 - p88);
  norm = Math.min(Math.max(norm,0),0.9999);
  return Math.round(norm * 10000) / 100;
}

// Smooth animate loading bar (with gradual finalising phase)
function animateLoading(targetPercent, messages = []) {
  return new Promise((resolve) => {
    const overlay = $('loadingOverlay'),
      fill = $('loadingFill'),
      msg = $('loadingMsg');

    if (!overlay || !fill || !msg) return resolve();

    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    fill.classList.remove('errorFill');
    fill.style.width = '0%';
    msg.textContent = 'Preparing...';

    const total = 7000, // total duration for animation
      steps = messages.length;
    let elapsed = 0,
      base = Math.floor(total / (steps + 1));

    // staged updates
    messages.forEach((m, i) => {
      const jitter = Math.floor((Math.random() - 0.5) * 120);
      setTimeout(() => {
        msg.textContent = m;
        const width = Math.round(targetPercent * (i + 1) / (steps + 1));
        fill.style.transition = "width 0.6s ease-out";
        fill.style.width = width + "%";
      }, elapsed + jitter);
      elapsed += base;
    });

    // Final stage
    setTimeout(() => {
      msg.textContent = "Finalising";

      // Step 1: go near the end (95–98% of target)
      const almost = Math.min(98, Math.max(targetPercent - 2, targetPercent * 0.96));
      fill.style.transition = "width 1.2s ease-in-out";
      fill.style.width = almost + "%";

      // Step 2: after a pause, reach the true target and then resolve
      setTimeout(() => {
        fill.style.transition = "width 0.9s ease-in-out";
        fill.style.width = targetPercent + "%";

        setTimeout(() => {
          overlay.classList.add("hidden");
          overlay.setAttribute("aria-hidden", "true");
          resolve();
        }, 950); // wait until smooth fill ends
      }, 1200);
    }, elapsed + 200);
  });
}


let calculating = false;
async function calculateGM(){
  if(calculating) return;
  const v = validateAllPagesForCalculation();
  if(!v.ok){
    const overlay = $('loadingOverlay'), fill = $('loadingFill');
    if(overlay && fill){
      overlay.classList.remove('hidden'); overlay.setAttribute('aria-hidden','false');
      fill.style.width='100%'; fill.classList.add('errorFill');
      $('loadingMsg').textContent='Fix red fields';
      setTimeout(()=>{ overlay.classList.add('hidden'); overlay.setAttribute('aria-hidden','true'); fill.classList.remove('errorFill'); fill.style.width='0%'; }, 1400);
    }
    return;
  }

  calculating = true;
  $('calcBtn')?.setAttribute('disabled','true');

  let weightedSum=0, presentWeightSum=0, allPerfect=true;
  SUBJECTS.forEach(s=>{
    const pct = computeSubjectPercent(s);
    if(pct !== null){ weightedSum += pct * (WEIGHTS[s.key] || 0); presentWeightSum += WEIGHTS[s.key] || 0; }
    s.pairs.forEach(([gotId,maxId])=>{
      const g = readInt(gotId), m = readInt(maxId);
      if((g === null && m === null) || (g === m)){} else allPerfect = false;
    });
  });

  if(presentWeightSum === 0){
    $('resultMain').textContent = 'No valid data entered';
    $('resultSub').textContent = '';
    $('resultOverlay')?.classList.remove('hidden'); $('resultOverlay')?.setAttribute('aria-hidden','false');
    calculating = false; $('calcBtn')?.removeAttribute('disabled'); return;
  }

  const scaledOverall = weightedSum / presentWeightSum;
  const overallRounded = Math.round(scaledOverall * 100) / 100;
  const chancePct = gmChancePercent(overallRounded);
  const msgs = ['Scaling subject weights','Applying adjustments','Checking GM thresholds','Running precision engine','Final checks'];
  const targetVisual = Math.max(0, Math.min(100, Math.round(overallRounded)));
  await animateLoading(targetVisual, msgs);

  if(allPerfect){
    $('resultMain').textContent = 'Cheater detected 🤖';
    $('resultSub').textContent = `Estimated chance of achieving GM: ${chancePct.toFixed(2)}%`;
  } else {
    $('resultMain').textContent = `Overall: ${overallRounded.toFixed(2)}%`;
    $('resultSub').textContent = `Estimated chance of achieving GM: ${chancePct.toFixed(2)}%`;
  }

  $('resultOverlay')?.classList.remove('hidden'); $('resultOverlay')?.setAttribute('aria-hidden','false');
  calculating = false; $('calcBtn')?.removeAttribute('disabled');

  // silent autosave
  try {
    if(!supabase) throw new Error('Supabase not configured');
    const payload = buildSubmissionObject(overallRounded, chancePct);
    await supabase.from('submissions').insert([payload]);
  } catch(err){
    // intentionally silent
  }
}

function buildSubmissionObject(overall, chance){
  const nameInput = $('initName'); const name = (nameInput && nameInput.value.trim()) || 'Anonymous';
  const marks = {};
  SUBJECTS.forEach(s=>{
    marks[s.key] = {};
    s.pairs.forEach(([gotId,maxId])=>{
      const g = readInt(gotId), m = readInt(maxId);
      marks[s.key][gotId] = Number.isNaN(g) ? null : g;
      marks[s.key][maxId] = Number.isNaN(m) ? null : m;
    });
  });
  return { name, overall, chance, marks, created_at: new Date().toISOString() };
}

document.addEventListener('DOMContentLoaded', ()=>{
  applySubjectPreset('ac1Sub','ac1');
  applySubjectPreset('ac2Sub','ac2');
  applySubjectPreset('oe1Sub','oe1');
  applySubjectPreset('oe2Sub','oe2');

  const themeBtn = $('themeToggleEmoji'); if(themeBtn) themeBtn.style.display='none';

  document.querySelectorAll('[data-action="next"]').forEach(b=>b.addEventListener('click', (ev)=>{ const r = validateVisiblePage(); if(r.ok) showStep(step+1); else ev.preventDefault(); }));
  document.querySelectorAll('[data-action="prev"]').forEach(b=>b.addEventListener('click', ()=> showStep(step-1)));
  $('toFinal')?.addEventListener('click', ()=> { if(validateVisiblePage().ok) showStep(5); });

  const nameInput = $('initName'), startBtn = $('startBtn');
  if(nameInput && startBtn){
    nameInput.addEventListener('input', e=> startBtn.disabled = (e.target.value||'').trim()==='');
    startBtn.addEventListener('click', ()=>{
      if((nameInput.value||'').trim()==='') return;
      $('hero')?.classList.add('hidden'); $('app')?.classList.remove('hidden'); showStep(1); setTimeout(()=> $('engT1')?.focus(),160);
    });
  }

  $('calcBtn')?.addEventListener('click', calculateGM);
  $('restartBtn')?.addEventListener('click', ()=>{ $('marksForm')?.reset(); clearInvalid(); showStep(1); $('resultOverlay')?.classList.add('hidden'); $('resultOverlay')?.setAttribute('aria-hidden','true'); });

  document.querySelectorAll('.maxEditable').forEach(maxEl=>{
    maxEl.addEventListener('input', ev=>{
      const gotId = ev.target.id.replace('Max',''), gotEl = $(gotId), v = ev.target.value.trim();
      if(/^[1-9]\d*$/.test(v) && Number(v)>=1 && Number(v)<=MAX_ALLOWED){ if(gotEl) gotEl.setAttribute('max',v); ev.target.classList.remove('invalid'); } 
      else { if(gotEl) gotEl.removeAttribute('max'); }
    });
  });

  document.querySelectorAll('input[type=number]').forEach(inp=>{
    inp.addEventListener('input', ()=>{ inp.classList.remove('invalid'); inp.closest('.row')?.classList.remove('invalid-row'); });
    inp.addEventListener('blur', ()=>{ const v = String(inp.value||'').trim(); if(v !== '' && (!/^\d+$/.test(v) || Number(v) < 0)) { inp.classList.add('invalid'); inp.closest('.row')?.classList.add('invalid-row'); } else { inp.classList.remove('invalid'); inp.closest('.row')?.classList.remove('invalid-row'); } });
  });

  showStep(1);
});
