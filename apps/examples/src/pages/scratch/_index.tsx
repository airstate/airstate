import { configure, createSharedYDoc, getDefaultClient } from '@airstate/client';
import { useEffect, useState } from 'react';

configure({
    appKey: '',
    server: `ws://localhost:11001/ws`,
});

export function Scratch() {
    const [run2, setRun2] = useState(false);

    useEffect(() => {
        setTimeout(() => {
            setRun2(true);
        }, 2000);
    }, []);

    useEffect(() => {
        return createSharedYDoc({
            key: 'test',
            initFreshDoc(doc) {
                doc.getMap('main').set('name', 'AirState LLC');
            },
            onConnect() {
                console.log('1 connected');
            },
            onDisconnect() {
                console.log('1 disconnected');
            },
            onSynced(doc) {
                console.log('1 synced', doc.getMap('main').toJSON());

                doc.on('update', () => {
                    console.log('1:', doc.getMap('main').toJSON());
                });
            },
        }).unsubscribe;
    }, []);

    useEffect(() => {
        if (run2) {
            return createSharedYDoc({
                key: 'test',
                initFreshDoc(doc) {},
                onConnect() {
                    console.log('2 connected');
                },
                onDisconnect() {
                    console.log('2 disconnected');
                },
                onSynced(doc) {
                    console.log('2 synced', doc.getMap('main').toJSON());

                    doc.on('update', () => {
                        console.log('2:', doc.getMap('main').toJSON());
                    });

                    doc.getMap('main').set('location', `Denver, CO ${Math.random()}`);
                },
            }).unsubscribe;
        }
    }, [run2]);

    return <div>tomato</div>;
}
