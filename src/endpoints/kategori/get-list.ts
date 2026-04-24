import { NextFunction, Request, Response } from 'express';
import { AppDataSource } from '../../data-source';
import { KategoriEntity } from '../../entities/kategori.entity';

type RawKategoriRow = {
  idKategori?: string | number;
  kategori?: string | null;
};

export async function getKategoriListHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const kategoriRepo = AppDataSource.getRepository(KategoriEntity);

    const rawRows = (await kategoriRepo
      .createQueryBuilder('kategori')
      .select([
        'kategori.idKategori AS idKategori',
        'kategori.kategori AS kategori'
      ])
      .orderBy('kategori.kategori', 'ASC')
      .getRawMany()) as RawKategoriRow[];

    const data = rawRows.map((row) => ({
      idKategori: String(row.idKategori ?? ''),
      kategori: String(row.kategori ?? '')
    }));

    res.json({
      success: true,
      message: 'Daftar kategori berhasil diambil',
      data
    });
  } catch (error) {
    next(error);
  }
}
