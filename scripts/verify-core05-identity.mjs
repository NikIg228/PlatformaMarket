import assert from 'node:assert/strict';
import { randomBytes, createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { startLocalAuthFixture } from './lib/local-auth-fixture.mjs';

// The fixture validates the exact disposable DB, starts only owned processes,
// records no credentials and removes its local mail files in finally.
const fixture = await startLocalAuthFixture({ operator: false });
const { db, apiUrl, runId, account, mail, request } = fixture;
const { generateTotp } = createRequire(import.meta.url)('../apps/api/dist/src/platform/security/totp.js');
const checks = [];
async function call(route, method, body, token, status = 200) {
  const response = await fetch(apiUrl + route, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  assert.equal(response.status, status, `${method} ${route}: ${response.status}; response body omitted`);
  return response.json();
}
try {
  const owner = await account(31, 'BUYER');
  const foreign = await account(32, 'SUPPLIER');
  const membership = await db.organizationMembership.findUniqueOrThrow({ where: { userId_organizationId: { userId: owner.userId, organizationId: owner.organizationId } }, include: { roles: true } });
  for (const code of ['organization.members.manage', 'organization.roles.manage']) {
    const permission = await db.permission.findUniqueOrThrow({ where: { code } });
    await db.rolePermission.create({ data: { roleId: membership.roles[0].roleId, permissionId: permission.id } });
  }
  const memberRole = await db.role.create({ data: { organizationId: owner.organizationId, code: 'core05_member', name: 'Synthetic member', permissions: { create: { permission: { connect: { code: 'catalog.product.view' } } } } } });
  const ownerLogin = await request('/auth/login', { email: owner.email, password: owner.password });
  const foreignLogin = await request('/auth/login', { email: foreign.email, password: foreign.password });
  const extraLogin = await request('/auth/login', { email: foreign.email, password: foreign.password });
  await call(`/auth/sessions/${extraLogin.sessionId}/revoke`, 'POST', {}, ownerLogin.accessToken, 404);
  const revoked = await call(`/auth/sessions/${extraLogin.sessionId}/revoke`, 'POST', {}, foreignLogin.accessToken, 201);
  assert.deepEqual(revoked, { id: extraLogin.sessionId, status: 'REVOKED' });
  await call('/auth/sessions', 'GET', undefined, extraLogin.accessToken, 401);
  checks.push('session-revocation-owner-only-and-safe-confirmation');
  const prefix = `/organizations/${owner.organizationId}`;
  await call(prefix + '/memberships', 'GET', undefined, foreignLogin.accessToken, 403);
  await call(prefix + '/invitations', 'GET', undefined, undefined, 401);
  checks.push('tenant-and-anonymous-denied');

  const email = `${runId}-invited@example.invalid`, password = randomBytes(24).toString('base64url');
  const invited = await call(prefix + '/invitations', 'POST', { email, roleIds: [memberRole.id] }, ownerLogin.accessToken, 201);
  const delivered = await call(prefix + `/invitations/${invited.invitationId}/deliver`, 'POST', {}, ownerLogin.accessToken, 201);
  assert.equal(delivered.delivery, 'LOCAL_FILE');
  const oldLink = await mail(email, '/invitation'); assert.ok(oldLink);
  await call(prefix + `/invitations/${invited.invitationId}/deliver`, 'POST', {}, ownerLogin.accessToken, 201);
  const link = await mail(email, '/invitation'); assert.ok(link);
  const oldToken = new URLSearchParams(new URL(oldLink).hash.slice(1)).get('token');
  const token = new URLSearchParams(new URL(link).hash.slice(1)).get('token');
  assert.notEqual(token, oldToken);
  await request('/invitations/details', { token: oldToken }, 400);
  const details = await request('/invitations/details', { token });
  assert.equal(details.email, email); assert.equal(details.accountExists, false);
  const statuses = await Promise.all([1, 2].map(async () => (await fetch(apiUrl + '/invitations/accept', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token, displayName: 'Synthetic colleague', password }) })).status));
  assert.deepEqual(statuses.sort(), [201, 400]);
  const member = await db.organizationMembership.findFirstOrThrow({ where: { organizationId: owner.organizationId, user: { email } }, include: { user: true } });
  assert.equal(await db.organizationMembership.count({ where: { organizationId: owner.organizationId, userId: member.userId } }), 1);
  assert.ok(member.user.emailVerifiedAt);
  await request('/invitations/accept', { token, displayName: 'Replay', password }, 400);
  const list = await call(prefix + '/invitations', 'GET', undefined, ownerLogin.accessToken);
  assert(!JSON.stringify(list).match(/tokenHash|"token"|passwordHash/));
  checks.push('actual-local-mail', 'resend-invalidates-old-proof', 'concurrent-accept-one-winner', 'safe-list-and-replay');

  const login = await request('/auth/login', { email, password });
  await call('/auth/sessions', 'GET', undefined, login.accessToken);
  await call(prefix + `/memberships/${member.id}`, 'PATCH', { status: 'BLOCKED' }, ownerLogin.accessToken);
  await call('/auth/sessions', 'GET', undefined, login.accessToken, 401);
  assert.equal(await db.authSession.count({ where: { userId: member.userId, status: 'ACTIVE' } }), 0);
  await call(prefix + '/invitations', 'POST', { email, roleIds: [memberRole.id] }, ownerLogin.accessToken, 409);
  await call(prefix + `/memberships/${member.id}`, 'PATCH', { status: 'ACTIVE' }, ownerLogin.accessToken);
  const relogin = await request('/auth/login', { email, password });
  await call(prefix + `/memberships/${member.id}/roles/${memberRole.id}`, 'DELETE', undefined, ownerLogin.accessToken);
  await call('/auth/sessions', 'GET', undefined, relogin.accessToken, 401);
  checks.push('disable-revokes-sessions', 'invitation-cannot-reactivate-disabled-member', 'role-removal-revokes-sessions');

  const existingInvite = await call(prefix + '/invitations', 'POST', { email: foreign.email, roleIds: [memberRole.id] }, ownerLogin.accessToken, 201);
  await request('/invitations/accept', { token: existingInvite.token, displayName: 'Must not replace', password: 'incorrect-password-value' }, 401);
  const accepted = await request('/invitations/accept', { token: existingInvite.token, displayName: 'Must not replace', password: foreign.password });
  assert.equal(accepted.user.id, foreign.userId); assert.notEqual(accepted.user.displayName, 'Must not replace');
  assert(!JSON.stringify(accepted).match(/passwordHash|tokenHash|refreshToken/));
  checks.push('existing-account-proof-and-profile-preserved');

  await request('/auth/password/forgot', { email: owner.email });
  const reset = new URL(await mail(owner.email, '/reset-password')).searchParams.get('token');
  const resetStatuses = await Promise.all([1, 2].map(async () => (await fetch(apiUrl + '/auth/password/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: reset, password: randomBytes(24).toString('base64url') }) })).status));
  assert.deepEqual(resetStatuses.sort(), [201, 401]);
  await call('/auth/sessions', 'GET', undefined, ownerLogin.accessToken, 401);
  checks.push('concurrent-password-reset-one-winner');

  const mfaUser = await request('/auth/login', { email: foreign.email, password: foreign.password });
  const enrollment = await request('/identity/mfa/totp/enroll', {}, 201, mfaUser.accessToken);
  const elevated = await request('/identity/mfa/totp/verify', { code: generateTotp(enrollment.secret) }, 201, mfaUser.accessToken);
  const recoveryStatuses = await Promise.all([1, 2].map(async () => (await fetch(apiUrl + '/identity/mfa/challenge', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${mfaUser.accessToken}` }, body: JSON.stringify({ code: enrollment.recoveryCodes[0] }) })).status));
  assert.deepEqual(recoveryStatuses.sort(), [201, 401]);
  await request('/identity/mfa/disable', { code: enrollment.recoveryCodes[1] }, 201, elevated.accessToken);
  await call('/auth/sessions', 'GET', undefined, elevated.accessToken, 401);
  checks.push('mfa-recovery-single-use-concurrent', 'mfa-disable-revokes-elevated-sessions');

  const freshEmail = `${runId}-verify-race@example.invalid`;
  await request('/auth/register', { email: freshEmail, password, displayName: 'Synthetic verification' });
  const proof = new URL(await mail(freshEmail, '/verify-email')).searchParams.get('token');
  const verificationStatuses = await Promise.all([1, 2].map(async () => (await fetch(apiUrl + '/auth/email/verify', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ token: proof }) })).status));
  assert.deepEqual(verificationStatuses.sort(), [201, 401]);
  const proofRow = await db.emailAuthToken.findUniqueOrThrow({ where: { tokenHash: createHash('sha256').update(proof).digest('hex') } });
  assert.ok(proofRow.consumedAt);
  checks.push('concurrent-email-verification-one-winner');
  console.log(JSON.stringify({ status: 'PASS', runId, database: 'dentmarket_audit_20260914', checks, externalDelivery: false }));
} finally { await fixture.stop(); }
