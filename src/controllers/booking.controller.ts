import type { Request, Response } from 'express';
import * as bookingService from '../services/booking.service';
import { HttpError } from '../utils/http-error';

const requireUser = (req: Request) => {
  if (!req.user) throw HttpError.unauthorized();
  return req.user;
};

export const create = async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const booking = await bookingService.createBooking(user.id, req.body);
  res.status(201).json(booking);
};

export const listMine = async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const result = await bookingService.listMyBookings(user.id, req.query as never);
  res.json(result);
};

export const listAll = async (req: Request, res: Response): Promise<void> => {
  const result = await bookingService.listAllBookings(req.query as never);
  res.json(result);
};

export const cancel = async (req: Request, res: Response): Promise<void> => {
  const user = requireUser(req);
  const booking = await bookingService.cancelBooking(req.params.id, user);
  res.json(booking);
};

export const approve = async (req: Request, res: Response): Promise<void> => {
  const booking = await bookingService.approveBooking(req.params.id);
  res.json(booking);
};

export const reject = async (req: Request, res: Response): Promise<void> => {
  const booking = await bookingService.rejectBooking(req.params.id);
  res.json(booking);
};
