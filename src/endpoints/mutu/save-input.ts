import { NextFunction, Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { ValidationError, UnauthorizedError } from "../../errors";
import { IndikatorRuanganEntity } from "../../entities/indikator-ruangan.entity";
import { MutuRuanganEntity } from "../../entities/mutu-ruangan.entity";

type NumericMap = Record<string, unknown>;

type SaveMutuInputBody = {
  tanggal?: string | Date;
  pasienSesuai?: NumericMap;
  totalPasien?: NumericMap;
};

type RawIndicatorRoomRow = {
  idIndikatorRuangan?: string | number | null;
  idIndikator?: string | number | null;
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toStringValue(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : Number.NaN;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }

  return Number.NaN;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDateOnly(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function resolveTanggal(value: unknown): string {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) {
      throw new ValidationError("Tanggal tidak valid", {
        tanggal: "Format tanggal harus YYYY-MM-DD",
      });
    }

    return formatDateOnly(value);
  }

  const raw = toStringValue(value).trim();
  if (raw.length === 0) {
    throw new ValidationError("Tanggal wajib diisi", {
      tanggal: "Format tanggal harus YYYY-MM-DD",
    });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new ValidationError("Tanggal wajib diisi", {
      tanggal: "Format tanggal harus YYYY-MM-DD",
    });
  }

  const parsed = new Date(`${raw}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) {
    throw new ValidationError("Tanggal tidak valid", {
      tanggal: "Format tanggal harus YYYY-MM-DD",
    });
  }

  return raw;
}

export async function saveMutuInputHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const queryRunner = AppDataSource.createQueryRunner();

  try {
    const authUser = req.authUser;
    if (!authUser) {
      throw new UnauthorizedError("Authentication is required");
    }

    const body = req.body as SaveMutuInputBody;
    const errors: Record<string, string> = {};

    let tanggal = "";
    try {
      tanggal = resolveTanggal(body.tanggal);
    } catch (error) {
      if (
        error instanceof ValidationError &&
        error.details &&
        typeof error.details === "object"
      ) {
        Object.assign(errors, error.details as Record<string, string>);
      } else {
        errors.tanggal = "Format tanggal harus YYYY-MM-DD";
      }
    }

    const pasienSesuai = body.pasienSesuai;
    const totalPasien = body.totalPasien;

    if (!isPlainObject(pasienSesuai)) {
      errors.pasienSesuai = "Harus berupa object";
    }

    if (!isPlainObject(totalPasien)) {
      errors.totalPasien = "Harus berupa object";
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError("Data input tidak valid", errors);
    }

    const requestIds = Array.from(
      new Set(
        Object.keys(pasienSesuai as Record<string, unknown>)
          .map((key) => key.trim())
          .filter((key) => key.length > 0),
      ),
    );

    if (requestIds.length === 0) {
      res.status(200).json({
        success: true,
        message: "Data berhasil disimpan",
        data: {
          updatedCount: 0,
        },
      });
      return;
    }

    const requestedIndicatorIds: number[] = [];
    for (const key of requestIds) {
      const idIndikator = toNumber(key);
      if (!Number.isFinite(idIndikator) || !Number.isInteger(idIndikator)) {
        errors[`pasienSesuai.${key}`] = "ID indikator harus berupa angka";
        continue;
      }

      requestedIndicatorIds.push(idIndikator);
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError("Data input tidak valid", errors);
    }

    await queryRunner.connect();
    await queryRunner.startTransaction();

    const indikatorRuanganRepository = queryRunner.manager.getRepository(
      IndikatorRuanganEntity,
    );
    const mutuRuanganRepository =
      queryRunner.manager.getRepository(MutuRuanganEntity);

    const indikatorRows = (await indikatorRuanganRepository
      .createQueryBuilder("ir")
      .innerJoin("ir.indikatorMutu", "im")
      .select([
        'ir.id_indikator_ruangan AS "idIndikatorRuangan"',
        'ir.id_indikator AS "idIndikator"',
      ])
      .where("ir.id_ruangan = :idRuangan", {
        idRuangan: String(authUser.idRuangan),
      })
      .andWhere("ir.active = true")
      .andWhere("ir.id_indikator IN (:...requestedIndicatorIds)", {
        requestedIndicatorIds,
      })
      .getRawMany()) as RawIndicatorRoomRow[];

    const indicatorRoomByIndicatorId = new Map<number, number>();
    for (const row of indikatorRows) {
      const idIndikator = toNumber(row.idIndikator);
      const idIndikatorRuangan = toNumber(row.idIndikatorRuangan);
      if (
        !Number.isFinite(idIndikator) ||
        !Number.isFinite(idIndikatorRuangan)
      ) {
        continue;
      }

      indicatorRoomByIndicatorId.set(idIndikator, idIndikatorRuangan);
    }

    for (const key of requestIds) {
      const idIndikator = toNumber(key);
      if (!Number.isFinite(idIndikator) || !Number.isInteger(idIndikator)) {
        continue;
      }

      if (!indicatorRoomByIndicatorId.has(idIndikator)) {
        continue;
      }

      const pasienSesuaiValue = toNumber(
        (pasienSesuai as Record<string, unknown>)[key],
      );
      const totalPasienValue = toNumber(
        (totalPasien as Record<string, unknown>)[key],
      );

      if (
        !Number.isFinite(pasienSesuaiValue) ||
        !Number.isFinite(totalPasienValue)
      ) {
        errors[`pasienSesuai.${key}`] = "Nilai harus berupa angka";
        continue;
      }

      if (pasienSesuaiValue > totalPasienValue) {
        errors[`pasienSesuai.${key}`] = "Tidak boleh melebihi totalPasien";
      }
    }

    if (Object.keys(errors).length > 0) {
      throw new ValidationError("Data input tidak valid", errors);
    }

    const tanggalDate = new Date(`${tanggal}T00:00:00`);
    let updatedCount = 0;

    for (const key of requestIds) {
      const idIndikator = toNumber(key);
      if (!Number.isFinite(idIndikator) || !Number.isInteger(idIndikator)) {
        continue;
      }

      const idIndikatorRuangan = indicatorRoomByIndicatorId.get(idIndikator);
      if (idIndikatorRuangan === undefined) {
        continue;
      }

      const pasienSesuaiValue = toNumber(
        (pasienSesuai as Record<string, unknown>)[key],
      );
      const totalPasienValue = toNumber(
        (totalPasien as Record<string, unknown>)[key],
      );

      const existing = await mutuRuanganRepository.findOne({
        where: {
          tanggal: tanggalDate,
          idIndikatorRuangan,
        },
      });

      if (existing) {
        existing.totalPasien = totalPasienValue;
        existing.pasienSesuai = pasienSesuaiValue;
        await mutuRuanganRepository.save(existing);
      } else {
        const created = mutuRuanganRepository.create({
          tanggal: tanggalDate,
          idIndikatorRuangan,
          totalPasien: totalPasienValue,
          pasienSesuai: pasienSesuaiValue,
        });
        await mutuRuanganRepository.save(created);
      }

      updatedCount += 1;
    }

    await queryRunner.commitTransaction();

    res.status(200).json({
      success: true,
      message: "Data berhasil disimpan",
      data: {
        updatedCount,
      },
    });
    return;
  } catch (error) {
    if (queryRunner.isTransactionActive) {
      await queryRunner.rollbackTransaction();
    }

    return next(error);
  } finally {
    if (!queryRunner.isReleased) {
      await queryRunner.release();
    }
  }
}
