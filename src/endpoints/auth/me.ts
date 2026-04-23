import { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../../errors';

export async function meHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.authUser) {
      throw new UnauthorizedError('Access token is required');
    }

    res.json({
      success: true,
      message: 'Data user berhasil diambil',
      data: req.authUser
    });
  } catch (error) {
    next(error);
  }
}