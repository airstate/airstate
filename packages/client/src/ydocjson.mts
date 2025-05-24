import * as y from 'yjs';
import { nanoid } from 'nanoid';

export type TJSONAble = string | number | boolean | null | TJSONAble[] | TJSONAbleObject;

export type TJSONAbleObject = {
    [key: string]: TJSONAble;
};

export type TObjectStored =
    | {
          // string
          t: 's';
          v: string;
      }
    | {
          // number
          t: 'n';
          v: number;
      }
    | {
          // boolean
          t: 'b';
          v: boolean;
      }
    | {
          // null
          t: 'u';
      }
    | {
          // array
          t: 'a';
      }
    | {
          // object
          t: 'o';
      };

export type TArrayStored =
    | {
          // string
          t: 's';
          v: string;
      }
    | {
          // number
          t: 'n';
          v: number;
      }
    | {
          // boolean
          t: 'b';
          v: boolean;
      }
    | {
          // null
          t: 'u';
      }
    | {
          // array
          t: 'a';
          i: string;
      }
    | {
          // object
          t: 'o';
          i: string;
      };

export type TArrayOptions = {
    doc: y.Doc;
    array: TJSONAble[];
    id?: string;
    path?: string[];
    avoidTruncation?: boolean;
};

export function encodeArrayToYDoc(options: TArrayOptions) {
    const id = options.id ?? '';
    const path = options.path ?? [];

    const array = options.doc.getArray(`a:${id}:${JSON.stringify(path)}`);

    if (!options.avoidTruncation) {
        if (array.length > options.array.length) {
            array.delete(options.array.length, array.length - options.array.length);
        }
    }

    const upTo = Math.min(array.length, options.array.length);

    for (let i = 0; i < upTo; i++) {
        const currentValue = array.get(i) as TArrayStored;
        const targetValue = options.array[i];

        if (typeof targetValue === 'string') {
            if (currentValue.t !== 's' || currentValue.v !== targetValue) {
                array.delete(i);
                array.insert(i, [
                    {
                        t: 's',
                        v: targetValue,
                    } satisfies TArrayStored,
                ]);
            }
        } else if (typeof targetValue === 'number') {
            if (currentValue.t !== 'n' || currentValue.v !== targetValue) {
                array.delete(i);
                array.insert(i, [
                    {
                        t: 'n',
                        v: targetValue,
                    } satisfies TArrayStored,
                ]);
            }
        } else if (typeof targetValue === 'boolean') {
            if (currentValue.t !== 'b' || currentValue.v !== targetValue) {
                array.delete(i);
                array.insert(i, [
                    {
                        t: 'b',
                        v: targetValue,
                    } satisfies TArrayStored,
                ]);
            }
        } else if (targetValue === null) {
            if (currentValue.t !== 'u') {
                array.delete(i);
                array.insert(i, [
                    {
                        t: 'u',
                    } satisfies TArrayStored,
                ]);
            }
        } else if (Array.isArray(targetValue)) {
            const id = currentValue.t === 'a' ? currentValue.i : nanoid();

            if (currentValue.t !== 'a') {
                array.delete(i);
                array.insert(i, [
                    {
                        t: 'a',
                        i: id,
                    } satisfies TArrayStored,
                ]);
            }

            encodeArrayToYDoc({
                doc: options.doc,
                array: targetValue,
                id: id,
                path: [],
            });
        } else if (typeof targetValue === 'object') {
            const id = currentValue.t === 'o' ? currentValue.i : nanoid();

            if (currentValue.t !== 'o') {
                array.delete(i);
                array.insert(i, [
                    {
                        t: 'o',
                        i: id,
                    } satisfies TArrayStored,
                ]);
            }

            encodeObjectToYDoc({
                doc: options.doc,
                object: targetValue,
                id: id,
                path: [],
            });
        }
    }

    for (let i = upTo; i < options.array.length; i++) {
        const currentValue = array.get(i) as TArrayStored;
        const targetValue = options.array[i];

        if (typeof targetValue === 'string') {
            array.insert(i, [
                {
                    t: 's',
                    v: targetValue,
                } satisfies TArrayStored,
            ]);
        } else if (typeof targetValue === 'number') {
            array.insert(i, [
                {
                    t: 'n',
                    v: targetValue,
                } satisfies TArrayStored,
            ]);
        } else if (typeof targetValue === 'boolean') {
            array.insert(i, [
                {
                    t: 'b',
                    v: targetValue,
                } satisfies TArrayStored,
            ]);
        } else if (targetValue === null) {
            array.insert(i, [
                {
                    t: 'u',
                } satisfies TArrayStored,
            ]);
        } else if (Array.isArray(targetValue)) {
            const id = nanoid();

            array.insert(i, [
                {
                    t: 'a',
                    i: id,
                } satisfies TArrayStored,
            ]);

            encodeArrayToYDoc({
                doc: options.doc,
                array: targetValue,
                id: id,
                path: [],
            });
        } else if (typeof targetValue === 'object') {
            const id = nanoid();

            array.insert(i, [
                {
                    t: 'o',
                    i: id,
                } satisfies TArrayStored,
            ]);

            encodeObjectToYDoc({
                doc: options.doc,
                object: targetValue,
                id: id,
                path: [],
            });
        }
    }
}

