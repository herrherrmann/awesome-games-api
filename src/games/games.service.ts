import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import axios, { AxiosInstance } from 'axios';
import { ascend, descend, differenceWith, prop, propOr, sortWith } from 'ramda';
import { Repository } from 'typeorm';
import { AuthService } from '../auth/auth.service';
import { IGDB_API } from '../common/config';
import { IGDB_Cover, IGDB_Game, IGDB_Genre } from '../interfaces/igdb';
import { Game } from './entities/game.entity';

type GitHubGame = Pick<
  Game,
  'name' | 'originalName' | 'type' | 'links' | 'isFree'
>;
type GenresMap = { [genreId: string]: IGDB_Genre['name'] };
type CoversMap = { [gameId in IGDB_Game['id']]: IGDB_Cover };
type GamesMap = { [search: string]: IGDB_Game[] };

const sortGames = sortWith<Game>([
  ascend(prop('name')),
  descend(propOr(0, 'releaseYear')),
]);

@Injectable()
export class GamesService {
  private gameCache: GamesMap = {};
  private genreCache: GenresMap;
  private igdbClient: AxiosInstance;

  constructor(
    @InjectRepository(Game) private readonly gameRepository: Repository<Game>,
    private readonly authService: AuthService,
  ) {
    this.igdbClient = axios.create({
      baseURL: IGDB_API + '/',
      headers: { Accept: 'application/json' },
    });
  }

