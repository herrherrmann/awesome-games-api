import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Game } from './entities/game.entity';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';

@Module({
  imports: [TypeOrmModule.forFeature([Game]), AuthModule],
  controllers: [GamesController],
  providers: [GamesService],
})
export class GamesModule {}
