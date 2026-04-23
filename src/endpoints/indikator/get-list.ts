import { NextFunction, Request, Response } from 'express';
import { Brackets } from 'typeorm';
import { AppDataSource } from '../../data-source';
import { IndikatorMutuEntity } from '../../entities/indikator-mutu.entity';

const MAX_LIMIT = 100;

function parsePositiveInteger(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.max(1, Math.floor(value));
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return fallback;
}

export async function getIndikatorListHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const page = parsePositiveInteger(req.query.page, 1);
    const limit = Math.min(MAX_LIMIT, parsePositiveInteger(req.query.limit, 10));
    const rawSearch = typeof req.query.search === 'string' ? req.query.search.trim() : '';
    const search = rawSearch.toLowerCase();

    const repository = AppDataSource.getRepository(IndikatorMutuEntity);
    const query = repository
      .createQueryBuilder('indikator')
      .leftJoinAndSelect('indikator.kategori', 'kategori');

    if (search !== '') {
      query.andWhere(
        new Brackets((qb) => {
          qb.where('LOWER(indikator.variabel) LIKE :search', { search: `%${search}%` }).orWhere(
            'LOWER(kategori.kategori) LIKE :search',
            { search: `%${search}%` },
          );
        }),
      );
    }

    const total = await query.getCount();
    const data = await query
      .orderBy('indikator.idIndikator', 'ASC')
      .skip((page - 1) * limit)
      .take(limit)
      .getMany();

    res.json({
      success: true,
      message: 'Daftar indikator berhasil diambil',
      data: {
        data,
        meta: {
          page,
          limit,
          total,
          totalPages: total === 0 ? 0 : Math.ceil(total / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
}