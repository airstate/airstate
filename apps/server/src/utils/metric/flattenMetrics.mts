import _ from 'lodash';
import { TMetricsTracker } from '../../types/metrics.mjs';

export function* flattenMetricsJSONL(tracker: TMetricsTracker): Generator<string> {
    for (const [serviceName, serviceObj] of Object.entries(tracker.services)) {
        const [containerKey, containerMap] = Object.entries(serviceObj)[0];

        const flattenedClients = _.flatMap(containerMap, (entry, entryId) => {
            return _.map(entry.clients, (client) => {
                return [
                    client.clientId,
                    entryId,
                    client.namespace,
                    client.appId,
                    client.groups || [],
                    entry.labels || [],
                    client.totalBytesSentToClients,
                    client.totalBytesReceivedFromClients,
                    client.totalUpdatesSentToClients,
                    client.totalUpdatesReceivedFromClients,
                ];
            });
        });

        if (flattenedClients.length === 0) continue;

        yield JSON.stringify([serviceName, flattenedClients.length]) + '\n';

        yield JSON.stringify([
            'client_id',
            `${_.snakeCase(_.trimEnd(containerKey, 's'))}_id`,
            'namespace',
            'app_id',
            'groups',
            'labels',
            'total_bytes_sent_to_client',
            'total_bytes_received_from_client',
            'total_updates_sent_to_client',
            'total_updates_received_from_client',
        ]) + '\n';

        for (const row of flattenedClients) {
            yield JSON.stringify(row) + '\n';
        }
    }
}
