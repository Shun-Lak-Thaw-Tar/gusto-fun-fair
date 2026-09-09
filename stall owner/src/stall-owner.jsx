import React,{useState} from 'react';
import {Link,NavLink,Outlet,useLocation,useOutletContext} from 'react-router-dom';
import {api,mediaUrl,money,date,publicStallUrl} from './api';
import {useResource,State,Table,Toolbar,Modal,Badge} from './ui';
import {NavIcon} from './icons';
import {BannerSpirit} from './mascot';
import './stall-owner.css';

const navigation=[['dashboard','Home'],['stall','My Stall'],['menu','Menu'],['orders','Orders'],['sales','Sales'],['share','Share']];
const greeting=()=>{const hour=Number(new Date().toLocaleString('en-GB',{timeZone:'Asia/Yangon',hour:'2-digit',hour12:false}));return hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';};
const foodKey=entry=>String(entry.stallFoodId||entry.foodId||entry.foodItemId||entry.legacyOrStallFoodId||entry.foodName);
const discountLabel=discount=>!discount||!discount.value?null:discount.type==='percentage'?`${discount.value}% OFF`:`${money(discount.value)} OFF`;

export function Empty({title,hint}){return <div className="so-empty"><span aria-hidden="true">⌑</span><h3>{title}</h3><p>{hint}</p></div>;}
export function StatCard({value,label,hint,tone=''}){return <div className={`so-stat ${tone}`}><strong>{value}</strong><span>{label}</span>{hint&&<small>{hint}</small>}</div>;}
export function SectionTitle({children,note}){return <div className="so-section-title"><h2>{children}</h2>{note&&<span>{note}</span>}</div>;}

export function FoodRanking({foods}){
 if(!foods.length)return <Empty title="No approved sales yet" hint="Your ranking appears once customer payments are approved."/>;
 return <ol className="so-rank">{foods.slice(0,6).map((food,index)=><li key={foodKey(food)}>
  <span className="so-rank-no">{index+1}</span>
  <span className="so-rank-name">{food.foodName}</span>
  <span className="so-rank-qty">{food.quantitySold}×</span>
  <span className="so-rank-money">{money(food.approvedRevenue)}</span>
 </li>)}</ol>;
}

export function RecentOrderCard({order}){return <article className="so-order-card">
 <header><strong>{order.paymentReference}</strong><Badge value={order.status}/></header>
 <p>{order.items.map(item=>`${item.foodName} ×${item.quantity}`).join(' • ')}</p>
 <footer><small>{date(order.createdAt)}</small><strong>{money(order.stallSubtotal)}</strong></footer>
</article>;}

export function FoodCard({entry,ordered}){
 const image=mediaUrl(entry.food?.image?.url);
 const discount=discountLabel(entry.discount);
 return <article className="so-food-card">
  <div className="so-food-image">
   {image?<img src={image} alt=""/>:<span aria-hidden="true"><NavIcon name="foods"/></span>}
   {discount&&<span className="so-food-discount">{discount}</span>}
  </div>
  <div className="so-food-body">
   <h3>{entry.food?.name||'Food'}</h3>
   <p className="so-price">{money(entry.preorderPrice)}{entry.preorderPrice!==entry.eventDayPrice&&<span className="so-price-alt">Event day {money(entry.eventDayPrice)}</span>}</p>
   <div className="so-food-meta">
    <span className={entry.isAvailable?'so-dot on':'so-dot off'}>{entry.isAvailable?`${entry.ticketsRemaining} available`:'Unavailable'}</span>
    {ordered>0&&<span className="so-food-ordered">{ordered} ordered</span>}
   </div>
  </div>
 </article>;
}

export function StallOwnerLayout({user,logout}){
 const location=useLocation(),[open,setOpen]=useState(false);
 const resource=useResource(()=>api('/stall-owner/dashboard'));
 React.useEffect(()=>setOpen(false),[location.pathname]);
 return <div className="so-shell">
  <header className="so-topbar">
   <div className="so-topbar-row">
    <NavLink to="/dashboard" className="so-brand"><img className="gusto-logo" src="/gusto-logo.png" alt="Gusto College logo"/><span>GUSTO FUN FAIR</span></NavLink>
    <div className="so-topbar-stall"><small>MY STALL</small><strong>{resource.data?.stall?.stallName||'…'}</strong></div>
    <div className="so-topbar-account">
     <span className="so-owner-name">{user.name}</span>
     <button className="so-signout" onClick={logout}>Sign out</button>
     <button className="so-menu-toggle" aria-label="Toggle navigation" aria-expanded={open} onClick={()=>setOpen(!open)}>{open?'✕':'☰'}</button>
    </div>
   </div>
   <nav className={`so-nav ${open?'open':''}`} aria-label="Stall owner navigation">
    {navigation.map(([path,title])=><NavLink key={path} to={`/${path}`} onClick={()=>setOpen(false)}>{title}</NavLink>)}
   </nav>
  </header>
  {open&&<button className="scrim" aria-label="Close navigation" onClick={()=>setOpen(false)}/>}
  <main className="so-content"><State resource={resource}>{data=><Outlet context={data}/>}</State></main>
  <footer className="so-footer">Gusto Fun Fair · Stall Owner<span>Approved sales only · All times in Myanmar Time</span></footer>
 </div>;
}

export function OwnerDashboard(){
 const {owner,stall,summary}=useOutletContext();
 const resource=useResource(async()=>{const [sales,orders]=await Promise.all([api('/stall-owner/sales'),api('/stall-owner/orders')]);return {sales,orders};});
 return <State resource={resource}>{({sales,orders})=><>
  <section className="so-hero">
   <div className="so-hero-text">
    <p className="so-eyebrow">GUSTO FUN FAIR · 2026</p>
    <h1>{greeting()},<br/>{stall.stallName}.</h1>
    <p>Here's how your stall is doing at GUSTO Fun Fair.</p>
   </div>
   <BannerSpirit/>
  </section>

  <div className="so-stats">
   <StatCard value={orders.summary.approvedOrderCount} label="Orders" hint="Approved orders that include your stall"/>
   <StatCard value={summary.foodTicketsSold} label="Items sold" hint="Total quantity across all of your foods"/>
   <StatCard tone="red" value={money(summary.approvedRevenue)} label="Sales" hint="Completed sales only"/>
  </div>

  <section className="so-feature">
   <div className="so-feature-image">{mediaUrl(stall.image?.url)?<img src={mediaUrl(stall.image.url)} alt={stall.stallName}/>:<span aria-hidden="true"><NavIcon name="stalls"/></span>}</div>
   <div className="so-feature-body">
    <p className="so-eyebrow">MY STALL</p>
    <h2>{stall.stallName}</h2>
    <p>{stall.description||'No description has been added for this stall yet.'}</p>
    <Link className="so-text-link" to="/stall">View my stall →</Link>
   </div>
  </section>

  <div className="so-two">
   <section className="so-panel">
    <SectionTitle note={sales.foods.length?`${sales.foods.length} foods sold`:null}>Top food</SectionTitle>
    <FoodRanking foods={sales.foods}/>
   </section>
   <section className="so-panel">
    <SectionTitle note="Your items only">Recent orders</SectionTitle>
    {orders.orders.length?<><div className="so-order-list">{orders.orders.slice(0,5).map(order=><RecentOrderCard key={order.orderId} order={order}/>)}</div><Link className="so-text-link" to="/orders">View all orders →</Link></>:<Empty title="No approved orders yet" hint="Approved customer orders containing your foods appear here."/>}
   </section>
  </div>
 </>}</State>;
}

export function OwnerStall(){
 const {stall}=useOutletContext(),image=mediaUrl(stall.image?.url),discount=discountLabel(stall.discount);
 const resource=useResource(()=>api('/stall-owner/foods'));
 return <div className="so-stall-feature">
  <div className="so-stall-feature-image">{image?<img src={image} alt={stall.stallName}/>:<span aria-hidden="true"><NavIcon name="stalls"/></span>}</div>
  <div className="so-stall-feature-body">
   <p className="so-eyebrow">YOUR STALL</p>
   <h1>{stall.stallName}</h1>
   <p className="so-stall-desc">{stall.description||'No description has been added for this stall yet.'}</p>
   <dl className="so-stall-facts">
    <div><dt>Batch</dt><dd>{stall.batch}</dd></div>
    <div><dt>Menu items</dt><dd>{resource.loading?'…':resource.data?.foods.length??'—'}</dd></div>
    <div><dt>Status</dt><dd>{stall.isActive?'Active':'Inactive'}</dd></div>
   </dl>
   {discount&&<span className="so-tag red">{discount}</span>}
   <p className="so-hint">GUSTO FUN FAIR · 2026 — stall details are managed by the event administrator.</p>
  </div>
 </div>;
}

export function OwnerMenu(){
 const resource=useResource(async()=>{const [foods,sales]=await Promise.all([api('/stall-owner/foods'),api('/stall-owner/sales')]);return {foods:foods.foods,sold:new Map(sales.foods.map(food=>[foodKey(food),food.quantitySold]))};});
 return <State resource={resource}>{({foods,sold})=><>
  <SectionTitle note={`${foods.length} foods on your menu`}>Menu</SectionTitle>
  {foods.length?<div className="so-food-grid">{foods.map(entry=><FoodCard key={String(entry.stallFoodId)} entry={entry} ordered={sold.get(foodKey(entry))||0}/>)}</div>:<Empty title="No foods on your menu yet" hint="The event administrator adds foods to your stall."/>}
 </>}</State>;
}

export function OwnerOrders(){
 const resource=useResource(()=>api('/stall-owner/orders'));
 const [search,setSearch]=useState(''),[selected,setSelected]=useState(null);
 return <State resource={resource}>{({orders,summary})=>{
  const term=search.trim().toLowerCase();
  const rows=term?orders.filter(order=>order.paymentReference.toLowerCase().includes(term)||order.items.some(item=>item.foodName.toLowerCase().includes(term))):orders;
  return <>
   <SectionTitle note={`${summary.approvedOrderCount} approved orders include your stall`}>Orders</SectionTitle>
   {orders.length?<><Toolbar search={search} setSearch={setSearch} placeholder="Search order reference or food…"/>
   <div className="so-panel so-table-panel"><Table pageSize={12} empty="No orders match your search." rows={rows} columns={[
    {label:'Order',render:order=><strong className="so-reference">{order.paymentReference}</strong>},
    {label:'Items',render:order=>order.items.map(item=>`${item.foodName} ×${item.quantity}`).join(' • ')},
    {label:'Quantity',render:order=>order.stallQuantity},
    {label:'Amount',render:order=><strong>{money(order.stallSubtotal)}</strong>},
    {label:'Status',render:order=><Badge value={order.status}/>},
    {label:'Date',render:order=>date(order.createdAt)},
    {label:'',render:order=><button className="so-link" onClick={()=>setSelected(order)}>View</button>},
   ]}/></div></>:<Empty title="No approved orders yet" hint="Orders appear here after the administrator approves the customer payment."/>}
   {selected&&<Modal title={selected.paymentReference} onClose={()=>setSelected(null)}>
    <p className="so-modal-note">Only the items belonging to your stall are shown.</p>
    <Table pageSize={20} rows={selected.items} columns={[
     {label:'Food',render:item=>item.foodName},
     {label:'Quantity',render:item=>item.quantity},
     {label:'Unit price',render:item=>money(item.unitPrice)},
     {label:'Subtotal',render:item=>money(item.subtotal)},
    ]}/>
    <p className="so-modal-total"><span>Your total for this order</span><strong>{money(selected.stallSubtotal)}</strong></p>
   </Modal>}
  </>;
 }}</State>;
}

export function OwnerSales(){
 const resource=useResource(async()=>{const [sales,orders]=await Promise.all([api('/stall-owner/sales'),api('/stall-owner/orders')]);return {sales,orders};});
 return <State resource={resource}>{({sales,orders})=>{
  return <>
   <section className="so-hero so-hero-compact">
    <div className="so-hero-text">
     <p className="so-eyebrow">SALES</p>
     <h1>{money(sales.summary.approvedRevenue)}</h1>
     <p>Approved payments only.</p>
    </div>
   </section>
   <div className="so-stats">
    <StatCard value={orders.summary.approvedOrderCount} label="Approved orders"/>
    <StatCard value={sales.summary.foodTicketsSold} label="Items sold"/>
   </div>
   <section className="so-panel">
    <SectionTitle>Sales by food</SectionTitle>
    {sales.foods.length?<Table pageSize={10} rows={sales.foods} columns={[
     {label:'Food',render:food=><strong>{food.foodName}</strong>},
     {label:'Qty',render:food=>food.quantitySold},
     {label:'Revenue',render:food=><strong className="so-money-cell">{money(food.approvedRevenue)}</strong>},
    ]}/>:<Empty title="No approved sales yet" hint="Quantities appear once payments are approved."/>}
   </section>
  </>;
 }}</State>;
}

export function OwnerShare(){
 const resource=useResource(()=>api('/stall-owner/share'));
 const [message,setMessage]=useState('');
 return <State resource={resource}>{({share})=>{
  // The invitation lives on this same app, so its own origin is correct here — unlike the customer
  // destination below, which is a separate, already-hosted site and must never be window.location.origin.
  const invitationUrl=`${window.location.origin}/invite/${share.slug}`;
  const invitationPath=`/invite/${share.slug}`;
  const stallUrl=publicStallUrl(share.slug);
  return <>
   <section className="so-hero so-hero-compact">
    <div className="so-hero-text">
     <p className="so-eyebrow">PROMOTE</p>
     <h1>Share your<br/>stall.</h1>
     <p>Give customers a little invitation to your GUSTO stall.</p>
    </div>
   </section>
   <div className="so-share">
    <article className="so-share-card">
     <div className="so-share-image">{mediaUrl(share.image?.url)?<img src={mediaUrl(share.image.url)} alt={share.stallName}/>:<span aria-hidden="true"><NavIcon name="stalls"/></span>}</div>
     <div className="so-share-body">
      {share.eventName&&<p className="so-eyebrow">{share.eventName}</p>}
      <h2>{share.stallName}</h2>
      <p>Your animated invitation is ready.</p>
      <a className="so-text-link light" href={invitationPath} target="_blank" rel="noreferrer">Preview invitation →</a>
     </div>
    </article>
    <section className="so-panel">
     <SectionTitle>Invitation link</SectionTitle>
     <p className="so-link-box">{invitationUrl}</p>
     <div className="so-share-actions">
      <button className="so-button primary" onClick={async()=>{try{if(navigator.share)await navigator.share({title:`${share.stallName} · GUSTO Fun Fair`,text:`You're invited to visit ${share.stallName} at GUSTO Fun Fair!`,url:invitationUrl});else setMessage('Sharing is not supported in this browser. Copy the link instead.');}catch{}}}>Share invitation →</button>
      <button className="so-button secondary" onClick={async()=>{try{await navigator.clipboard.writeText(invitationUrl);setMessage('Invitation link copied.');}catch{setMessage('Copy the link above manually.');}}}>Copy invitation link</button>
     </div>
     {message&&<p className="so-copied" role="status">{message}</p>}
     <a className="so-text-link" href={stallUrl} target="_blank" rel="noreferrer">View public stall →</a>
     <p className="so-modal-note">This invitation link stays the same even if the stall name is edited.</p>
    </section>
   </div>
  </>;
 }}</State>;
}
