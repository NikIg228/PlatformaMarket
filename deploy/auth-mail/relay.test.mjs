import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createRelay, smtpOptions } from './relay.mjs';
const token = 'synthetic-relay-test-token-never-a-real-secret';
const message = { to: 'recipient@example.invalid', subject: 'Account recovery', text: 'Synthetic link' };
async function fixture(t, sendMail = async () => ({ accepted: ['recipient@example.invalid'], rejected: [] })) {
  const calls = [];
  const server = createRelay({ token, sendMail: async value => { calls.push(value); return sendMail(value); } });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  return { calls, post: (body = message, headers = {}) => fetch(`http://127.0.0.1:${server.address().port}/send`, {
    method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body),
  }) };
}
test('fixed SMTP host, TLS verification, bounded transport and no file/URL access', () => {
  assert.throws(() => smtpOptions('invalid'));
  assert.deepEqual(smtpOptions('re_'+'x'.repeat(30)).tls,{ minVersion:'TLSv1.2',rejectUnauthorized:true });
  const options=smtpOptions('re_'+'x'.repeat(30));
  assert.equal(options.host,'smtp.resend.com'); assert.equal(options.port,465); assert.equal(options.secure,true);
  assert.equal(options.disableFileAccess,true); assert.equal(options.disableUrlAccess,true); assert.equal(options.socketTimeout,10000);
});
test('requires relay authentication and accepts only the fixed sender', async t => {
  const f=await fixture(t);
  assert.equal((await f.post(message,{authorization:'Bearer wrong'})).status,401);
  assert.equal(f.calls.length,0);
  assert.equal((await f.post()).status,200);
  assert.equal(f.calls[0].from.address,'no-reply@notify.platformamarket.kz');
  assert.deepEqual(f.calls[0].to,[{address:message.to}]);
});
test('rejects header injection, attachments, multiple recipients, malformed and oversized bodies', async t => {
  const f=await fixture(t);
  for(const value of ['bad json',{...message,subject:'x\r\nbcc:x@y.test'},{...message,to:'a@b.test,c@d.test'},{...message,attachments:[]},{...message,text:''}])
    assert.equal((await f.post(value)).status,400);
  assert.equal((await f.post('x'.repeat(17000))).status,413);
  assert.equal(f.calls.length,0);
});
test('fails closed without leaking provider errors or claiming rejected mail was accepted', async t => {
  const f=await fixture(t,async()=>{throw new Error('secret-password-and-provider-data');});
  const response=await f.post();assert.equal(response.status,502);
  assert.deepEqual(await response.json(),{code:'DELIVERY_UNCONFIRMED'});assert.equal(f.calls.length,1);
  const rejected=await fixture(t,async()=>({accepted:[],rejected:[message.to]}));
  assert.equal((await rejected.post()).status,502);
});
test('bounds authenticated send attempts without automatic SMTP retries', async t => {
  const f=await fixture(t);
  for(let i=0;i<20;i++)assert.equal((await f.post()).status,200);
  assert.equal((await f.post()).status,429);assert.equal(f.calls.length,20);
});
