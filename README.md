# Awesome Games API

API for the [Awesome Multiplayer Games website](https://multiplayer.page), built with TypeScript and NestJS. Fetches all games and enriches the data with information from [IGDB](https://www.igdb.com/).

## Related repositories:

- Data source: https://github.com/herrherrmann/awesome-multiplayer-games
- Frontend: https://github.com/herrherrmann/awesome-games-frontend

# Contribute

If you want to add or edit games, please go to https://github.com/herrherrmann/awesome-multiplayer-games and create a pull request.

## Installation

1. Install the Node version defined in `.nvmrc`:
   ```bash
   nvm use # or nvm install
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and fill in the necessary values.

## Running the app

```bash
# development
npm run start

# watch mode
npm run start:dev

# production mode
npm run start:prod
```

## Tests

```bash
# unit tests
npm run test

# e2e tests
npm run test:e2e

# test coverage
npm run test:cov
```
