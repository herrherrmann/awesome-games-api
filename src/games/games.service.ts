import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios, { AxiosInstance } from 'axios';
import { differenceWith } from 'ramda';
import { IGDB_Cover, IGDB_Game, IGDB_Genre } from 'src/interfaces/igdb';
import { Repository } from 'typeorm';
import { IGDB_API, IGDB_API_KEY } from '../common/config';
import { Game } from './entities/game.entity';

type GenresMap = { [genreId in IGDB_Genre['id']]: IGDB_Genre['name'] };
type CoversMap = { [gameId in IGDB_Game['id']]: IGDB_Cover };
type GamesMap = { [search: string]: IGDB_Game[] };

@Injectable()
export class GamesService {
  private gameCache: GamesMap = {};
  private genreCache: GenresMap;
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
    const gamesInDatabase = await this.getAllGamesInDatabase();
    let githubGames;
    try {
      githubGames = await this.getGamesFromGitHub();
    } catch {
      // Fallback to direct DB access if GitHub lookup doesn't work.
      console.info(
        `💥 GitHub lookup failed. Serving ${gamesInDatabase.length} games straight from the database.`,
      );
      return gamesInDatabase;
    }
    const hasUpdated = await this.updateGamesInDatabase(
      githubGames,
      gamesInDatabase,
    );
    if (hasUpdated) {
      return this.getAllGamesInDatabase();
    }
    console.log(
      `🕹 Serving ${gamesInDatabase.length} games straight from the database.`,
    );
    return gamesInDatabase;
  }

  async getCoversFromIGDB(gameIds: Game['id'][]): Promise<CoversMap> {
    if (!gameIds.length) {
      return [];
    }
    console.info('📥 Requesting covers from IGDB.');
    const searchQuery = `fields *; where game=(${gameIds.join(',')});`;
    const response = await this.igdbClient.post('covers', searchQuery);
    const rawCovers: IGDB_Cover[] = response.data;
    const covers: CoversMap = rawCovers.reduce(
      (result: CoversMap, rawCover: IGDB_Cover) => {
        result[rawCover.game] = rawCover;
        return result;
      },
      {},
    );
    return covers;
  }

  /**
   * igdbCover.url is something like "//images.igdb.com/igdb/image/upload/t_thumb/co1ntq.jpg"
   */
  igdbCoverToUrl(igdbCover: IGDB_Cover): string {
    return 'https://' + igdbCover.url.substring(2);
  }

  async getGenresFromIGDB(): Promise<GenresMap> {
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
    const genres: GenresMap = rawGenres.reduce(
      (genreMap: GenresMap, rawGenre: IGDB_Genre) => {
        genreMap[Number(rawGenre.id)] = rawGenre.name;
        return genreMap;
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

  private mergeGames(
    igdbGame: IGDB_Game,
    githubGame: Game,
    genres: GenresMap,
    covers: CoversMap,
  ): Game {
    return {
      id: igdbGame.id,
      igdbId: igdbGame.id,
      name: igdbGame.name,
      originalName: githubGame.name,
      description: igdbGame.summary,
      links: { ...githubGame.links, igdb: igdbGame.url },
      genres: igdbGame.genres
        ? igdbGame.genres
            .map((genre: number) => genres[genre] || genres[genre.toString()])
            .sort()
        : [],
      isFree: githubGame.isFree,
      releaseYear: igdbGame.first_release_date
        ? new Date(igdbGame.first_release_date * 1000).getFullYear()
        : null,
      coverUrl: covers[igdbGame.id]
        ? this.igdbCoverToUrl(covers[igdbGame.id])
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
    const githubGames: Game[] = response.data
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.startsWith(GAME_PREFIX))
      .map((line: string, index: number) =>
        this.markdownLineToGame(line.slice(GAME_PREFIX.length), index),
      );
    return githubGames;
  }

  private async getAllGamesInDatabase() {
    return this.gameRepository.find();
  }

  private async updateGamesInDatabase(
    githubGames: Game[],
    gamesInDatabase: Game[],
  ): Promise<boolean> {
    const newGames = differenceWith(
      (githubGame, gameInDb) => githubGame.name === gameInDb.originalName,
      githubGames,
      gamesInDatabase,
    );
    if (newGames.length) {
      console.info(`✨ ${newGames.length} new games detected.`);
      const genres = await this.getGenresFromIGDB();
      const promises = newGames.map(game => this.getGamesFromIGDB(game.name));
      const igdbResultsPerGame = await Promise.all(promises);
      const bestResults: ({
        bestResult: IGDB_Game | null;
        githubGame: Game;
      })[] = newGames.map((githubGame: Game, index: number) => {
        // TODO: Move this rather into getGamesFromIGDB().
        const searchResults = igdbResultsPerGame[index];
        return {
          bestResult: this.pickBestResult(searchResults, githubGame),
          githubGame,
        };
      });
      const covers = await this.getCoversFromIGDB(
        bestResults
          .filter(({ bestResult }) => !!bestResult)
          .map(({ bestResult }) => bestResult.id),
      );
      const newGamesMerged = bestResults.map(({ bestResult, githubGame }) =>
        this.mergeGames(bestResult, githubGame, genres, covers),
      );
      console.info(`🔒 Storing ${newGamesMerged.length} new games.`);
      await this.gameRepository.save(newGamesMerged);
    }
    const removedGames = differenceWith(
      (gameInDb, githubGame) => githubGame.name === gameInDb.originalName,
      gamesInDatabase,
      githubGames,
    );
    if (removedGames.length) {
      console.info(`🗑 ${removedGames.length} removed games detected.`);
      this.gameRepository.remove(removedGames);
    }
    return !!newGames.length || !!removedGames.length;
  }

  private markdownLineToGame(markdownLine: string, customId: number): Game {
    let name = markdownLine;
    const links = {};
    let isFree: boolean = false;
    const LINK_REGEX = /(\[.+\])(.+)/;
    const removeBrackets = (str: string) => str.slice(1, -1);
    const hasLink = markdownLine.startsWith('[');
    if (hasLink) {
      const [, parsedName, parsedUrl] = LINK_REGEX.exec(markdownLine);
      name = removeBrackets(parsedName);
      const linkUrl = removeBrackets(parsedUrl);
      const key = linkUrl.includes('steampowered.com') ? 'steam' : 'website';
      links[key] = linkUrl;
    }
    if (name.endsWith('*')) {
      name = name.slice(0, -1);
      isFree = true;
    }
    return {
      id: customId,
      igdbId: null,
      name,
      originalName: name,
      description: '',
      links,
      genres: [],
      isFree,
      releaseYear: null,
      coverUrl: null,
      rating: null,
    };
  }
}
