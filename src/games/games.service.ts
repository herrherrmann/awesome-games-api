import { HttpException, Injectable } from '@nestjs/common';
import { GAMES } from '../mocks/games.mock';

@Injectable()
export class GamesService {
  games = GAMES;
  suggestions = [];

  getBooks(): Promise<any> {
    return new Promise(resolve => {
      resolve(this.games);
    });
  }

  getBook(gameId): Promise<any> {
    const id = gameId;
    return new Promise(resolve => {
      const game = this.games.find(game => game.id === id);
      if (!game) {
        throw new HttpException('Game does not exist!', 404);
      }
      resolve(game);
    });
  }

  suggest(game): Promise<any> {
    return new Promise(resolve => {
      this.suggestions.push(game);
      resolve(this.suggestions);
    });
  }
}
