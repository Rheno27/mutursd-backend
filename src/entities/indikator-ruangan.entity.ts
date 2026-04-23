import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { IndikatorMutuEntity } from './indikator-mutu.entity';
import { MutuRuanganEntity } from './mutu-ruangan.entity';
import { RuanganEntity } from './ruangan.entity';

@Entity({ name: 'indikator_ruangan' })
export class IndikatorRuanganEntity {
  @PrimaryGeneratedColumn({ name: 'id_indikator_ruangan' })
  idIndikatorRuangan!: number;

  @Column({ name: 'id_ruangan' })
  idRuangan!: number;

  @Column({ name: 'id_indikator' })
  idIndikator!: number;

  @Column({ name: 'active' })
  active!: boolean;

  @ManyToOne(() => RuanganEntity, (ruangan) => ruangan.indikatorRuangan, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'id_ruangan' })
  ruangan!: RuanganEntity;

  @ManyToOne(() => IndikatorMutuEntity, (indikatorMutu) => indikatorMutu.indikatorRuangan, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'id_indikator' })
  indikatorMutu!: IndikatorMutuEntity;

  @OneToMany(() => MutuRuanganEntity, (mutuRuangan) => mutuRuangan.indikatorRuangan)
  mutuRuangan!: MutuRuanganEntity[];
}