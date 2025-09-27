import { TMetricsTracker } from '../../types/metrics.mjs';

export function initMetricsTrackerClient(
    metricsTracker: TMetricsTracker,
    options: {
        serviceType: 'ydoc' | 'presence';
        containerId: string;
        labels?: string[];

        clientId: string;
        namespace: string;
        appId: string | null;
        groups?: string[];
    },
) {
    const container =
        options.serviceType === 'presence'
            ? metricsTracker.services.presence.rooms
            : metricsTracker.services.ydoc.documents;

    if (!container[options.containerId]) {
        container[options.containerId] = {
            [options.serviceType === 'presence' ? 'roomId' : 'documentId']:
                `${options.serviceType}_${options.containerId}`,
            labels: options.labels,
            clients: {},
        } as any;
    }

    const entry = container[options.containerId];

    if (!entry.clients[options.clientId]) {
        entry.clients[options.clientId] = {
            clientId: options.clientId,
            namespace: options.namespace,
            appId: options.appId,
            groups: options.groups,
            totalUpdatesReceivedFromClients: 0,
            totalBytesReceivedFromClients: 0,
            totalUpdatesSentToClients: 0,
            totalBytesSentToClients: 0,
        };
    }
    return entry.clients[options.clientId];
}
