import { NextFunction, Request, Response } from 'express';
import { AppDataSource } from '../../data-source';
import { MutuRuanganEntity } from '../../entities/mutu-ruangan.entity';

interface SaveMutuInputBody {
  tanggal?: string | Date;
  [key: string]: unknown;
}

export const saveMutuInputHandler = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
  try {
    const body = req.body as SaveMutuInputBody;
    const mutuRuanganRepository = AppDataSource.getRepository(MutuRuanganEntity);

    const tanggal = body.tanggal instanceof Date ? body.tanggal : new Date(body.tanggal ?? '');

    const entity = mutuRuanganRepository.create({
      ...body,
      tanggal,
    } as any);

    const savedMutuRuangan = await mutuRuanganRepository.save(entity);

    return res.status(200).json({
      success: true,
      message: 'Berhasil menyimpan input mutu',
      data: savedMutuRuangan,
    });
  } catch (error) {
    return next(error);
  }
};