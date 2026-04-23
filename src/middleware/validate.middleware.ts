import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { plainToInstance, type ClassConstructor } from 'class-transformer';
import { validate } from 'class-validator';
import { ValidationError as AppValidationError } from '../errors';

export type ValidationSource = 'body' | 'query' | 'params';

export interface ValidationIssue {
  property: string;
  value: unknown;
  constraints?: Record<string, string>;
  children?: ValidationIssue[];
}

function flattenValidationErrors(errors: Array<import('class-validator').ValidationError>): ValidationIssue[] {
  return errors.map((error) => ({
    property: error.property,
    value: error.value,
    constraints: error.constraints ?? undefined,
    children: error.children && error.children.length > 0 ? flattenValidationErrors(error.children) : undefined
  }));
}

export function validateMiddleware<T extends object>(
  dtoClass: ClassConstructor<T>,
  source: ValidationSource = 'body'
): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      const instance = plainToInstance(dtoClass, req[source], {
        enableImplicitConversion: true,
        excludeExtraneousValues: false
      });

      const validationErrors = await validate(instance as object, {
        whitelist: true,
        forbidNonWhitelisted: false,
        forbidUnknownValues: false
      });

      if (validationErrors.length > 0) {
        throw new AppValidationError('Validation failed', flattenValidationErrors(validationErrors));
      }

      (req as Request & Record<ValidationSource, unknown>)[source] = instance;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export const validateBody = <T extends object>(dtoClass: ClassConstructor<T>): RequestHandler =>
  validateMiddleware(dtoClass, 'body');

export const validateQuery = <T extends object>(dtoClass: ClassConstructor<T>): RequestHandler =>
  validateMiddleware(dtoClass, 'query');

export const validateParams = <T extends object>(dtoClass: ClassConstructor<T>): RequestHandler =>
  validateMiddleware(dtoClass, 'params');