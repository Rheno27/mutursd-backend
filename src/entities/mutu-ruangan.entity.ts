import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { IndikatorRuanganEntity } from './indikator-ruangan.entity';

@Entity({ name: 'mutu_ruangan' })
export class MutuRuanganEntity {
  @PrimaryGeneratedColumn({ name: 'id_mutu' })
  idMutu!: number;

  @Column({ name: 'tanggal' })
  tanggal!: Date;

  @Column({ name: 'id_indikator_ruangan' })
  idIndikatorRuangan!: number;

  @Column({ name: 'total_pasien' })
  totalPasien!: number;

  @Column({ name: 'pasien_sesuai' })
  pasienSesuai!: number;

  @ManyToOne(() => IndikatorRuanganEntity, (indikatorRuangan) => indikatorRuangan.mutuRuangan, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'id_indikator_ruangan' })
  indikatorRuangan!: IndikatorRuanganEntity;
}