import { NextFunction, Request, Response } from 'express';
import { AppDataSource } from '../../data-source';
import { PertanyaanEntity } from '../../entities/pertanyaan.entity';
import { RuanganEntity } from '../../entities/ruangan.entity';

export async function getSurveyFormHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const pertanyaanRepository = AppDataSource.getRepository(PertanyaanEntity);
    const ruanganRepository = AppDataSource.getRepository(RuanganEntity);

    const questions = await pertanyaanRepository
      .createQueryBuilder('pertanyaan')
      .leftJoinAndSelect('pertanyaan.pilihan_jawaban', 'pilihan_jawaban')
      .orderBy('pertanyaan.urutan', 'ASC')
      .addOrderBy('pilihan_jawaban.id_pilihan', 'ASC')
      .getMany();

    const rooms = await ruanganRepository
      .createQueryBuilder('ruangan')
      .where('ruangan.id_ruangan <> :specialId', { specialId: 'SP00' })
      .orderBy('ruangan.id_ruangan', 'ASC')
      .getMany();

    res.status(200).json({
      success: true,
      message: 'OK',
      data: {
        questions,
        rooms,
      },
    });
  } catch (error) {
    next(error);
  }
}