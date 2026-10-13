import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createHash, randomUUID } from 'node:crypto';
import { startLocalAuthFixture } from './lib/local-auth-fixture.mjs';
import { auditEnvironment } from './lib/registration-resume-fixture.mjs';

// Existing fixture proves the actual database name and starts only an owned JWT API.
Object.assign(process.env, auditEnvironment());
const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');
const { logoutTargetSession } = require('../apps/api/dist/src/modules/identity/session-logout.js');
const fixture = await startLocalAuthFixture({ operator: false });
const { db, request, apiUrl, account } = fixture;
try {
  const buyer = await account(1, 'BUYER');
  const supplier = await account(2, 'SUPPLIER');
  const staff = await account(3, 'MARKETPLACE_OPERATOR');
  const login = person => request('/auth/login', { email: person.email, password: person.password });
  const rootA = await login(buyer);
  assert.equal((await db.authSession.findUniqueOrThrow({ where: { id: rootA.sessionId } })).originLoginSessionId, rootA.sessionId);
  const issue = (root, capability) => request('/auth/handoff', { capability }, 201, root.accessToken);
  async function exchange(code, expected = 201) {
    const response = await fetch(apiUrl + '/auth/handoff/exchange', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ handoffCode: code }) });
    assert.equal(response.status, expected, 'handoff exchange status');
    const payload = await response.json();
    return { ...payload, cookie: response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ') };
  }
  async function logout(session, expected = 201, headers = {}) {
    const response = await fetch(apiUrl + '/auth/session-logout', { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify({ sessionId: session.sessionId, accessToken: session.accessToken }) });
    assert.equal(response.status, expected, 'self logout status');
    assert.equal(response.headers.get('set-cookie'), null, 'logout must not clear a later login cookie');
    assert.equal(response.headers.get('cache-control'), 'no-store');
    return response.json();
  }
  const workspaceA = await exchange((await issue(rootA, 'BUYER')).handoffCode);
  assert.equal((await db.authSession.findUniqueOrThrow({ where: { id: workspaceA.sessionId } })).originLoginSessionId, rootA.sessionId);
  const newerA = await login(buyer), rootB = await login(supplier);
  const receipt = await logout(workspaceA, 201, { cookie: 'mp_refresh=unrelated; mp_csrf=unrelated', 'x-user-id': supplier.userId });
  assert.deepEqual(receipt, { sessionId: workspaceA.sessionId, status: 'REVOKED', loginStatus: 'REVOKED' });
  const firstRevokedAt = (await db.authSession.findUniqueOrThrow({ where: { id: workspaceA.sessionId } })).revokedAt;
  const expiredProof = await fixture.sessionProof(workspaceA.sessionId, { expired: true });
  assert.deepEqual(await logout({ ...workspaceA, accessToken: expiredProof }), receipt);
  assert.equal((await db.authSession.findUniqueOrThrow({ where: { id: workspaceA.sessionId } })).revokedAt.toISOString(), firstRevokedAt.toISOString());
  assert.equal(await db.securityEvent.count({ where: { sessionId: { in: [workspaceA.sessionId, rootA.sessionId] }, type: 'auth.session.logout' } }), 2);
  await request('/auth/workspace-context', undefined, 401, workspaceA.accessToken);
  await request('/auth/workspace-context', undefined, 401, rootA.accessToken);
  await request('/auth/workspace-context', undefined, 200, newerA.accessToken);
  await request('/auth/workspace-context', undefined, 200, rootB.accessToken);
  const refresh = await fetch(apiUrl + '/auth/refresh', { method: 'POST', headers: { 'content-type': 'application/json', cookie: workspaceA.cookie, 'x-csrf-token': workspaceA.csrfToken },
    body: JSON.stringify({ workspace: 'BUYER', expectedSessionId: workspaceA.sessionId }) });
  assert.equal(refresh.status, 401, 'revoked refresh rejected');
  await logout({ sessionId: newerA.sessionId, accessToken: rootB.accessToken }, 401);
  assert.equal((await db.authSession.findUniqueOrThrow({ where: { id: newerA.sessionId } })).status, 'ACTIVE');

  const operator = await request('/auth/operator/login', { email: staff.email, password: staff.password });
  const operatorB = await request('/auth/operator/login', { email: staff.email, password: staff.password });
  assert.equal((await logout(operator)).loginStatus, 'SAME_SESSION');
  await request('/organizations', undefined, 401, operator.accessToken);
  await request('/organizations', undefined, 200, operatorB.accessToken);

  // Fail a transactional effect after the real session UPDATE; PostgreSQL must roll it back.
  const rollbackRoot = await login(buyer);
  const transactionalFailure = { $transaction: callback => db.$transaction(tx => callback(new Proxy(tx, {
    get(target, property) { return property === 'securityEvent' ? { create: async () => { throw Error('synthetic audit failure'); } } : Reflect.get(target, property); },
  }))) };
  const rollbackProof = jwt.sign({}, process.env.JWT_SECRET, { algorithm: 'HS256', subject: buyer.userId, jwtid: rollbackRoot.sessionId,
    issuer: process.env.JWT_ISSUER ?? 'dentmarket-kz', audience: process.env.JWT_AUDIENCE ?? 'dentmarket-web', expiresIn: 600 });
  await assert.rejects(logoutTargetSession(transactionalFailure, { sessionId: rollbackRoot.sessionId, accessToken: rollbackProof }), /synthetic audit failure/);
  assert.equal((await db.authSession.findUniqueOrThrow({ where: { id: rollbackRoot.sessionId } })).status, 'ACTIVE');
  assert.equal(await db.securityEvent.count({ where: { sessionId: rollbackRoot.sessionId, type: 'auth.session.logout' } }), 0);

  // Duplicate concurrent commands produce one state transition/audit per session.
  const duplicates = await Promise.all([logout(rollbackRoot), logout(rollbackRoot)]);
  assert.deepEqual(duplicates[0], duplicates[1]);
  assert.equal(await db.securityEvent.count({ where: { sessionId: rollbackRoot.sessionId, type: 'auth.session.logout' } }), 1);
  const raceRoot = await login(buyer);
  const handoff = await issue(raceRoot, 'BUYER');
  const race = await Promise.all([logout(raceRoot), fetch(apiUrl + '/auth/handoff/exchange', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ handoffCode: handoff.handoffCode }) })]);
  assert.ok([201, 401].includes(race[1].status), 'handoff serializes before or after revoke');
  assert.equal((await db.authSession.findUniqueOrThrow({ where: { id: raceRoot.sessionId } })).status, 'REVOKED');
  const racePayload = await race[1].json();
  if (race[1].status === 201) assert.equal((await db.authSession.findUniqueOrThrow({ where: { id: racePayload.sessionId } })).originLoginSessionId, raceRoot.sessionId);
  await request('/auth/handoff', { capability: 'BUYER' }, 401, raceRoot.accessToken);

  // Both serialization outcomes are required independently of scheduler timing.
  const revokeFirst = await login(buyer);
  const issuedBeforeRevoke = await issue(revokeFirst, 'BUYER');
  await logout(revokeFirst);
  const beforeRejectedExchange = await db.authSession.count({ where: { originLoginSessionId: revokeFirst.sessionId } });
  await exchange(issuedBeforeRevoke.handoffCode, 401);
  assert.equal(await db.authSession.count({ where: { originLoginSessionId: revokeFirst.sessionId } }), beforeRejectedExchange);
  const exchangeFirst = await login(buyer);
  const existingDestination = await exchange((await issue(exchangeFirst, 'BUYER')).handoffCode);
  await logout(exchangeFirst);
  assert.equal((await db.authSession.findUniqueOrThrow({ where: { id: existingDestination.sessionId } })).status, 'ACTIVE', 'root logout must not cascade to existing sibling destinations');
  await request('/auth/workspace-context', undefined, 200, existingDestination.accessToken);

  const legacyId = randomUUID();
  await db.authSession.create({ data: { id: legacyId, userId: buyer.userId, familyId: randomUUID(), refreshTokenHash: createHash('sha256').update(randomUUID()).digest('hex'),
    organizationIds: [buyer.organizationId], activeOrganizationId: buyer.organizationId, authMethods: ['password'], expiresAt: new Date(Date.now() + 3600000) } });
  const legacyToken = await fixture.sessionProof(legacyId);
  assert.equal((await logout({ sessionId: legacyId, accessToken: legacyToken })).loginStatus, 'NOT_LINKED');
  assert.equal((await db.authSession.findUniqueOrThrow({ where: { id: newerA.sessionId } })).status, 'ACTIVE');
  console.log('PASS real JWT API: exact target/origin, same-user new login, foreign proof, Admin, revoked access/refresh, lost-response receipt, duplicate audit, PostgreSQL rollback, handoff race and legacy isolation');
} finally { await fixture.stop(); }
