import { AckPolicy, DeliverPolicy, StringCodec } from 'nats';
import { JetStreamServices } from '../../../../../types/nats.mjs';
import { nanoid } from 'nanoid';
import * as Y from 'yjs';

const stringCodec = StringCodec();

export async function getMergedUpdate(
    jetStream: JetStreamServices,
    streamName: string,
    previous: {
        lastMergedUpdate: string;
        lastSeq: number;
    } | null,
): Promise<null | {
    mergedUpdate: string;
    lastSeq: number;
}> {
    const ephemeralConsumerName = `coordinator_consumer_${nanoid()}`;

    if (!previous) {
        await jetStream.jetStreamManager.consumers.add(streamName, {
            name: ephemeralConsumerName,
            deliver_policy: DeliverPolicy.All,
            ack_policy: AckPolicy.None,
            inactive_threshold: 0.1 * 1e9,
        });
    } else {
        await jetStream.jetStreamManager.consumers.add(streamName, {
            name: ephemeralConsumerName,
            deliver_policy: DeliverPolicy.StartSequence,
            opt_start_seq: previous.lastSeq + 1,
            ack_policy: AckPolicy.None,
            inactive_threshold: 0.1 * 1e9,
        });
    }

    let lastMerged: Uint8Array | null = previous?.lastMergedUpdate
        ? Uint8Array.from(Buffer.from(previous.lastMergedUpdate, 'base64'))
        : null;

    let lastProcessedSeq = previous?.lastSeq ?? null;

    const ephemeralStreamConsumer = await jetStream.jetStreamClient.consumers.get(streamName, ephemeralConsumerName);

    const streamInfo = await jetStream.jetStreamManager.streams.info(streamName);

    let messagesToRead = streamInfo.state.messages - (previous?.lastSeq ?? 0);

    while (messagesToRead) {
        let updates: Uint8Array[] = [];

        const messagesToFetch = Math.min(messagesToRead, 1000);

        const streamMessages = await ephemeralStreamConsumer.fetch({
            max_messages: messagesToFetch,
            expires: 1000,
        });

        for await (const streamMessage of streamMessages) {
            updates.push(Uint8Array.from(Buffer.from(stringCodec.decode(streamMessage.data), 'base64')));
            lastProcessedSeq = streamMessage.seq;
        }

        if (updates.length === 0) {
            break;
        } else {
            lastMerged = Y.mergeUpdatesV2(lastMerged ? [lastMerged, ...updates] : updates);
        }

        messagesToRead -= updates.length;
    }

    await jetStream.jetStreamManager.consumers.delete(streamName, ephemeralConsumerName);

    if (lastMerged) {
        return {
            mergedUpdate: Buffer.from(lastMerged).toString('base64'),
            lastSeq: lastProcessedSeq!,
        };
    } else {
        return null;
    }
}
