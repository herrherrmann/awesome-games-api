export default interface Game {
  id: number;
  name: string;
  description: string;
  genres: string[];
  releaseYear: number | null;
  rating: number;
  isFree: boolean;
  links: {
    website?: string;
    igdb?: string;
    steam?: string;
  };
}
