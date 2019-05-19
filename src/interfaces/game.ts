interface Link {
  type: 'STEAM';
  name: string;
  url: string;
}

export default interface Game {
  id: string;
  name: string;
  officialWebsiteUrl: string;
  links: Link[];
}
