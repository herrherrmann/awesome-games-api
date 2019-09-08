import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Game {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 500 })
  name: string;

  @Column('text', { nullable: true })
  description: string;

  @Column('simple-array')
  genres: string[];

  @Column('integer', { nullable: true })
  releaseYear: number | null;

  @Column('numeric', { nullable: true })
  rating: number;

  @Column('boolean')
  isFree: boolean;

  @Column('jsonb')
  links: {
    website?: string;
    igdb?: string;
    steam?: string;
  };
}
