import { NextFunction, Request, Response } from 'express';
import moment from 'moment';
import { AppDataSource } from '../../data-source';
import { IndikatorRuanganEntity } from '../../entities/indikator-ruangan.entity';
import { MutuRuanganEntity } from '../../entities/mutu-ruangan.entity';
import { AuthUserContext } from '../../jwt.util';
import { UnauthorizedError, ValidationError } from '../../errors';

type MutuInputPayload = {
  tanggal?: string;
  pasienSesuai?: Record<string, number | string | null | undefined>;
  totalPasien?: Record<string, number | string | null | undefined>;
  pasien_sesuai?: Record<string, number | string | null | undefined>;
  total_pasien?: Record<string, number | string | null | undefined>;
};

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

function toSafeNumber(value: unknown): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export async function saveMutuInputHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authUser = req.authUser as AuthUserContext | undefined;
    if (!authUser?.idRuangan) {
      throw new UnauthorizedError('Unauthorized');
    }

    const body = req.body as MutuInputPayload;
    const tanggal = normalizeDate(body.tanggal);
    const pasienSesuai = body.pasienSesuai ?? body.pasien_sesuai ?? {};
    const totalPasien = body.totalPasien ?? body.total_pasien ?? {};

    const indikatorRuanganRepo = AppDataSource.getRepository(IndikatorRuanganEntity);

    const activeAssignments = await indikatorRuanganRepo
      .createQueryBuilder('ir')
      .where('ir.idRuangan = :idRuangan', { idRuangan: authUser.idRuangan })
      .andWhere('ir.active = :active', { active: true })
      .getMany();

    await AppDataSource.transaction(async (manager) => {
      const mutuRepository = manager.getRepository(MutuRuanganEntity);

      const existingRows = activeAssignments.length
        ? await mutuRepository
            .createQueryBuilder('mr')
            .where('mr.tanggal = :tanggal', { tanggal })
            .andWhere('mr.idIndikatorRuangan IN (:...ids)', { ids: activeAssignments.map((item) => item.idIndikatorRuangan) })
            .getMany()
        : [];

      const existingMap = new Map<string, MutuRuanganEntity>();
      for (const row of existingRows) {
        existingMap.set(String(row.idIndikatorRuangan), row);
      }

      for (const assignment of activeAssignments) {
        const assignmentKey = String(assignment.idIndikator);
        const pasienSesuaiValue = toSafeNumber(pasienSesuai[assignmentKey]);
        const totalPasienValue = toSafeNumber(totalPasien[assignmentKey]);

        if (pasienSesuaiValue < 0 || totalPasienValue < 0) {
          throw new ValidationError(`Nilai pasien untuk indikator ${assignmentKey} tidak boleh negatif.`);
        }

        if (pasienSesuaiValue > totalPasienValue) {
          throw new ValidationError(`Pasien sesuai untuk indikator ${assignmentKey} tidak boleh lebih besar dari total pasien.`);
        }

        const existingRow = existingMap.get(String(assignment.idIndikatorRuangan));
        const entity = existingRow ?? mutuRepository.create();

        entity.idIndikatorRuangan = assignment.idIndikatorRuangan;
        entity.tanggal = tanggal;
        entity.totalPasien = totalPasienValue;
        entity.pasienSesuai = pasienSesuaiValue;

        await mutuRepository.save(entity);
      }
    });

    res.status(200).json({
      success: true,
      message: 'Data mutu berhasil disimpan.',
      data: {
        tanggal,
      },
    });
  } catch (error) {
    next(error);
  }
}