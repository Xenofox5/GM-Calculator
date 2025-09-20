// script.js -- full implementation (drop-in)
// Features:
// - MAX_ALLOWED = 50
// - oe1/oe2 required for T1 & T2
// - Term3 'got' can be entered before its 'max' (won't block navigation)
// - gmChancePercent: logistic, 0 below 88.5, capped at 99.99% top
// - Slower, smoother loading (UK English messages)
// - Opaque overlays
// - DEBUG flag (false by default)

const DEBUG = false;            // set true to show validation diagnostics UI
const MAX_ALLOWED = 50;        // Out-of must be between 1..MAX_ALLOWED
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

// ----------------- Debug UI -----------------
function ensureDebugArea() {
  if (!DEBUG) return;
  if ($('validationErrors')) return;
  const container = document.createElement('div');
  container.id = 'validationErrors';
  container.style.cssText = 'background:#fff3cd;border:1px solid #ffeeba;padding:10px;margin:8px 0;border-radius:6px;color:#856404;font-family:inherit';
  container.setAttribute('aria-live','polite');
  const title = document.createElement('strong'); title.textContent = 'Validation diagnostics:'; container.appendChild(title);
  const list = document.createElement('div'); list.id = 'validationErrorsList'; list.style.marginTop = '6px'; container.appendChild(list);
  const form = document.querySelector('form') || document.body;
  form.insertBefore(container, form.firstChild);
}
function setDebugList(lines) {
  if (!DEBUG) return;
  ensureDebugArea();
  const list = $('validationErrorsList');
  list.innerHTML = '';
  if (!lines || lines.length === 0) {
    list.innerHTML = '<div style="color:#155724;background:#d4edda;padding:6px;border-radius:4px">No validation issues detected</div>';
    return;
  }
  lines.forEach(l=>{
    const el = document.createElement('div'); el.textContent = l; el.style.marginBottom='4px'; list.appendChild(el);
  });
}

// ----------------- Overlays hide on load -----------------
window.addEventListener('load', () => {
  $('loadingOverlay')?.classList.add('hidden'); $('loadingOverlay')?.setAttribute('aria-hidden','true');
  $('resultOverlay')?.classList.add('hidden'); $('resultOverlay')?.setAttribute('aria-hidden','true');
});

// ----------------- Stepper -----------------
let step = 1;
function showStep(n) {
  step = Math.min(Math.max(1,n),5);
  document.querySelectorAll('.step').forEach(el => el.classList.toggle('active', Number(el.dataset.step) === step));
  document.querySelectorAll('.page').forEach(p => p.classList.toggle('hidden', Number(p.dataset.step) !== step));
}

