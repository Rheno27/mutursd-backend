import { NextFunction, Request, Response } from 'express';
import moment from 'moment';
import { AppDataSource } from '../../data-source';
import { IndikatorRuanganEntity } from '../../entities/indikator-ruangan.entity';
import { MutuRuanganEntity } from '../../entities/mutu-ruangan.entity';
import { AuthUserContext } from '../../jwt.util';
import { UnauthorizedError } from '../../errors';

function normalizeDate(input: unknown): string {
  const value = String(input ?? '').trim();
  if (value) {
    const parsed = moment(value, ['YYYY-MM-DD', moment.ISO_8601], true);
    if (parsed.isValid()) {
      return parsed.format('YYYY-MM-DD');
    }
  }
  return moment().format('YYYY-MM-DD');
}

export async function getMutuInputFormHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authUser = req.authUser as AuthUserContext | undefined;
    if (!authUser?.idRuangan) {
      throw new UnauthorizedError('Unauthorized');
    }

    const tanggal = normalizeDate(req.query.tanggal);

    const indikatorRuanganRepo = AppDataSource.getRepository(IndikatorRuanganEntity);
    const mutuRuanganRepo = AppDataSource.getRepository(MutuRuanganEntity);

    const activeIndicators = await indikatorRuanganRepo
      .createQueryBuilder('ir')
      .innerJoinAndSelect('ir.indikatorMutu', 'im')
      .leftJoinAndSelect('im.kategori', 'k')
      .where('ir.idRuangan = :idRuangan', { idRuangan: authUser.idRuangan })
      .andWhere('ir.active = :active', { active: true })
      .orderBy('im.variabel', 'ASC')
      .addOrderBy('ir.idIndikatorRuangan', 'ASC')
      .getMany();

    const savedRows = await mutuRuanganRepo
      .createQueryBuilder('mr')
      .innerJoinAndSelect('mr.indikatorRuangan', 'ir')
      .innerJoinAndSelect('ir.indikatorMutu', 'im')
      .where('ir.idRuangan = :idRuangan', { idRuangan: authUser.idRuangan })
      .andWhere('mr.tanggal = :tanggal', { tanggal })
      .getMany();

    const mutu: Record<string, Record<string, unknown>> = {};
    for (const row of savedRows) {
      const idIndikator = row.indikatorRuangan?.idIndikator;
      if (idIndikator !== undefined && idIndikator !== null) {
        mutu[String(idIndikator)] = {
          idMutuRuangan: row.idMutuRuangan,
          idIndikatorRuangan: row.idIndikatorRuangan,
          tanggal: row.tanggal,
          totalPasien: row.totalPasien,
          pasienSesuai: row.pasienSesuai,
        };
      }
    }

    const indikator = activeIndicators.map((assignment) => ({
      idIndikatorRuangan: assignment.idIndikatorRuangan,
      idRuangan: assignment.idRuangan,
      idIndikator: assignment.idIndikator,
      active: assignment.active,
      indikatorMutu: assignment.indikatorMutu
        ? {
            idIndikator: assignment.indikatorMutu.idIndikator,
            idKategori: assignment.indikatorMutu.idKategori,
            variabel: assignment.indikatorMutu.variabel,
            standar: assignment.indikatorMutu.standar,
            kategori: assignment.indikatorMutu.kategori
              ? {
                  idKategori: assignment.indikatorMutu.kategori.idKategori,
                  kategori: assignment.indikatorMutu.kategori.kategori,
                  urutan: assignment.indikatorMutu.kategori.urutan,
                }
              : null,
          }
        : null,
    }));

    res.status(200).json({
      success: true,
      message: 'Berhasil mengambil form input mutu.',
      data: {
        tanggal,
        indikator,
        mutu,
      },
    });
  } catch (error) {
    next(error);
  }
}