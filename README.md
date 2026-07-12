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
srcpush promote MyApp Staging Production
```

## Documentation

| Guide | Description |
|-------|-------------|
| [Command reference](docs/commands.md) | All CLI commands with options and examples |
| [Migration from App Center](docs/migration-from-appcenter.md) | Step-by-step App Center migration |
| [Development](docs/development.md) | Build, test, and contribute |
| [Architecture](docs/architecture.md) | Module layout and build pipeline |

## Requirements

- Node.js 18+

## License

MIT — see [LICENSE](LICENSE).
