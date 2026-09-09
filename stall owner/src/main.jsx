import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter,Routes,Route,Navigate,useLocation} from 'react-router-dom';
import {api,session} from './api';
import {Form} from './ui';
import {LoginSpirit} from './mascot';
import './base.css';
import {StallOwnerLayout,OwnerDashboard,OwnerStall,OwnerMenu,OwnerOrders,OwnerSales,OwnerShare} from './stall-owner';
import PublicInvitation from './invite';

function Login({user,onLogin}){
 if(user)return <Navigate to="/dashboard" replace/>;
 return <div className="so-login">
  <div className="so-login-brand">
   <img className="gusto-logo" src="/gusto-logo.png" alt="Gusto College logo"/>
   <p className="eyebrow">GUSTO FUN FAIR · 2026</p>
   <h1>Good food<br/>brings people<br/>together.</h1>
   <p>See how many people ordered your food, which dishes sell the most, and the approved sales your stall has made.</p>
   <span className="so-login-date">11 · 09 · 26</span>
   <LoginSpirit/>
  </div>
  <div className="so-login-form">
   <p className="eyebrow">STALL OWNER</p>
   <h2>Welcome back.</h2>
   <p>Use the stall owner account the event administrator gave you.</p>
   <Form fields={[{key:'name',label:'Account name',required:true,minLength:2,maxLength:50},{key:'password',label:'Password',type:'password',required:true,minLength:8,maxLength:128}]} onSave={async credentials=>{
    const data=await api('/auth/login',{method:'POST',body:credentials});
    if(data.user.role!=='stall_owner'){session.clear();throw new Error('This portal is for stall owner accounts only.');}
    session.set(data.token);onLogin(data.user);
   }}/>
   <small>Only approved sales are shown. Administrators sign in to their own workspace.</small>
  </div>
 </div>;
}

function App(){
 // Public invitations never touch stall-owner session state — no /auth/me call, no verifying-session gate.
 const isInvite=useLocation().pathname.startsWith('/invite/');
 const [user,setUser]=useState(null),[checking,check]=useState(!isInvite),[authError,setAuthError]=useState(''),[retry,setRetry]=useState(0);
 useEffect(()=>{
  if(isInvite)return;
  let active=true;check(true);setAuthError('');if(!session.get()){check(false);return;}
  api('/auth/me').then(d=>{if(active){if(d.user.role==='stall_owner')setUser(d.user);else session.clear();}}).catch(e=>{if(active&&e.status!==401)setAuthError(e.message);}).finally(()=>active&&check(false));
  return()=>{active=false;};},[retry,isInvite]);
 useEffect(()=>{const clear=()=>setUser(null);window.addEventListener('monitor:unauthorized',clear);return()=>window.removeEventListener('monitor:unauthorized',clear);},[]);
 if(!isInvite&&checking)return <div className="state" role="status"><span className="spinner"/>Verifying your stall owner session…</div>;
 if(!isInvite&&authError)return <div className="state error" role="alert"><h3>Unable to verify your session</h3><p>{authError}</p><button onClick={()=>setRetry(x=>x+1)}>Retry</button><button onClick={()=>{session.clear();setAuthError('');setUser(null);}}>Return to sign in</button></div>;
 const logout=()=>{session.clear();setUser(null);};
 return <Routes>
  <Route path="/invite/:slug" element={<PublicInvitation/>}/>
  <Route path="/login" element={<Login user={user} onLogin={setUser}/>}/>
  <Route path="/" element={user?<StallOwnerLayout user={user} logout={logout}/>:<Navigate to="/login" replace/>}>
   <Route index element={<Navigate to="dashboard" replace/>}/>
   <Route path="dashboard" element={<OwnerDashboard/>}/>
   <Route path="stall" element={<OwnerStall/>}/>
   <Route path="menu" element={<OwnerMenu/>}/>
   <Route path="orders" element={<OwnerOrders/>}/>
   <Route path="sales" element={<OwnerSales/>}/>
   <Route path="share" element={<OwnerShare/>}/>
   <Route path="*" element={<p>Page not found. Choose a page from the navigation.</p>}/>
  </Route>
  <Route path="*" element={<Navigate to={user?'/dashboard':'/login'} replace/>}/>
 </Routes>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><BrowserRouter basename="/stall-owner"><App/></BrowserRouter></React.StrictMode>);
