import React,{useState} from 'react';
import './login-totoro.css';

export function LoginTotoro(){
 const [paused,setPaused]=useState(false);
 return <div className={`login-totoro ${paused?'is-paused':''}`}>
  <svg viewBox="0 0 340 200" role="img" aria-label="Totoro swaying happily and reaching for a floating leaf">
   <ellipse cx="170" cy="182" rx="106" ry="7" fill="#A8DADC" opacity=".15"/>
   <g className="totoro-sway">
    <path d="M220 143q51-12 39 17-8 14-35 7" fill="#457B9D" stroke="#A8DADC" strokeWidth="2"/>
    <path d="M122 65 119 21q1-13 10-3l21 39m39 0 18-40q7-11 11 2l-3 50" fill="#457B9D" stroke="#A8DADC" strokeWidth="2.5" strokeLinejoin="round"/>
    <path d="M165 48c-44 0-64 42-65 85-2 37 18 49 65 49s75-9 72-47c-4-44-23-87-72-87Z" fill="#457B9D" stroke="#A8DADC" strokeWidth="2.5"/>
    <ellipse cx="169" cy="137" rx="51" ry="42" fill="#F1FAEE"/>
    <g fill="none" stroke="#1D3557" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="m142 119 7-5 7 5m12-5 7-5 7 5m12 5 7-5 7 5m-66 23 7-5 7 5m12-1 7-5 7 5m12 1 7-5 7 5"/></g>
    <g className="totoro-blink"><ellipse cx="146" cy="77" rx="10" ry="10" fill="#F1FAEE"/><ellipse cx="190" cy="77" rx="10" ry="10" fill="#F1FAEE"/><circle cx="149" cy="77" r="3.5" fill="#1D3557"/><circle cx="188" cy="77" r="3.5" fill="#1D3557"/></g>
    <path d="m161 80 8-3 7 3-7 5Z" fill="#1D3557"/>
    <path d="M148 91q21 15 43-1-20 27-43 1Z" fill="#F1FAEE" stroke="#1D3557" strokeWidth="1.5"/>
    <path d="m157 95 2 6m9-4v6m10-7-1 6M126 83l-26-7m25 13-29 1m29 6-23 8m105-21 27-8m-25 15 29 1m-29 6 23 8" fill="none" stroke="#1D3557" strokeWidth="2" strokeLinecap="round"/>
    <path d="M111 109q-27 14-22 36 9 8 24-18" fill="#457B9D" stroke="#A8DADC" strokeWidth="2"/>
    <path className="totoro-wave" d="M223 116q31-7 29-35-12-11-21 12l-15 12" fill="#457B9D" stroke="#A8DADC" strokeWidth="2"/>
    <ellipse cx="132" cy="178" rx="18" ry="7" fill="#457B9D"/><ellipse cx="207" cy="178" rx="18" ry="7" fill="#457B9D"/>
   </g>
   <g className="totoro-leaf"><path d="M241 45q1-29 40-24-2 30-40 24Z" fill="#A8DADC"/><path d="m234 53 34-25m-18 14 1-12m5 7 12 1" fill="none" stroke="#1D3557" strokeWidth="2" strokeLinecap="round"/></g>
   <g className="totoro-sparkles" fill="none" stroke="#A8DADC" strokeWidth="2" strokeLinecap="round"><path d="M68 59v10m-5-5h10m205 60v8m-4-4h8"/><circle cx="78" cy="126" r="3"/></g>
  </svg>
  <button type="button" className="totoro-pause" aria-pressed={paused} onClick={()=>setPaused(!paused)}>{paused?'Play animation':'Pause animation'}</button>
 </div>;
}
