import { PUBLICATION_MAPPING, publicationDimensions, fieldLabel, valueLabel, publicationText } from './runtime/publicationDisplay.js?v=1277f413b0b8dcff';
const state = { page:1, pageSize:50, total:0 };
const labels = {
  dt_capability:'DT capability', vct_capability:'VCT capability', dt_level:'DT anchoring level', temporal_lifecycle_class:'Temporal lifecycle',
  x_axis:fieldLabel('x_axis'), y_axis:fieldLabel('y_axis'), validation:fieldLabel('validation'), mode:'Model mode', disease_group_primary:'Disease group',
  candidate_disposition:'Candidate disposition', evidence_access_level:'Evidence access', classification_status:'Classification status',
  verification_outcome:'Verification outcome', review_state:'Review state'
};
const filterFields = ['dt_capability','vct_capability','dt_level','temporal_lifecycle_class','x_axis','y_axis','validation','mode','disease_group_primary','publication_type','study_type','clinical_target_type'];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const display = v => v === null || v === undefined || v === '' ? '—' : String(v).replaceAll('_',' ');
async function api(url){ const r=await fetch(url); const j=await r.json(); if(!r.ok) throw new Error(j.error||r.statusText); return j; }
function badge(value){
  const v=String(value??''); let cls='';
  if(['verified_provisional','supported','DT+','VCT+'].includes(v)) cls='ok';
  else if(['human_review_required','needs_human_review','conflicting','needs_duplicate_review'].includes(v)) cls='warn';
  else if(['contradicted','canonical_duplicate','DT-','VCT-'].includes(v)) cls='danger';
  else if(v) cls='emerging';
  return `<span class="badge ${cls}">${esc(display(value))}</span>`;
}

