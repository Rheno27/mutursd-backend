import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import { IndikatorMutuEntity } from './indikator-mutu.entity';

@Entity({ name: 'kategori' })
export class KategoriEntity {
  @PrimaryGeneratedColumn({ name: 'id_kategori' })
  idKategori!: number;

  @Column({ name: 'kategori' })
  kategori!: string;

  @OneToMany(() => IndikatorMutuEntity, (indikatorMutu) => indikatorMutu.kategori)
  indikatorMutu!: IndikatorMutuEntity[];
}