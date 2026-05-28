import type { Request, Response } from 'express';
import * as resourceService from '../services/resource.service';

export const list = async (_req: Request, res: Response): Promise<void> => {
  const resources = await resourceService.listResources();
  res.json({ data: resources });
};

export const getOne = async (req: Request, res: Response): Promise<void> => {
  const resource = await resourceService.getResourceById(req.params.id);
  res.json(resource);
};

export const create = async (req: Request, res: Response): Promise<void> => {
  const resource = await resourceService.createResource(req.body);
  res.status(201).json(resource);
};

export const update = async (req: Request, res: Response): Promise<void> => {
  const resource = await resourceService.updateResource(req.params.id, req.body);
  res.json(resource);
};

export const remove = async (req: Request, res: Response): Promise<void> => {
  await resourceService.deleteResource(req.params.id);
  res.status(204).send();
};
