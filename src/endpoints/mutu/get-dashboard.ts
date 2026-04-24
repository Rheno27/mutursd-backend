import { NextFunction, Request, Response } from 'express';
import { AppDataSource } from '../../data-source';
import { MutuRuanganEntity } from '../../entities/mutu-ruangan.entity';
import { calculateSkmDailyStats } from '../../function/calculate-skm';

export const getMutuDashboardHandler = async (_req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
  try {
    const mutuRepository = AppDataSource.getRepository(MutuRuanganEntity);
    const mutuRows = await mutuRepository.find({
      order: {
        tanggal: 'DESC',
      } as any,
    });

    const skmDailyStats = calculateSkmDailyStats(mutuRows as any, {}, { label: 'SKM' }) as unknown as Array<Record<string, unknown>>;

    return res.status(200).json({
      success: true,
      message: 'Berhasil mengambil dashboard mutu',
      data: {
        mutuRows,
        skmDailyStats,
      },
    });
  } catch (error) {
    return next(error);
  }
};
