import { NextFunction, Request, Response } from 'express';
import { AppDataSource } from '../../data-source';
import { ConflictError, NotFoundError, ValidationError } from '../../errors';

function normalizeString(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

export async function switchRuanganHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idRuangan = normalizeString(req.body?.idRuangan);
    const idIndikatorRuanganLama = normalizeString(req.body?.idIndikatorRuanganLama);
    const idIndikatorBaru = normalizeString(req.body?.idIndikatorBaru);

    if (!idRuangan || !idIndikatorRuanganLama || !idIndikatorBaru) {
      throw new ValidationError('idRuangan, idIndikatorRuanganLama, dan idIndikatorBaru wajib diisi');
    }

    await AppDataSource.transaction(async (manager) => {
      const oldAssignmentRows = await manager.query(
        'SELECT id_indikator_ruangan AS idIndikatorRuangan, id_ruangan AS idRuangan, id_indikator AS idIndikator, active FROM indikator_ruangan WHERE id_indikator_ruangan = ? LIMIT 1',
        [idIndikatorRuanganLama],
      );

      if (!oldAssignmentRows.length) {
        throw new NotFoundError('Indikator ruangan lama tidak ditemukan');
      }

      const oldAssignment = oldAssignmentRows[0];
      if (normalizeString(oldAssignment.idRuangan) !== idRuangan) {
        throw new NotFoundError('Indikator ruangan lama tidak ditemukan di ruangan ini');
      }

      const newIndicatorRows = await manager.query('SELECT id_indikator AS idIndikator FROM indikator_mutu WHERE id_indikator = ? LIMIT 1', [idIndikatorBaru]);
      if (!newIndicatorRows.length) {
        throw new NotFoundError('Indikator mutu baru tidak ditemukan');
      }

      const duplicateActiveRows = await manager.query(
        'SELECT id_indikator_ruangan AS idIndikatorRuangan FROM indikator_ruangan WHERE id_ruangan = ? AND id_indikator = ? AND active = 1 AND id_indikator_ruangan <> ? LIMIT 1',
        [idRuangan, idIndikatorBaru, idIndikatorRuanganLama],
      );

      if (duplicateActiveRows.length > 0) {
        throw new ConflictError('Indikator sudah aktif di ruangan ini');
      }

      await manager.query('UPDATE indikator_ruangan SET active = 0 WHERE id_indikator_ruangan = ?', [idIndikatorRuanganLama]);

      const inactiveNewRows = await manager.query(
        'SELECT id_indikator_ruangan AS idIndikatorRuangan, active FROM indikator_ruangan WHERE id_ruangan = ? AND id_indikator = ? AND active = 0 ORDER BY id_indikator_ruangan ASC LIMIT 1',
        [idRuangan, idIndikatorBaru],
      );

      if (inactiveNewRows.length > 0) {
        await manager.query('UPDATE indikator_ruangan SET active = 1 WHERE id_indikator_ruangan = ?', [inactiveNewRows[0].idIndikatorRuangan]);
      } else {
        await manager.query('INSERT INTO indikator_ruangan (id_ruangan, id_indikator, active) VALUES (?, ?, 1)', [idRuangan, idIndikatorBaru]);
      }
    });

    res.json({
      success: true,
      message: 'Indikator berhasil diganti',
      data: {
        success: true,
      },
    });
  } catch (error) {
    next(error);
  }
}