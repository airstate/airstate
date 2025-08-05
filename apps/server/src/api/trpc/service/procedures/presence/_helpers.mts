import { JetStreamServices } from '../../../../../types/nats.mjs';
import { nanoid } from 'nanoid';
import { AckPolicy, DeliverPolicy, StringCodec } from 'nats';
import { TJSONAble } from '../../../../../types/misc.mjs';
import { TConnectionStatePeers } from '../../../../../services/ephemeralState.mjs';
import { TPresenceMessageInitPeers } from '../../../control/procedures/presence/presence.mjs';

const stringCodec = StringCodec();

export type TNATSPresenceMessage = {
    session_id: string;
    peer_id: string;
    timestamp: number;
} & (
    | {
          type: 'meta';
          meta: any;
      }
    | {
          type: 'state';
          state: TJSONAble;
      }
);

export type TPresenceConnectedState = {
    connected: true;
    lastConnected: number;
    lastDisconnected?: number;
};

export type TPresenceDisconnectedState = {
    connected: false;
    lastConnected?: number;
    lastDisconnected?: number;
};

export type TPresenceConnectionState = TPresenceConnectedState | TPresenceDisconnectedState;

export type TPresenceState<STATE_TYPE extends TJSONAble = TJSONAble, META_TYPE extends TJSONAble = TJSONAble> = {
    peers: Record<
        string,
        {
            peerId: string;

            meta?: STATE_TYPE;
            state: META_TYPE;

            lastUpdated: number;
        } & TPresenceConnectionState
    >;
    stats: {
        totalPeers: number;
    };
};

export async function getInitialPresenceState(
    jetStream: JetStreamServices,
    streamName: string,
    initialConnectionState: TPresenceMessageInitPeers,
): Promise<{ state: TPresenceState; lastSeq: number }> {
    const ephemeralConsumerName = `coordinator_consumer_${nanoid()}`;

    await jetStream.jetStreamManager.consumers.add(streamName, {
        name: ephemeralConsumerName,
        deliver_policy: DeliverPolicy.All,
        ack_policy: AckPolicy.None,
        inactive_threshold: 0.1 * 1e9,
    });

    try {
        const ephemeralStreamConsumer = await jetStream.jetStreamClient.consumers.get(
            streamName,
            ephemeralConsumerName,
        );

        const streamInfo = await jetStream.jetStreamManager.streams.info(streamName);

        const keySet = new Set<string>();

        const peerMap: Record<
            string,
            {
                peerId: string;

                meta?: any;
                state: any;

                lastUpdated: number;
            } & TPresenceConnectionState
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
                    const peer = (peerMap[message.peer_id] = {
                        peerId: message.peer_id,
                        state: undefined,
                        lastUpdated: Date.now(),

                        connected: false,
                    });

                    if (message.peer_id in initialConnectionState) {
                        const initialState = initialConnectionState[message.peer_id];

                        if (
                            !initialState.lastDisconnected ||
                            initialState.lastConnected >= initialState.lastDisconnected
                        ) {
                            const assignableState: TPresenceConnectedState = {
                                connected: true,
                                lastConnected: initialState.lastConnected,
                            };

                            if (initialState.lastDisconnected) {
                                assignableState.lastDisconnected = initialState.lastDisconnected;
                            }

                            Object.assign(peer, assignableState);
                        } else {
                            const assignableState: TPresenceDisconnectedState = {
                                connected: false,
                            };

                            if (initialState.lastConnected) {
                                assignableState.lastConnected = initialState.lastConnected;
                            }

                            if (initialState.lastDisconnected) {
                                assignableState.lastDisconnected = initialState.lastDisconnected;
                            }

                            Object.assign(peer, assignableState);
                        }
                    }
                }

                const peer = peerMap[message.peer_id];

                if (message.type === 'meta') {
                    peer.meta = message.meta;
                } else if (message.type === 'state') {
                    peer.state = message.state;
                }

                messagesRead++;
                lastSeq = streamMessage.seq;
            }

            messagesToRead -= messagesRead;
        }

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
    } catch (error) {
        throw error;
    } finally {
        await jetStream.jetStreamManager.consumers.delete(streamName, ephemeralConsumerName);
    }
}
