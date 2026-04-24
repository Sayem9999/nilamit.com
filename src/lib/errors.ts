/**
 * Standardized Application Errors
 * Used to differentiate between expected domain violations and unexpected system failures.
 */

export enum ErrorType {
  VALIDATION = 'VALIDATION_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED_ERROR',
  FORBIDDEN = 'FORBIDDEN_ERROR',
  NOT_FOUND = 'NOT_FOUND_ERROR',
  CONFLICT = 'CONFLICT_ERROR',
  RATE_LIMIT = 'RATE_LIMIT_ERROR',
  INTERNAL = 'INTERNAL_ERROR',
}

export class AppError extends Error {
  constructor(
    public type: ErrorType,
    public override message: string,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Type guard to check if an error is an AppError
 */
export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

/**
 * Standard Service Response Wrapper
 */
export interface ServiceResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    type: ErrorType;
    message: string;
    code?: string;
    details?: unknown;
  };
}

export function successResponse<T>(data: T): ServiceResponse<T> {
  return { success: true, data };
}

export function errorResponse(type: ErrorType, message: string, code?: string, details?: unknown): ServiceResponse<never> {
  return {
    success: false,
    error: { type, message, code, details }
  };
}
