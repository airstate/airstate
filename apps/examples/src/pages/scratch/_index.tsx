import { configure, sharedYDoc, yjs, createSharedState } from '@airstate/client';
import { useEffect, useState } from 'react';
import { IndexeddbPersistence } from 'y-indexeddb';

configure({
    appKey: '',
    server: `ws://${window.location.hostname}:11001/ws`,
});

type AnyObject = {
    [key: string]: any;
};

export function Scratch() {
    // useEffect(() => {
    //     const doc = new yjs.Doc();
    //
    //     encodeObjectToYDoc({
    //         doc: doc,
    //
    //         object: {
    //             name: 'AirState',
    //             founders: [
    //                 { name: 'Tanvir Hossen', number: '' },
    //                 {
    //                     name: 'Omran Jamal',
    //                     number: '',
    //                     address: {
    //                         city: 'Dhaka',
    //                         country: 'Bangladesh',
    //                     },
    //                 },
    //                 { name: 'Samiha Tahsin', number: '' },
    //                 { name: 'Alfred Pithu', number: '' },
    //             ],
    //             address: {
    //                 city: 'Denver',
    //                 state: 'CO',
    //             },
    //         },
    //     });
    //
    //     console.log(doc.toJSON());
    //
    //     console.log(
    //         decodeYDocToObject({
    //             doc: doc,
    //         }),
    //     );
    // }, []);

    // useEffect(() => {
    //     const u1: Uint8Array[] = [];
    //     const u2: Uint8Array[] = [];
    //
    //     const d1 = new yjs.Doc();
    //     const d2 = new yjs.Doc();
    //
    //     d1.on('updateV2', (u) => u1.push(u));
    //     d2.on('updateV2', (u) => u2.push(u));
    //
    //     encodeObjectToYDoc({
    //         doc: d1,
    //         object: {
    //             numbers: [3, { age: 27 }],
    //             tomato: {
    //                 potato: {
    //                     first_name: 'Tanvir',
    //                     last_name: 'Bhabi',
    //                 },
    //             },
    //         },
    //     });
    //
    //     encodeObjectToYDoc({
    //         doc: d2,
    //         object: {
    //             numbers: [1, 2],
    //             tomato: {
    //                 potato: {
    //                     last_name: 'Hossen',
    //                 },
    //             },
    //         },
    //     });
    //
    //     u1.forEach((u) => yjs.applyUpdateV2(d2, u));
    //     u2.forEach((u) => yjs.applyUpdateV2(d1, u));
    //
    //     console.log(decodeYDocToObject({ doc: d1 }), decodeYDocToObject({ doc: d2 }));
    // }, []);

    // useEffect(() => {
    //     const d = new yjs.Doc();
    //     let u: null | Uint8Array = null;
    //
    //     d.on('update', (u1) => {
    //         u = u1;
    //         console.log(`updated ${Math.random()}`, u1.length);
    //     });
    //
    //     const provider = new IndexeddbPersistence('testing', d);
    //
    //     // d.getMap('main').set('location', 'Denver, CO');
    //
    //     // console.log(yjs.encodeStateAsUpdate(d).length);
    //     //
    //     // for (let i = 0; i < 5; i++) {
    //     //     yjs.applyUpdate(d, u!);
    //     // }
    //     //
    //     // d.getMap('main').set('address', 'Denver, CO');
    //     // d.getMap('main').set('address', 'tomato');
    //
    //     console.log(yjs.encodeStateAsUpdate(d).length);
    // }, []);

    useEffect(() => {
        const sharedDOC = createSharedState<AnyObject>({
            key: 'takashi',
            initialValue: {
                name: 'LUCY',
            },
        });
        sharedDOC.onConnect(() => {
            console.log('1 connected');
        });
        sharedDOC.onError((error) => {
            console.error('1', error);
        });
        sharedDOC.onDisconnect(() => {
            console.log('1 disconnected');
        });
        sharedDOC.onSynced((val) => {
            console.log('Client 1 received synced value:', val);
            // setTimeout(() => {
            //     sharedDOC.update({ name: 'kaka', profession: 'kaka' });
            //     console.log('Client 1 sent update synced value:');
            // }, 7000);
        });
        sharedDOC.onUpdate((update) => {
            console.log('Client 1 received update:', update);
        });
    }, []);

    return <div>tomato</div>;
}
