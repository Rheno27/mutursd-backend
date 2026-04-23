import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { JawabanEntity } from './jawaban.entity';
import { PilihanJawabanEntity } from './pilihan-jawaban.entity';

@Entity({ name: 'pertanyaan' })
export class PertanyaanEntity {
  @PrimaryGeneratedColumn({ name: 'id_pertanyaan' })
  idPertanyaan!: number;

  @Column({ name: 'pertanyaan' })
  pertanyaan!: string;

  @Column({ name: 'urutan' })
  urutan!: number;

  @OneToMany(() => PilihanJawabanEntity, (pilihanJawaban) => pilihanJawaban.pertanyaan)
  pilihanJawaban!: PilihanJawabanEntity[];

  @OneToMany(() => JawabanEntity, (jawaban) => jawaban.pertanyaan)
  jawaban!: JawabanEntity[];
}