// ----------------- Helpers -----------------
function readInt(id) {
  const el = $(id);
  if (!el) return null;
  const s = (el.value||'').trim();
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
function clearInvalid() {
  document.querySelectorAll('.invalid').forEach(n=>n.classList.remove('invalid'));
  document.querySelectorAll('.invalid-row').forEach(n=>n.classList.remove('invalid-row'));
  document.querySelectorAll('.input-shake').forEach(n=>n.classList.remove('input-shake'));
}
function setInvalid(ids) {
  ids.forEach(id=>{
    const el = $(id); if(!el) return;
    el.classList.add('invalid');
    const row = el.closest('.row');
    if(row) {
      row.classList.add('invalid-row');
      el.classList.add('input-shake');
      setTimeout(()=> el.classList.remove('input-shake'),300);
    }
  });
}
function pageAncestor(el) { return el ? el.closest('.page') : null; }

// ----------------- Validation rules -----------------
// Notes:
// - math T1 optional
// - oe1/oe2 now required for T1 & T2
// - If both elements missing from DOM -> skip
// - If inputs reside on a hidden page -> skip (only validate visible page inputs when navigating)
function validateAll() {
  clearInvalid();
  const badIds = new Set();
  const problems = [];

  SUBJECTS.forEach(s => {
    s.pairs.forEach(([gotId, maxId]) => {
      const gotEl = $(gotId);
      const maxEl = $(maxId);

      // If neither exists in DOM -> skip entirely
      if (!gotEl && !maxEl) {
        if (DEBUG) problems.push(`Skipped missing pair: "${gotId}" / "${maxId}" (not in DOM).`);
        return;
      }

      // If the pair is inside a hidden page, skip validation for now
      const pageEl = pageAncestor(gotEl) || pageAncestor(maxEl);
      if (pageEl && pageEl.classList.contains('hidden')) {
        if (DEBUG) problems.push(`Skipped hidden pair: "${gotId}" / "${maxId}".`);
        return;
      }

      const got = readInt(gotId);
      const max = readInt(maxId);
      const termMatch = gotId.match(/T[123]$/i);
      const term = termMatch ? termMatch[0].toUpperCase() : '';

      // Optional/Required logic
      const isOptional = (s.key === 'math' && term === 'T1');
      const isRequired = (() => {
        switch(s.key) {
          case 'eng': case 'sci': case 'ac1': case 'ac2': case 'pe': case 'oe1': case 'oe2':
            return (term === 'T1' || term === 'T2');
          case 'math':
            return (term === 'T2' || term === 'T3');
          default: return false;
        }
      })();

      // Missing element mismatches
      if (!gotEl && maxEl) { badIds.add(gotId); problems.push(`Missing input element "${gotId}" (paired max exists).`); }
      if (gotEl && !maxEl) { badIds.add(maxId); problems.push(`Missing max element "${maxId}" (paired got exists).`); }

      // If optional and both empty -> skip
      if (isOptional && got === null && max === null) return;

      // Required: if elements present but empty -> error
      if (isRequired) {
        if ((gotEl && got === null) || (maxEl && max === null)) {
          if (gotEl) badIds.add(gotId);
          if (maxEl) badIds.add(maxId);
          problems.push(`Required ${s.key} ${term} missing or empty (ids "${gotId}" / "${maxId}").`);
        }
      }

      // Non-required special-case: allow Term 3 'got' without 'max' (user can type mark first)
      if (!isRequired && got !== null && max === null && term === 'T3') {
        // allow; do not mark bad
      } else {
        // For other non-required cases, if got provided but max absent -> error
        if (!isRequired && got !== null && !maxEl) {
          badIds.add(maxId);
          problems.push(`${s.key} ${term}: score provided but Out-of missing (id "${maxId}").`);
        }
      }

      // Numeric checks (apply only when values exist)
      if (got !== null && (!Number.isFinite(got) || got < 0)) { badIds.add(gotId); problems.push(`${gotId} contains invalid value (${got}).`); }
      if (max !== null && (!Number.isFinite(max) || max <= 0 || max > MAX_ALLOWED)) { badIds.add(maxId); problems.push(`${maxId} contains invalid Out-of (${max}). Allowed: 1..${MAX_ALLOWED}`); }
      if (got !== null && max !== null && got > max) { badIds.add(gotId); problems.push(`${gotId} (${got}) is greater than ${maxId} (${max}).`); }
    });
  });

  const badArr = Array.from(badIds);
  setInvalid(badArr);

  if (DEBUG) {
    const userProblems = problems.filter(p => !p.startsWith('Skipped'));
    const skipped = problems.filter(p => p.startsWith('Skipped'));
    setDebugList(userProblems.concat(skipped));
  }

  // focus first invalid if present
  if (badArr.length > 0) {
    const firstId = badArr[0]; const el = $(firstId);
    if (el) { el.scrollIntoView({ behavior:'smooth', block:'center' }); setTimeout(()=>el.focus(),250); }
    else if (DEBUG) { ensureDebugArea(); $('validationErrors').scrollIntoView({ behavior:'smooth', block:'center' }); }
  }

  console.log('validateAll -> ok=', badArr.length===0, 'bad=', badArr);
  return { ok: badArr.length === 0, bad: badArr, problems };
}

// ----------------- Compute subject percent -----------------
function computeSubjectPercent(sub) {
  let sumGot = 0, sumMax = 0, any = false;
  sub.pairs.forEach(([gotId, maxId]) => {
    const g = readInt(gotId), m = readInt(maxId);
    if (g !== null && m !== null) { sumGot += g; sumMax += m; any = true; }
  });
  if (!any || sumMax === 0) return null;
  return (sumGot / sumMax) * 100;
}

// ----------------- GM chance formula -----------------
// Logistic curve with clamping: below 88.5% => 0
// scale-down factor and top-cap to 99.99% so 100% marks never return 100.00
function gmChancePercent(x) {
  // tuned parameters
  const k = 0.8;
  const x0 = 92.0;

  if (x < 88.5) return 0;      // minimum threshold

  // logistic
  let p = 100 / (1 + Math.exp(-k * (x - x0)));

  // scale down to lower probabilities slightly (preserves shape)
  p *= 0.9;

  // cap top at 99.99 to avoid showing 100.00
  if (p >= 99.99) p = 99.99;

  // round to 2 d.p.
  return Math.round(p * 100) / 100;
}

// ----------------- Loading animation -----------------
// Slower, smoother, UK English messages
function animateLoading(targetPercent, messages = []) {
  return new Promise(resolve => {
    const overlay = $('loadingOverlay'), fill = $('loadingFill'), msg = $('loadingMsg');
    if (!overlay || !fill || !msg) return resolve();

    overlay.classList.remove('hidden'); overlay.setAttribute('aria-hidden','false');
    fill.classList.remove('errorFill'); fill.style.width = '0%';
    msg.textContent = 'Preparing...';

    // longer total time for smoother feel
    const total = 7000; // 7s total
    const steps = messages.length;
    let elapsed = 0;
    const base = Math.floor(total / (steps + 1));

    messages.forEach((m, i) => {
      const jitter = Math.floor((Math.random() - 0.5) * 120);
      setTimeout(() => {
        msg.textContent = m;
        const width = Math.round(targetPercent * (i + 1) / (steps + 1));
        fill.style.width = width + '%';
      }, elapsed + jitter);
      elapsed += base;
    });

    setTimeout(() => {
      msg.textContent = 'Finalising';
      fill.style.width = targetPercent + '%';
      setTimeout(() => {
        overlay.classList.add('hidden'); overlay.setAttribute('aria-hidden','true');
        resolve();
      }, 900); // keep final state visible a bit
    }, elapsed + 150);
  });
}

// ----------------- Calculate GM -----------------
let calculating = false;
async function calculateGM() {
  if (calculating) return;
  const v = validateAll();
  if (!v.ok) {
    const overlay = $('loadingOverlay'), fill = $('loadingFill');
    if (overlay && fill) {
      overlay.classList.remove('hidden'); overlay.setAttribute('aria-hidden','false');
      fill.style.width = '100%'; fill.classList.add('errorFill');
      $('loadingMsg').textContent = 'Fix red fields';
      setTimeout(() => {
        overlay.classList.add('hidden'); overlay.setAttribute('aria-hidden','true');
        fill.classList.remove('errorFill'); fill.style.width = '0%';
      }, 1400);
    }
    return;
  }

  calculating = true;
  $('calcBtn')?.setAttribute('disabled','true');

  let weightedSum = 0, presentWeightSum = 0, allPerfect = true;
  SUBJECTS.forEach(s => {
    const pct = computeSubjectPercent(s);
    if (pct !== null) {
      weightedSum += pct * (WEIGHTS[s.key] || 0);
      presentWeightSum += WEIGHTS[s.key] || 0;
    }
    s.pairs.forEach(([gotId, maxId]) => {
      const g = readInt(gotId), m = readInt(maxId);
      if ((g === null && m === null) || (g === m)) {} else allPerfect = false;
    });
  });

  if (presentWeightSum === 0) {
    $('resultMain').textContent = 'No valid data entered';
    $('resultSub').textContent = '';
    $('resultOverlay')?.classList.remove('hidden'); $('resultOverlay')?.setAttribute('aria-hidden','false');
    calculating = false;
    $('calcBtn')?.removeAttribute('disabled');
    return;
  }

  const scaledOverall = weightedSum / presentWeightSum;
  const overallRounded = Math.round(scaledOverall * 100) / 100;
  const chancePct = gmChancePercent(overallRounded);

  const msgs = ['Scaling subject weights','Applying adjustments','Checking GM thresholds','Running precision engine','Final checks'];
  const targetVisual = Math.max(0, Math.min(100, Math.round(overallRounded)));
  await animateLoading(targetVisual, msgs);

  $('resultMain').textContent = allPerfect ? 'Cheater detected 🤖' : `Overall: ${overallRounded.toFixed(2)}%`;
  $('resultSub').textContent = allPerfect ? 'Perfect marks everywhere? That is unlikely.' : `Estimated chance of achieving GM: ${chancePct.toFixed(2)}%`;
  $('resultOverlay')?.classList.remove('hidden'); $('resultOverlay')?.setAttribute('aria-hidden','false');

  calculating = false;
  $('calcBtn')?.removeAttribute('disabled');
}

// ----------------- DOM wiring -----------------
document.addEventListener('DOMContentLoaded', () => {
  if (DEBUG) ensureDebugArea();

  document.querySelectorAll('[data-action="next"]').forEach(b =>
    b.addEventListener('click', (ev) => {
      const v = validateAll();
      if (v.ok) showStep(step + 1);
      else ev.preventDefault();
    })
  );
  document.querySelectorAll('[data-action="prev"]').forEach(b =>
    b.addEventListener('click', () => showStep(step - 1))
  );
  $('toFinal')?.addEventListener('click', () => { if (validateAll().ok) showStep(5); });

  $('startBtn')?.addEventListener('click', () => {
    $('hero')?.classList.add('hidden');
    $('app')?.classList.remove('hidden');
    showStep(1);
    setTimeout(()=> $('engT1')?.focus(),160);
  });

  $('calcBtn')?.addEventListener('click', calculateGM);
  $('restartBtn')?.addEventListener('click', ()=> {
    $('marksForm')?.reset();
    clearInvalid();
    if (DEBUG) setDebugList([]);
    showStep(1);
    $('resultOverlay')?.classList.add('hidden'); $('resultOverlay')?.setAttribute('aria-hidden','true');
  });

  // Dynamic max sync for editable Out-of controls
  document.querySelectorAll('.maxEditable').forEach(maxEl=>{
    maxEl.addEventListener('input', ev=>{
      const gotId = ev.target.id.replace('Max',''), gotEl=$(gotId), v=ev.target.value.trim();
      if(/^[1-9]\d*$/.test(v) && Number(v)>=1 && Number(v)<=MAX_ALLOWED){
        if(gotEl) gotEl.setAttribute('max',v);
        ev.target.classList.remove('invalid');
      } else { if(gotEl) gotEl.removeAttribute('max'); }
    });
  });

  // Immediate feedback on number fields
  document.querySelectorAll('input[type=number]').forEach(inp=>{
    inp.addEventListener('input', ()=>{ inp.classList.remove('invalid'); inp.closest('.row')?.classList.remove('invalid-row'); });
    inp.addEventListener('blur', ()=>{
      const v = String(inp.value||'').trim();
      if (v !== '' && (!/^\d+$/.test(v) || Number(v) < 0)) {
        inp.classList.add('invalid'); inp.closest('.row')?.classList.add('invalid-row');
      }
    });
  });

  if (DEBUG) validateAll();
});
