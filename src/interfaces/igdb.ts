export const IGDB_STATUSES = {
  0: 'released',
  2: 'alpha',
  3: 'beta',
  4: 'early_access',
  5: 'offline',
  6: 'cancelled',
};

export interface IGDB_Game {
  id: number;
  bundles: number[];
  category: number;
  collection: number;
  cover: number;
  created_at: number;
  external_games: number[];
  first_release_date: number;
  game_engines: number[];
  game_modes: number[];
  genres: number[];
  involved_companies: number[];
  keywords: number[];
  name: string;
  platforms: number[];
  player_perspectives: number[];
  rating: number;
  rating_count: number;
  release_dates: number[];
  screenshots: number[];
  similar_games: number[];
  slug: string;
  summary: string;
  tags: number[];
  themes: number[];
  total_rating: number;
  total_rating_count: number;
  updated_at: number;
  url: string;
  websites: number[];
}

export interface IGDB_Genre {
  id: number;
  name: string;
}

export interface IGDB_Cover {
  id: number;
  alpha_channel: boolean;
  animated: boolean;
  game: number;
  height: number;
  image_id: string;
  url: string;
  width: number;
}
