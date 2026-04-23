import { NextFunction, Request, Response } from 'express';
import { AppDataSource } from '../../data-source';
import { KategoriEntity } from '../../entities/kategori.entity';
import { IndikatorMutuEntity } from '../../entities/indikator-mutu.entity';
import { NotFoundError, ValidationError } from '../../errors';

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

export async function updateIndikatorHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idParam = req.params.id ?? (req.params as Record<string, string | undefined>).idIndikator;
    const parsedId = parseId(idParam);
    const { idKategori, variabel, standar } = (req.body ?? {}) as {
      idKategori?: unknown;
      variabel?: unknown;
      standar?: unknown;
    };

    const parsedIdKategori = parseId(idKategori);
    const variabelValue = typeof variabel === 'string' || typeof variabel === 'number' ? String(variabel).trim() : '';
    const standarValue = typeof standar === 'string' || typeof standar === 'number' ? String(standar).trim() : '';

    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      throw new (ValidationError as any)('ID indikator tidak valid');
    }

    if (!Number.isFinite(parsedIdKategori) || parsedIdKategori <= 0) {
      throw new (ValidationError as any)('Kategori indikator tidak valid');
    }

    if (variabelValue === '' || standarValue === '') {
      throw new (ValidationError as any)('Variabel dan standar wajib diisi');
    }

    const indikatorRepository = AppDataSource.getRepository(IndikatorMutuEntity);
    const indikator = await indikatorRepository.findOne({
      where: { idIndikator: parsedId } as any,
      relations: { kategori: true } as any,
    });

    if (!indikator) {
      throw new (NotFoundError as any)('Indikator tidak ditemukan');
    }

    const kategoriRepository = AppDataSource.getRepository(KategoriEntity);
    const kategori = await kategoriRepository.findOne({
      where: { idKategori: parsedIdKategori } as any,
    });

    if (!kategori) {
      throw new (NotFoundError as any)('Kategori indikator tidak ditemukan');
    }

    (indikator as any).idKategori = parsedIdKategori;
    (indikator as any).kategori = kategori;
    (indikator as any).variabel = variabelValue;
    (indikator as any).standar = standarValue;

    const savedIndikator = await indikatorRepository.save(indikator);

    res.json({
      success: true,
      message: 'Indikator berhasil diperbarui',
      data: savedIndikator,
    });
  } catch (error) {
    next(error);
  }
}