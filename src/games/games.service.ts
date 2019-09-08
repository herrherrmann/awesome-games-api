import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios, { AxiosInstance } from 'axios';
import { differenceWith } from 'ramda';
import { IGDB_Game } from 'src/interfaces/igdb';
import { Repository } from 'typeorm';
import { IGDB_API, IGDB_API_KEY } from '../common/config';
import { SuggestGameDTO } from './dto/SuggestGameDTO.dto';
import { Game } from './entities/game.entity';

type IGDB_Genre = { id: number; name: string };
type Genres = { [id: number]: string };
type Games = { [search: string]: IGDB_Game[] };

@Injectable()
export class GamesService {
  private gameCache: Games = {};
  private genreCache: Genres;
  private suggestions = [];
  private igdbClient: AxiosInstance;

  constructor(
    @InjectRepository(Game) private readonly gameRepository: Repository<Game>,
  ) {
    this.igdbClient = axios.create({
      baseURL: IGDB_API + '/',
      headers: {
        Accept: 'application/json',
        'user-key': IGDB_API_KEY,
      },
    });
  }

  async getGames(): Promise<Game[]> {
    const genres = await this.getGenresFromIGDB();
    const githubGames = await this.getGamesFromGitHub();
    const promises = githubGames.map(game => this.getGamesFromIGDB(game.name));
    const igdbResultsPerGame = await Promise.all(promises);
    const games = githubGames.map((game: Game, index: number) => {
      const searchResults = igdbResultsPerGame[index];
      const bestResult = this.pickBestResult(searchResults, game);
      if (!bestResult) {
        return game;
      }
      return this.mergeGames(bestResult, game, genres);
    });
    this.updateGamesInDatabase(games);
    return games;
  }

  async getGenresFromIGDB(): Promise<Genres> {
    if (this.genreCache) {
      console.info('🗄  Serving genres from cache.');
      return this.genreCache;
    }
    console.info('📥 Requesting genres from IGDB.');
    const searchQuery = `
      fields *;
      limit: 50;
    `;
    const response = await this.igdbClient.post('genres', searchQuery);
    const rawGenres: IGDB_Genre[] = response.data;
    const genres: Genres = rawGenres.reduce(
      (allGenres: Genres, rawGenre: IGDB_Genre) => {
        allGenres[Number(rawGenre.id)] = rawGenre.name;
        return allGenres;
      },
      {},
    );
    this.genreCache = genres;
    return genres;
  }

  async getGamesFromIGDB(search?: string): Promise<IGDB_Game[]> {
    if (search && this.gameCache[search]) {
      console.info(`🗄  Serving "${search}" from cache.`);
      return Promise.resolve(this.gameCache[search]);
    }
    const MAIN_GAME_CATEGORY = 0;
    const searchQuery = `
      ${search ? `search "${search}";` : ''}
      fields *;
      where category=${MAIN_GAME_CATEGORY};
    `;
    const response = await this.igdbClient.post('games', searchQuery);
    const games: IGDB_Game[] = response.data;
    console.info(
      `📥 Requesting from IGDB:`,
      search ? `"${search}"` : '',
      `=> ${games.length} result(s)`,
    );
    if (search) {
      this.gameCache[search] = games;
    }
    return games;
  }

  private pickBestResult(igdbResults: IGDB_Game[], game: Game): IGDB_Game {
    const exactMatch = igdbResults.find(
      igdbResult => igdbResult.name.toLowerCase() === game.name.toLowerCase(),
    );
    if (exactMatch) {
      return exactMatch;
    }
    return igdbResults[0];
  }

  private mergeGames(igdbGame: IGDB_Game, game: Game, genres: Genres): Game {
    return {
      id: igdbGame.id,
      name: igdbGame.name,
      description: igdbGame.summary,
      links: game.links,
      genres: igdbGame.genres
        ? igdbGame.genres.map(
            (genre: number) => genres[genre] || genres[genre.toString()],
          )
        : [],
      isFree: game.isFree,
      releaseYear: igdbGame.first_release_date
        ? new Date(igdbGame.first_release_date * 1000).getFullYear()
        : null,
      rating: igdbGame.total_rating,
    };
  }

  async getGamesFromGitHub(): Promise<Game[]> {
    console.info('🐱 Requesting GitHub README.');
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
    // return games.slice(0, 5);
    return games;
  }

  private async updateGamesInDatabase(games: Game[]) {
    const ids: number[] = games.map(game => game.id);
    const existingGames = await this.gameRepository.findByIds(ids);
    const newGames = differenceWith(
      (gameA, gameB) => gameA.id === gameB.id,
      games,
      existingGames,
    );
    if (newGames.length) {
      console.info(`🔒 Storing ${newGames.length} new games.`);
      this.gameRepository.save(newGames);
    }
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
