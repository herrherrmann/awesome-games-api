import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { SuggestGameDTO } from './dto/SuggestGameDTO.dto';
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

  @Post()
  async suggest(@Body() suggestGameDTO: SuggestGameDTO) {
    return await this.gamesService.suggest(suggestGameDTO);
  }
}
