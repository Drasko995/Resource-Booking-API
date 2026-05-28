import type { Request, Response } from 'express';
import * as holidayService from '../services/holiday.service';

export const list = async (_req: Request, res: Response): Promise<void> => {
  const holidays = await holidayService.listHolidays();
  res.json({ data: holidays });
};

export const create = async (req: Request, res: Response): Promise<void> => {
  const holiday = await holidayService.createHoliday(req.body);
  res.status(201).json(holiday);
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  await holidayService.deleteHoliday(req.params.id);
  res.status(204).send();
};
