import {test,expect} from '@playwright/test';
const order={_id:'o1',paymentReference:'FF-ORDER-ABC123',userId:{name:'Aye'},status:'PAYMENT_SUBMITTED',inventoryStatus:'RESERVED',totalAmount:6000,totalQuantity:2,createdAt:'2026-09-05T00:00:00Z',items:[{foodName:'Burger',stallName:'Food House',quantity:2,unitPrice:3000,subtotal:6000}]};
async function mock(page,{role='admin',signedIn=true}={}){
 if(signedIn)await page.addInitScript(()=>sessionStorage.setItem('monitor.token','test-token'));
 await page.route('**/api/**',async route=>{const url=new URL(route.request().url()),p=url.pathname;let body={};
 if(p==='/api/auth/me'||p==='/api/auth/login')body={user:{name:'Admin',role},token:'test-token'};
 else if(p.endsWith('/dashboard')||p.endsWith('/overview'))body={dashboard:{totalOrders:1,approvedRevenue:6000,pendingPaymentReview:1}};
 else if(p==='/api/admin/orders')body={orders:[order]};
 else if(p==='/api/admin/orders/o1')body={order,payment:{status:'SUBMITTED'},ticket:null};
 else if(p==='/api/admin/payments')body={payments:[{id:'p1',order,user:{name:'Aye'},status:'SUBMITTED',proofVersion:2,submittedAt:order.createdAt,proofs:[{version:2,imageUrl:'/api/payments/p1/proofs/2'}]}]};
 else if(p.includes('/proofs/'))return route.fulfill({status:200,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#A8DADC"/></svg>'});
 else if(p.startsWith('/api/admin/tickets/'))body={ticket:{code:'FF26-X82K91',status:p.endsWith('/redeem')?'REDEEMED':'ACTIVE',orderId:order,userId:{name:'Aye'}}};
 else if(p==='/api/admin/event')body={event:{eventName:'Gusto Fun Fair',eventDate:'2026-09-11T02:30:00Z',preorderOpenAt:'2026-09-08T02:30:00Z',preorderCloseAt:'2026-09-10T02:30:00Z',orderReservationMinutes:60,paymentProofGraceMinutes:30,featureFlags:{},orderingEnabled:true}};
 else if(p==='/api/admin/memories/window')body={snaps:{status:'NOT_CONFIGURED'}};
 else if(p==='/api/memories')body={memories:[],nextCursor:null};
 else if(p.includes('crush-letters'))body={crushLetters:[],pagination:{page:1,total:0,totalPages:0}};
 else if(p.endsWith('best-selling-stall'))body={leaders:[],stall:null};
 else if(p.endsWith('stall-foods'))body={stallFoods:[]};
 else if(p.endsWith('stalls'))body={stalls:[]};
 else if(p.endsWith('foods'))body={foods:[]};
 return route.fulfill({json:body});});
}
test('unauthenticated and non-admin users cannot access admin pages',async({page})=>{await mock(page,{signedIn:false,role:'user'});await page.goto('/admin/orders');await expect(page.getByRole('heading',{name:'Sign in to your workspace'})).toBeVisible();await page.getByLabel('Account name').fill('Customer');await page.getByLabel('Password',{exact:true}).fill('password123');await page.getByRole('button',{name:'Sign in →'}).click();await expect(page.getByRole('alert')).toContainText('administrator account');await expect(page).toHaveURL(/login/);});
test('all thirteen pages load and navigation remains within the viewport on tablet',async({page})=>{await mock(page);await page.goto('/admin/dashboard');await expect(page.getByText('Loading event data…')).toHaveCount(0);await page.screenshot({path:'test-results/dashboard-desktop.png',fullPage:true});for(const title of ['Dashboard','Statistics','Stalls','Food Catalog','Stall Menus','Stall Owners','Orders','Payment Review','Ticket Redemption','Event Configuration','Feature Controls','Memories Feature','Crush Letters']){await page.getByRole('navigation').getByRole('link',{name:title,exact:true}).click();await expect(page.getByRole('heading',{level:1,name:title,exact:true})).toBeVisible();await expect(page.getByText('Loading event data…')).toHaveCount(0);}await page.setViewportSize({width:768,height:1024});await page.getByRole('button',{name:'Toggle navigation'}).click();await page.getByRole('navigation').getByRole('link',{name:'Dashboard',exact:true}).click();await expect(page.getByRole('heading',{level:1,name:'Dashboard'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);});
for(const decision of ['APPROVED','REJECTED'])test(`payment ${decision} sends current version and reason`,async({page})=>{await mock(page);await page.goto('/admin/payments');await page.getByRole('button',{name:'Review payment'}).click();await page.getByLabel('Decision',{exact:true}).selectOption(decision);if(decision==='REJECTED')await page.getByLabel('Reason (required').fill('Amount does not match');page.on('dialog',d=>d.accept());const request=page.waitForRequest(r=>r.url().endsWith('/p1/review')&&r.method()==='PATCH');await page.getByRole('button',{name:'Submit review'}).click();const body=(await request).postDataJSON();expect(body).toEqual({decision,proofVersion:2,...(decision==='REJECTED'?{reason:'Amount does not match'}:{})});await expect(page.getByText('Payment review saved.')).toBeVisible();});
test('ticket lookup and redemption display authoritative response',async({page})=>{await mock(page);await page.goto('/admin/tickets');await page.getByLabel('Ticket code').fill('FF26-X82K91');await page.getByRole('button',{name:'Verify ticket'}).click();await expect(page.getByText('Physical tickets required')).toBeVisible();page.on('dialog',d=>d.accept());await page.getByRole('button',{name:'Redeem ticket',exact:true}).click();await expect(page.getByText('REDEEMED',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Redeem ticket',exact:true})).toHaveCount(0);});
test('API failure can be retried without invented data',async({page})=>{await mock(page);let fail=true;await page.route('**/api/admin/orders',route=>fail?route.fulfill({status:503,json:{error:{message:'Database unavailable'}}}):route.fulfill({json:{orders:[]}}));await page.goto('/admin/orders');await expect(page.getByRole('alert')).toContainText('Database unavailable');fail=false;await page.getByRole('button',{name:'Try again'}).click();await expect(page.getByText('No records to show.')).toBeVisible();});
test('stall creation sends only supported fields and confirms the change',async({page})=>{
 await mock(page);await page.goto('/admin/stalls');await page.getByRole('button',{name:'Add stall'}).click();
 await page.getByLabel('Stall name',{exact:true}).fill('Burger House');await page.getByLabel('Batch',{exact:true}).fill('Batch 26');await page.getByLabel('Description',{exact:true}).fill('Fresh burgers');
 page.on('dialog',d=>d.accept());const request=page.waitForRequest(r=>r.url().endsWith('/admin/stalls')&&r.method()==='POST');await page.getByRole('button',{name:'Save changes'}).click();
 expect((await request).postDataJSON()).toEqual({stallName:'Burger House',batch:'Batch 26',description:'Fresh burgers',isActive:true,image:{url:''}});await expect(page.getByText('Stall saved.')).toBeVisible();
});
test('menu form keeps computed inventory and preorder prices out of writes',async({page})=>{
 await mock(page);const stallId='a'.repeat(24),foodId='b'.repeat(24);
 await page.route('**/api/admin/stalls',r=>r.fulfill({json:{stalls:[{_id:stallId,stallName:'Burger House'}]}}));
 await page.route('**/api/admin/foods',r=>r.fulfill({json:{foods:[{_id:foodId,name:'Burger'}]}}));
 await page.goto('/admin/stall-menus');await page.getByRole('button',{name:'Add food to stall'}).click();
 await page.getByLabel('Stall',{exact:true}).selectOption(stallId);await page.getByLabel('Food',{exact:true}).selectOption(foodId);await page.getByLabel('Event-day price (MMK)',{exact:true}).fill('3000');await page.getByLabel('Ticket limit',{exact:true}).fill('100');await page.getByLabel('Discount value',{exact:true}).fill('10');
 page.on('dialog',d=>d.accept());const request=page.waitForRequest(r=>r.url().endsWith('/admin/stall-foods')&&r.method()==='POST');await page.getByRole('button',{name:'Save changes'}).click();expect((await request).postDataJSON()).toEqual({stallId,foodId,eventDayPrice:3000,ticketLimit:100,discount:{type:'percentage',value:10},isAvailable:true});await expect(page.getByText('Menu entry saved.')).toBeVisible();
});
test('event form converts Myanmar dates and excludes internal configuration fields',async({page})=>{
 await mock(page);await page.goto('/admin/event');await expect(page.getByLabel('Preorder opens',{exact:true})).toHaveValue('2026-09-08T09:00');page.on('dialog',d=>d.accept());const request=page.waitForRequest(r=>r.url().endsWith('/admin/event')&&r.method()==='PATCH');await page.getByRole('button',{name:'Save changes'}).click();const body=(await request).postDataJSON();expect(body.preorderOpenAt).toBe('2026-09-08T02:30:00.000Z');expect(body).not.toHaveProperty('featureFlags');expect(body).not.toHaveProperty('_id');await expect(page.getByText('Changes saved.')).toBeVisible();
});
test('order search, status filter, detail modal, and compact layout work together',async({page})=>{
 await mock(page);await page.goto('/admin/orders');await page.getByRole('searchbox').fill('missing');await expect(page.getByText('No records to show.')).toBeVisible();await page.getByRole('searchbox').fill('Aye');await page.getByLabel('Filter records').selectOption('PAYMENT_SUBMITTED');await page.getByRole('button',{name:'View order'}).click();await expect(page.getByRole('dialog')).toContainText('Burger');await page.getByRole('button',{name:'Close dialog'}).click();await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('returning directly from Statistics to Dashboard never renders stale data',async({page})=>{
 await mock(page);const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/admin/dashboard');
 for(let i=0;i<3;i++){
  await page.getByRole('navigation').getByRole('link',{name:'Statistics',exact:true}).click();await expect(page.getByText('Sales by food',{exact:true})).toBeVisible();
  await page.getByRole('navigation').getByRole('link',{name:'Dashboard',exact:true}).click();await expect(page.getByText('Recent orders',{exact:true})).toBeVisible();
  await page.getByRole('navigation').getByRole('link',{name:'Dashboard',exact:true}).click();await expect(page.getByText('Recent orders',{exact:true})).toBeVisible();
 }
 expect(errors).toEqual([]);await page.getByRole('button',{name:'Pause banner animation'}).click();await expect(page.locator('.banner-mascot')).toHaveClass(/paused/);
});
