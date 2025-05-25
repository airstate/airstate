import { JetStreamServices } from '../../../../../types/nats.mjs';
import { nanoid } from 'nanoid';
import { AckPolicy, DeliverPolicy, StringCodec } from 'nats';

const stringCodec = StringCodec();

export type TNATSPresenceMessage = {
    session_id: string;
    peer_key: string;
    timestamp: number;
} & (
    | {
          type: 'static';
          staticState: Record<string, any>;
      }
    | {
          type: 'dynamic';
          dynamicState: Record<string, any>;
      }
    | {
          type: 'focus';
          isFocused: boolean;
      }
);

export type TPresenceState = {
    peers: Record<
        string,
        {
            client_key: string;

            connectionState?: {
                connected: boolean;
                lastUpdateTimestamp: number;
            };

            focusState?: {
                isFocused: boolean;
                lastUpdateTimestamp: number;
            };

            staticState?: {
                state: Record<string, any>;
                lastUpdateTimestamp: number;
            };

            dynamicState?: {
                state: Record<string, any>;
                lastUpdateTimestamp: number;
            };
        }
    >;
    summary: {
        totalPeers: number;
        focusedPeers: number;
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
            client_key: string;

            focusState?: {
                isFocused: boolean;
                lastUpdateTimestamp: number;
            };

            staticState?: {
                state: Record<string, any>;
                lastUpdateTimestamp: number;
            };

            dynamicState?: {
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

            keySet.add(message.peer_key);

            if (!(message.peer_key in peerMap)) {
                peerMap[message.peer_key] = {
                    client_key: message.peer_key,
                };
            }

            const peer = peerMap[message.peer_key];

            if (message.type === 'static') {
                peer.staticState = {
                    state: message.staticState,
                    lastUpdateTimestamp: message.timestamp,
                };
            } else if (message.type === 'dynamic') {
                peer.dynamicState = {
                    state: message.dynamicState,
                    lastUpdateTimestamp: message.timestamp,
                };
            } else if (message.type === 'focus') {
                peer.focusState = {
                    isFocused: message.isFocused,
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
            summary: {
                totalPeers: peers.length,
                focusedPeers: peers.filter((peer) => peer.focusState?.isFocused ?? false).length,
            },
        },
        lastSeq: lastSeq,
    };
}
