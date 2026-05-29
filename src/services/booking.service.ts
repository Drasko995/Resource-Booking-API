import { DateTime } from 'luxon';
import type { EntityManager } from 'typeorm';
import { AppDataSource } from '../config/datasource';
import { Booking, BookingStatus } from '../entities/Booking';
import { Holiday } from '../entities/Holiday';
import { Resource } from '../entities/Resource';
import { UserRole } from '../entities/User';
import type { CreateBookingInput, ListBookingsQuery } from '../dtos/booking.dto';
import { parseIsoInstant } from '../utils/date';
import { HttpError } from '../utils/http-error';
import { validateBookingTimes } from './booking-validator.service';

const ACTIVE_STATUSES = [BookingStatus.PENDING, BookingStatus.APPROVED];

export type Paginated<T> = {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
};

type Actor = { id: string; role: UserRole };

const findOverlapping = (
  tx: EntityManager,
  resourceId: string,
  startAt: Date,
  endAt: Date,
  excludeBookingId?: string,
): Promise<Booking | null> => {
  const qb = tx
    .getRepository(Booking)
    .createQueryBuilder('b')
    .where('b.resourceId = :resourceId', { resourceId })
    .andWhere('b.status IN (:...statuses)', { statuses: ACTIVE_STATUSES })
    .andWhere('b.startAt < :endAt', { endAt })
    .andWhere('b.endAt > :startAt', { startAt });
  if (excludeBookingId) {
    qb.andWhere('b.id != :excludeBookingId', { excludeBookingId });
  }
  return qb.getOne();
};

const loadHolidayDates = async (tx: EntityManager): Promise<Set<string>> => {
  const holidays = await tx.getRepository(Holiday).find();
  return new Set(holidays.map((h) => h.date));
};

export const createBooking = async (
  userId: string,
  input: CreateBookingInput,
): Promise<Booking> => {
  const startDt = parseIsoInstant(input.startAt);
  const endDt = parseIsoInstant(input.endAt);
  const startAt = startDt.toJSDate();
  const endAt = endDt.toJSDate();
  const now = DateTime.utc();

  return AppDataSource.transaction(async (tx) => {
    const resource = await tx
      .getRepository(Resource)
      .createQueryBuilder('r')
      .where('r.id = :id', { id: input.resourceId })
      .setLock('pessimistic_write')
      .getOne();

    if (!resource) {
      throw HttpError.notFound('Resource not found');
    }

    const holidayDates = await loadHolidayDates(tx);

    validateBookingTimes({ start: startDt, end: endDt, resource, holidayDates, now });

    const overlap = await findOverlapping(tx, resource.id, startAt, endAt);
    if (overlap) {
      throw HttpError.conflict('Resource is already booked for the requested time range');
    }

    const booking = tx.getRepository(Booking).create({
      resourceId: resource.id,
      userId,
      startAt,
      endAt,
      status: BookingStatus.PENDING,
      note: input.note ?? null,
    });

    return tx.getRepository(Booking).save(booking);
  });
};

const buildListQuery = (query: ListBookingsQuery, userId?: string) => {
  const qb = AppDataSource.getRepository(Booking)
    .createQueryBuilder('b')
    .leftJoinAndSelect('b.resource', 'resource')
    .orderBy('b.startAt', 'DESC');

  if (userId) {
    qb.andWhere('b.userId = :userId', { userId });
  }
  if (query.status) {
    qb.andWhere('b.status = :status', { status: query.status });
  }
  if (query.resourceId) {
    qb.andWhere('b.resourceId = :resourceId', { resourceId: query.resourceId });
  }

  qb.skip((query.page - 1) * query.pageSize).take(query.pageSize);
  return qb;
};

const paginate = async (
  query: ListBookingsQuery,
  userId?: string,
): Promise<Paginated<Booking>> => {
  const qb = buildListQuery(query, userId);
  const [data, total] = await qb.getManyAndCount();
  return {
    data,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: total === 0 ? 0 : Math.ceil(total / query.pageSize),
    },
  };
};

export const listMyBookings = (userId: string, query: ListBookingsQuery) =>
  paginate(query, userId);

export const listAllBookings = (query: ListBookingsQuery) => paginate(query);

const loadBookingOrThrow = async (id: string): Promise<Booking> => {
  const booking = await AppDataSource.getRepository(Booking).findOne({ where: { id } });
  if (!booking) {
    throw HttpError.notFound('Booking not found');
  }
  return booking;
};

export const cancelBooking = async (bookingId: string, actor: Actor): Promise<Booking> => {
  const booking = await loadBookingOrThrow(bookingId);
  if (actor.role !== UserRole.ADMIN && booking.userId !== actor.id) {
    throw HttpError.forbidden("You cannot cancel another user's booking");
  }
  if (!ACTIVE_STATUSES.includes(booking.status)) {
    throw HttpError.conflict(`Cannot cancel a booking with status ${booking.status}`);
  }
  booking.status = BookingStatus.CANCELLED;
  return AppDataSource.getRepository(Booking).save(booking);
};

export const approveBooking = async (bookingId: string): Promise<Booking> => {
  return AppDataSource.transaction(async (tx) => {
    const booking = await tx
      .getRepository(Booking)
      .createQueryBuilder('b')
      .where('b.id = :id', { id: bookingId })
      .setLock('pessimistic_write')
      .getOne();

    if (!booking) {
      throw HttpError.notFound('Booking not found');
    }
    if (booking.status !== BookingStatus.PENDING) {
      throw HttpError.conflict(`Cannot approve a booking with status ${booking.status}`);
    }

    const overlap = await findOverlapping(
      tx,
      booking.resourceId,
      booking.startAt,
      booking.endAt,
      booking.id,
    );
    if (overlap) {
      throw HttpError.conflict('Another active booking overlaps this time range');
    }

    booking.status = BookingStatus.APPROVED;
    return tx.getRepository(Booking).save(booking);
  });
};

export const rejectBooking = async (bookingId: string): Promise<Booking> => {
  const booking = await loadBookingOrThrow(bookingId);
  if (booking.status !== BookingStatus.PENDING) {
    throw HttpError.conflict(`Cannot reject a booking with status ${booking.status}`);
  }
  booking.status = BookingStatus.REJECTED;
  return AppDataSource.getRepository(Booking).save(booking);
};
