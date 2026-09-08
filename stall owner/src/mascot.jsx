import React,{useState} from 'react';
import './mascot.css';

// The Fun Fair forest spirit: a small one for the dashboard, a large one for sign in.
export function BannerSpirit(){
 const [paused,setPaused]=useState(false);
 return <div className={`banner-mascot ${paused?'paused':''}`}>
  <svg viewBox="0 0 260 110" role="img" aria-label="A big fluffy forest spirit holding a leaf over its head in the rain, with a tiny spirit hopping beside it">
   <g className="rain">
    <path className="drop" d="M42 8v7"/>
    <path className="drop d2" d="M72 2v7"/>
    <path className="drop d3" d="M182 6v7"/>
    <path className="drop d4" d="M228 0v7"/>
    <path className="drop d5" d="M250 14v7"/>
   </g>

   <path className="play-ground" d="M12 94h236"/>
   <ellipse className="spirit-shadow" cx="120" cy="95" rx="36" ry="4"/>
   <ellipse className="spirit-shadow mini" cx="206" cy="95" rx="12" ry="2.5"/>

   <g className="play-spirit">
    <path className="spirit-fur" d="M92 36q-2-19 4-21 6 6 8 17z"/>
    <path className="spirit-fur" d="M148 36q2-19-4-21-6 6-8 17z"/>

    <path className="spirit-whisker" d="M90 38l-16-5M89 45h-17M90 52l-16 5"/>
    <path className="spirit-whisker" d="M150 38l16-5M151 45h17M150 52l16 5"/>

    <path className="spirit-fur" d="M120 22c26 0 35 20 35 40 0 21-15 32-35 32s-35-11-35-32c0-20 9-40 35-40z"/>
    <ellipse className="spirit-arm left-arm" cx="87" cy="62" rx="6" ry="12"/>
    <ellipse className="spirit-arm" cx="153" cy="62" rx="6" ry="12"/>
    <path className="spirit-belly" d="M120 44c16 0 22 12 22 25 0 13-10 22-22 22s-22-9-22-22 6-25 22-25z"/>
    <path className="spirit-mark" d="M108 62l5-6 5 6M122 62l5-6 5 6M112 76l5-6 5 6M126 76l5-6 5 6"/>

    <ellipse className="spirit-blush" cx="101" cy="52" rx="5.5" ry="3"/>
    <ellipse className="spirit-blush" cx="139" cy="52" rx="5.5" ry="3"/>
    <g className="spirit-eyes">
     <circle className="eye-white" cx="108" cy="40" r="6"/>
     <circle className="eye-white" cx="132" cy="40" r="6"/>
     <circle className="eye-pupil" cx="109" cy="41" r="2.8"/>
     <circle className="eye-pupil" cx="133" cy="41" r="2.8"/>
     <circle className="eye-glint" cx="107" cy="38.5" r="1.2"/>
     <circle className="eye-glint" cx="131" cy="38.5" r="1.2"/>
    </g>
    <path className="spirit-nose" d="M117 48h6l-3 4z"/>
    <path className="spirit-mouth" d="M113 55q7 6 14 0"/>

    <ellipse className="spirit-foot" cx="107" cy="92" rx="9" ry="4.5"/>
    <ellipse className="spirit-foot" cx="133" cy="92" rx="9" ry="4.5"/>

    <g className="spirit-leaf">
     <path className="leaf-stem" d="M103 17q-6 3-8 8"/>
     <path className="leaf-blade" d="M103 16q9-19 37-13 5 19-37 13z"/>
     <path className="leaf-vein" d="M104 15q17 1 35-11M113 14l3-6M122 14l4-6M131 12l4-5"/>
    </g>
   </g>

   <g className="mini-spirit">
    <path className="spirit-fur" d="M199 78q0-8 3-9 2 3 3 7z"/>
    <path className="spirit-fur" d="M213 78q0-8-3-9-2 3-3 7z"/>
    <ellipse className="spirit-fur" cx="206" cy="83" rx="11" ry="11"/>
    <ellipse className="spirit-belly" cx="206" cy="86" rx="6.5" ry="7"/>
    <circle className="eye-pupil" cx="202" cy="80" r="2"/>
    <circle className="eye-pupil" cx="210" cy="80" r="2"/>
    <circle className="eye-glint" cx="201.3" cy="79.3" r=".8"/>
    <circle className="eye-glint" cx="209.3" cy="79.3" r=".8"/>
    <path className="spirit-mouth" d="M204 85q2 2 4 0"/>
   </g>

   <g className="play-spark"><circle cx="176" cy="60" r="1.8"/><circle cx="60" cy="70" r="1.4"/><circle cx="240" cy="66" r="1.6"/></g>
  </svg>
  <button type="button" className="motion-toggle" aria-label={paused?'Play banner animation':'Pause banner animation'} aria-pressed={paused} onClick={()=>setPaused(!paused)}>{paused?'Play':'Pause'}</button>
 </div>;
}

