import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export class AuthInfo {
  @PrimaryColumn()
  authToken: string;

  @Column('text')
  expiryDate: string;
}
