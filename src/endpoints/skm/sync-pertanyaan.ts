import { NextFunction, Request, Response } from 'express';
import { AppDataSource } from '../../data-source';
import * as Errors from '../../errors';
import { JawabanEntity } from '../../entities/jawaban.entity';
import { PilihanJawabanEntity } from '../../entities/pilihan-jawaban.entity';
import { PertanyaanEntity } from '../../entities/pertanyaan.entity';

type SyncQuestionPayload = {
  idPertanyaan?: string | number | null;
  pertanyaan?: string;
  urutan?: number | string;
  pilihan?: Array<{
    idPilihan?: string | number | null;
    pilihan?: string;
    nilai?: number | string | null;
  }>;
};

function parseOptionalNumber(value: unknown, fieldName: string, allowZero = false): number | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const parsed = Number(value);
  if (Number.isNaN(parsed) || (!allowZero && parsed <= 0) || (allowZero && parsed < 0)) {
    throw createValidationError(`${fieldName} harus berupa angka yang valid`);
  }

  return parsed;
}

function createValidationError(message: string): Error {
  const Ctor = (Errors as any).ValidationError ?? (Errors as any).BadRequestError ?? Error;
  return new Ctor(message);
}

function parseRequiredQuestions(payload: any): SyncQuestionPayload[] {
  if (!payload || !Array.isArray(payload.questions)) {
    throw createValidationError('questions wajib diisi');
  }

  return payload.questions as SyncQuestionPayload[];
}

export async function syncSkmPertanyaanHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const questions = parseRequiredQuestions(req.body);

    await AppDataSource.transaction(async (manager) => {
      const questionRepo = manager.getRepository(PertanyaanEntity);
      const choiceRepo = manager.getRepository(PilihanJawabanEntity);
      const answerRepo = manager.getRepository(JawabanEntity);

      const safeQuestionIds = new Set<string>();
      const safeChoiceIds = new Set<string>();

      for (const rawQuestion of questions) {
        const questionId = parseOptionalNumber(rawQuestion.idPertanyaan, 'idPertanyaan');
        const pertanyaan = String(rawQuestion.pertanyaan ?? '').trim();
        const urutan = parseOptionalNumber(rawQuestion.urutan, 'urutan') ?? 0;
        const pilihanList = Array.isArray(rawQuestion.pilihan) ? rawQuestion.pilihan : [];

        if (!pertanyaan) {
          throw createValidationError('Teks pertanyaan wajib diisi');
        }

        let savedQuestionId: string | number;

        if (questionId !== null) {
          const existingQuestion = await questionRepo
            .createQueryBuilder('p')
            .select('p.id_pertanyaan', 'idPertanyaan')
            .where('p.id_pertanyaan = :idPertanyaan', { idPertanyaan: questionId })
            .getRawOne();

          if (existingQuestion) {
            await questionRepo
              .createQueryBuilder()
              .update(PertanyaanEntity)
              .set({ pertanyaan, urutan } as any)
              .where('id_pertanyaan = :idPertanyaan', { idPertanyaan: questionId })
              .execute();
            savedQuestionId = questionId;
          } else {
            const insertedQuestion = await questionRepo.save(
              questionRepo.create({
                pertanyaan,
                urutan,
              } as any),
            );
            savedQuestionId = (insertedQuestion as any).idPertanyaan;
          }
        } else {
          const insertedQuestion = await questionRepo.save(
            questionRepo.create({
              pertanyaan,
              urutan,
            } as any),
          );
          savedQuestionId = (insertedQuestion as any).idPertanyaan;
        }

        safeQuestionIds.add(String(savedQuestionId));

        for (const rawChoice of pilihanList) {
          const choiceId = parseOptionalNumber(rawChoice.idPilihan, 'idPilihan');
          const pilihan = String(rawChoice.pilihan ?? '').trim();
          const nilai = parseOptionalNumber(rawChoice.nilai, 'nilai', true);

          if (!pilihan) {
            continue;
          }

          if (choiceId !== null) {
            const existingChoice = await choiceRepo
              .createQueryBuilder('pj')
              .select('pj.id_pilihan', 'idPilihan')
              .where('pj.id_pilihan = :idPilihan', { idPilihan: choiceId })
              .getRawOne();

            if (existingChoice) {
              await choiceRepo
                .createQueryBuilder()
                .update(PilihanJawabanEntity)
                .set(
                  {
                    idPertanyaan: savedQuestionId as any,
                    pilihan,
                    nilai,
                  } as any,
                )
                .where('id_pilihan = :idPilihan', { idPilihan: choiceId })
                .execute();
              safeChoiceIds.add(String(choiceId));
            } else {
              const insertedChoice = await choiceRepo.save(
                choiceRepo.create({
                  idPertanyaan: savedQuestionId as any,
                  pilihan,
                  nilai,
                } as any),
              );
              safeChoiceIds.add(String((insertedChoice as any).idPilihan));
            }
          } else {
            const insertedChoice = await choiceRepo.save(
              choiceRepo.create({
                idPertanyaan: savedQuestionId as any,
                pilihan,
                nilai,
              } as any),
            );
            safeChoiceIds.add(String((insertedChoice as any).idPilihan));
          }
        }
      }

      const existingQuestionRows = await questionRepo
        .createQueryBuilder('p')
        .select('p.id_pertanyaan', 'idPertanyaan')
        .getRawMany();

      const staleQuestionIds = existingQuestionRows
        .map((row: any) => String(row.idPertanyaan))
        .filter((id: string) => !safeQuestionIds.has(id));

      const existingChoiceRows = await choiceRepo
        .createQueryBuilder('pj')
        .select('pj.id_pilihan', 'idPilihan')
        .getRawMany();

      const staleChoiceIds = existingChoiceRows
        .map((row: any) => String(row.idPilihan))
        .filter((id: string) => !safeChoiceIds.has(id));

      if (staleChoiceIds.length > 0) {
        await answerRepo
          .createQueryBuilder()
          .delete()
          .from(JawabanEntity)
          .where('id_pilihan IN (:...ids)', { ids: staleChoiceIds })
          .execute();

        await choiceRepo
          .createQueryBuilder()
          .delete()
          .from(PilihanJawabanEntity)
          .where('id_pilihan IN (:...ids)', { ids: staleChoiceIds })
          .execute();
      }

      if (staleQuestionIds.length > 0) {
        await answerRepo
          .createQueryBuilder()
          .delete()
          .from(JawabanEntity)
          .where('id_pertanyaan IN (:...ids)', { ids: staleQuestionIds })
          .execute();

        await choiceRepo
          .createQueryBuilder()
          .delete()
          .from(PilihanJawabanEntity)
          .where('id_pertanyaan IN (:...ids)', { ids: staleQuestionIds })
          .execute();

        await questionRepo
          .createQueryBuilder()
          .delete()
          .from(PertanyaanEntity)
          .where('id_pertanyaan IN (:...ids)', { ids: staleQuestionIds })
          .execute();
      }
    });

    res.status(200).json({
      success: true,
      message: 'Struktur pertanyaan berhasil diperbarui',
      data: {
        success: true,
      },
    });
  } catch (error) {
    next(error);
  }
}