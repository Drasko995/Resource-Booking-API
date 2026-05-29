import { DateTime } from 'luxon';
import type { Resource } from '../entities/Resource';
import { HttpError } from '../utils/http-error';
import { validateBookingTimes } from './booking-validator.service';

const TZ = 'Europe/Belgrade';

const buildResource = (overrides: Partial<Resource> = {}): Resource =>
  ({
    id: 'r1',
    name: 'Test',
    type: 'meeting_room',
    description: null,
    allowOutsideHours: false,
    allowWeekendsAndHolidays: false,
    createdAt: new Date(),
    bookings: [],
    ...overrides,
  }) as Resource;

const local = (iso: string): DateTime => DateTime.fromISO(iso, { zone: TZ }).toUTC();

const NOW = local('2026-05-29T10:00:00');

const run = (input: {
  startIso: string;
  endIso: string;
  resource?: Resource;
  holidays?: string[];
  now?: DateTime;
}) =>
  validateBookingTimes({
    start: local(input.startIso),
    end: local(input.endIso),
    resource: input.resource ?? buildResource(),
    holidayDates: new Set(input.holidays ?? []),
    now: input.now ?? NOW,
  });

describe('validateBookingTimes', () => {
  describe('rule 1: end must be after start', () => {
    it('throws when end equals start', () => {
      expect(() =>
        run({ startIso: '2026-06-01T09:00:00', endIso: '2026-06-01T09:00:00' }),
      ).toThrow(HttpError);
    });

    it('throws when end is before start', () => {
      expect(() =>
        run({ startIso: '2026-06-01T10:00:00', endIso: '2026-06-01T09:00:00' }),
      ).toThrow(/endAt must be after startAt/);
    });
  });

  describe('rule 2: not in the past', () => {
    it('throws when start is before now', () => {
      expect(() =>
        run({ startIso: '2024-01-01T09:00:00', endIso: '2024-01-01T10:00:00' }),
      ).toThrow(/cannot be created in the past/);
    });

    it('accepts a start exactly equal to now', () => {
      const start = NOW;
      expect(() =>
        validateBookingTimes({
          start,
          end: start.plus({ hours: 1 }),
          resource: buildResource({ allowOutsideHours: true }),
          holidayDates: new Set(),
          now: NOW,
        }),
      ).not.toThrow();
    });
  });

  describe('rule 3: working hours', () => {
    it('rejects a booking that starts before opening on a strict resource', () => {
      expect(() =>
        run({ startIso: '2026-06-01T07:00:00', endIso: '2026-06-01T09:00:00' }),
      ).toThrow(/working hours/);
    });

    it('rejects a booking that ends after closing on a strict resource', () => {
      expect(() =>
        run({ startIso: '2026-06-01T15:00:00', endIso: '2026-06-01T18:00:00' }),
      ).toThrow(/working hours/);
    });

    it('accepts a booking that ends exactly at closing time', () => {
      expect(() =>
        run({ startIso: '2026-06-01T15:00:00', endIso: '2026-06-01T17:00:00' }),
      ).not.toThrow();
    });

    it('rejects a booking starting exactly at closing time', () => {
      expect(() =>
        run({ startIso: '2026-06-01T17:00:00', endIso: '2026-06-01T18:00:00' }),
      ).toThrow(/working hours/);
    });

    it('skips the check when resource has allowOutsideHours', () => {
      const resource = buildResource({ allowOutsideHours: true });
      expect(() =>
        run({
          startIso: '2026-06-01T22:00:00',
          endIso: '2026-06-01T23:00:00',
          resource,
        }),
      ).not.toThrow();
    });
  });

  describe('rule 4: weekends', () => {
    it('rejects a Saturday booking on a strict resource', () => {
      expect(() =>
        run({ startIso: '2026-06-06T09:00:00', endIso: '2026-06-06T11:00:00' }),
      ).toThrow(/weekends/);
    });

    it('rejects a Sunday booking on a strict resource', () => {
      expect(() =>
        run({ startIso: '2026-06-07T09:00:00', endIso: '2026-06-07T11:00:00' }),
      ).toThrow(/weekends/);
    });

    it('skips the check when resource has allowWeekendsAndHolidays', () => {
      const resource = buildResource({ allowWeekendsAndHolidays: true });
      expect(() =>
        run({
          startIso: '2026-06-06T09:00:00',
          endIso: '2026-06-06T11:00:00',
          resource,
        }),
      ).not.toThrow();
    });
  });

  describe('rule 5: holidays', () => {
    it('rejects a booking on a configured holiday', () => {
      expect(() =>
        run({
          startIso: '2026-12-25T09:00:00',
          endIso: '2026-12-25T10:00:00',
          holidays: ['2026-12-25'],
        }),
      ).toThrow(/holiday/);
    });

    it('skips the check when resource has allowWeekendsAndHolidays', () => {
      const resource = buildResource({ allowWeekendsAndHolidays: true });
      expect(() =>
        run({
          startIso: '2026-12-25T09:00:00',
          endIso: '2026-12-25T10:00:00',
          resource,
          holidays: ['2026-12-25'],
        }),
      ).not.toThrow();
    });
  });

  describe('rule 6: single-day window for strict resources', () => {
    it('rejects a booking that spans across midnight', () => {
      expect(() =>
        run({ startIso: '2026-06-01T16:00:00', endIso: '2026-06-02T09:00:00' }),
      ).toThrow(/working hours/);
    });
  });

  describe('happy path', () => {
    it('accepts a valid weekday booking in working hours', () => {
      expect(() =>
        run({ startIso: '2026-06-01T09:00:00', endIso: '2026-06-01T11:00:00' }),
      ).not.toThrow();
    });
  });
});
