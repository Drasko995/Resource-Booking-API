import { DateTime } from 'luxon';
import { env } from '../config/env';

export const COMPANY_TZ = env.COMPANY_TIMEZONE;

export type TimeOfDay = { hour: number; minute: number };

export const parseTimeOfDay = (hhmm: string): TimeOfDay => {
  const [hourStr, minuteStr] = hhmm.split(':');
  return { hour: Number(hourStr), minute: Number(minuteStr) };
};

export const WORKING_HOURS_START = parseTimeOfDay(env.WORKING_HOURS_START);
export const WORKING_HOURS_END = parseTimeOfDay(env.WORKING_HOURS_END);

export const parseIsoInstant = (input: string): DateTime => {
  const dt = DateTime.fromISO(input, { setZone: true });
  if (!dt.isValid) {
    throw new Error(`Invalid ISO datetime: ${input}`);
  }
  return dt.toUTC();
};

export const toCompanyZone = (dt: DateTime): DateTime => dt.setZone(COMPANY_TZ);

export const companyDateString = (dt: DateTime): string =>
  toCompanyZone(dt).toFormat('yyyy-LL-dd');

export const sameCompanyDay = (a: DateTime, b: DateTime): boolean =>
  companyDateString(a) === companyDateString(b);

export const isWeekendInCompanyZone = (dt: DateTime): boolean => {
  const weekday = toCompanyZone(dt).weekday;
  return weekday === 6 || weekday === 7;
};

export const companyDaysCovered = (start: DateTime, end: DateTime): string[] => {
  const startLocal = toCompanyZone(start);
  const endLocal = toCompanyZone(end);
  const days: string[] = [];
  let cursor = startLocal.startOf('day');
  while (cursor < endLocal) {
    days.push(cursor.toFormat('yyyy-LL-dd'));
    cursor = cursor.plus({ days: 1 });
  }
  return days;
};

export const fitsInDailyWindow = (
  start: DateTime,
  end: DateTime,
  windowStart: TimeOfDay,
  windowEnd: TimeOfDay,
): boolean => {
  const startLocal = toCompanyZone(start);
  const endLocal = toCompanyZone(end);
  if (!sameCompanyDay(startLocal, endLocal)) return false;

  const winOpen = startLocal.set({
    hour: windowStart.hour,
    minute: windowStart.minute,
    second: 0,
    millisecond: 0,
  });
  const winClose = startLocal.set({
    hour: windowEnd.hour,
    minute: windowEnd.minute,
    second: 0,
    millisecond: 0,
  });

  return startLocal >= winOpen && endLocal <= winClose && startLocal < winClose;
};
