import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { SuggestGameDTO } from './dto/SuggestGameDTO.dto';
import { GamesService } from './games.service';

@Controller('games')
export class GamesController {
  constructor(private gamesService: GamesService) {}

  @Get()
  async getBooks() {
    const games = await this.gamesService.getBooks();
    return games;
  }

  @Get(':gameId')
  async getGame(@Param('gameId') gameId) {
    const game = await this.gamesService.getBook(gameId);
    return game;
  }

  @Post()
  async suggest(@Body() suggestGameDTO: SuggestGameDTO) {
    const addedSuggestion = await this.gamesService.suggest(suggestGameDTO);
    return addedSuggestion;
  }
}
