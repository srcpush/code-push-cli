# CLI Command Reference

Complete reference for the `srcpush` CLI shipped with `@srcpush/code-push-cli`.

## Global options

| Option | Alias | Description |
|--------|-------|-------------|
| `--help` | `-h` | Show help for a command |
| `--version` | `-v` | Show CLI version |

Many list commands accept `--format` (`table` or `json`).

## Environment variables

| Variable | Description |
|----------|-------------|
| `SRCPUSH_ACCESS_KEY` | Access key used for authentication |
| `SRCPUSH_SERVER_URL` | Custom API server URL |
| `SRCPUSH_PROXY` | HTTP proxy for API requests |
| `CODE_PUSH_NODE_ARGS` | Extra arguments passed to the Node process when running `react-native bundle` |

---

## Authentication

### `register`

Create a new Source Push account.

```bash
srcpush register
srcpush register https://api.srcpush.com
```

### `login`

Authenticate with Source Push.

```bash
srcpush login
srcpush login --accessKey my-access-key
srcpush login --key my-access-key
```

| Option | Alias | Description |
|--------|-------|-------------|
| `--accessKey` | `-key` | Access key instead of interactive browser login |

### `logout`

End the current CLI session and remove the cached access key.

```bash
srcpush logout
```

### `whoami`

Show the account associated with the current session.

```bash
srcpush whoami
```

---

## Access keys

Manage long-lived access keys (useful for CI/CD).

### `access-key add <name>`

```bash
srcpush access-key add "CI Pipeline"
srcpush access-key add "One-time key" --ttl 5m
srcpush access-key add "Annual key" --ttl 1y
```

| Option | Description |
|--------|-------------|
| `--ttl` | Duration until expiry (default: `60d`). Examples: `5m`, `60d`, `1y` |

### `access-key patch <name>`

```bash
srcpush access-key patch "CI Pipeline" --name "Build Server Key"
srcpush access-key patch "CI Pipeline" --ttl 7d
srcpush access-key patch "CI Pipeline" --name "New Name" --ttl 30d
```

| Option | Description |
|--------|-------------|
| `--name` | New display name |
| `--ttl` | New expiration duration |

### `access-key list` / `access-key ls`

```bash
srcpush access-key list
srcpush access-key ls --format json
```

### `access-key remove <name>` / `access-key rm <name>`

```bash
srcpush access-key remove "CI Pipeline"
```

---

## Sessions

Manage browser login sessions.

### `session list` / `session ls`

```bash
srcpush session list
srcpush session ls --format json
```

### `session remove <machineName>` / `session rm <machineName>`

```bash
srcpush session rm "MacBook-Pro.local"
```

---

## Apps

### `app add <appName>`

Create an app with default `Staging` and `Production` deployments.

```bash
srcpush app add MyApp
```

### `app list` / `app ls`

```bash
srcpush app list
srcpush app ls --format json
```

### `app rename <currentName> <newName>`

```bash
srcpush app rename MyApp MyRenamedApp
```

### `app remove <appName>` / `app rm <appName>`

```bash
srcpush app rm MyApp
```

### `app transfer <appName> <email>`

Transfer app ownership to another account.

```bash
srcpush app transfer MyApp teammate@example.com
```

---

## Collaborators

### `collaborator add <appName> <email>`

```bash
srcpush collaborator add MyApp dev@example.com
```

### `collaborator list <appName>` / `collaborator ls <appName>`

```bash
srcpush collaborator list MyApp
srcpush collaborator ls MyApp --format json
```

### `collaborator remove <appName> <email>` / `collaborator rm <appName> <email>`

```bash
srcpush collaborator rm MyApp dev@example.com
```

---

## Deployments

### `deployment add <appName> <deploymentName>`

```bash
srcpush deployment add MyApp Beta
```

### `deployment list <appName>` / `deployment ls <appName>`

```bash
srcpush deployment list MyApp
srcpush deployment ls MyApp --format json --displayKeys
```

| Option | Description |
|--------|-------------|
| `--displayKeys` | Include deployment keys in output |

### `deployment rename <appName> <currentName> <newName>`

```bash
srcpush deployment rename MyApp Staging QA
```

### `deployment remove <appName> <deploymentName>` / `deployment rm <appName> <deploymentName>`

```bash
srcpush deployment rm MyApp Beta
```

### `deployment history <appName> <deploymentName>` / `deployment h <appName> <deploymentName>`

```bash
srcpush deployment history MyApp Production
srcpush deployment h MyApp Staging --format json --displayAuthor
```

| Option | Description |
|--------|-------------|
| `--displayAuthor` | Include release author in output |

### `deployment clear <appName> <deploymentName>`

Clear all release history for a deployment.

```bash
srcpush deployment clear MyApp Staging
```

---

## Releases

### `release <appName> <updateContentsPath> <targetBinaryVersion>`

Release a file or directory to a deployment.

```bash
# Release a single bundle file to Staging, any binary version
srcpush release MyApp app.js "*"

# Release a folder to Production for a specific binary version
srcpush release MyApp ./platforms/ios/www 1.0.3 -d Production

# Staged rollout to 20% of users
srcpush release MyApp ./platforms/android/www 2.0.0 -d Production -r 20
```

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--deploymentName` | `-d` | `Staging` | Target deployment |
| `--description` | `-des` | — | Release notes |
| `--disabled` | `-x` | `false` | Disable immediate download |
| `--mandatory` | `-m` | `false` | Mark release as mandatory |
| `--rollout` | `-r` | `100%` | Rollout percentage (e.g. `25`, `25%`) |
| `--noDuplicateReleaseError` | — | `false` | Warn instead of error on duplicate package |

### `release-react <appName> <platform>`

Bundle a React Native project and release it. Must be run from the React Native project root.

Supported platforms: `ios`, `android`, `windows`.

```bash
# Release iOS bundle to Staging
srcpush release-react MyApp ios

