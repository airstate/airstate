import { configure, shareYDoc, yjs, encodeObjectToYDoc, decodeYDocToObject } from '@airstate/client';
import { useEffect, useState } from 'react';
import { IndexeddbPersistence } from 'y-indexeddb';

configure({
    appKey: '',
    server: `ws://localhost:11001/ws`,
});

export function Scratch() {
    const [run2, setRun2] = useState(false);

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

    useEffect(() => {
        const d = new yjs.Doc();
        let u: null | Uint8Array = null;

        d.on('update', (u1) => {
            u = u1;
            console.log(`updated ${Math.random()}`, u1.length);
        });

        const provider = new IndexeddbPersistence('testing', d);

        // d.getMap('main').set('location', 'Denver, CO');

        // console.log(yjs.encodeStateAsUpdate(d).length);
        //
        // for (let i = 0; i < 5; i++) {
        //     yjs.applyUpdate(d, u!);
        // }
        //
        // d.getMap('main').set('address', 'Denver, CO');
        // d.getMap('main').set('address', 'tomato');

        console.log(yjs.encodeStateAsUpdate(d).length);
    }, []);

    // useEffect(() => {
    //     setTimeout(() => {
    //         setRun2(true);
    //     }, 2000);
    // }, []);

    // useEffect(() => {
    //     const doc = new yjs.Doc();
    //
    //     return shareYDoc({
    //         key: 'test',
    //         doc: doc,
    //         onConnect() {
    //             console.log('1 connected');
    //         },
    //         onDisconnect() {
    //             console.log('1 disconnected');
    //         },
    //         onSynced(doc) {
    //             console.log('1 synced', doc.getMap('main').toJSON());
    //
    //             doc.on('update', () => {
    //                 console.log('1:', doc.getMap('main').toJSON());
    //             });
    //         },
    //     });
    // }, []);

    // useEffect(() => {
    //     if (run2) {
    //         return createSharedYDoc({
    //             key: 'test',
    //             initFreshDoc(doc) {},
    //             onConnect() {
    //                 console.log('2 connected');
    //             },
    //             onDisconnect() {
    //                 console.log('2 disconnected');
    //             },
    //             onSynced(doc) {
    //                 console.log('2 synced', doc.getMap('main').toJSON());
    //
    //                 doc.on('update', () => {
    //                     console.log('2:', doc.getMap('main').toJSON());
    //                 });
    //
    //                 doc.getMap('main').set('location', `Denver, CO ${Math.random()}`);
    //             },
    //         }).unsubscribe;
    //     }
    // }, [run2]);

    return <div>tomato</div>;
}
