export function getFirstForwardedIPAddress(forwardingHeader: string | undefined) {
    if (forwardingHeader) {
        return forwardingHeader.split(',')[0].trim();
    }

    return null;
}
