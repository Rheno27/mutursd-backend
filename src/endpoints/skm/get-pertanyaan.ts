import { NextFunction, Request, Response } from 'express';
import { AppDataSource } from '../../data-source';
import { PertanyaanEntity } from '../../entities/pertanyaan.entity';
import { PilihanJawabanEntity } from '../../entities/pilihan-jawaban.entity';

type RawPertanyaanRow = {
  idPertanyaan: string | number;
  pertanyaan: string;
  urutan: number;
  idPilihan: string | number | null;
  pilihan: string | null;
  nilai: string | number | null;
};

export async function getSkmPertanyaanHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rows = (await AppDataSource.getRepository(PertanyaanEntity)
      .createQueryBuilder('p')
      .leftJoin(PilihanJawabanEntity, 'pj', 'pj.id_pertanyaan = p.id_pertanyaan')
      .select('p.id_pertanyaan', 'idPertanyaan')
      .addSelect('p.pertanyaan', 'pertanyaan')
      .addSelect('p.urutan', 'urutan')
      .addSelect('pj.id_pilihan', 'idPilihan')
      .addSelect('pj.pilihan', 'pilihan')
      .addSelect('pj.nilai', 'nilai')
      .orderBy('p.urutan', 'ASC')
      .addOrderBy('pj.id_pilihan', 'ASC')
      .getRawMany()) as RawPertanyaanRow[];

    const map = new Map<
      string,
      {
        idPertanyaan: string | number;
        pertanyaan: string;
        urutan: number;
        pilihanJawaban: Array<{
          idPilihan: string | number;
          pilihan: string;
          nilai: string | number | null;
        }>;
      }
    >();

    for (const row of rows) {
      const key = String(row.idPertanyaan);

      if (!map.has(key)) {
        map.set(key, {
          idPertanyaan: row.idPertanyaan,
          pertanyaan: row.pertanyaan,
          urutan: row.urutan,
          pilihanJawaban: [],
        });
      }

      if (row.idPilihan !== null && row.idPilihan !== undefined) {
        map.get(key)!.pilihanJawaban.push({
          idPilihan: row.idPilihan,
          pilihan: row.pilihan ?? '',
          nilai: row.nilai,
        });
      }
    }

    res.status(200).json({
      success: true,
      message: 'Data pertanyaan berhasil diambil',
      data: {
        data: Array.from(map.values()),
      },
    });
  } catch (error) {
    next(error);
  }
}