// ---------------- Mode 1 ----------------
function renderCrosstab(x){
  let html='<table class="crosstab"><thead><tr><th>DT \\ VCT</th>'+x.cols.map(c=>`<th>${esc(display(c))}</th>`).join('')+'<th>Total</th></tr></thead><tbody>';
  x.rows.forEach((r,i)=>{ const rowTotal=x.cells[i].reduce((a,b)=>a+b,0); html+=`<tr><th>${esc(display(r))}</th>`+x.cols.map((c,j)=>`<td><button class="cell-button" data-row="${esc(r)}" data-col="${esc(c)}">${x.cells[i][j]}</button></td>`).join('')+`<td>${rowTotal}</td></tr>`; });
  const colTotals=x.cols.map((_,j)=>x.cells.reduce((a,row)=>a+row[j],0)); html+='<tr><th>Total</th>'+colTotals.map(n=>`<td>${n}</td>`).join('')+`<td>${x.denominator}</td></tr></tbody></table>`;
  document.querySelector('#crosstab').innerHTML=html;
  document.querySelectorAll('.cell-button').forEach(b=>b.addEventListener('click',()=>{ setSelect('dt_capability',b.dataset.row); setSelect('vct_capability',b.dataset.col); invalidateNlq(); state.page=1; loadRecords(); document.querySelector('.workspace').scrollIntoView({behavior:'smooth'}); }));
}
function renderFilters(options){
  const mainFlags=['any_open_public_data','any_public_source_any_license','any_open_source_licensed'];
  document.querySelector('#additionalBoolFilters').innerHTML=options.boolean_fields.filter(f=>!mainFlags.includes(f)).map(f=>`<label class="field"><span>${esc(display(f))}</span><select data-bool-filter="${esc(f)}"><option value="">Any</option><option value="true">True</option><option value="false">False (not flagged)</option></select></label>`).join('');
  document.querySelector('#categoricalFilters').innerHTML=filterFields.map(f=>{ const opts=(options.fields[f]||[]).map(v=>`<option value="${v===null?'__NULL__':esc(v)}">${esc(valueLabel(f,v))}</option>`).join(''); return `<label class="field"><span>${esc(labels[f]||f)}</span><select data-filter-field="${f}"><option value="">Any</option>${opts}</select></label>`; }).join('');
  for(const id of ['roleInclude','roleExclude']) document.querySelector('#'+id).innerHTML=options.roles.map(r=>`<option value="${esc(r)}">${esc(display(r))}</option>`).join('');
}
function setSelect(field,value){ const el=document.querySelector(`[data-filter-field="${field}"]`); if(el) el.value=value; }
function selectedValues(el){ return Array.from(el.selectedOptions).map(o=>o.value); }
function queryString(){
  const p=new URLSearchParams(); const search=document.querySelector('#searchInput').value.trim(); if(search) p.append('search',search);
  document.querySelectorAll('[data-filter-field]').forEach(el=>{ if(el.value){const values=el.value==='__NLQ_VALUES__'?JSON.parse(el.selectedOptions[0].dataset.values):[el.value];values.forEach(v=>p.append(el.dataset.filterField,v));} });
  document.querySelectorAll('[data-bool-filter]').forEach(el=>{ if(el.value) p.append(el.dataset.boolFilter,el.value); });
  selectedValues(document.querySelector('#roleInclude')).forEach(v=>p.append('role_include',v)); selectedValues(document.querySelector('#roleExclude')).forEach(v=>p.append('role_exclude',v));
  p.set('page',state.page); p.set('page_size',state.pageSize); return p.toString();
}
function flagValue(value){ return value===true?'Yes':value===false?'Not flagged':'—'; }
function renderRecords(data){
  state.total=data.total; state.page=data.page; document.querySelector('#resultCount').textContent=data.total; const body=document.querySelector('#recordsBody');
  if(!data.records.length) body.innerHTML='<tr><td colspan="9" class="empty">No canonical records match this query.</td></tr>';
  else body.innerHTML=data.records.map(r=>`<tr><td class="title-cell"><button class="record-title-button" data-mode1-id="${esc(r.study_unit_id)}">${esc(r.title)}</button></td><td>${esc(r.dt_capability)}</td><td>${esc(r.vct_capability)}</td><td>${esc(r.dt_level??'—')}</td><td>${esc(r.temporal_lifecycle_class??'—')}</td><td>${['x_axis','y_axis','validation'].map(f=>`<div><strong>${esc(fieldLabel(f))}:</strong> ${esc(valueLabel(f,r[f]))}</div>`).join('')}</td><td>${(r.functional_roles||[]).map(x=>`<span class="tag">${esc(display(x))}</span>`).join('')}</td><td>${flagValue(r.any_open_public_data)}</td><td>${flagValue(r.any_public_source_any_license)}</td></tr>`).join('');
  document.querySelectorAll('[data-mode1-id]').forEach(b=>b.addEventListener('click',()=>showMode1Detail(b.dataset.mode1Id)));
  const pages=Math.max(1,Math.ceil(data.total/data.page_size)); document.querySelector('#pageStatus').textContent=`Page ${data.page} of ${pages}`; document.querySelector('#prevPage').disabled=data.page<=1; document.querySelector('#nextPage').disabled=data.page>=pages;
}
async function loadRecords(){ try{ renderRecords(await api('/api/records?'+queryString())); } catch(e){ document.querySelector('#recordsBody').innerHTML=`<tr><td colspan="9" class="empty">${esc(e.message)}</td></tr>`; } }
function detailRow(k,v){ if(Array.isArray(v)) v=v.map(display).join('; '); else if(typeof v==='boolean') v=v?'Yes':'No'; else if(v===null||v==='') v='—'; else if(typeof v==='object') v=JSON.stringify(v); return `<dt>${esc(k.replaceAll('_',' '))}</dt><dd>${esc(v)}</dd>`; }
const recordDetailLabels = {
  population_or_indication:'Population / indication', study_type:'Study type', clinical_target_type:'Clinical target', disease_group_primary:'Disease group', mode:'Model approach',
  dt_capability:'DT capability', dt_level:'DT anchoring level', vct_capability:'VCT capability', temporal_lifecycle_class:'Temporal lifecycle', functional_roles:'Functional roles',
  x_axis:fieldLabel('x_axis'), y_axis:fieldLabel('y_axis'), validation:fieldLabel('validation'), instantiation_modalities:'Instantiation modalities', multimodal_instantiation_current:'Multimodal instantiation',
  direct_patient_record_input:'Direct patient-record input', forward_state_propagation:'Forward state propagation', post_instantiation_assimilation:'Post-instantiation assimilation',
  publication_type:'Publication type', longitudinal_initialization:'Longitudinal initialization'
};
function recordDetailRow(record,field){
  const value=publicationDimensions[field]?valueLabel(field,record[field]):record[field];
  return detailRow(recordDetailLabels[field]||field,typeof value==='string'?display(value):value);
}
function accessFlagRow(label,value){ return detailRow(label,flagValue(value)); }
function accessNotes(record,kind){
  const notes=kind==='data'
    ? [[record.any_data_not_public,'Some data are flagged as not public.'],[record.any_data_unclear,'Access to some data is unclear.']]
    : [[record.any_code_not_public,'Some code is flagged as not public.'],[record.any_code_unclear,'Access to some code is unclear.']];
  return notes.filter(([flag])=>flag===true).map(([,text])=>`<p class="muted">${esc(text)}</p>`).join('');
}
async function showMode1Detail(id){
  const r=await api('/api/record/'+encodeURIComponent(id)); document.querySelector('#detailEyebrow').textContent='Canonical record detail'; document.querySelector('#detailTitle').textContent=`${r.study_unit_id} — ${r.title}`;
  const overview=['population_or_indication','disease_group_primary','clinical_target_type','study_type','mode'];
  const classification=['dt_capability','dt_level','vct_capability','temporal_lifecycle_class','functional_roles','x_axis','y_axis','validation'];
  const representation=['instantiation_modalities','multimodal_instantiation_current'];
  const additional=['direct_patient_record_input','forward_state_propagation','post_instantiation_assimilation','longitudinal_initialization','publication_type'];
  document.querySelector('#detailBody').innerHTML=`
    <section class="detail-section"><h3>Study overview</h3><dl class="detail-grid">${overview.map(k=>recordDetailRow(r,k)).join('')}</dl></section>
    <section class="detail-section"><h3>DT / VCT classification</h3><dl class="detail-grid">${classification.map(k=>recordDetailRow(r,k)).join('')}</dl></section>
    <section class="detail-section"><h3>Patient representation</h3><dl class="detail-grid">${representation.map(k=>recordDetailRow(r,k)).join('')}</dl></section>
    <section class="detail-section"><h3>Data &amp; code access</h3>
      <p class="muted">Not flagged means the descriptor is not flagged in the review; it does not establish absence.</p>
      <h4>Data</h4><dl class="detail-grid">${accessFlagRow('Open public data',r.any_open_public_data)}${accessFlagRow('Controlled-access data',r.any_controlled_access_data)}${accessFlagRow('Data available on request',r.any_data_on_request)}</dl>${accessNotes(r,'data')}
      <h4>Source code</h4><dl class="detail-grid">${accessFlagRow('Public source code',r.any_public_source_any_license)}${accessFlagRow('Recognized open-source license',r.any_open_source_licensed)}${accessFlagRow('Code available on request',r.any_code_on_request)}</dl>${accessNotes(r,'code')}
    </section>
    <details class="detail-section additional-details"><summary>Additional details</summary>
      <h4>Classification descriptors</h4><dl class="detail-grid">${additional.map(k=>recordDetailRow(r,k)).join('')}</dl>
      <h4>Other resources</h4><dl class="detail-grid">${accessFlagRow('Institutional proprietary data',r.any_institutional_proprietary_data)}${accessFlagRow('Public non-source artifact',r.any_public_non_source_artifact)}</dl>
    </details>`;
  document.querySelector('#detailDialog').showModal();
}
function resetFilters(){ invalidateNlq(); document.querySelector('#searchInput').value=''; document.querySelectorAll('[data-filter-field]').forEach(e=>e.value=''); document.querySelectorAll('[data-bool-filter]').forEach(e=>e.value=''); for(const id of ['roleInclude','roleExclude']) Array.from(document.querySelector('#'+id).options).forEach(o=>o.selected=false); state.page=1; loadRecords(); }


