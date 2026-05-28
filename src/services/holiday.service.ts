import { AppDataSource } from '../config/datasource';
import { Holiday } from '../entities/Holiday';
import type { CreateHolidayInput } from '../dtos/holiday.dto';
import { HttpError } from '../utils/http-error';

const repo = () => AppDataSource.getRepository(Holiday);

export const listHolidays = (): Promise<Holiday[]> =>
  repo().find({ order: { date: 'ASC' } });

export const createHoliday = async (input: CreateHolidayInput): Promise<Holiday> => {
  const existing = await repo().findOne({ where: { date: input.date } });
  if (existing) {
    throw HttpError.conflict('Holiday for this date already exists');
  }
  return repo().save(repo().create(input));
};

export const deleteHoliday = async (id: string): Promise<void> => {
  const result = await repo().delete({ id });
  if (!result.affected) {
    throw HttpError.notFound('Holiday not found');
  }
};
