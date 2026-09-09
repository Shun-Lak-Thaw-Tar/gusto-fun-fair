import React, { useEffect, useRef, useState } from 'react';
import { id } from './api';

export function useResource(loader, deps = []) {
  const [state,set] = useState({ loading:true, data:null, error:'' }); const [version, bump] = useState(0);
  useEffect(() => { let active = true; set(s=>({...s,loading:true,error:''})); Promise.resolve().then(loader).then(data=>active&&set({data,loading:false,error:''})).catch(e=>active&&set({data:null,loading:false,error:e.message})); return()=>{active=false;}; }, [...deps,version]);
  return {...state,reload:()=>bump(v=>v+1)};
}
export function State({resource,children}) { if(resource.loading) return <div className="state" role="status"><span className="spinner"/>Loading your stall data…</div>; if(resource.error) return <div className="state error" role="alert"><h3>Unable to load this page</h3><p>{resource.error}</p><button onClick={resource.reload}>Try again</button></div>; return children(resource.data); }
export function Badge({value}) { return <span className={`badge ${/REJECT|EXPIRE|CANCEL|DISABLED|REUPLOAD/.test(value||'')?'critical':''}`}>{value || '—'}</span>; }
export function Table({columns,rows,empty='No records to show.',pageSize=10}) {
  const [page,setPage]=useState(1); useEffect(()=>setPage(1),[rows]); const pages=Math.max(1,Math.ceil(rows.length/pageSize));
  return !rows.length?<div className="state"><h3>{empty}</h3><p>Records will appear here when they are available.</p></div>:<><div className="table-scroll"><table><thead><tr>{columns.map(c=><th key={c.label}>{c.label}</th>)}</tr></thead><tbody>{rows.slice((page-1)*pageSize,page*pageSize).map((row,i)=><tr key={id(row)||i}>{columns.map(c=><td key={c.label} data-label={c.label}>{c.render?c.render(row):row[c.key]??'—'}</td>)}</tr>)}</tbody></table></div>{rows.length>pageSize&&<div className="pagination"><span>{rows.length} records · Page {page} of {pages}</span><button disabled={page===1} onClick={()=>setPage(page-1)}>Previous</button><button disabled={page===pages} onClick={()=>setPage(page+1)}>Next</button></div>}</>;
}
export function Toolbar({search,setSearch,placeholder='Search records…'}) {return <div className="toolbar"><input aria-label="Search records" type="search" placeholder={placeholder} value={search} onChange={e=>setSearch(e.target.value)}/></div>;}
export function Modal({title,onClose,children}) {
  const ref=useRef(); useEffect(()=>{const previous=document.activeElement;ref.current.showModal();return()=>previous?.focus();},[]);
  return <dialog ref={ref} onCancel={e=>{e.preventDefault();onClose();}}><header><h2>{title}</h2><button aria-label="Close dialog" className="icon-button" onClick={onClose}>×</button></header><div className="modal-body">{children}</div></dialog>;
}
export function Form({fields,onSave,submit='Sign in →'}) {
  const [values,set]=useState({}),[busy,setBusy]=useState(false),[error,setError]=useState('');
  async function save(e){e.preventDefault();setBusy(true);setError('');try{await onSave(values);}catch(e){setError(e.message);}finally{setBusy(false);}}
  return <form onSubmit={save} className="form-grid">{fields.map(f=><label key={f.key}><span>{f.label}</span><input aria-label={f.label} type={f.type||'text'} required={f.required} minLength={f.minLength} maxLength={f.maxLength} autoComplete={f.type==='password'?'current-password':'username'} value={values[f.key]??''} onChange={e=>set({...values,[f.key]:e.target.value})}/></label>)}{error&&<p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy}>{busy?'Signing in…':submit}</button></form>;
}