  async getGames(): Promise<Game[]> {
    const gamesInDatabase = await this.getAllGamesInDatabase();
    let githubGames: GitHubGame[];
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
      // Re-fetch from database, because games have changed.
      return this.getAllGamesInDatabase();
    }
    console.log(
      `🕹 Serving ${gamesInDatabase.length} games straight from the database.`,
    );
    return gamesInDatabase;
  }

  async getCoversFromIGDB(gameIds: Game['id'][]): Promise<CoversMap> {
    if (!gameIds.length) {
      return {};
    }
    console.info('📥 Requesting covers from IGDB.');
    const searchQuery = `fields *; where game=(${gameIds.join(
      ',',
    )}); limit 100;`;
    const response = await this.igdbClient.post('covers', searchQuery, {
      headers: await this.authService.getAuthHeaders(),
    });
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
      limit 50;
    `;
    const response = await this.igdbClient.post('genres', searchQuery, {
      headers: await this.authService.getAuthHeaders(),
    });
    const rawGenres: IGDB_Genre[] = response.data;
    const genres: GenresMap = rawGenres.reduce(
      (genreMap: GenresMap, rawGenre: IGDB_Genre) => {
        genreMap[String(rawGenre.id)] = rawGenre.name;
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
    let games: IGDB_Game[] = [];
    try {
      games = (
        await this.igdbClient.post('games', searchQuery, {
          headers: await this.authService.getAuthHeaders(),
        })
      ).data;
      console.info(
        `📥 Fetched from IGDB:`,
        search ? `"${search}"` : '',
        `=> ${games.length} result(s)`,
      );
    } catch {
      console.info(
        `☠️ Error while fetching from IGDB, returning no results for now.`,
      );
      return [];
    }
    if (search) {
      this.gameCache[search] = games;
    }
    return games;
  }

  private pickBestOrFirstResult(
    igdbResults: IGDB_Game[],
    gitHubGame: GitHubGame,
  ): IGDB_Game | null {
    const exactMatch = igdbResults.find(
      (igdbResult) =>
        igdbResult.name.toLowerCase() === gitHubGame.name.toLowerCase(),
    );
    if (exactMatch) {
      return exactMatch;
    }
    return igdbResults[0] || null;
  }

  private mergeGames(
    genresMap: GenresMap,
    covers: CoversMap,
    githubGame: GitHubGame,
    igdbGame?: IGDB_Game,
  ): Game {
    return {
      igdbId: igdbGame?.id,
      name: igdbGame?.name || githubGame.name,
      originalName: githubGame.name,
      description: igdbGame?.summary,
      links: { ...githubGame.links, igdb: igdbGame?.url },
      type: githubGame.type,
      genres: (igdbGame?.genres || [])
        .map((genre: number) => genresMap[String(genre)])
        .filter(Boolean)
        .sort(),
      isFree: githubGame.isFree,
      releaseYear: igdbGame?.first_release_date
        ? new Date(igdbGame.first_release_date * 1000).getFullYear()
        : null,
      coverUrl:
        igdbGame && covers[igdbGame.id]
          ? this.igdbCoverToUrl(covers[igdbGame.id])
          : null,
      rating: igdbGame?.total_rating,
    };
  }

  async getGamesFromGitHub(): Promise<GitHubGame[]> {
    console.info('🐱 Requesting GitHub README.');
    const readmeUrl =
      'https://raw.githubusercontent.com/herrherrmann/awesome-multiplayer-games/master/readme.md';
    const { data } = await axios.get(readmeUrl);
    const [
      localGamesString,
      otherGamesString,
    ] = this.splitIntoLocalAndGeneralMultiplayer(data);
    const localGames: GitHubGame[] = this.markdownToGames(
      localGamesString,
      'local',
    );
    const otherGames: GitHubGame[] = this.markdownToGames(
      otherGamesString,
      'other',
    );
    return [...localGames, ...otherGames];
  }

  /**
   * Separates the section "## local multiplayer" (1st item in array) from the rest (2nd item in array).
   */
  private splitIntoLocalAndGeneralMultiplayer(
    readmeString: string,
  ): [string, string] {
    const localGamesMatch = readmeString.match(
      /#+.*(local multiplayer)[\s\S]*#+/i,
    );
    if (!localGamesMatch) {
      return null;
    }
    const localGames = localGamesMatch[0];
    const localGamesStart = localGamesMatch.index;
    const localGamesEnd = localGamesStart + localGames.length;
    const otherGames =
      readmeString.slice(0, localGamesStart) +
      readmeString.slice(localGamesEnd);
    return [localGames, otherGames];
  }

  private async getAllGamesInDatabase() {
    const games = await this.gameRepository.find();
    return sortGames(games);
  }

  private async updateGamesInDatabase(
    githubGames: GitHubGame[],
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
      const promises = newGames.map((game) => this.getGamesFromIGDB(game.name));
      const igdbResultsPerGame = await Promise.all(promises);
      const gameWithIGDBResults: {
        githubGame: GitHubGame;
        igdbGame: IGDB_Game | null;
      }[] = newGames.map((githubGame: GitHubGame, index: number) => {
        // TODO: Move this rather into getGamesFromIGDB().
        const searchResults = igdbResultsPerGame[index];
        return {
          githubGame,
          igdbGame: this.pickBestOrFirstResult(searchResults, githubGame),
        };
      });
      const igdbIds = gameWithIGDBResults
        .filter(({ igdbGame }) => !!igdbGame)
        .map(({ igdbGame }) => igdbGame.id);
      const covers = await this.getCoversFromIGDB(igdbIds);
      const newGamesMerged = gameWithIGDBResults.map(
        ({ githubGame, igdbGame }) =>
          this.mergeGames(genres, covers, githubGame, igdbGame),
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
    return !!(newGames.length || removedGames.length);
  }

  private markdownToGames(
    markdown: string,
    type: GitHubGame['type'],
  ): GitHubGame[] {
    const GAME_PREFIX = '- ';
    return markdown
      .split('\n')
      .filter((line) => line.startsWith(GAME_PREFIX))
      .map((line) =>
        this.markdownLineToGame(line.trim().slice(GAME_PREFIX.length), type),
      );
  }

  private markdownLineToGame(
    markdownLine: string,
    type: GitHubGame['type'],
  ): GitHubGame {
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
      name,
      originalName: name,
      type,
      links,
      isFree,
    };
  }
}
