import { NextFunction, Request, Response } from 'express';
import { AppDataSource } from '../../data-source';
import { NotFoundError, ValidationError } from '../../errors';

function normalizeString(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

export async function deactivateRuanganHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idIndikatorRuangan = normalizeString(req.body?.idIndikatorRuangan);

    if (!idIndikatorRuangan) {
      throw new ValidationError('idIndikatorRuangan wajib diisi');
    }

    await AppDataSource.transaction(async (manager) => {
      const existingRows = await manager.query(
        'SELECT id_indikator_ruangan AS idIndikatorRuangan FROM indikator_ruangan WHERE id_indikator_ruangan = ? LIMIT 1',
        [idIndikatorRuangan],
      );

      if (!existingRows.length) {
        throw new NotFoundError('Indikator ruangan tidak ditemukan');
      }

      await manager.query('UPDATE indikator_ruangan SET active = 0 WHERE id_indikator_ruangan = ?', [idIndikatorRuangan]);
    });

    res.json({
      success: true,
      message: 'Indikator berhasil dinonaktifkan',
      data: {
        success: true,
      },
    });
  } catch (error) {
    next(error);
  }
}