# Release Android to Production with description and mandatory flag
srcpush release-react MyApp android -d Production --des "Bug fixes" -m

# Development bundle with source map
srcpush release-react MyApp android --dev -s index.android.js.map

# Target a semver range and partial rollout
srcpush release-react MyApp ios -t "~1.2.0" -r 50%
```

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--deploymentName` | `-d` | `Staging` | Target deployment |
| `--description` | `-des` | — | Release notes |
| `--development` | `-dev` | `false` | Generate dev bundle |
| `--disabled` | `-x` | `false` | Disable immediate download |
| `--mandatory` | `-m` | `false` | Mark release as mandatory |
| `--bundleName` | `-b` | platform default | Output bundle file name |
| `--entryFile` | `-e` | `index.<platform>.js` | Entry JavaScript file |
| `--targetBinaryVersion` | `-t` | from native project | Semver range (e.g. `1.0.0`, `~1.2.3`) |
| `--rollout` | `-r` | `100%` | Rollout percentage |
| `--sourcemapOutput` | `-s` | — | Source map output path |
| `--outputDir` | `-o` | temp dir | Keep bundle/sourcemap on disk |
| `--gradleFile` | `-g` | — | Android `build.gradle` path |
| `--plistFile` | `-p` | — | iOS `Info.plist` path |
| `--plistFilePrefix` | `-pre` | — | Prefix when searching for Info.plist |
| `--podFile` | `-pod` | — | iOS Podfile path |
| `--useHermes` | `-h` | `false` | Force Hermes bytecode compilation |
| `--extraHermesFlags` | `-hf` | — | Extra Hermes compiler flags (repeatable) |
| `--privateKeyPath` | `-k` | — | Private key for code signing |
| `--xcodeProjectFile` | `-xp` | — | Xcode project or `.pbxproj` path |
| `--xcodeTargetName` | `-xt` | — | Xcode target name (iOS) |
| `--buildConfigurationName` | `-c` | — | Xcode build configuration (iOS) |
| `--extraBundlerOption` | `-eo` | — | Extra bundler flags (repeatable) |
| `--noDuplicateReleaseError` | — | `false` | Warn instead of error on duplicate package |

Default bundle names:

| Platform | Default bundle |
|----------|----------------|
| iOS | `main.jsbundle` |
| Android | `index.android.bundle` |
| Windows | `index.windows.bundle` |

### `promote <appName> <sourceDeployment> <destDeployment>`

Promote a release from one deployment to another.

```bash
srcpush promote MyApp Staging Production

srcpush promote MyApp Staging Production \
  --des "Production rollout" \
  -r 25 \
  -m
```

| Option | Alias | Default | Description |
|--------|-------|---------|-------------|
| `--label` | `-l` | latest | Source release label |
| `--description` | `-des` | from source | Release notes |
| `--disabled` | `-x` | from source | Disable download |
| `--mandatory` | `-m` | from source | Mandatory flag |
| `--rollout` | `-r` | `100%` | Rollout percentage |
| `--targetBinaryVersion` | `-t` | from source | Target binary version range |
| `--noDuplicateReleaseError` | — | `false` | Warn on duplicate package |

### `patch <appName> <deploymentName>`

Update metadata on an existing release.

```bash
# Patch latest release in Production
srcpush patch MyApp Production --des "Updated notes" -r 50%

# Patch a specific label
srcpush patch MyApp Production -l v3 --des "Hotfix metadata" -m
```

| Option | Alias | Description |
|--------|-------|-------------|
| `--label` | `-l` | Release label (default: latest) |
| `--description` | `-des` | New description |
| `--disabled` | `-x` | Enable/disable download |
| `--mandatory` | `-m` | Mandatory flag |
| `--rollout` | `-r` | Rollout percentage (can only increase) |
| `--targetBinaryVersion` | `-t` | Target binary version range |

### `rollback <appName> <deploymentName>`

Roll back a deployment to a previous release.

```bash
# Roll back to previous release
srcpush rollback MyApp Production

# Roll back to a specific label
srcpush rollback MyApp Production --targetRelease v4
```

| Option | Alias | Description |
|--------|-------|-------------|
| `--targetRelease` | `-r` | Label to roll back to (default: previous) |

---

## Debug

### `debug <platform>`

Stream CodePush debug logs from a running app (iOS Simulator or Android emulator).

```bash
srcpush debug android
srcpush debug ios
```

---

## Common workflows

### First release

```bash
srcpush login
srcpush app add MyApp
srcpush release-react MyApp ios -d Staging
srcpush promote MyApp Staging Production
```

### CI/CD release

```bash
export SRCPUSH_ACCESS_KEY="your-access-key"
srcpush release-react MyApp android \
  -d Production \
  --des "Build ${BUILD_NUMBER}" \
  -t "${APP_VERSION}"
```

### Gradual rollout

```bash
srcpush release-react MyApp ios -d Production -r 10
srcpush patch MyApp Production -r 50
srcpush patch MyApp Production -r 100
```

---

## Related docs

- [Migration from App Center](migration-from-appcenter.md)
- [Development guide](development.md)
- [Architecture](architecture.md)
