import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity()
export class Game {
  @PrimaryGeneratedColumn()
  id: number;

  @Column('integer', { nullable: true })
  igdbId: number | null;

  @Column('text', { nullable: true })
  igdbUrl: string | null;

  @Column({ length: 500 })
  name: string;

  /**
   * The original name from the GitHub readme
   */
  @Column({ length: 500 })
  originalName: string;

  @Column('text', { nullable: true })
  description: string | null;

  @Column('simple-array')
  genres: string[];

  @Column('integer', { nullable: true })
  releaseYear: number | null;

  @Column('numeric', { nullable: true })
  rating: number | null;

  @Column('boolean')
  isFree: boolean;

  @Column('jsonb')
  links: {
    website?: string;
    igdb?: string;
    steam?: string;
  };
}
