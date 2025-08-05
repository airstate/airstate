---
'@airstate/server': major
'@airstate/client': major
'@airstate/react': major
---

**Summary:** Data validation and a better, more stable SharedPresence.

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

