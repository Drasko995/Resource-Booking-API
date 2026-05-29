import { DateTime } from 'luxon';
import { env } from '../config/env';
import type { Resource } from '../entities/Resource';
import { HttpError } from '../utils/http-error';
import {
  COMPANY_TZ,
  WORKING_HOURS_END,
  WORKING_HOURS_START,
  companyDaysCovered,
  fitsInDailyWindow,
} from '../utils/date';

export type ValidateBookingTimesInput = {
  start: DateTime;
  end: DateTime;
  resource: Resource;
  holidayDates: Set<string>;
  now: DateTime;
};

export const validateBookingTimes = (input: ValidateBookingTimesInput): void => {
  const { start, end, resource, holidayDates, now } = input;

  if (end <= start) {
    throw HttpError.badRequest('endAt must be after startAt');
  }

  if (start < now) {
    throw HttpError.badRequest('Bookings cannot be created in the past');
  }

  if (!resource.allowOutsideHours) {
    const fits = fitsInDailyWindow(start, end, WORKING_HOURS_START, WORKING_HOURS_END);
    if (!fits) {
      throw HttpError.unprocessable(
        `Booking must fit within working hours (${env.WORKING_HOURS_START}-${env.WORKING_HOURS_END}) on a single day`,
      );
    }
  }

  if (!resource.allowWeekendsAndHolidays) {
    for (const day of companyDaysCovered(start, end)) {
      const local = DateTime.fromISO(day, { zone: COMPANY_TZ });
      if (local.weekday === 6 || local.weekday === 7) {
        throw HttpError.unprocessable(`Bookings are not allowed on weekends (${day})`);
      }
      if (holidayDates.has(day)) {
        throw HttpError.unprocessable(`Bookings are not allowed on holiday (${day})`);
      }
    }
  }
};
