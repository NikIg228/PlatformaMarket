import assert from 'node:assert/strict';
import { randomUUID, randomBytes, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { assertPortsAvailable } from './lib/local-readiness.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const url = process.env.DATABASE_URL;
assert(url && url === process.env.POSTGRES_TEST_DATABASE_URL, 'Run through db:test with an explicit isolated database');
const parsed = new URL(url);
assert.equal(parsed.pathname, '/dentmarket_audit_20260914');
assert(['127.0.0.1', 'localhost'].includes(parsed.hostname));
const prisma = new PrismaClient({ datasourceUrl: url });
const port = 4591;
const apiBase = `http://127.0.0.1:${port}/api`;
const run = randomUUID();
const dir = path.join(root, '.tmp/audit-boundaries');
const orgIds = [], userIds = [];
let api, connectionId, sourceId;
const logs = [];
const report = { database: parsed.pathname.slice(1), profile: 'go_live/test/jwt', cases: [] };
const hash = value => createHash('sha256').update(value).digest('hex');

async function post(route, body, authorization) {
  const response = await fetch(`${apiBase}${route}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(authorization ? { authorization } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(15000) });
  const text = await response.text();
  let payload; try { payload = JSON.parse(text); } catch { payload = { nonJson: true }; }
  return { status: response.status, code: payload.code, message: payload.message, payload };
}

try {
  const [identity] = await prisma.$queryRaw`SELECT current_database() AS name`;
  assert.equal(identity.name, 'dentmarket_audit_20260914');
  await assertPortsAvailable([port]);
  await mkdir(path.join(dir, 'candidate-storage'), { recursive: true });
  for (let index = 0; index < 2; index++) {
    const organization = await prisma.organization.create({ data: {
      legalName: `Synthetic audit ${run} ${index}`, displayName: `Audit ${index}`,
      bin: `7${String(Date.now()).slice(-9)}${index}8`, commerceDataset: 'TEST',
      capabilities: { create: { capability: 'SUPPLIER' } }, supplierProfile: { create: { regulatoryDetails: { auditFixture: run } } },
    } });
    orgIds.push(organization.id);
  }
  const user = await prisma.user.create({ data: { email: `audit-${run}@example.invalid`, displayName: 'Synthetic audit user', memberships: { create: orgIds.map(organizationId => ({ organizationId, status: 'ACTIVE' })) } } });
  userIds.push(user.id);
  const session = await prisma.authSession.create({ data: { userId: user.id, familyId: randomUUID(), refreshTokenHash: hash(randomBytes(32)), organizationIds: orgIds, activeOrganizationId: orgIds[0], authMethods: ['password'], expiresAt: new Date(Date.now() + 3600000) } });
  const source = await prisma.supplierDataSource.create({ data: { supplierOrganizationId: orgIds[0], name: `Audit ${run}`, type: 'ERP' } });
  sourceId = source.id;
  const enrollment = randomBytes(32).toString('base64url');
  const connection = await prisma.integrationConnection.create({ data: { supplierOrganizationId: orgIds[0], sourceId, provider: 'ONE_C', mode: 'AGENT', displayName: `Audit ${run}`, agent: { create: { agentId: `audit-${run}`, enrollmentTokenHash: hash(enrollment), enrollmentExpiresAt: new Date(Date.now() + 3600000) } } } });
  connectionId = connection.id;
  api = spawn(process.execPath, [path.join(root, 'apps/api/dist/src/main.js')], { cwd: path.join(root, 'apps/api'), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'], env: {
    ...process.env, DATABASE_URL: url, NODE_ENV: 'test', DEPLOYMENT_PROFILE: 'go_live', PROCESS_ROLE: 'api', API_HOST: '127.0.0.1', API_PORT: String(port),
    AUTH_MODE: 'jwt', JWT_SECRET: 'synthetic-audit-candidate-key-only-not-production', JWT_REQUIRE_MFA: 'false',
    BACKGROUND_QUEUE_ENABLED: 'false', OBJECT_STORAGE_DRIVER: 'local', LOCAL_STORAGE_PATH: path.join(dir, 'candidate-storage'), AV_SCAN_MODE: 'disabled', PAYMENT_PROVIDER_MODE: 'mock',
    OTEL_EXPORTER_OTLP_ENDPOINT: '', SENTRY_DSN: '', LOG_LEVEL: 'warn', PUBLIC_CATALOG_ORGANIZATION_ID: orgIds[0],
  } });
  for (const stream of [api.stdout, api.stderr]) stream.on('data', chunk => { logs.push(String(chunk)); if (logs.length > 25) logs.shift(); });
  api.on('error', error => logs.push(error.message));
  const deadline = Date.now() + 90000;
  let ready = false;
  while (Date.now() < deadline) {
    if (api.exitCode !== null) throw new Error(`API exited ${api.exitCode}`);
    try { const r = await fetch(`${apiBase}/health/ready`, { signal: AbortSignal.timeout(2000) }); if (r.ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  assert(ready, 'isolated API ready');

  const unauthorized = await post(`/auth/sessions/${session.id}/organization`, { organizationId: orgIds[1] });
  const changed = await prisma.authSession.findUniqueOrThrow({ where: { id: session.id } });
  report.cases.push({ id: 'session-anonymous-organization-switch', expected: '401/403, no DB state change', status: unauthorized.status, code: unauthorized.code, activeOrganizationChanged: changed.activeOrganizationId !== orgIds[0], tokenReturned: Boolean(unauthorized.payload.accessToken) });

  assert.equal(unauthorized.status, 401, 'anonymous switch rejected');
  assert.equal(changed.activeOrganizationId, orgIds[0], 'anonymous switch leaves session unchanged');
  const sign = (sid, actor) => jwt.sign({ organization_ids: orgIds, organization_id: orgIds[0], amr: ['password'] }, 'synthetic-audit-candidate-key-only-not-production', { subject: actor, jwtid: sid, issuer: 'dentmarket-kz', audience: 'dentmarket-web', expiresIn: 600 });
  const authorized = await post('/auth/sessions/' + session.id + '/organization', { organizationId: orgIds[1] }, 'Bearer ' + sign(session.id, user.id));
  assert.equal(authorized.status, 201, 'owner switch accepted');
  assert.equal(jwt.decode(authorized.payload.accessToken).sub, user.id, 'token subject remains owner');
  assert.equal((await prisma.authSession.findUniqueOrThrow({ where: { id: session.id } })).activeOrganizationId, orgIds[1]);
  const foreignUser = await prisma.user.create({ data: { email: 'foreign-' + run + '@example.invalid', displayName: 'Synthetic other user', memberships: { create: { organizationId: orgIds[0], status: 'ACTIVE' } } } });
  userIds.push(foreignUser.id);
  const foreignSession = await prisma.authSession.create({ data: { userId: foreignUser.id, familyId: randomUUID(), refreshTokenHash: hash(randomBytes(32)), organizationIds: [orgIds[0]], activeOrganizationId: orgIds[0], authMethods: ['password'], expiresAt: new Date(Date.now() + 3600000) } });
  const foreign = await post('/auth/sessions/' + session.id + '/organization', { organizationId: orgIds[0] }, 'Bearer ' + sign(foreignSession.id, foreignUser.id));
  assert.equal(foreign.status, 404, 'foreign session not found');
  assert.equal((await prisma.authSession.findUniqueOrThrow({ where: { id: session.id } })).activeOrganizationId, orgIds[1]);
  await prisma.authSession.update({ where: { id: session.id }, data: { status: 'REVOKED' } });
  const revoked = await post('/auth/sessions/' + session.id + '/organization', { organizationId: orgIds[0] }, 'Bearer ' + sign(session.id, user.id));
  assert.equal(revoked.status, 401, 'revoked bearer rejected');
  report.cases.push({ id: 'owner-foreign-revoked-switch', owner: authorized.status, foreign: foreign.status, revoked: revoked.status });

  const enrolled = await post(`/connector-agents/audit-${run}/enroll`, { enrollmentToken: enrollment, version: 'audit-1', capabilities: [] });
  assert.equal(enrolled.status, 201, 'real agent enrollment');
  assert.equal(typeof enrolled.payload.accessToken, 'string');
  for (const scheme of ['Bearer', 'bearer', 'BEARER']) {
    const response = await post(`/connector-agents/audit-${run}/heartbeat`, { version: 'audit-1', capabilities: [] }, `${scheme} ${enrolled.payload.accessToken}`);
    assert.equal(response.status, 201, 'valid agent heartbeat');
    report.cases.push({ id: 'connector-heartbeat', scheme, expected: '201 accepted for valid agent access token', status: response.status, code: response.code, accepted: response.payload.accepted === true });
  }
  const invalid = await post('/connector-agents/audit-' + run + '/heartbeat', { version: 'audit-1', capabilities: [] }, 'Bearer invalid-agent-token');
  assert.equal(invalid.status, 401);
  const foreignAgent = await post('/connector-agents/missing-' + run + '/heartbeat', { version: 'audit-1', capabilities: [] }, 'Bearer ' + enrolled.payload.accessToken);
  assert.equal(foreignAgent.status, 401);
  const claim = await post('/connector-agents/audit-' + run + '/jobs/claim', {}, 'Bearer ' + enrolled.payload.accessToken);
  assert.equal(claim.status, 201);
  const ordinary = await post('/auth/sessions/' + session.id + '/organization', { organizationId: orgIds[0] }, 'Bearer ' + enrolled.payload.accessToken);
  assert.equal(ordinary.status, 401, 'agent token cannot authenticate ordinary routes');
  await prisma.connectorAgent.update({ where: { connectionId }, data: { status: 'REVOKED' } });
  const revokedAgent = await post('/connector-agents/audit-' + run + '/heartbeat', { version: 'audit-1', capabilities: [] }, 'Bearer ' + enrolled.payload.accessToken);
  assert.equal(revokedAgent.status, 401);
  report.cases.push({ id: 'agent-boundaries', invalid: invalid.status, foreign: foreignAgent.status, claim: claim.status, ordinary: ordinary.status, revoked: revokedAgent.status });
  console.log(JSON.stringify(report, null, 2));
  await writeFile(path.join(dir, 'http-regression-result.json'), JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error.stack);
  await writeFile(path.join(dir, 'http-regression-api-error.log'), logs.join(''));
  process.exitCode = 1;
} finally {
  if (api && api.exitCode === null) { api.kill(); await new Promise(resolve => { api.once('exit', resolve); setTimeout(resolve, 5000).unref(); }); }
  if (connectionId) await prisma.integrationConnection.delete({ where: { id: connectionId } });
  if (sourceId) await prisma.supplierDataSource.delete({ where: { id: sourceId } });
  if (userIds.length) await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  if (orgIds.length) await prisma.organization.deleteMany({ where: { id: { in: orgIds } } });
  await prisma.$disconnect();
}
