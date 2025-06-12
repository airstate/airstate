import { createHash } from 'node:crypto';
import { TTelemetryTracker } from '../../types/telemetry.mjs';
import { lookup } from 'ip-location-api';
import { UAParser as parseUserAgent } from 'ua-parser-js';

export async function initTelemetryTrackerClient(
    telemetryTracker: TTelemetryTracker,
    options: {
        id: string;
        ipAddress: string;
        userAgentString: string;

        serverHostname: string;
        clientPageHostname: string;
    },
) {
    const telemetryTrackerClients = telemetryTracker.clients;
    const telemetryTrackerClientID = options.id;

    if (!(telemetryTrackerClientID in telemetryTrackerClients)) {
        const hashedTelemetryTrackerClientID = createHash('sha256').update(telemetryTrackerClientID).digest('hex');

        const countryLookupResult = await lookup(options.ipAddress);
        const userAgentParseResult = parseUserAgent(options.userAgentString);

        telemetryTrackerClients[telemetryTrackerClientID] = {
            clientID: telemetryTrackerClientID,
            hashedClientID: hashedTelemetryTrackerClientID,

            browser: userAgentParseResult.browser.name ?? '',
            os: userAgentParseResult.os.name ?? '',
            country: countryLookupResult?.country ?? '',

            serverHostname: options.serverHostname,
            clientPageHostname: options.clientPageHostname,

            firstActivityTimestamp: Date.now(),
            lastActivityTimestamp: Date.now(),

            totalMessagesReceived: 0,
            totalMessagesRelayed: 0,

            totalBytesReceived: 0,
            totalBytesRelayed: 0,
        };
    }

    return telemetryTrackerClients[telemetryTrackerClientID];
}
