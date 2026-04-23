import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { JawabanEntity } from './jawaban.entity';
import { PertanyaanEntity } from './pertanyaan.entity';

@Entity({ name: 'pilihan_jawaban' })
export class PilihanJawabanEntity {
  @PrimaryGeneratedColumn({ name: 'id_pilihan' })
  idPilihan!: number;

  @Column({ name: 'id_pertanyaan' })
  idPertanyaan!: number;

  @Column({ name: 'pilihan' })
  pilihan!: string;

  @Column({ name: 'nilai' })
  nilai!: number;

  @ManyToOne(() => PertanyaanEntity, (pertanyaan) => pertanyaan.pilihanJawaban, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'id_pertanyaan' })
  pertanyaan!: PertanyaanEntity;

  @OneToMany(() => JawabanEntity, (jawaban) => jawaban.pilihanJawaban)
  jawaban!: JawabanEntity[];
}