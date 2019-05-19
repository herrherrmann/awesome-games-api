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

  @Get(':gameId')
  async getGame(@Param('gameId') gameId) {
    return await this.gamesService.getGame(gameId);
  }

  @Post()
  async suggest(@Body() suggestGameDTO: SuggestGameDTO) {
    return await this.gamesService.suggest(suggestGameDTO);
  }
}
