# Development

## Prerequisites

- Node.js 18+
- npm

## Setup

```bash
git clone https://github.com/srcpush/code-push-cli.git
cd code-push-cli
npm install
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Build `dist/cli.js` and `dist/index.js` with Vite |
| `npm run dev` | Watch mode build |
| `npm test` | Run Vitest suite |
| `npm run test:watch` | Vitest in watch mode |
| `npm run typecheck` | TypeScript check (`tsconfig.build.json`) |
| `npm run lint` | ESLint on `src/` and `tests/` |
| `npm run format` | Prettier write |

## Project layout

```
src/
├── cli.ts              # CLI entry (shebang)
├── index.ts            # SDK export (AccountManager)
├── commands/           # parser, executor, debug
├── sdk/                # management + acquisition SDKs
├── lib/                # hash, sign, react-native helpers
├── types/              # shared types
└── utils/              # file utilities

tests/
├── unit/               # hash, management-sdk, acquisition-sdk
├── integration/        # CLI command tests
├── fixtures/           # TestApp, zip archives
└── helpers/            # mocks and setup
```

## Local CLI smoke test

```bash
npm run build
node dist/cli.js -h
npm link   # optional: install `srcpush` globally
```

## Hash utility sync

`src/lib/hash.ts` must stay in sync with `api/src/utils/hash-utils.ts` in the monorepo. Any hashing change requires updating both files.
