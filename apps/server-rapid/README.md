# Quick Reference

- Maintained by: [AirState](https://airstate.dev)
- Where to get help: [Discord Community](https://discord.gg/86Nky76RFw)

# Supported Tags

- `latest`
- `0.1.11`, `0.1`, `0`
- `0.1.11-alpine`, `0.1-alpine`, `0-alpine`
- `0.1.11-alpine3.22`, `0.1-alpine3.22`, `0-alpine3.22`

# What is AirState?

AirState is a set of open-source SDKs that help you add real-time collaboration and syncing capabilities
into your app.

# Quickstart: `docker-compose.yml`

First create a `nats-server.conf` file in a directory.

```
server_name: nats

jetstream {
  store_dir: /data/jetstream
  max_file_store: 10Gb
  max_mem_store: 2Gb
}

http: 8222
```

The following `docker-compose.yml` file sets up NATS, Valkey, and AirState server for you.

```yml
services:
    valkey:
        restart: unless-stopped
        image: bitnami/valkey:8.1.1
        environment:
            ALLOW_EMPTY_PASSWORD: yes
        volumes:
            - target: /bitnami/valkey/data
              source: valkey-data
              type: volume

    nats:
        restart: unless-stopped
        image: nats:2.11.1-alpine3.21

        volumes:
            - source: ./nats-server.conf
              target: /etc/nats/nats-server.conf
              type: bind

            - target: /data
              source: nats-data
              type: volume

        command: ['-c', '/etc/nats/nats-server.conf', '--server_name', 'nats']

    airstate-server:
        restart: unless-stopped
        image: airstate/server:latest
        environment:
            REDIS_URL: redis://valkey:6379
            NATS_URL: nats://nats:4222
        ports:
            - target: 11001
              published: 11001
              protocol: tcp
        depends_on:
            - valkey
            - nats

volumes:
    # named volumes; they aren't removed on `docker compose down`
    valkey-data:
    nats-data:
```

# Get The Image

```bash
docker pull airstate/server:latest
```

Or if you wanna pull a specific tag that has been listed above.

```bash
docker pull airstate/server:[TAG]
```

# How To Use This Image

You'd need at minimum a Redis server (we actually recommend Valkey instead), and
a NATS server to connect to. Then use the below command to start a AirState server.

```bash
docker run \
  -e NATS_URL=nats://localhost:4222 \
  -e REDIS_URL=redis://localhost:6379 \
  -p 11001:11001 \
  airstate/server
```

# Configuration

| Environment Variable                        | Description                                                                                     | Default      | Required |
| ------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------ | -------- |
| `NATS_URL`                                  | NATS server URL                                                                                 | -            | Yes      |
| `REDIS_URL`                                 | Redis/Valkey server URL                                                                         | -            | Yes      |
| `PORT`                                      | Server port                                                                                     | `11001`      | No       |
| `SHARED_SIGNING_KEY`                        | Key to verify [your server's JWTs](https://airstate.dev/docs/latest/security)                   | -            | No       |
| `AIRSTATE_CONFIG_API_BASE_URL`              | API base URL for your [config server](https://airstate.dev/docs/latest/self-host/config-server) | -            | No       |
| `DEFAULT_YJS_READ_PERMISSION`               | Allow YJS read operations (affects SharedState)                                                 | `true`       | No       |
| `DEFAULT_YJS_WRITE_PERMISSION`              | Allow YJS write operations (affects SharedState)                                                | `true`       | No       |
| `DEFAULT_PRESENCE_JOIN_PERMISSION`          | Allow users to join presence                                                                    | `true`       | No       |
| `DEFAULT_PRESENCE_UPDATE_STATE_PERMISSION`  | Allow users to update their presence state                                                      | `true`       | No       |
| `DEFAULT_PRESENCE_READ_PRESENCE_PERMISSION` | Allow users to read presence information                                                        | `true`       | No       |
| `DEFAULT_PRESENCE_READ_SUMMARY_PERMISSION`  | Allow reading presence summaries                                                                | `true`       | No       |
| `NODE_ENV`                                  | Runtime environment                                                                             | `production` | No       |

# License

MIT
