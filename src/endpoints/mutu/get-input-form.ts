import { NextFunction, Request, Response } from 'express';
import { AppDataSource } from '../../data-source';
import { KategoriEntity } from '../../entities/kategori.entity';
import { MutuRuanganEntity } from '../../entities/mutu-ruangan.entity';

export const getMutuInputFormHandler = async (_req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
  try {
    const kategoriRepository = AppDataSource.getRepository(KategoriEntity);
    const mutuRuanganRepository = AppDataSource.getRepository(MutuRuanganEntity);

    const [kategoriRows, mutuRuanganRows] = await Promise.all([
      kategoriRepository.find(),
      mutuRuanganRepository.find(),
    ]);

    const kategoriSorted = [...kategoriRows].sort((left, right) => {
      const leftOrder = ((left as any).urutan_kategori ?? (left as any).urutan ?? 0) as number;
      const rightOrder = ((right as any).urutan_kategori ?? (right as any).urutan ?? 0) as number;
      return leftOrder - rightOrder;
    });

    const data = {
      kategori: kategoriSorted,
      mutuRuangan: mutuRuanganRows.map((row) => ({
        ...row,
        idMutuRuangan: (row as any).id_mutu_ruangan ?? (row as any).idMutuRuangan,
      })),
    };

    return res.status(200).json({
      success: true,
      message: 'Berhasil mengambil form input mutu',
      data,
    });
  } catch (error) {
    return next(error);
  }
};