export type TObjectOptions = {
    doc: y.Doc;
    object: {
        [key: string]: TJSONAble;
    };
    id?: string;
    path?: string[];
    avoidRemovingKeys?: boolean;
};

export function encodeObjectToYDoc(options: TObjectOptions) {
    const id = options.id ?? '';
    const path = options.path ?? [];

    const map = options.doc.getMap(`m:${id}:${JSON.stringify(path)}`);

    if (!options.avoidRemovingKeys) {
        for (const [key] of map) {
            if (!options.object.hasOwnProperty(key)) {
                map.delete(key);
            }
        }
    }

    for (const [key, value] of Object.entries(options.object)) {
        if (typeof value === 'string') {
            if (map.has(key)) {
                const prev = map.get(key) as TObjectStored;

                if (prev.t !== 's' || prev.v !== value) {
                    map.set(key, {
                        t: 's',
                        v: value,
                    } satisfies TObjectStored);
                }
            } else {
                map.set(key, {
                    t: 's',
                    v: value,
                } satisfies TObjectStored);
            }
        } else if (typeof value === 'number') {
            if (map.has(key)) {
                const prev = map.get(key) as TObjectStored;

                if (prev.t !== 'n' || prev.v !== value) {
                    map.set(key, {
                        t: 'n',
                        v: value,
                    } satisfies TObjectStored);
                }
            } else {
                map.set(key, {
                    t: 'n',
                    v: value,
                } satisfies TObjectStored);
            }
        } else if (typeof value === 'boolean') {
            if (map.has(key)) {
                const prev = map.get(key) as TObjectStored;

                if (prev.t !== 'b' || prev.v !== value) {
                    map.set(key, {
                        t: 'b',
                        v: value,
                    } satisfies TObjectStored);
                }
            } else {
                map.set(key, {
                    t: 'b',
                    v: value,
                } satisfies TObjectStored);
            }
        } else if (value === null) {
            if (map.has(key)) {
                const prev = map.get(key) as TObjectStored;

                if (prev.t !== 'u') {
                    map.set(key, {
                        t: 'u',
                    } satisfies TObjectStored);
                }
            } else {
                map.set(key, {
                    t: 'u',
                } satisfies TObjectStored);
            }
        } else if (Array.isArray(value)) {
            if (map.has(key)) {
                const prev = map.get(key) as TObjectStored;

                if (prev.t !== 'a') {
                    map.set(key, {
                        t: 'a',
                    } satisfies TObjectStored);
                }
            } else {
                map.set(key, {
                    t: 'a',
                });
            }

            encodeArrayToYDoc({
                doc: options.doc,
                array: value,
                id: options.id,
                path: [...path, key],
            });
        } else if (typeof value === 'object') {
            if (map.has(key)) {
                const prev = map.get(key) as TObjectStored;

                if (prev.t !== 'o') {
                    map.set(key, {
                        t: 'o',
                    } satisfies TObjectStored);
                }
            } else {
                map.set(key, {
                    t: 'o',
                } satisfies TObjectStored);
            }

            encodeObjectToYDoc({
                doc: options.doc,
                object: value,
                id: options.id,
                path: [...path, key],
            });
        }
    }
}

export type TDecodeOptions = {
    doc: y.Doc;
    id?: string;
    path?: string[];
};

export function decodeYDocToObject(options: TDecodeOptions): TJSONAbleObject {
    const id = options.id ?? '';
    const path = options.path ?? [];

    const map = options.doc.getMap(`m:${id}:${JSON.stringify(path)}`);

    const object: TJSONAbleObject = {};

    for (const [key, _value] of map) {
        const value = map.get(key) as TObjectStored;

        if (value.t === 's' || value.t === 'n' || value.t === 'b') {
            object[key] = value.v;
        } else if (value.t === 'u') {
            object[key] = null;
        } else if (value.t === 'o') {
            object[key] = decodeYDocToObject({
                doc: options.doc,
                id: options.id,
                path: [...path, key],
            });
        } else if (value.t === 'a') {
            object[key] = decodeYDocToArray({
                doc: options.doc,
                id: options.id,
                path: [...path, key],
            });
        }
    }

    return object;
}

export function decodeYDocToArray(options: TDecodeOptions): TJSONAble[] {
    const id = options.id ?? '';
    const path = options.path ?? [];

    const yArray = options.doc.getArray(`a:${id}:${JSON.stringify(path)}`);

    const array: TJSONAble[] = [];

    for (let i = 0; i < yArray.length; i++) {
        const value = yArray.get(i) as TArrayStored;

        if (value.t === 's' || value.t === 'n' || value.t === 'b') {
            array.push(value.v);
        } else if (value.t === 'u') {
            array.push(null);
        } else if (value.t === 'o') {
            array.push(
                decodeYDocToObject({
                    doc: options.doc,
                    id: value.i,
                    path: [],
                }),
            );
        } else if (value.t === 'a') {
            array.push(
                decodeYDocToArray({
                    doc: options.doc,
                    id: value.i,
                    path: [],
                }),
            );
        }
    }

    return array;
}
