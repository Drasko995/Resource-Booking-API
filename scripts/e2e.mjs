#!/usr/bin/env node
/**
 * End-to-end integration test for the Resource Booking API.
 *
 * Drives the running API over HTTP. Verifies authentication, booking
 * validation rules, status transitions, role-based authorization, and
 * concurrency safety of the SELECT FOR UPDATE lock.
 *
 * Prerequisites:
 *   docker compose up -d --build
 *   docker compose exec api npm run migration:run
 *   docker compose exec api npm run seed
 *
 * Run:
 *   npm run e2e                                (uses http://localhost:3000)
 *   E2E_BASE_URL=http://staging:3000 npm run e2e
 *
 * Exits 0 on success, 1 on any failure.
 */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.resolve(__dirname, '..', '.env');

let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  try {
    const env = fs.readFileSync(ENV_PATH, 'utf8');
    const match = env.match(/^JWT_SECRET=(.+)$/m);
    if (match) JWT_SECRET = match[1].trim();
  } catch {
    // .env not readable from here — the crafted-token tests will be skipped
  }
}

const C = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
};

let pass = 0;
let fail = 0;
let skip = 0;

const banner = (label) =>
  console.log(`\n${C.cyan}${'━'.repeat(66)}\n  ${label}\n${'━'.repeat(66)}${C.reset}`);

const check = (label, actual, expected) => {
  const ok = String(actual) === String(expected);
  const sym = ok ? `${C.green}✓${C.reset}` : `${C.red}✗${C.reset}`;
  console.log(
    `  ${sym}  ${label.padEnd(52)}  got=${String(actual).padEnd(10)} ${C.dim}(want ${expected})${C.reset}`,
  );
  ok ? pass++ : fail++;
  return ok;
};

const info = (label, value) =>
  console.log(`  ${C.yellow}ⓘ${C.reset}  ${label.padEnd(52)}  ${C.dim}${value}${C.reset}`);

const skipped = (label, reason) => {
  skip++;
  console.log(`  ${C.dim}—  ${label.padEnd(52)}  (skipped: ${reason})${C.reset}`);
};

const json = (r) => r.json().catch(() => ({}));
const headers = (token) => ({
  'Content-Type': 'application/json',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});
const get = (p, token) => fetch(`${BASE}${p}`, { headers: headers(token) });
const post = (p, body, token) =>
  fetch(`${BASE}${p}`, { method: 'POST', headers: headers(token), body: JSON.stringify(body) });

const b64url = (input) => {
  const buf = Buffer.isBuffer(input)
    ? input
    : typeof input === 'string'
      ? Buffer.from(input)
      : Buffer.from(JSON.stringify(input));
  return buf
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

const signJwt = (payload, secret, expSecondsFromNow = 3600) => {
  const iat = Math.floor(Date.now() / 1000);
  const headerB64 = b64url({ alg: 'HS256', typ: 'JWT' });
  const payloadB64 = b64url({ ...payload, iat, exp: iat + expSecondsFromNow });
  const signingInput = `${headerB64}.${payloadB64}`;
  const sig = crypto.createHmac('sha256', secret).update(signingInput).digest();
  return `${signingInput}.${b64url(sig)}`;
};

const COMPANY_TZ = 'Europe/Belgrade';

const tzOffsetFor = (yyyyMmDd) => {
  const noon = new Date(`${yyyyMmDd}T12:00:00Z`);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: COMPANY_TZ,
    timeZoneName: 'shortOffset',
  }).formatToParts(noon);
  const tz = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+00:00';
  const m = tz.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/);
  if (!m) return '+00:00';
  const sign = m[1];
  const hh = String(parseInt(m[2], 10)).padStart(2, '0');
  const mm = String(m[3] ? parseInt(m[3], 10) : 0).padStart(2, '0');
  return `${sign}${hh}:${mm}`;
};

const at = (yyyyMmDd, hhmm) => `${yyyyMmDd}T${hhmm}:00${tzOffsetFor(yyyyMmDd)}`;