// ---------------- Transparent NLQ adapter (no scientific arithmetic) ----------------
function invalidateNlq(){
  document.querySelector('#nlqInterpretation')?.remove();
}
function applyNlqState(q){
  document.querySelector('#searchInput').value=q.search||'';
  document.querySelectorAll('[data-filter-field]').forEach(el=>{
    el.querySelectorAll('[data-nlq-option]').forEach(o=>o.remove());
    const values=q.filters[el.dataset.filterField]||[];
    if(values.length>1){const o=document.createElement('option');o.value='__NLQ_VALUES__';o.dataset.nlqOption='true';o.dataset.values=JSON.stringify(values);o.textContent=valueLabel(el.dataset.filterField,values);el.appendChild(o);el.value=o.value;}
    else el.value=values.length?String(values[0]??'__NULL__'):'';
  });
  document.querySelectorAll('[data-bool-filter]').forEach(el=>{const vals=q.filters[el.dataset.boolFilter]||[];el.value=vals.length?String(vals[0]):'';});
  for(const [id,key] of [['roleInclude','role_include'],['roleExclude','role_exclude']]) Array.from(document.querySelector('#'+id).options).forEach(o=>o.selected=q[key].includes(o.value));
  const extra=document.querySelector('#additionalFlags');extra.open=Array.from(extra.querySelectorAll('[data-bool-filter]')).some(el=>el.value);
  state.page=1;
}
function nlqOutput(){
  let output=document.querySelector('#nlqInterpretation');
  if(!output){
    output=document.createElement('div');output.id='nlqInterpretation';output.className='nlq-interpretation';output.setAttribute('aria-live','polite');
    document.querySelector('.nlq-panel').appendChild(output);
  }
  return output;
}
function renderNlq(data){
  const q=data.interpretation;
  const chips=q.interpreted_terms.map(t=>`<span class="tag">${esc(t.field?`${fieldLabel(t.field)}: ${valueLabel(t.field,t.value)}${t.operation==='exclude'?' (negation)':''}`:`${t.operation}: ${Array.isArray(t.value)?t.value.map(fieldLabel).join(" / "):fieldLabel(t.value)}`)}</span>`).join(' ');
  let aggregate='';
  if(data.groups){const valueCompare=q.intent==='group_by'&&q.group_by&&(q.filters[q.group_by]||[]).length>1&&/\b(?:compare|versus|vs\.?)\b/i.test(q.prompt);aggregate=`<h3>${valueCompare?'Comparison of matching study units':'Grouped matching study units'}</h3><table class="nlq-aggregate"><thead><tr><th>${esc(fieldLabel(q.group_by))}</th><th>Study units</th></tr></thead><tbody>${data.groups.map(g=>`<tr><td>${esc(valueLabel(q.group_by,g.value))}</td><td>${esc(g.n)}</td></tr>`).join('')}</tbody></table>`;}
  if(data.crosstab){const x=data.crosstab;aggregate=`<h3>Cross-tab of matching study units</h3><div class="table-wrap"><table class="nlq-aggregate"><thead><tr><th>${esc(fieldLabel(x.field_a))} / ${esc(fieldLabel(x.field_b))}</th>${x.cols.map(c=>`<th>${esc(valueLabel(x.field_b,c))}</th>`).join('')}</tr></thead><tbody>${x.rows.map((r,i)=>`<tr><th>${esc(valueLabel(x.field_a,r))}</th>${x.cells[i].map(n=>`<td>${esc(n)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
  if(data.groups_by_dimension) aggregate='<h3>Summary of matching study units</h3>'+Object.entries(data.groups_by_dimension).map(([f,gs])=>`<p><strong>${esc(display(f))}:</strong> ${gs.map(g=>`${esc(valueLabel(q.group_by,g.value))}: ${esc(g.n)}`).join('; ')}</p>`).join('');
  nlqOutput().innerHTML=`<p class="nlq-state"><strong>${data.applied?'Interpreted and applied':'Not applied - clarification required'}</strong></p><div>${chips||'No supported filters identified.'}</div><p id="nlqAnswer">${esc(publicationText(data.answer)||'Current filters and visible results are unchanged.')}</p>${q.messages.map(m=>`<p class="muted">${esc(publicationText(m))}</p>`).join('')}${q.unresolved_terms.length?`<p><strong>Unresolved:</strong> ${esc(publicationText(q.unresolved_terms.join('; ')))}</p>`:''}${aggregate}<details><summary>Internal structured interpretation (codes preserved)</summary><pre class="nlq-json">${esc(JSON.stringify(q,null,2))}</pre></details>`;
}
async function runNlq(){
  const btn=document.querySelector('#nlqSubmit');btn.disabled=true;
  document.querySelectorAll('[data-nlq-example]').forEach(b=>b.disabled=true);
  try{const d=await api('/api/nlq?'+new URLSearchParams({prompt:document.querySelector('#nlqPrompt').value}));if(d.applied){applyNlqState(d.interpretation);await loadRecords();}renderNlq(d);}
  catch(e){nlqOutput().innerHTML=`<p>Query not applied: ${esc(publicationText(e.message))}</p>`;}
  finally{btn.disabled=false;document.querySelectorAll('[data-nlq-example]').forEach(b=>b.disabled=false);}
}

async function init(){
  const [o,x]=await Promise.all([api('/api/options'),api('/api/crosstab?field_a=dt_capability&field_b=vct_capability')]); renderFilters(o); renderCrosstab(x); await loadRecords();
  document.querySelector('#nlqForm').addEventListener('submit',e=>{e.preventDefault();runNlq()});
  document.querySelectorAll('[data-nlq-example]').forEach(b=>b.addEventListener('click',()=>{document.querySelector('#nlqPrompt').value=b.dataset.nlqExample;runNlq()}));
  document.querySelectorAll('[data-filter-field],[data-bool-filter],#roleInclude,#roleExclude,#searchInput').forEach(e=>e.addEventListener('change',invalidateNlq));
  document.querySelector('#applyBtn').addEventListener('click',()=>{invalidateNlq();state.page=1;loadRecords()}); document.querySelector('#resetBtn').addEventListener('click',resetFilters); document.querySelector('#searchInput').addEventListener('keydown',e=>{if(e.key==='Enter'){invalidateNlq();state.page=1;loadRecords()}}); document.querySelector('#pageSize').addEventListener('change',e=>{state.pageSize=Number(e.target.value);state.page=1;loadRecords()}); document.querySelector('#prevPage').addEventListener('click',()=>{state.page--;loadRecords()}); document.querySelector('#nextPage').addEventListener('click',()=>{state.page++;loadRecords()});
  document.querySelector('#closeDialog').addEventListener('click',()=>document.querySelector('#detailDialog').close());
}
init().catch(e=>{document.body.insertAdjacentHTML('afterbegin',`<div class="notice">Initialization error: ${esc(e.message)}</div>`)});
