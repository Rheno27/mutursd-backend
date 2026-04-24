import { NextFunction, Request, Response } from 'express';
import { AppDataSource } from '../../data-source';
import { SUPERADMIN_ROOM_ID } from '../../constant';
import { RuanganEntity } from '../../entities/ruangan.entity';

export async function getRuanganListHandler(_req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const ruanganRepo = AppDataSource.getRepository(RuanganEntity);

    const rawRows = await ruanganRepo.find({
      select: {
        idRuangan: true,
        namaRuangan: true
      }
    });

    const data = rawRows
      .map((row) => ({
        idRuangan: String(row.idRuangan ?? ''),
        namaRuangan: String(row.namaRuangan ?? '')
      }))
      .filter((row) => row.idRuangan !== SUPERADMIN_ROOM_ID && row.idRuangan !== '');

    res.json({
      success: true,
      message: 'Daftar ruangan berhasil diambil',
      data
    });
  } catch (error) {
    next(error);
  }
}
