import { AppDataSource } from '../config/datasource';
import { Resource } from '../entities/Resource';
import type { CreateResourceInput, UpdateResourceInput } from '../dtos/resource.dto';
import { HttpError } from '../utils/http-error';

const repo = () => AppDataSource.getRepository(Resource);

export const listResources = (): Promise<Resource[]> =>
  repo().find({ order: { name: 'ASC' } });

export const getResourceById = async (id: string): Promise<Resource> => {
  const resource = await repo().findOne({ where: { id } });
  if (!resource) {
    throw HttpError.notFound('Resource not found');
  }
  return resource;
};

export const createResource = async (input: CreateResourceInput): Promise<Resource> => {
  const existing = await repo().findOne({ where: { name: input.name } });
  if (existing) {
    throw HttpError.conflict('Resource with this name already exists');
  }
  const resource = repo().create({
    name: input.name,
    type: input.type,
    description: input.description ?? null,
    allowOutsideHours: input.allowOutsideHours ?? false,
    allowWeekendsAndHolidays: input.allowWeekendsAndHolidays ?? false,
  });
  return repo().save(resource);
};

export const updateResource = async (
  id: string,
  input: UpdateResourceInput,
): Promise<Resource> => {
  const resource = await getResourceById(id);
  Object.assign(resource, input);
  return repo().save(resource);
};

export const deleteResource = async (id: string): Promise<void> => {
  const result = await repo().delete({ id });
  if (!result.affected) {
    throw HttpError.notFound('Resource not found');
  }
};
