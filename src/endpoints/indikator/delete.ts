import { NextFunction, Request, Response } from 'express';
import { AppDataSource } from '../../data-source';
import { IndikatorMutuEntity } from '../../entities/indikator-mutu.entity';
import { IndikatorRuanganEntity } from '../../entities/indikator-ruangan.entity';
import { ConflictError, NotFoundError, ValidationError } from '../../errors';

function parseId(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.floor(value);
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return Number.NaN;
}

export async function deleteIndikatorHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idParam = req.params.id ?? (req.params as Record<string, string | undefined>).idIndikator;
    const parsedId = parseId(idParam);

    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      throw new (ValidationError as any)('ID indikator tidak valid');
    }

    const indikatorRepository = AppDataSource.getRepository(IndikatorMutuEntity);
    const indikator = await indikatorRepository.findOne({
      where: { idIndikator: parsedId } as any,
    });

    if (!indikator) {
      throw new (NotFoundError as any)('Indikator tidak ditemukan');
    }

    const indikatorRuanganRepository = AppDataSource.getRepository(IndikatorRuanganEntity);
    const usedCount = await indikatorRuanganRepository.count({
      where: { idIndikator: parsedId } as any,
    });

    if (usedCount > 0) {
      throw new (ConflictError as any)('Indikator sedang digunakan pada ruangan');
    }

    await indikatorRepository.delete({ idIndikator: parsedId } as any);

    res.json({
      success: true,
      message: 'Indikator berhasil dihapus',
      data: null,
    });
  } catch (error) {
    next(error);
  }
}