const salt = 30 + Math.floor(Math.random() * 365);
const pickFutureWeekday = (offsetWeekdays) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + salt);
  while (d.getUTCDay() === 0 || d.getUTCDay() === 6) d.setUTCDate(d.getUTCDate() + 1);
  let added = 0;
  while (added < offsetWeekdays) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (d.getUTCDay() !== 0 && d.getUTCDay() !== 6) added++;
  }
  return d.toISOString().slice(0, 10);
};
const nextSaturdayAfter = (yyyyMmDd) => {
  const d = new Date(`${yyyyMmDd}T00:00:00Z`);
  while (d.getUTCDay() !== 6) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

const abort = (message) => {
  console.error(`\n  ${C.red}${message}${C.reset}`);
  process.exit(1);
};

const main = async () => {
  banner('PRECONDITIONS');
  let health;
  try {
    health = await get('/health');
  } catch (err) {
    abort(`Cannot reach ${BASE} (${err.message}). Is the API running?`);
  }
  if (!check('GET /health', health.status, 200)) {
    abort(`Server at ${BASE} is not healthy. Run \`docker compose up -d\` first.`);
  }

  banner('AUTH — login flow');
  const userLogin = await json(
    await post('/api/auth/login', { email: 'user@example.com', password: 'ChangeMe123!' }),
  );
  check('user login', userLogin.user?.role, 'USER');

  const adminLogin = await json(
    await post('/api/auth/login', { email: 'admin@example.com', password: 'ChangeMe123!' }),
  );
  check('admin login', adminLogin.user?.role, 'ADMIN');

  if (!userLogin.token || !adminLogin.token) {
    abort('Seed users missing. Run `docker compose exec api npm run seed` first.');
  }
  const USER = userLogin.token;
  const ADMIN = adminLogin.token;

  check(
    'wrong password',
    (await post('/api/auth/login', { email: 'user@example.com', password: 'no' })).status,
    401,
  );
  check(
    'unknown email',
    (await post('/api/auth/login', { email: 'nobody@example.com', password: 'x' })).status,
    401,
  );
  check(
    'malformed email body',
    (await post('/api/auth/login', { email: 'not-an-email', password: 'x' })).status,
    400,
  );

  banner('AUTH — JWT acceptance');
  check('valid JWT', (await get('/api/bookings/me', USER)).status, 200);
  check('no Authorization header', (await get('/api/bookings/me')).status, 401);
  check(
    'wrong scheme (Basic)',
    (await fetch(`${BASE}/api/bookings/me`, { headers: { Authorization: `Basic ${USER}` } })).status,
    401,
  );
  check('garbage token', (await get('/api/bookings/me', 'garbage')).status, 401);
  check('malformed a.b.c token', (await get('/api/bookings/me', 'a.b.c')).status, 401);

  if (JWT_SECRET) {
    const wrongSig = signJwt({ sub: userLogin.user.id, role: 'USER' }, 'a-different-secret');
    check('valid shape, wrong signature', (await get('/api/bookings/me', wrongSig)).status, 401);

    const expired = signJwt({ sub: userLogin.user.id, role: 'USER' }, JWT_SECRET, -60);
    check('valid signature, expired 60s ago', (await get('/api/bookings/me', expired)).status, 401);

    const forged = signJwt({ sub: userLogin.user.id, role: 'ADMIN' }, JWT_SECRET);
    const forgedResp = await get('/api/bookings', forged);
    info(
      'forged ADMIN claim signed with real secret',
      `accepted (status ${forgedResp.status}) — claim-based trust, no DB role lookup`,
    );
  } else {
    skipped('crafted-JWT tests (wrong-sig, expired, forged)', 'JWT_SECRET not available');
  }

  banner('AUTH — role-based authorization');
  check('USER hits admin endpoint', (await get('/api/bookings', USER)).status, 403);
  check('ADMIN hits admin endpoint', (await get('/api/bookings', ADMIN)).status, 200);

  banner('SETUP — load seeded resources');
  const resources = (await json(await get('/api/resources', USER))).data ?? [];
  const room = resources.find((r) => r.name === 'Meeting Room A');
  const vehicle = resources.find((r) => r.name === 'Company Vehicle 1');
  const printer = resources.find((r) => r.name === '3D Printer');
  if (!room || !vehicle || !printer) {
    abort('Required seeded resources missing. Run `docker compose exec api npm run seed` first.');
  }
  info('Meeting Room A (strict)', room.id);
  info('Company Vehicle 1 (allowWeekendsAndHolidays)', vehicle.id);
  info('3D Printer (allowOutsideHours)', printer.id);

  const day0 = pickFutureWeekday(0);
  const day1 = pickFutureWeekday(1);
  const day2 = pickFutureWeekday(2);
  const day3 = pickFutureWeekday(3);
  const day4 = pickFutureWeekday(4);
  const day5 = pickFutureWeekday(5);
  const sat = nextSaturdayAfter(day0);
  info('test weekday base', day0);
  info('test Saturday', sat);

  banner('BOOKINGS — validation rules (strict resource)');
  const createBooking = (body, token) => post('/api/bookings', body, token);

  const validBooking = await json(
    await createBooking(
      { resourceId: room.id, startAt: at(day0, '09:00'), endAt: at(day0, '11:00') },
      USER,
    ),
  );
  check('valid weekday 09:00-11:00', validBooking.status, 'PENDING');

  check(
    'past date → 400',
    (
      await createBooking(
        {
          resourceId: room.id,
          startAt: '2024-01-01T09:00:00+01:00',
          endAt: '2024-01-01T10:00:00+01:00',
        },
        USER,
      )
    ).status,
    400,
  );

  check(
    'end <= start → 400',
    (
      await createBooking(
        { resourceId: room.id, startAt: at(day1, '10:00'), endAt: at(day1, '09:00') },
        USER,
      )
    ).status,
    400,
  );

  check(
    'Saturday on strict resource → 422',
    (
      await createBooking(
        { resourceId: room.id, startAt: at(sat, '10:00'), endAt: at(sat, '11:00') },
        USER,
      )
    ).status,
    422,
  );

  check(
    'outside hours 22:00 → 422',
    (
      await createBooking(
        { resourceId: room.id, startAt: at(day1, '22:00'), endAt: at(day1, '23:00') },
        USER,
      )
    ).status,
    422,
  );

  check(
    'starts exactly at 17:00 → 422',
    (
      await createBooking(
        { resourceId: room.id, startAt: at(day1, '17:00'), endAt: at(day1, '18:00') },
        USER,
      )
    ).status,
    422,
  );

  check(
    'ends exactly at 17:00 → 201',
    (
      await createBooking(
        { resourceId: room.id, startAt: at(day1, '15:00'), endAt: at(day1, '17:00') },
        USER,
      )
    ).status,
    201,
  );

  check(
    'overlap with PENDING → 409',
    (
      await createBooking(
        { resourceId: room.id, startAt: at(day0, '10:00'), endAt: at(day0, '12:00') },
        USER,
      )
    ).status,
    409,
  );

  check(
    'holiday 2026-12-25 → 422',
    (
      await createBooking(
        {
          resourceId: room.id,
          startAt: at('2026-12-25', '09:00'),
          endAt: at('2026-12-25', '10:00'),
        },
        USER,
      )
    ).status,
    422,
  );

  banner('BOOKINGS — per-resource overrides');
  check(
    'vehicle on Saturday (allowWeekendsAndHolidays) → 201',
    (
      await createBooking(
        { resourceId: vehicle.id, startAt: at(sat, '10:00'), endAt: at(sat, '12:00') },
        USER,
      )
    ).status,
    201,
  );

  check(
    'printer 22:00 (allowOutsideHours) → 201',
    (
      await createBooking(
        { resourceId: printer.id, startAt: at(day2, '22:00'), endAt: at(day2, '23:00') },
        USER,
      )
    ).status,
    201,
  );

  banner('BOOKINGS — status transitions');
  const approved = await json(await post(`/api/bookings/${validBooking.id}/approve`, {}, ADMIN));
  check('admin approves PENDING → APPROVED', approved.status, 'APPROVED');

  check(
    'cannot approve already-APPROVED → 409',
    (await post(`/api/bookings/${validBooking.id}/approve`, {}, ADMIN)).status,
    409,
  );

  check(
    'overlap with APPROVED → 409',
    (
      await createBooking(
        { resourceId: room.id, startAt: at(day0, '09:30'), endAt: at(day0, '10:00') },
        USER,
      )
    ).status,
    409,
  );

  const cancelled = await json(await post(`/api/bookings/${validBooking.id}/cancel`, {}, USER));
  check('owner cancels APPROVED → CANCELLED', cancelled.status, 'CANCELLED');

  check(
    'cannot cancel already-CANCELLED → 409',
    (await post(`/api/bookings/${validBooking.id}/cancel`, {}, USER)).status,
    409,
  );

  const toReject = await json(
    await createBooking(
      { resourceId: room.id, startAt: at(day3, '09:00'), endAt: at(day3, '10:00') },
      USER,
    ),
  );
  const rejected = await json(await post(`/api/bookings/${toReject.id}/reject`, {}, ADMIN));
  check('admin rejects PENDING → REJECTED', rejected.status, 'REJECTED');

  check(
    'cannot reject already-REJECTED → 409',
    (await post(`/api/bookings/${toReject.id}/reject`, {}, ADMIN)).status,
    409,
  );

  const adminBooking = await json(
    await createBooking(
      { resourceId: room.id, startAt: at(day4, '09:00'), endAt: at(day4, '10:00') },
      ADMIN,
    ),
  );
  check(
    "user cannot cancel another user's booking → 403",
    (await post(`/api/bookings/${adminBooking.id}/cancel`, {}, USER)).status,
    403,
  );

  banner('BOOKINGS — listing, pagination, filtering');
  const myList = await json(await get('/api/bookings/me', USER));
  check('GET /bookings/me returns data array', Array.isArray(myList.data), true);
  check('GET /bookings/me returns pagination', typeof myList.pagination?.total === 'number', true);

  const pendingPage = await json(await get('/api/bookings?status=PENDING&pageSize=5', ADMIN));
  check(
    'admin filter status=PENDING pageSize=5',
    pendingPage.data.length <= 5 && pendingPage.data.every((b) => b.status === 'PENDING'),
    true,
  );

  banner('CONCURRENCY — 20 parallel bookings for the same slot');
  const slot = {
    resourceId: room.id,
    startAt: at(day5, '14:00'),
    endAt: at(day5, '15:00'),
  };
  info('slot', `${slot.startAt} → ${slot.endAt}`);
  const N = 20;
  const t0 = process.hrtime.bigint();
  const statuses = await Promise.all(
    Array.from({ length: N }, (_, i) =>
      post('/api/bookings', { ...slot, note: `parallel-${i}` }, USER).then((r) => r.status),
    ),
  );
  const elapsed = Number(process.hrtime.bigint() - t0) / 1e6;
  const ok201 = statuses.filter((s) => s === 201).length;
  const ok409 = statuses.filter((s) => s === 409).length;
  const other = N - ok201 - ok409;
  info('elapsed', `${elapsed.toFixed(0)} ms`);
  info('201 / 409 / other', `${ok201} / ${ok409} / ${other}`);
  check('exactly 1 booking wins', ok201, 1);
  check('exactly N-1 conflicts', ok409, N - 1);
  check('no unexpected statuses', other, 0);

  banner('SUMMARY');
  console.log(`  ${C.green}passed:${C.reset}  ${pass}`);
  console.log(`  ${fail === 0 ? C.dim : C.red}failed:${C.reset}  ${fail}`);
  if (skip > 0) console.log(`  ${C.dim}skipped: ${skip}${C.reset}`);
  process.exit(fail === 0 ? 0 : 1);
};

main().catch((err) => {
  console.error('\n', err);
  process.exit(1);
});
