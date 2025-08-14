# @airstate/server

## 2.0.1

### Patch Changes

- 35bd80d: Updated documentation

## 2.0.0

### Major Changes

- 97ad9ae: **Summary:** Data validation and a better, more stable SharedPresence.

    1. Change the SharedPresence API
        1. Dropped focus state (use dynamic state instead)
        2. Renamed dynamic state to just `state`
        3. Renamed static state to `meta`
        4. Renamed summary to `stats`
        5. Renamed `peerkKey` to `peerId` in options.
        6. `roomKey` is now `room`
    2. SharedPresence now supports tracking connection state. i.e. developers will now be able to filter out disconnected peers.
    3. Renamed `key` to `channel` in SharedState options.
    4. Both SharedPresence and SharedState now supports a `validate` function in options to validate data sent by other peers.
    5. `appKey` is not `appId` when configuring client.

### Patch Changes

- 769430f: release

## 2.0.0-beta.0

### Major Changes

- 97ad9ae: **Summary:** Data validation and a better, more stable SharedPresence.

    1. Change the SharedPresence API
        1. Dropped focus state (use dynamic state instead)
        2. Renamed dynamic state to just `state`
        3. Renamed static state to `meta`
        4. Renamed summary to `stats`
        5. Renamed `peerkKey` to `peerId` in options.
        6. `roomKey` is now `room`
    2. SharedPresence now supports tracking connection state. i.e. developers will now be able to filter out disconnected peers.
    3. Renamed `key` to `channel` in SharedState options.
    4. Both SharedPresence and SharedState now supports a `validate` function in options to validate data sent by other peers.
    5. `appKey` is not `appId` when configuring client.

## 1.0.1

### Patch Changes

- de48c05: request version bump: telemetry request format changed

## 1.0.0

### Minor Changes

- 228fd10: fix: telemetry api call fixed

## 0.1.12

### Patch Changes

- 241cba5: Improved presence type exported. Localized to @airstate/client and not re-exported from @airstate/server

## 0.1.11

### Patch Changes

- 52fa7f2: added READMEs

## 0.1.10

### Patch Changes

- 3cc7bcb: fixed: making sure examples project is not published with rest of codebase

## 0.1.9

### Patch Changes

- 4d2e913: fixed: re-render issue in @airstate/react

## 1.0.0-alpha.2

### Minor Changes

- 38eebac: ;

## 0.1.8-alpha.1

### Patch Changes

- e69f960: ;;

## 0.1.8-alpha.0

### Patch Changes

- 15c03cd: ;;;

## 0.1.7

### Patch Changes

- fd7e9b2: ...

## 0.1.6

### Patch Changes

- 105eeae: ..

## 0.1.5

### Patch Changes

- 35f35b4: .

## 0.1.4

### Patch Changes

- 842b6ac: re: testing changesets #5

## 0.1.3

### Patch Changes

- f279a87: re: testing changesets #5

## 0.1.2

### Patch Changes

- f516c81: re: testing changeset #3
- a270268: re: testing changesets #4

## 0.1.1

### Patch Changes

- d8c7d68: re: testing changeset #2

## 0.0.1

### Patch Changes

- 039591a: re: testing changeset
- 695ace8: testing changesets
