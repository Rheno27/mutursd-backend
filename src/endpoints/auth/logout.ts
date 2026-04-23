import { NextFunction, Request, Response } from 'express';

export async function logoutHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    res.json({
      success: true,
      message: 'Logout berhasil',
      data: {
        success: true,
        message: 'Logout berhasil'
      }
    });
  } catch (error) {
    next(error);
  }
}