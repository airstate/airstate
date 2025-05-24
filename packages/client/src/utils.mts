export function uint8ArrayToBase64(array: Uint8Array) {
    return btoa(String.fromCharCode.apply(null, Array.from(array)));
}

export function base64ToUint8Array(base64: string) {
    const binaryString = atob(base64);

    const len = binaryString.length;
    const uint8Array = new Uint8Array(len);

    for (let i = 0; i < len; i++) {
        uint8Array[i] = binaryString.charCodeAt(i);
    }

    return uint8Array;
}
