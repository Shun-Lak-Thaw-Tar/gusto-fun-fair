import React,{useState} from 'react';
import {api,date} from './api';
import {useResource,State,Panel,Table,Action} from './ui';
export function QuizLeaderboard(){
  const [notice,n]=useState('');
  const r=useResource(()=>api('/admin/quiz/leaderboard'));
  return <>{notice&&<p className="notice" role="status">{notice}</p>}<Panel title="Quiz leaderboard"><p>Every attempt that answered all five questions correctly within the 50-second limit, fastest first. Removing an entry disqualifies it — the account's pre-order code stays used, so it does not free up a second attempt.</p><State resource={r}>{d=><Table empty="No perfect-score attempts yet." rows={d.leaderboard.map(entry=>({...entry,_id:entry.attemptId}))} columns={[{label:'Rank',render:e=>`#${e.rank}`},{label:'Name',key:'name'},{label:'Score',render:e=>`${e.score} / 5`},{label:'Time',render:e=>`${(e.elapsedMs/1000).toFixed(1)}s`},{label:'Submitted · MMT',render:e=>date(e.submittedAt)},{label:'Actions',render:e=><Action confirm={`Remove ${e.name} (#${e.rank}, ${(e.elapsedMs/1000).toFixed(1)}s) from the leaderboard? This cannot be undone.`} onAction={async()=>{await api(`/admin/quiz/attempts/${e.attemptId}`,{method:'DELETE'});n('Leaderboard entry removed.');r.reload();}}>Remove</Action>}]}/>}</State></Panel></>;
}
