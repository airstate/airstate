import { NatsError, StorageType } from 'nats';
import { NATSServices, JetStreamServices } from '../../../../types/nats.mjs';
import { AckPolicy, DeliverPolicy, StringCodec } from 'nats';
import { nanoid } from 'nanoid';
import * as Y from 'yjs';

export async function getInitialState(
    nats: NATSServices,
    streamName: string,
    subject: string,
    clientSentInitialState: string,
): Promise<[string, number, boolean]> {
    try {
        await nats.sharedStateKV.create(
            `${streamName}__coordinator`,
            JSON.stringify({
                lastSeq: 0,
                lastMergedUpdate: clientSentInitialState,
            }),
        );

        await nats.jetStreamManager.streams.add({
            name: streamName,
            subjects: [subject],
            storage: StorageType.File,
            max_msgs_per_subject: -1,
        });

        return [clientSentInitialState, 0, true];
    } catch (err) {
        if (err instanceof NatsError && err.code === '400' && err.message.includes('wrong last sequence')) {
            const coordinatorValue = await nats.sharedStateKV.get(`${streamName}__coordinator`);

            if (coordinatorValue && coordinatorValue.string()) {
                const coordinatorValueJSON = JSON.parse(coordinatorValue.string()) as {
                    lastSeq: number;
                    lastMergedUpdate: string;
                };

                try {
                    const [mergedUpdate, lastSeq] = await getMergedUpdate(
                        nats,
                        streamName,
                        coordinatorValueJSON.lastSeq,
                        coordinatorValueJSON.lastMergedUpdate,
                    );

                    await nats.sharedStateKV.put(
                        `${streamName}__coordinator`,
                        JSON.stringify({
                            lastSeq,
                            lastMergedUpdate: mergedUpdate,
                        }),
                    );

                    return [mergedUpdate, lastSeq, false];
                } catch (mergeErr) {
                    if (
                        mergeErr instanceof NatsError &&
                        mergeErr.code === '404' &&
                        mergeErr.message.includes('stream not found')
                    ) {
                        await nats.sharedStateKV.delete(`${streamName}__coordinator`);
                    }

                    throw mergeErr;
                }
            }
        }

        throw err;
    }
}

const stringCodec = StringCodec();

export async function getMergedUpdate(
    jetStream: JetStreamServices,
    streamName: string,
    lastSeq: number,
    lastMergedUpdate: string,
): Promise<[string, number]> {
    const ephemeralConsumerName = `coordinator_consumer_${nanoid()}`;

    await jetStream.jetStreamManager.consumers.add(streamName, {
        name: ephemeralConsumerName,
        deliver_policy: DeliverPolicy.StartSequence,
        opt_start_seq: lastSeq + 1,
        ack_policy: AckPolicy.None,
        inactive_threshold: 60 * 1e9,
    });

    let lastMerged: Uint8Array = Uint8Array.from(Buffer.from(lastMergedUpdate, 'base64'));
    let currSeq = lastSeq;

    const ephemeralStreamConsumer = await jetStream.jetStreamClient.consumers.get(streamName, ephemeralConsumerName);

    while (true) {
        let updates: Uint8Array[] = [];

        // TODO: optimize this such that we first read the length of the
        //       stream, and then request the appropriate amount of `max_messages`
        //       when calling `fetch`
        const streamMessages = await ephemeralStreamConsumer.fetch({
            max_messages: 1000,
            expires: 1000,
        });

        for await (const streamMessage of streamMessages) {
            updates.push(Uint8Array.from(Buffer.from(stringCodec.decode(streamMessage.data), 'base64')));
            currSeq++;
        }

        if (updates.length === 0) {
            break;
        }

        lastMerged = Y.mergeUpdatesV2([lastMerged, ...updates]);
    }

    await jetStream.jetStreamManager.consumers.delete(streamName, ephemeralConsumerName);

    return [Buffer.from(lastMerged).toString('base64'), currSeq];
}
