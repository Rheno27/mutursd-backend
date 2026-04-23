import { NextFunction, Request, Response } from 'express';
import { AppDataSource } from '../../data-source';
import { ConflictError, NotFoundError, ValidationError } from '../../errors';
import { RuanganEntity } from '../../entities/ruangan.entity';
import { IndikatorMutuEntity } from '../../entities/indikator-mutu.entity';
import { IndikatorRuanganEntity } from '../../entities/indikator-ruangan.entity';

function normalizeString(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

function toBoolean(value: unknown): boolean {
  return Number(value) === 1 || value === true || value === '1';
}

export async function assignRuanganHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idRuangan = normalizeString(req.body?.idRuangan);
    const idIndikatorBaru = normalizeString(req.body?.idIndikatorBaru);

    if (!idRuangan || !idIndikatorBaru) {
      throw new ValidationError('idRuangan dan idIndikatorBaru wajib diisi');
    }

    await AppDataSource.transaction(async (manager) => {
      const roomRepo = manager.getRepository(RuanganEntity);
      const indicatorRepo = manager.getRepository(IndikatorMutuEntity);

      const roomExists = await roomRepo
        .createQueryBuilder('r')
        .select('r.id_ruangan', 'idRuangan')
        .where('r.id_ruangan = :idRuangan', { idRuangan })
        .getRawOne();

      if (!roomExists) {
        throw new NotFoundError('Ruangan tidak ditemukan');
      }

      const indicatorExists = await indicatorRepo
        .createQueryBuilder('im')
        .select('im.id_indikator', 'idIndikator')
        .where('im.id_indikator = :idIndikator', { idIndikator: idIndikatorBaru })
        .getRawOne();

      if (!indicatorExists) {
        throw new NotFoundError('Indikator mutu tidak ditemukan');
      }

      const indikatorRuanganRepo = manager.getRepository(IndikatorRuanganEntity);
      const existingRows = await indikatorRuanganRepo
        .createQueryBuilder('ir')
        .select('ir.id_indikator_ruangan', 'idIndikatorRuangan')
        .addSelect('ir.active', 'active')
        .where('ir.id_ruangan = :idRuangan', { idRuangan })
        .andWhere('ir.id_indikator = :idIndikatorBaru', { idIndikatorBaru })
        .orderBy('ir.id_indikator_ruangan', 'ASC')
        .getRawMany();

      const existingRow = existingRows.length > 0 ? existingRows[0] : null;

      if (existingRow && toBoolean(existingRow.active)) {
        throw new ConflictError('Indikator sudah aktif di ruangan ini');
      }

      if (existingRow) {
        await manager.query('UPDATE indikator_ruangan SET active = 1 WHERE id_indikator_ruangan = ?', [existingRow.idIndikatorRuangan]);
      } else {
        await manager.query('INSERT INTO indikator_ruangan (id_ruangan, id_indikator, active) VALUES (?, ?, 1)', [idRuangan, idIndikatorBaru]);
      }
    });

    res.json({
      success: true,
      message: 'Indikator berhasil ditambahkan',
      data: {
        success: true,
      },
    });
  } catch (error) {
    next(error);
  }
}