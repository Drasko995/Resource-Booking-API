export type HttpErrorDetails = Record<string, unknown> | unknown[];

export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: HttpErrorDetails;

  constructor(statusCode: number, code: string, message: string, details?: HttpErrorDetails) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static badRequest(message: string, details?: HttpErrorDetails): HttpError {
    return new HttpError(400, 'BAD_REQUEST', message, details);
  }

  static unauthorized(message = 'Unauthorized'): HttpError {
    return new HttpError(401, 'UNAUTHORIZED', message);
  }

  static forbidden(message = 'Forbidden'): HttpError {
    return new HttpError(403, 'FORBIDDEN', message);
  }

  static notFound(message = 'Resource not found'): HttpError {
    return new HttpError(404, 'NOT_FOUND', message);
  }

  static conflict(message: string, details?: HttpErrorDetails): HttpError {
    return new HttpError(409, 'CONFLICT', message, details);
  }

  static unprocessable(message: string, details?: HttpErrorDetails): HttpError {
    return new HttpError(422, 'UNPROCESSABLE_ENTITY', message, details);
  }
}