export function LoginSpirit(){
 const [paused,setPaused]=useState(false);
 return <div className={`login-totoro ${paused?'is-paused':''}`}>
  <svg viewBox="0 0 340 200" role="img" aria-label="Totoro swaying happily and reaching for a floating leaf">
   <ellipse cx="170" cy="182" rx="106" ry="7" fill="#5DCAD1" opacity=".15"/>
   <g className="totoro-sway">
    <path d="M220 143q51-12 39 17-8 14-35 7" fill="#457B9D" stroke="#5DCAD1" strokeWidth="2"/>
    <path d="M122 65 119 21q1-13 10-3l21 39m39 0 18-40q7-11 11 2l-3 50" fill="#457B9D" stroke="#5DCAD1" strokeWidth="2.5" strokeLinejoin="round"/>
    <path d="M165 48c-44 0-64 42-65 85-2 37 18 49 65 49s75-9 72-47c-4-44-23-87-72-87Z" fill="#457B9D" stroke="#5DCAD1" strokeWidth="2.5"/>
    <ellipse cx="169" cy="137" rx="51" ry="42" fill="#FFFAE8"/>
    <g fill="none" stroke="#E63946" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="m142 119 7-5 7 5m12-5 7-5 7 5m12 5 7-5 7 5m-66 23 7-5 7 5m12-1 7-5 7 5m12 1 7-5 7 5"/></g>
    <g className="totoro-blink"><ellipse cx="146" cy="77" rx="10" ry="10" fill="#FFFAE8"/><ellipse cx="190" cy="77" rx="10" ry="10" fill="#FFFAE8"/><circle cx="149" cy="77" r="3.5" fill="#E63946"/><circle cx="188" cy="77" r="3.5" fill="#E63946"/></g>
    <path d="m161 80 8-3 7 3-7 5Z" fill="#E63946"/>
    <path d="M148 91q21 15 43-1-20 27-43 1Z" fill="#FFFAE8" stroke="#E63946" strokeWidth="1.5"/>
    <path d="m157 95 2 6m9-4v6m10-7-1 6M126 83l-26-7m25 13-29 1m29 6-23 8m105-21 27-8m-25 15 29 1m-29 6 23 8" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round"/>
    <path d="M111 109q-27 14-22 36 9 8 24-18" fill="#457B9D" stroke="#5DCAD1" strokeWidth="2"/>
    <path className="totoro-wave" d="M223 116q31-7 29-35-12-11-21 12l-15 12" fill="#457B9D" stroke="#5DCAD1" strokeWidth="2"/>
    <ellipse cx="132" cy="178" rx="18" ry="7" fill="#457B9D"/><ellipse cx="207" cy="178" rx="18" ry="7" fill="#457B9D"/>
   </g>
   <g className="totoro-leaf"><path d="M241 45q1-29 40-24-2 30-40 24Z" fill="#5DCAD1"/><path d="m234 53 34-25m-18 14 1-12m5 7 12 1" fill="none" stroke="#E63946" strokeWidth="2" strokeLinecap="round"/></g>
   <g className="totoro-sparkles" fill="none" stroke="#5DCAD1" strokeWidth="2" strokeLinecap="round"><path d="M68 59v10m-5-5h10m205 60v8m-4-4h8"/><circle cx="78" cy="126" r="3"/></g>
  </svg>
  <button type="button" className="totoro-pause" aria-pressed={paused} onClick={()=>setPaused(!paused)}>{paused?'Play animation':'Pause animation'}</button>
 </div>;
}
