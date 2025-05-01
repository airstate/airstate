import { AckPolicy, DeliverPolicy, StringCodec } from 'nats';
import { JetStreamServices } from '../../../../types/nats.mjs';
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
            lastProcessedSeq = streamMessage.seq;
        }

        if (updates.length === 0) {
            break;
        } else {
            lastMerged = Y.mergeUpdatesV2(lastMerged ? [lastMerged, ...updates] : updates);
        }
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
