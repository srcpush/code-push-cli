# @srcpush/code-push-cli

Management CLI for [Source Push](https://srcpush.com/) — deploy React Native OTA updates, manage apps, deployments, and releases.

## Install

```bash
npm install -g @srcpush/code-push-cli
```

## Quick start

```bash
srcpush login
srcpush app add MyApp
srcpush release-react MyApp ios -d Staging
```

## Documentation

- [Migration from App Center](docs/migration-from-appcenter.md)
- [Command reference](docs/commands.md)
- [Development guide](docs/development.md)
- [Architecture](docs/architecture.md)

## Requirements

- Node.js 18+

## License

MIT
