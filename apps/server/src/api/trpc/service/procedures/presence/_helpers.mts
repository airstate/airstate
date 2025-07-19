import { JetStreamServices } from '../../../../../types/nats.mjs';
import { nanoid } from 'nanoid';
import { AckPolicy, DeliverPolicy, StringCodec } from 'nats';

const stringCodec = StringCodec();

export type TNATSPresenceMessage = {
    session_id: string;
    peer_id: string;
    timestamp: number;
} & (
    | {
          type: 'meta';
          meta: Record<string, any>;
      }
    | {
          type: 'state';
          state: Record<string, any>;
      }
);

export type TPresenceState<
    DYNAMIC_STATE_TYPE extends Record<string, any> = Record<string, any>,
    STATIC_STATE_TYPE extends Record<string, any> = Record<string, any>,
> = {
    peers: Record<
        string,
        {
            client_id: string;

            connectionState?: {
                connected: boolean;
                lastUpdateTimestamp: number;
            };

            meta?: {
                meta: STATIC_STATE_TYPE;
                lastUpdateTimestamp: number;
            };

            state?: {
                state: DYNAMIC_STATE_TYPE;
                lastUpdateTimestamp: number;
            };
        }
    >;
    stats: {
        totalPeers: number;
    };
};

export async function getInitialPresenceState(
    jetStream: JetStreamServices,
    streamName: string,
): Promise<{ state: TPresenceState; lastSeq: number }> {
    const ephemeralConsumerName = `coordinator_consumer_${nanoid()}`;

    await jetStream.jetStreamManager.consumers.add(streamName, {
        name: ephemeralConsumerName,
        deliver_policy: DeliverPolicy.All,
        ack_policy: AckPolicy.None,
        inactive_threshold: 0.1 * 1e9,
    });

    const ephemeralStreamConsumer = await jetStream.jetStreamClient.consumers.get(streamName, ephemeralConsumerName);

    const streamInfo = await jetStream.jetStreamManager.streams.info(streamName);

    const keySet = new Set<string>();

    const peerMap: Record<
        string,
        {
            client_id: string;

            meta?: {
                meta: Record<string, any>;
                lastUpdateTimestamp: number;
            };

            state?: {
                state: Record<string, any>;
                lastUpdateTimestamp: number;
            };
        }
    > = {};

    let messagesToRead = streamInfo.state.messages;
    let lastSeq = 0;

    while (messagesToRead) {
        const messagesToFetch = Math.min(messagesToRead, 1000);

        const streamMessages = await ephemeralStreamConsumer.fetch({
            max_messages: messagesToFetch,
            expires: 1000,
        });

        let messagesRead = 0;

        for await (const streamMessage of streamMessages) {
            const messageData = stringCodec.decode(streamMessage.data);
            const message = JSON.parse(messageData) as TNATSPresenceMessage;

            keySet.add(message.peer_id);

            if (!(message.peer_id in peerMap)) {
                peerMap[message.peer_id] = {
                    client_id: message.peer_id,
                };
            }

            const peer = peerMap[message.peer_id];

            if (message.type === 'meta') {
                peer.meta = {
                    meta: message.meta,
                    lastUpdateTimestamp: message.timestamp,
                };
            } else if (message.type === 'state') {
                peer.state = {
                    state: message.state,
                    lastUpdateTimestamp: message.timestamp,
                };
            }

            messagesRead++;
            lastSeq = streamMessage.seq;
        }

        messagesToRead -= messagesRead;
    }

    await jetStream.jetStreamManager.consumers.delete(streamName, ephemeralConsumerName);

    const peers = Object.values(peerMap);

    return {
        state: {
            peers: peerMap,
            stats: {
                totalPeers: peers.length,
            },
        },
        lastSeq: lastSeq,
    };
}
