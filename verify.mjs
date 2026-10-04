import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createApp} from './app.js';
const db=new PGlite();
await db.exec(await fs.readFile(new URL('./schema.sql',import.meta.url),'utf8'));
Object.assign(process.env,{APP_URL:'https://checkout.test',XOLVIS_BASE_URL:'https://gateway.test',XOLVIS_CONNECTOR_API_KEY:'key',XOLVIS_API_USER:'user',XOLVIS_API_PASSWORD:'password',XOLVIS_PUBLIC_INTEGRATION_KEY:'public',XOLVIS_SUCCESS_URL:'https://success.test/default',XOLVIS_SUCCESS_URL_2295:'https://success.test/2295',XOLVIS_SUCCESS_URL_2695:'https://success.test/2695',XOLVIS_SUCCESS_URL_3795:'https://success.test/3795',XOLVIS_ERROR_URL:'https://failure.test/?base=1',XOLVIS_CANCEL_URL:'https://cancel.test/',XOLVIS_CALLBACK_URL:'https://legendspeak.test/xolvis-webhook',BLOCKED_CARD_BINS:'123456'});
const requests=[];
let gatewayReply={success:true,returnType:'REDIRECT',redirectUrl:'https://3ds.test/',uuid:'test-uuid'};
const app=createApp({pool:db,publicDir:new URL('./public/',import.meta.url).pathname,gatewayFetch:async(url,opts)=>{requests.push({url,headers:opts.headers,body:JSON.parse(opts.body)});return {ok:true,status:200,text:async()=>JSON.stringify(gatewayReply)};}});
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const base='http://127.0.0.1:'+server.address().port;
async function post(route,data){const res=await fetch(base+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(data)});return {status:res.status,body:await res.json()};}
async function makeLink(plan='2695',extra={}){const r=await post('/api/create-promo-checkout-link',{step2File:'xo-cl2-2-ls.html',plan,firstName:'Test',lastName:'User',email:plan+'@example.com',originalQueryString:'sub1=A&sub2=B&clickid=C&source=pop&sub_id=S',ref:'affiliate',...extra});assert.equal(r.status,200);return r.body.url;}
async function pay(link,extra={}){return post('/api/create-promo-payment',{checkoutToken:link.split('/').pop(),transactionToken:'token',flowId:'flow-main',cardData:{card_type:'visa',first_six_digits:'444444'},...extra});}
async function result(reference){const r=await fetch(base+'/api/payment-result-status?reference='+encodeURIComponent(reference));return r.json();}
try {
 assert.equal((await fetch(base+'/health')).status,200);
 const page1=await fetch(base+'/xo-cl1-2-ls.html');assert.equal(page1.status,200);
 assert.equal(await page1.text(),await fs.readFile(new URL('./public/xo-cl1-2-ls.html',import.meta.url),'utf8'));
 const link=await makeLink('2695',{successUrl:'https://success.test/custom'});
 const page=await fetch(base+link);assert.equal(page.status,200);const pageHtml=await page.text();assert.match(pageHtml,/window.PROMO_CHECKOUT_TOKEN=/);assert.match(pageHtml,/window.XOLVIS_PUBLIC_INTEGRATION_KEY="public"/);
 const paid=await pay(link);assert.equal(paid.status,200);assert.equal(paid.body.amount,'26.95');assert.equal(paid.body.redirectUrl,'https://3ds.test/');
 const req=requests[0].body;assert.equal(req.currency,'GBP');assert.equal(req.description,'Legend Speak Access');assert.equal(req.callbackUrl,process.env.XOLVIS_CALLBACK_URL);assert.equal(req.errorUrl,req.cancelUrl);assert.equal(req.successUrl,req.cancelUrl);assert.equal(new URL(req.successUrl).origin,'https://checkout.test');assert.equal(paid.body.paymentResultUrl,req.successUrl);assert.match(requests[0].headers.Authorization,/^Basic /);
 const reference=req.merchantTransactionId;
 const saved=(await db.query('SELECT * FROM xolvis_payments WHERE reference=$1',[reference])).rows[0];
 const success=new URL(saved.final_redirect_url);assert.equal(success.pathname,'/custom');assert.equal(success.searchParams.get('sub1'),'A');assert.equal(success.searchParams.get('clickid'),'C');assert.equal(success.searchParams.get('ref'),'affiliate');assert.equal(saved.binom_clickid,'C');assert.equal(saved.traffic_source,'pop');assert.equal(saved.sub_id,'S');
 assert.equal((await result(reference)).final,false);
 await db.query('UPDATE xolvis_payments SET status=$1,xolvis_payload=$2 WHERE reference=$3',['ERROR',{code:'1003'},reference]);
 let final=await result(reference);assert.equal(final.resultType,'CANCEL');let dest=new URL(final.redirectUrl);assert.equal(dest.hostname,'cancel.test');assert.equal(dest.searchParams.get('sub3'),'A');assert.equal(dest.searchParams.get('sub4'),'B');assert.equal(dest.searchParams.get('ref'),'affiliate');
 await db.query('UPDATE xolvis_payments SET xolvis_payload=$1 WHERE reference=$2',[{message:'declined'},reference]);final=await result(reference);assert.equal(final.resultType,'ERROR');assert.equal(new URL(final.redirectUrl).hostname,'failure.test');
 await db.query('UPDATE xolvis_payments SET paid_at=NOW(),status=$1 WHERE reference=$2',['OK',reference]);final=await result(reference);assert.equal(final.resultType,'SUCCESS');assert.equal(final.redirectUrl,saved.final_redirect_url);
 assert.equal((await fetch(base+'/payment-result?reference='+reference)).status,200);
 const escaped=await (await fetch(base+'/payment-result?reference='+encodeURIComponent('</script><script>alert(1)</script>'))).text();assert.ok(!escaped.includes('const reference =\n      "</script>'));
 for(const [plan,amount] of [['2295','22.95'],['3795','37.95'],['lifetime','37.95']]) {const l=await makeLink(plan);const p=await pay(l);assert.equal(p.body.amount,amount);const ref=requests.at(-1).body.merchantTransactionId;const row=(await db.query('SELECT final_redirect_url FROM xolvis_payments WHERE reference=$1',[ref])).rows[0];assert.equal(new URL(row.final_redirect_url).pathname,plan==='lifetime'?'/3795':'/'+plan);}
 const bin=await pay(link,{cardData:{card_type:'visa',first_six_digits:'123456'}});assert.equal(bin.body.code,'CARD_BIN_BLOCKED');
 const brand=await pay(link,{cardData:{card_type:'amex'}});assert.equal(brand.body.code,'CARD_TYPE_NOT_SUPPORTED');
 gatewayReply={success:false,returnType:'ERROR'};assert.equal((await pay(link)).status,500);
 assert.equal((await pay(link)).status,429); // source server counts blocked attempts, too
 const fun=await post('/api/promo-funnel-event',{flowId:'F',eventName:'PAGE2_LOADED',eventDetails:'ready'});assert.equal(fun.status,200);
 assert.equal((await post('/api/promo-funnel-event',{flowId:'F',eventName:'INVALID'})).status,400);
 const absent=await makeLink('2695',{email:'no-ref@example.com',ref:null,originalQueryString:''});assert.equal((await fetch(base+absent)).status,200);
 assert.equal((await post('/api/create-promo-checkout-link',{email:'x@example.com',step2File:'../server.js'})).status,400);
 assert.equal((await fetch(base+'/c/invalid')).status,404);
 console.log('PASS: Chile GBP26.95, plan prices, token injection, unchanged pages, gateway payload/callback, pending/success/cancel/error flow, affiliate parameters, funnel events, blocked brands/BINs, 3-attempt limit, missing ref and invalid files. Gateway mocked; no live charge made.');
} finally {await new Promise(r=>server.close(r));await db.close();}
