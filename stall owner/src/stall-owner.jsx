import React,{useState} from 'react';
import {NavLink,Outlet,useLocation,useOutletContext} from 'react-router-dom';
import {api,mediaUrl,money,date} from './api';
import {useResource,State,Table,Toolbar,Modal,Badge} from './ui';
import {NavIcon} from './icons';
import {BannerSpirit} from './mascot';
import './stall-owner.css';

const navigation=[['','dashboard','Dashboard','dashboard'],['MY STALL','stall','My Stall','stalls'],['','menu','My Menu','foods'],['SALES','orders','Orders','orders'],['','sales','Sales','statistics'],['PROMOTE','share','Share Stall','share']];
const greeting=()=>{const hour=Number(new Date().toLocaleString('en-GB',{timeZone:'Asia/Yangon',hour:'2-digit',hour12:false}));return hour<12?'Good morning':hour<17?'Good afternoon':'Good evening';};
const foodKey=entry=>String(entry.stallFoodId||entry.foodId||entry.foodItemId||entry.legacyOrStallFoodId||entry.foodName);
const discountLabel=discount=>!discount||!discount.value?null:discount.type==='percentage'?`${discount.value}% OFF`:`${money(discount.value)} OFF`;

export function Empty({title,hint}){return <div className="so-empty"><span aria-hidden="true">⌑</span><h3>{title}</h3><p>{hint}</p></div>;}
export function StatCard({icon,value,label,hint,tone=''}){return <div className={`so-stat ${tone}`}><span className="so-stat-icon" aria-hidden="true"><NavIcon name={icon}/></span><strong>{value}</strong><span>{label}</span>{hint&&<small>{hint}</small>}</div>;}
export function SectionTitle({children,note}){return <div className="so-section-title"><h2>{children}</h2>{note&&<span>{note}</span>}</div>;}

