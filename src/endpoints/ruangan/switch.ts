import { NextFunction, Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { ConflictError, NotFoundError, ValidationError } from "../../errors";

function normalizeString(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

export async function switchRuanganHandler(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const idRuangan = normalizeString(req.body?.idRuangan);
    const idIndikatorRuanganLama = normalizeString(
      req.body?.idIndikatorRuanganLama,
    );
    const idIndikatorBaru = normalizeString(req.body?.idIndikatorBaru);

    if (!idRuangan || !idIndikatorRuanganLama || !idIndikatorBaru) {
      throw new ValidationError(
        "idRuangan, idIndikatorRuanganLama, dan idIndikatorBaru wajib diisi",
      );
    }

    await AppDataSource.transaction(async (manager) => {
      // PostgreSQL: $1 placeholder, quoted alias
      const oldAssignmentRows = await manager.query(
        'SELECT id_indikator_ruangan AS "idIndikatorRuangan", id_ruangan AS "idRuangan", id_indikator AS "idIndikator", active FROM indikator_ruangan WHERE id_indikator_ruangan = $1 LIMIT 1',
        [idIndikatorRuanganLama],
      );

      if (!oldAssignmentRows.length) {
        throw new NotFoundError("Indikator ruangan lama tidak ditemukan");
      }

      const oldAssignment = oldAssignmentRows[0];
      if (normalizeString(oldAssignment.idRuangan) !== idRuangan) {
        throw new NotFoundError(
          "Indikator ruangan lama tidak ditemukan di ruangan ini",
        );
      }

      const newIndicatorRows = await manager.query(
        'SELECT id_indikator AS "idIndikator" FROM indikator_mutu WHERE id_indikator = $1 LIMIT 1',
        [idIndikatorBaru],
      );
      if (!newIndicatorRows.length) {
        throw new NotFoundError("Indikator mutu baru tidak ditemukan");
      }

      // PostgreSQL: boolean true for active check
      const duplicateActiveRows = await manager.query(
        'SELECT id_indikator_ruangan AS "idIndikatorRuangan" FROM indikator_ruangan WHERE id_ruangan = $1 AND id_indikator = $2 AND active = true AND id_indikator_ruangan <> $3 LIMIT 1',
        [idRuangan, idIndikatorBaru, idIndikatorRuanganLama],
      );

      if (duplicateActiveRows.length > 0) {
        throw new ConflictError("Indikator sudah aktif di ruangan ini");
      }

      await manager.query(
        "UPDATE indikator_ruangan SET active = false WHERE id_indikator_ruangan = $1",
        [idIndikatorRuanganLama],
      );

      const inactiveNewRows = await manager.query(
        'SELECT id_indikator_ruangan AS "idIndikatorRuangan", active FROM indikator_ruangan WHERE id_ruangan = $1 AND id_indikator = $2 AND active = false ORDER BY id_indikator_ruangan ASC LIMIT 1',
        [idRuangan, idIndikatorBaru],
      );

      if (inactiveNewRows.length > 0) {
        await manager.query(
          "UPDATE indikator_ruangan SET active = true WHERE id_indikator_ruangan = $1",
          [inactiveNewRows[0].idIndikatorRuangan],
        );
      } else {
        await manager.query(
          "INSERT INTO indikator_ruangan (id_ruangan, id_indikator, active) VALUES ($1, $2, true)",
          [idRuangan, idIndikatorBaru],
        );
      }
    });

    res.json({
      success: true,
      message: "Indikator berhasil diganti",
      data: { success: true },
    });
  } catch (error) {
    next(error);
  }
}
