import { Controller, Get } from '@nestjs/common';
import { GamesService } from './games.service';

@Controller('games')
export class GamesController {
  constructor(private gamesService: GamesService) {}

  @Get()
  async getGames() {
    return await this.gamesService.getGames();
  }

  @Get('/from-igdb')
  async getGamesFromIGDB() {
    return await this.gamesService.getGamesFromIGDB();
  }

  @Get('/from-github')
  async getGamesFromGitHub() {
    return await this.gamesService.getGamesFromGitHub();
  }
}