export function FoodRanking({foods}){
 if(!foods.length)return <Empty title="No approved sales yet" hint="Your ranking appears once customer payments are approved."/>;
 const top=foods.slice(0,8),max=Math.max(1,...top.map(food=>food.quantitySold));
 return <ol className="so-rank">{top.map((food,index)=><li key={foodKey(food)}>
  <span className="so-rank-no">{String(index+1).padStart(2,'0')}</span>
  <div className="so-rank-body"><p><strong>{food.foodName}</strong><span>{food.quantitySold} ordered</span></p><div className="so-bar"><i style={{width:`${Math.max(6,Math.round(food.quantitySold/max*100))}%`}}/></div></div>
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
 return <article className="so-food-card">
  <div className="so-food-image">{image?<img src={image} alt=""/>:<span aria-hidden="true"><NavIcon name="foods"/></span>}</div>
  <div className="so-food-body">
   <h3>{entry.food?.name||'Food'}</h3>
   <p>{entry.food?.description||'No description provided.'}</p>
   <p className="so-price">{money(entry.preorderPrice)}{entry.preorderPrice!==entry.eventDayPrice&&<small>Event day {money(entry.eventDayPrice)}</small>}</p>
   <dl className="so-food-facts">
    <div><dt>Ordered</dt><dd className="so-strong-red">{ordered}</dd></div>
    <div><dt>Remaining</dt><dd>{entry.ticketsRemaining}</dd></div>
    <div><dt>Ticket limit</dt><dd>{entry.ticketLimit}</dd></div>
   </dl>
   <p className={entry.isAvailable?'so-dot on':'so-dot off'}>{entry.isAvailable?'Available':'Unavailable'}</p>
  </div>
 </article>;
}

export function StallOwnerLayout({user,logout}){
 const location=useLocation(),[open,setOpen]=useState(false);
 const resource=useResource(()=>api('/stall-owner/dashboard'));
 React.useEffect(()=>setOpen(false),[location.pathname]);
 return <div className="so-shell">
  <aside className={open?'so-sidebar open':'so-sidebar'}>
   <div className="so-brand"><img className="gusto-logo" src="/gusto-logo.png" alt="Gusto College logo"/><span><strong>MONITOR</strong><small>Gusto Stall Owner</small></span></div>
   <nav aria-label="Stall owner navigation">{navigation.map(([section,path,title,icon])=><React.Fragment key={path}>{section&&<p className="so-nav-section">{section}</p>}<NavLink to={`/stall-owner/${path}`}><span className="so-nav-icon" aria-hidden="true"><NavIcon name={icon}/></span>{title}</NavLink></React.Fragment>)}</nav>
   <div className="so-sidebar-footer"><span className="live-dot"/>Gusto Fun Fair<small>Stall owner portal · 2026</small></div>
  </aside>
  {open&&<button className="scrim" aria-label="Close navigation" onClick={()=>setOpen(false)}/>}
  <div className="so-main">
   <header className="so-header">
    <button className="so-menu" aria-label="Toggle navigation" aria-expanded={open} onClick={()=>setOpen(!open)}>☰</button>
    <div className="so-header-stall"><small>MY STALL</small><strong>{resource.data?.stall?.stallName||'…'}</strong></div>
    <div className="so-account"><div><strong>{user.name}</strong><small>Stall Owner</small></div><span className="so-avatar">{user.name?.slice(0,1).toUpperCase()}</span><button onClick={logout}>Sign out</button></div>
   </header>
   <main className="so-content"><State resource={resource}>{data=><Outlet context={data}/>}</State></main>
   <footer className="so-footer">Gusto Fun Fair · Stall Owner Portal<span>Approved sales only · All times in Myanmar Time</span></footer>
  </div>
 </div>;
}

export function OwnerDashboard(){
 const {owner,stall,summary}=useOutletContext();
 const resource=useResource(async()=>{const [sales,orders]=await Promise.all([api('/stall-owner/sales'),api('/stall-owner/orders')]);return {sales,orders};});
 return <State resource={resource}>{({sales,orders})=><>
  <section className="so-hero">
   <div className="so-hero-text"><p className="so-eyebrow">STALL PERFORMANCE</p><h1>{greeting()}, {owner.name}</h1><p>Here is how <strong>{stall.stallName}</strong> is performing right now.</p><span className="so-hero-tag">Batch {stall.batch}</span></div>
   <BannerSpirit/>
  </section>
  <div className="so-stats">
   <StatCard icon="orders" tone="blue" value={orders.summary.approvedOrderCount} label="Orders" hint="Approved orders that include your stall"/>
   <StatCard icon="foods" tone="light" value={summary.foodTicketsSold} label="Food items ordered" hint="Total quantity across all of your foods"/>
   <StatCard icon="tickets" tone="navy" value={orders.summary.approvedOrderCount} label="Digital tickets" hint="One approved order = one digital ticket"/>
  </div>
  <section className="so-revenue"><p>APPROVED REVENUE</p><strong>{money(summary.approvedRevenue)}</strong><small>Counted from approved payments only</small></section>
  <div className="so-two">
   <section className="so-panel">
    <SectionTitle note={sales.foods.length?`${sales.foods.length} foods sold`:null}>Most ordered foods</SectionTitle>
    <FoodRanking foods={sales.foods}/>
   </section>
   <section className="so-panel">
    <SectionTitle note="Your items only">Recent orders</SectionTitle>
    {orders.orders.length?<div className="so-order-list">{orders.orders.slice(0,5).map(order=><RecentOrderCard key={order.orderId} order={order}/>)}</div>:<Empty title="No approved orders yet" hint="Approved customer orders containing your foods appear here."/>}
   </section>
  </div>
 </>}</State>;
}

export function OwnerStall(){
 const {stall}=useOutletContext(),image=mediaUrl(stall.image?.url),discount=discountLabel(stall.discount);
 return <>
  <SectionTitle note="Managed by the event administrator">My stall</SectionTitle>
  <article className="so-stall-card">
   <div className="so-stall-image">{image?<img src={image} alt={stall.stallName}/>:<span aria-hidden="true"><NavIcon name="stalls"/></span>}</div>
   <div className="so-stall-body">
    <h2>{stall.stallName}</h2>
    <p className="so-stall-batch">Batch {stall.batch}</p>
    <p>{stall.description||'No description has been added for this stall yet.'}</p>
    <div className="so-stall-meta">
     {discount&&<span className="so-tag red">{discount}</span>}
     <span className={stall.isActive?'so-tag':'so-tag muted'}>{stall.isActive?'ACTIVE':'INACTIVE'}</span>
     <span className="so-tag muted">/{stall.slug}</span>
    </div>
   </div>
  </article>
 </>;
}

export function OwnerMenu(){
 const resource=useResource(async()=>{const [foods,sales]=await Promise.all([api('/stall-owner/foods'),api('/stall-owner/sales')]);return {foods:foods.foods,sold:new Map(sales.foods.map(food=>[foodKey(food),food.quantitySold]))};});
 return <State resource={resource}>{({foods,sold})=><>
  <SectionTitle note={`${foods.length} foods on your menu`}>My menu</SectionTitle>
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
   <div className="so-panel"><Table pageSize={12} empty="No orders match your search." rows={rows} columns={[
    {label:'Order reference',render:order=><strong className="so-reference">{order.paymentReference}</strong>},
    {label:'Your foods',render:order=>order.items.map(item=>`${item.foodName} ×${item.quantity}`).join(' • ')},
    {label:'Quantity',render:order=>order.stallQuantity},
    {label:'Your subtotal',render:order=><strong>{money(order.stallSubtotal)}</strong>},
    {label:'Status',render:order=><Badge value={order.status}/>},
    {label:'Date',render:order=>date(order.createdAt)},
    {label:'Details',render:order=><button className="so-link" onClick={()=>setSelected(order)}>View</button>},
   ]}/></div></>:<Empty title="No approved orders yet" hint="Orders appear here after the administrator approves the customer payment."/>}
   {selected&&<Modal title={`Order ${selected.paymentReference}`} onClose={()=>setSelected(null)}>
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
  const max=Math.max(1,...sales.foods.map(food=>food.approvedRevenue));
  return <>
   <SectionTitle note="Approved payments only">Sales</SectionTitle>
   <div className="so-stats">
    <StatCard icon="orders" tone="blue" value={orders.summary.approvedOrderCount} label="Approved orders"/>
    <StatCard icon="foods" tone="light" value={sales.summary.foodTicketsSold} label="Total food quantity"/>
    <StatCard icon="statistics" tone="red" value={money(sales.summary.approvedRevenue)} label="Approved revenue"/>
   </div>
   <div className="so-two">
    <section className="so-panel">
     <SectionTitle>Food sales</SectionTitle>
     {sales.foods.length?<Table pageSize={10} rows={sales.foods} columns={[
      {label:'Food',render:food=><strong>{food.foodName}</strong>},
      {label:'Quantity sold',render:food=>food.quantitySold},
     ]}/>:<Empty title="No approved sales yet" hint="Quantities appear once payments are approved."/>}
    </section>
    <section className="so-panel">
     <SectionTitle>Revenue by food</SectionTitle>
     {sales.foods.length?<ul className="so-revenue-list">{sales.foods.map(food=><li key={foodKey(food)}><p><strong>{food.foodName}</strong><span>{money(food.approvedRevenue)}</span></p><div className="so-bar red"><i style={{width:`${Math.max(6,Math.round(food.approvedRevenue/max*100))}%`}}/></div></li>)}</ul>:<Empty title="No revenue yet" hint="Approved orders build this breakdown."/>}
    </section>
   </div>
  </>;
 }}</State>;
}

export function OwnerShare(){
 const resource=useResource(()=>api('/stall-owner/share'));
 const [message,setMessage]=useState('');
 return <State resource={resource}>{({share})=>{
  const link=`${window.location.origin}${share.publicPath}`;
  return <>
   <SectionTitle note="Invite customers to your stall">Share stall</SectionTitle>
   <div className="so-share">
    <article className="so-share-card">
     <div className="so-share-image">{mediaUrl(share.image?.url)?<img src={mediaUrl(share.image.url)} alt={share.stallName}/>:<span aria-hidden="true"><NavIcon name="stalls"/></span>}</div>
     <div className="so-share-body">
      {share.eventName&&<p className="so-eyebrow">{share.eventName}</p>}
      <h2>{share.stallName}</h2>
      <p>Batch {share.batch}</p>
      {share.foodNames.length>0&&<p className="so-share-foods">{share.foodNames.join(' · ')}</p>}
     </div>
    </article>
    <section className="so-panel">
     <SectionTitle>Your public stall link</SectionTitle>
     <p className="so-link-box">{link}</p>
     <div className="so-share-actions">
      <button className="so-button" onClick={async()=>{try{await navigator.clipboard.writeText(link);setMessage('Link copied.');}catch{setMessage('Copy the link above manually.');}}}>Copy link</button>
      <button className="so-button ghost" onClick={async()=>{try{if(navigator.share)await navigator.share({title:share.stallName,url:link});else setMessage('Sharing is not supported in this browser. Copy the link instead.');}catch{}}}>Share</button>
     </div>
     {message&&<p className="so-copied" role="status">{message}</p>}
     <p className="so-modal-note">This is the stable public address of your stall. It stays the same even if the stall name is edited.</p>
    </section>
   </div>
  </>;
 }}</State>;
}
