import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createApp} from './app.js';
const db=new PGlite();await db.exec(await fs.readFile(new URL('./schema.sql',import.meta.url),'utf8'));
Object.assign(process.env,{APP_URL:'https://checkout.test',ADMIN_DASHBOARD_PASSWORD:'test-secret',XOLVIS_BASE_URL:'https://gateway.test',XOLVIS_CALLBACK_URL:'https://old.test/callback'});
let gatewayCalls=0;
const pool={query:async(...a)=>{const r=await db.query(...a);return {...r,rowCount:r.rows.length||r.affectedRows||0};}};
const app=createApp({pool,publicDir:new URL('./public',import.meta.url).pathname,gatewayFetch:async()=>{gatewayCalls++;return {ok:true,text:async()=>JSON.stringify({success:true,uuid:'refund-uuid',returnType:'PENDING'})};}});
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
const headers={'x-admin-password':'test-secret'};
try{
 for(const route of ['/api/admin/transactions','/api/admin/chargebacks'])assert.equal((await fetch(base+route)).status,401);
 await db.query("INSERT INTO xolvis_payments(reference,email,plan,amount,status,paid_at,xolvis_uuid) VALUES('test','test@example.com','2695',26.95,'FINISHED',NOW(),'paid-uuid')");
 const tr=await fetch(base+'/api/admin/transactions',{headers});assert.equal(tr.status,200);assert.equal((await tr.json()).transactions[0].reference,'test');
 assert.equal((await fetch(base+'/api/admin/chargebacks',{headers})).status,200);
 const form=new FormData();form.append('file',new Blob(['Case ID/Scheme ID,Merchant Name,Kind,Ntwk,Card No.,Transaction Date,Merchant Funding Amt Gr\ncase1,LEGENDSPEAK.NET,CBK1,VI,444444xxxx1111,20261004,26.95'],{type:'text/csv'}),'cases.csv');
 const upload=await fetch(base+'/api/admin/chargebacks/upload',{method:'POST',headers,body:form});assert.equal(upload.status,200);assert.equal((await upload.json()).imported,1);
 const refundRoute=base+'/api/admin/transactions/test/refund';assert.equal((await fetch(refundRoute,{method:'POST'})).status,401);
 assert.equal((await fetch(refundRoute,{method:'POST',headers})).status,200);assert.equal((await fetch(refundRoute,{method:'POST',headers})).status,409);assert.equal(gatewayCalls,1);
 assert.equal((await fetch(base+'/admin-transactions.html')).status,200);console.log('PASS: password protection, transaction SQL, chargeback CSV import/list, mocked refund and duplicate prevention. No real gateway calls.');
}finally{server.close();await db.close();}
