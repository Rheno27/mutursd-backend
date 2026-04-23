import { Column, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { KategoriEntity } from './kategori.entity';
import { IndikatorRuanganEntity } from './indikator-ruangan.entity';

@Entity({ name: 'indikator_mutu' })
export class IndikatorMutuEntity {
  @PrimaryGeneratedColumn({ name: 'id_indikator' })
  idIndikator!: number;

  @Column({ name: 'id_kategori' })
  idKategori!: number;

  @Column({ name: 'variabel' })
  variabel!: string;

  @Column({ name: 'standar' })
  standar!: string;

  @ManyToOne(() => KategoriEntity, (kategori) => kategori.indikatorMutu, {
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
    eager: false,
  })
  @JoinColumn({ name: 'id_kategori' })
  kategori!: KategoriEntity;

  @OneToMany(() => IndikatorRuanganEntity, (indikatorRuangan) => indikatorRuangan.indikatorMutu)
  indikatorRuangan!: IndikatorRuanganEntity[];
}