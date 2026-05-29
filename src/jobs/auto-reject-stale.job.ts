import cron, { type ScheduledTask } from 'node-cron';
import { LessThan } from 'typeorm';
import { AppDataSource } from '../config/datasource';
import { Booking, BookingStatus } from '../entities/Booking';

const STALE_THRESHOLD_HOURS = 48;
const SCHEDULE = '*/15 * * * *';

export const rejectStalePendingBookings = async (
  now: Date = new Date(),
): Promise<number> => {
  const cutoff = new Date(now.getTime() - STALE_THRESHOLD_HOURS * 60 * 60 * 1000);
  const repo = AppDataSource.getRepository(Booking);
  const result = await repo.update(
    { status: BookingStatus.PENDING, createdAt: LessThan(cutoff) },
    { status: BookingStatus.REJECTED },
  );
  return result.affected ?? 0;
};

export const startAutoRejectStaleJob = (): ScheduledTask => {
  const task = cron.schedule(SCHEDULE, async () => {
    try {
      const count = await rejectStalePendingBookings();
      if (count > 0) {
        console.info(`[auto-reject] rejected ${count} stale pending bookings`);
      }
    } catch (err) {
      console.error('[auto-reject] job failed', err);
    }
  });
  console.info(`[auto-reject] scheduled (cron: ${SCHEDULE})`);
  return task;
};
