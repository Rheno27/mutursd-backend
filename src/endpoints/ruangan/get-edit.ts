import { NextFunction, Request, Response } from 'express';
import { AppDataSource } from '../../data-source';
import { NotFoundError } from '../../errors';
import { RuanganEntity } from '../../entities/ruangan.entity';
import { IndikatorRuanganEntity } from '../../entities/indikator-ruangan.entity';
import { IndikatorMutuEntity } from '../../entities/indikator-mutu.entity';
import { KategoriEntity } from '../../entities/kategori.entity';

type RawRoom = {
  idRuangan?: string | number;
  namaRuangan?: string | null;
};

type RawIndicatorRoom = {
  idIndikatorRuangan?: string | number;
  idRuangan?: string | number;
  idIndikator?: string | number;
  idKategori?: string | number | null;
  variabel?: string | null;
  indikator?: string | null;
  kategori?: string | null;
  active?: string | number | boolean;
};

type RawMasterIndicator = {
  idIndikator?: string | number;
  idKategori?: string | number | null;
  variabel?: string | null;
  indikator?: string | null;
  kategori?: string | null;
};

type RawKategori = {
  idKategori?: string | number;
  kategori?: string | null;
};

function normalizeString(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

function sortByKategoriPriority(rows: RawIndicatorRoom[]): RawIndicatorRoom[] {
  const getPriority = (kategori?: string | null): number => {
    const value = normalizeString(kategori).toLowerCase();
    if (value.includes('prioritas unit')) {
      return 0;
    }

    if (value.includes('nasional mutu')) {
      return 1;
    }

    if (value.includes('prioritas rs')) {
      return 2;
    }

    return 3;
  };

  return [...rows].sort((a, b) => {
    const priorityDiff = getPriority(a.kategori) - getPriority(b.kategori);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }

    const variabelA = normalizeString(a.variabel).toLowerCase();
    const variabelB = normalizeString(b.variabel).toLowerCase();
    if (variabelA < variabelB) return -1;
    if (variabelA > variabelB) return 1;

    return normalizeString(a.idIndikatorRuangan).localeCompare(normalizeString(b.idIndikatorRuangan));
  });
}

export async function getRuanganEditHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idRuangan = normalizeString(req.params.id);

    const ruanganRepo = AppDataSource.getRepository(RuanganEntity);
    const indikatorRuanganRepo = AppDataSource.getRepository(IndikatorRuanganEntity);
    const indikatorMutuRepo = AppDataSource.getRepository(IndikatorMutuEntity);
    const kategoriRepo = AppDataSource.getRepository(KategoriEntity);

    const ruangan = (await ruanganRepo
      .createQueryBuilder('r')
      .select([
        'r.id_ruangan AS idRuangan',
        'r.nama_ruangan AS namaRuangan',
      ])
      .where('r.id_ruangan = :idRuangan', { idRuangan })
      .getRawOne()) as RawRoom | undefined;

    if (!ruangan) {
      throw new NotFoundError('Ruangan tidak ditemukan');
    }

    const activeIndikatorsRaw = (await indikatorRuanganRepo
      .createQueryBuilder('ir')
      .innerJoin('indikator_mutu', 'im', 'im.id_indikator = ir.id_indikator')
      .leftJoin('kategori', 'k', 'k.id_kategori = im.id_kategori')
      .select([
        'ir.id_indikator_ruangan AS idIndikatorRuangan',
        'ir.id_ruangan AS idRuangan',
        'ir.id_indikator AS idIndikator',
        'ir.active AS active',
        'im.id_kategori AS idKategori',
        'im.variabel AS variabel',
        'im.indikator AS indikator',
        'k.kategori AS kategori',
      ])
      .where('ir.id_ruangan = :idRuangan', { idRuangan })
      .andWhere('ir.active = 1')
      .getRawMany()) as RawIndicatorRoom[];

    const sortedActiveIndikators = sortByKategoriPriority(activeIndikatorsRaw);

    const allMasterIndikators = (await indikatorMutuRepo
      .createQueryBuilder('im')
      .leftJoin('kategori', 'k', 'k.id_kategori = im.id_kategori')
      .select([
        'im.id_indikator AS idIndikator',
        'im.id_kategori AS idKategori',
        'im.variabel AS variabel',
        'im.indikator AS indikator',
        'k.kategori AS kategori',
      ])
      .orderBy('im.variabel', 'ASC')
      .getRawMany()) as RawMasterIndicator[];

    const allKategoris = (await kategoriRepo
      .createQueryBuilder('k')
      .select([
        'k.id_kategori AS idKategori',
        'k.kategori AS kategori',
      ])
      .orderBy('k.id_kategori', 'ASC')
      .getRawMany()) as RawKategori[];

    const usedIndicatorIds = sortedActiveIndikators.map((indikator) => normalizeString(indikator.idIndikator));

    res.json({
      success: true,
      message: 'Data edit ruangan berhasil diambil',
      data: {
        ruangan: {
          idRuangan: normalizeString(ruangan.idRuangan),
          namaRuangan: normalizeString(ruangan.namaRuangan),
        },
        activeIndikators: sortedActiveIndikators.map((indikator) => ({
          idIndikatorRuangan: normalizeString(indikator.idIndikatorRuangan),
          idRuangan: normalizeString(indikator.idRuangan),
          idIndikator: normalizeString(indikator.idIndikator),
          idKategori: indikator.idKategori === null || indikator.idKategori === undefined ? null : normalizeString(indikator.idKategori),
          variabel: normalizeString(indikator.variabel),
          indikator: normalizeString(indikator.indikator),
          kategori: normalizeString(indikator.kategori),
          active: Number(indikator.active) === 1,
        })),
        allMasterIndikators: allMasterIndikators.map((indikator) => ({
          idIndikator: normalizeString(indikator.idIndikator),
          idKategori: indikator.idKategori === null || indikator.idKategori === undefined ? null : normalizeString(indikator.idKategori),
          variabel: normalizeString(indikator.variabel),
          indikator: normalizeString(indikator.indikator),
          kategori: normalizeString(indikator.kategori),
        })),
        allKategoris: allKategoris.map((kategori) => ({
          idKategori: normalizeString(kategori.idKategori),
          kategori: normalizeString(kategori.kategori),
        })),
        usedIndicatorIds,
      },
    });
  } catch (error) {
    next(error);
  }
}