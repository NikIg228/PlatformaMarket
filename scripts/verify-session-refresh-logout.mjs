import assert from 'node:assert/strict';
import { startLocalAuthFixture } from './lib/local-auth-fixture.mjs';

const fixture = await startLocalAuthFixture({ operator: false });
const { db, request, apiUrl } = fixture;
try {
  const account = await fixture.account(31, 'BUYER');
  async function session() {
    const root = await request('/auth/login', { email: account.email, password: account.password });
    const handoff = await request('/auth/handoff', { capability: 'BUYER' }, 201, root.accessToken);
    const response = await fetch(apiUrl + '/auth/handoff/exchange', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ handoffCode: handoff.handoffCode }) });
    assert.equal(response.status, 201);
    return { ...await response.json(), cookie: response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ') };
  }
  const logout = selected => request('/auth/session-logout', { sessionId: selected.sessionId, accessToken: selected.accessToken });
  const refresh = selected => fetch(apiUrl + '/auth/refresh', { method: 'POST', headers: { 'content-type': 'application/json', cookie: selected.cookie, 'x-csrf-token': selected.csrfToken }, body: JSON.stringify({ workspace: 'BUYER', expectedSessionId: selected.sessionId }) });
  const first = await session();
  await logout(first); assert.equal((await refresh(first)).status, 401);
  const second = await session();
  const renewed = await refresh(second); assert.equal(renewed.status, 201);
  const payload = await renewed.json(); await logout(second);
  await request('/auth/workspace-context', undefined, 401, payload.accessToken);
  const third = await session();
  const concurrent = await Promise.all([refresh(third), logout(third)]);
  assert.ok([201, 401].includes(concurrent[0].status));
  assert.equal((await db.authSession.findUniqueOrThrow({ where: { id: third.sessionId } })).status, 'REVOKED');
  if (concurrent[0].status === 201) await request('/auth/workspace-context', undefined, 401, (await concurrent[0].json()).accessToken);
  console.log('PASS refresh/logout: both deterministic orders and concurrent execution cannot resurrect a revoked session');
} finally { await fixture.stop(); }
