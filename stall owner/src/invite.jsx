import React,{useEffect,useState} from 'react';
import {useParams} from 'react-router-dom';
import {api,mediaUrl,publicStallUrl,PUBLIC_SITE_URL} from './api';
import {NavIcon} from './icons';
import './invite.css';

const eventDateLabel=value=>value?new Date(value).toLocaleDateString('en-GB',{timeZone:'Asia/Yangon',day:'numeric',month:'long',year:'numeric'}):'';

function InviteShell({children}){
 return <div className="gi-page"><div className="gi-topmark"><img className="gi-logo" src="/gusto-logo.png" alt="Gusto College logo"/><span>GUSTO FUN FAIR</span></div>{children}</div>;
}

function InviteState({tone='',icon,title,hint,action}){
 return <InviteShell><div className={`gi-state ${tone}`}><span className="gi-state-icon" aria-hidden="true">{icon}</span><h1>{title}</h1><p>{hint}</p>{action}</div></InviteShell>;
}

export default function PublicInvitation(){
 const {slug}=useParams();
 const [phase,setPhase]=useState('loading'); // loading | notfound | error | ready
 const [data,setData]=useState(null);
 const [attempt,setAttempt]=useState(0);

 useEffect(()=>{
  let active=true;
  setPhase('loading');
  (async()=>{
   try{
    const [stallResult,eventResult]=await Promise.all([
     api(`/stalls/by-slug/${encodeURIComponent(slug)}`),
     api('/event').catch(()=>null),
    ]);
    if(!active)return;
    setData({stall:stallResult.stall,foods:stallResult.foods||[],event:eventResult?.event||null});
    setPhase('ready');
   }catch(e){
    if(!active)return;
    setPhase(e.status===404?'notfound':'error');
   }
  })();
  return ()=>{active=false;};
 },[slug,attempt]);

 useEffect(()=>{
  if(phase==='ready'&&data)document.title=`${data.stall.stallName} · You're Invited | Gusto Fun Fair`;
  else document.title='Gusto Fun Fair · Invitation';
 },[phase,data]);

 if(phase==='loading')return <InviteState icon={<span className="gi-spinner" role="status" aria-label="Loading"/>} title="Preparing your invitation…" hint="Gathering the details for this stall."/>;
 if(phase==='notfound')return <InviteState tone="notfound" icon="✦" title="This invitation is no longer available." hint="The stall may have been renamed, deactivated, or does not exist." action={<a className="gi-button ghost" href={PUBLIC_SITE_URL}>Visit Gusto Fun Fair ↗</a>}/>;
 if(phase==='error')return <InviteState tone="error" icon="!" title="We couldn't load this invitation." hint="Check your connection and try again." action={<button className="gi-button" onClick={()=>setAttempt(a=>a+1)}>Try again</button>}/>;

 const {stall,foods,event}=data;
 const image=mediaUrl(stall.image?.url);
 const teaserNames=foods.map(entry=>entry.food?.name).filter(Boolean).slice(0,3);
 const destination=publicStallUrl(stall.slug);
 const eventDate=eventDateLabel(event?.eventDate);

 return <InviteShell>
  <div className="gi-scene">
   <div className="gi-envelope" aria-hidden="true">
    <div className="gi-envelope-body"/>
    <div className="gi-flap"/>
   </div>
   <div className="gi-sparkles" aria-hidden="true">
    <span className="gi-sparkle s1">✦</span>
    <span className="gi-sparkle s2">✧</span>
    <span className="gi-sparkle s3">✦</span>
    <span className="gi-sparkle s4">✧</span>
    <span className="gi-sparkle s5">✦</span>
   </div>
   <article className="gi-card">
    <p className="gi-eyebrow">GUSTO FUN FAIR{event?.eventName?` · ${event.eventName}`:''}</p>
    <h1 className="gi-headline">You're invited</h1>
    <div className="gi-card-image">{image?<img src={image} alt=""/>:<span aria-hidden="true"><NavIcon name="stalls"/></span>}</div>
    <h2 className="gi-stall-name">{stall.stallName}</h2>
    {stall.description&&<p className="gi-description">{stall.description}</p>}
    <div className="gi-facts">
     <span className="gi-fact">{foods.length} menu item{foods.length===1?'':'s'}</span>
     {eventDate&&<span className="gi-fact">{eventDate}</span>}
     {stall.batch&&<span className="gi-fact">Batch {stall.batch}</span>}
    </div>
    {teaserNames.length>0&&<p className="gi-teaser">{teaserNames.join(' · ')}{foods.length>teaserNames.length?' · …':''}</p>}
    <a className="gi-button primary" href={destination}>Enter the Stall →</a>
   </article>
  </div>
 </InviteShell>;
}
