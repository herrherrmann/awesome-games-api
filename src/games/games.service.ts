import { HttpException, Injectable, HttpStatus } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { IGDB_API, IGDB_API_KEY } from '../common/config';
import { GAMES } from '../mocks/games.mock';

@Injectable()
export class GamesService {
  private games = GAMES;
  private suggestions = [];
  private igdbClient: AxiosInstance;

  constructor() {
    this.igdbClient = axios.create({
      baseURL: IGDB_API + '/',
      headers: {
        Accept: 'application/json',
        'user-key': IGDB_API_KEY,
      },
    });
  }

  getGames(): Promise<any> {
    return new Promise(resolve => {
      resolve(this.games);
    });
  }

  async getGamesFromIGDB(): Promise<any> {
    const response = await this.igdbClient.post(
      'games',
      'fields age_ratings,aggregated_rating,aggregated_rating_count,alternative_names,artworks,bundles,category,collection,cover,created_at,dlcs,expansions,external_games,first_release_date,follows,franchise,franchises,game_engines,game_modes,genres,hypes,involved_companies,keywords,multiplayer_modes,name,parent_game,platforms,player_perspectives,popularity,pulse_count,rating,rating_count,release_dates,screenshots,similar_games,slug,standalone_expansions,status,storyline,summary,tags,themes,time_to_beat,total_rating,total_rating_count,updated_at,url,version_parent,version_title,videos,websites;',
    );
    return response.data;
  }

  async getGamesFromGitHub(): Promise<any> {
    const readmeUrl =
      'https://raw.githubusercontent.com/herrherrmann/awesome-lan-party-games/master/readme.md';
    const response = await axios.get(readmeUrl);
    return response.data;
  }

  getGame(gameId): Promise<any> {
    const id = gameId;
    return new Promise(resolve => {
      const game = this.games.find(game => game.id === id);
      if (!game) {
        throw new HttpException('Game does not exist!', HttpStatus.NOT_FOUND);
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
