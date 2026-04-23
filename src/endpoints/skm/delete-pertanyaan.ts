import { NextFunction, Request, Response } from 'express';
import { AppDataSource } from '../../data-source';
import * as Errors from '../../errors';
import { JawabanEntity } from '../../entities/jawaban.entity';
import { PilihanJawabanEntity } from '../../entities/pilihan-jawaban.entity';
import { PertanyaanEntity } from '../../entities/pertanyaan.entity';

function createValidationError(message: string): Error {
  const Ctor = (Errors as any).ValidationError ?? (Errors as any).BadRequestError ?? Error;
  return new Ctor(message);
}

function createNotFoundError(message: string): Error {
  const Ctor = (Errors as any).NotFoundError ?? Error;
  return new Ctor(message);
}

function createConflictError(message: string): Error {
  const Ctor = (Errors as any).ConflictError ?? Error;
  return new Ctor(message);
}

function parseId(value: unknown, fieldName: string): number {
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed <= 0) {
    throw createValidationError(`${fieldName} wajib diisi dan harus berupa angka yang valid`);
  }
  return parsed;
}

export async function deleteSkmPertanyaanHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const idPertanyaan = parseId(req.params.idPertanyaan, 'idPertanyaan');

    const questionRepo = AppDataSource.getRepository(PertanyaanEntity);
    const answerRepo = AppDataSource.getRepository(JawabanEntity);

    const question = await questionRepo
      .createQueryBuilder('p')
      .select('p.id_pertanyaan', 'idPertanyaan')
      .where('p.id_pertanyaan = :idPertanyaan', { idPertanyaan })
      .getRawOne();

    if (!question) {
      throw createNotFoundError('Pertanyaan tidak ditemukan');
    }

    const responseCount = await answerRepo
      .createQueryBuilder('j')
      .where('j.id_pertanyaan = :idPertanyaan', { idPertanyaan })
      .getCount();

    if (responseCount > 0) {
      throw createConflictError('Pertanyaan tidak bisa dihapus karena sudah ada responden');
    }

    await AppDataSource.transaction(async (manager) => {
      await manager
        .getRepository(PilihanJawabanEntity)
        .createQueryBuilder()
        .delete()
        .from(PilihanJawabanEntity)
        .where('id_pertanyaan = :idPertanyaan', { idPertanyaan })
        .execute();

      await manager
        .getRepository(PertanyaanEntity)
        .createQueryBuilder()
        .delete()
        .from(PertanyaanEntity)
        .where('id_pertanyaan = :idPertanyaan', { idPertanyaan })
        .execute();
    });

    res.status(200).json({
      success: true,
      message: 'Pertanyaan berhasil dihapus',
      data: {
        success: true,
      },
    });
  } catch (error) {
    next(error);
  }
}