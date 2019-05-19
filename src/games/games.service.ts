import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import { IGDB_API, IGDB_API_KEY } from '../common/config';
import Game from '../interfaces/game';
import { SuggestGameDTO } from './dto/SuggestGameDTO.dto';
import { IGDB_Game } from 'src/interfaces/igdb';

@Injectable()
export class GamesService {
  private gameCache: { [id: string]: Game };
  private suggestions = [];
  private igdbClient: AxiosInstance;
  private IGDB_FIELDS =
    'category,cover,first_release_date,genres,multiplayer_modes,name,platforms,popularity,rating,slug,summary,total_rating,url,websites';

  constructor() {
    this.igdbClient = axios.create({
      baseURL: IGDB_API + '/',
      headers: {
        Accept: 'application/json',
        'user-key': IGDB_API_KEY,
      },
    });
  }

  async getGames(): Promise<Game[]> {
    const githubGames = await this.getGamesFromGitHub();
    const promises = githubGames.map(game => this.getGamesFromIGDB(game.name));
    const searchResultsPerGame = await Promise.all(promises);
    return githubGames.map((game: Game, index: number) => {
      const searchResults = searchResultsPerGame[index];
      const bestResult = this.getBestResult(searchResults, game);
      console.log('bestResult: ', bestResult);
      if (!bestResult) {
        return game;
      }
      return this.mergeGames(bestResult, game);
    });
  }

  async getGamesFromIGDB(search?: string): Promise<IGDB_Game[]> {
    const MAIN_GAME_CATEGORY = 0;
    const searchQuery = `
      ${search ? `search "${search}";` : ''}
      fields *;
      where category=${MAIN_GAME_CATEGORY};
    `;
    const response = await this.igdbClient.post('games', searchQuery);
    const games: IGDB_Game[] = response.data;
    return games;
  }

  getBestResult(igdbResults: IGDB_Game[], game: Game): IGDB_Game {
    const exactMatch = igdbResults.find(
      igdbResult => igdbResult.name.toLowerCase() === game.name.toLowerCase(),
    );
    if (exactMatch) {
      return exactMatch;
    }
    return igdbResults[0];
  }

  mergeGames(igdbGame: IGDB_Game, game: Game): Game {
    return {
      id: igdbGame.id,
      name: igdbGame.name,
      description: igdbGame.summary,
      links: game.links,
      genres: [],
      isFree: game.isFree,
      releaseYear: igdbGame.first_release_date
        ? new Date(igdbGame.first_release_date).getFullYear()
        : null,
      rating: igdbGame.total_rating,
    };
  }

  async getGamesFromGitHub(): Promise<Game[]> {
    const readmeUrl =
      'https://raw.githubusercontent.com/herrherrmann/awesome-lan-party-games/master/readme.md';
    const response = await axios.get(readmeUrl);
    const GAME_PREFIX = '- ';
    const games: Game[] = response.data
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.startsWith(GAME_PREFIX))
      .map((line: string, index: number) =>
        this.parseMarkdownLine(line.slice(GAME_PREFIX.length), index),
      );
    // TODO: Remove limit.
    return games.slice(0, 5);
  }

  private parseMarkdownLine(markdownLine: string, customId: number): Game {
    let name = markdownLine;
    const links = {};
    let isFree: boolean = false;
    const LINK_REGEX = /(\[.+\])(.+)/;
    const removeBrackets = (str: string) => str.slice(1, -1);
    if (markdownLine.startsWith('[')) {
      const [, parsedGameName, parsedLinkUrl] = LINK_REGEX.exec(markdownLine);
      name = removeBrackets(parsedGameName);
      const linkUrl = removeBrackets(parsedLinkUrl);
      const key = linkUrl.includes('steampowered.com') ? 'steam' : 'website';
      links[key] = linkUrl;
    }
    if (name.endsWith('*')) {
      name = name.slice(0, -1);
      isFree = true;
    }
    return {
      id: customId,
      name,
      description: '',
      links,
      genres: [],
      isFree,
      releaseYear: null,
      rating: null,
    };
  }

  suggest(game: SuggestGameDTO): Promise<SuggestGameDTO[]> {
    return new Promise(resolve => {
      this.suggestions.push(game);
      resolve(this.suggestions);
    });
  }
}
