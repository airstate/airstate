import { useSharedPresence, usePersistentNanoId } from '@airstate/react';
import { getDefaultClient } from '@airstate/client';

const customClient = getDefaultClient();
type TOptionalTypeOfDynamicState = any;

export function ReactReadmeSharedPresenceQuickStart() {
    const peerId = usePersistentNanoId();

    // every client on example.com/tomato is now part of the same room
    // and is sharing their state in real-time

    const { others, setState } = useSharedPresence({
        peerId: peerId, // replace this with any string that uniquely identifies the user; ideally keep stable
        initialState: {
            x: 0,
            y: 0,
        },
    });

    return (
        // a blue 512 x 512 square
        <div
            className={'absolute bg-blue-200 top-0 left-0 w-[512] h-[512]'}
            onMouseMove={(ev) => {
                // update dynamic state on mouse move
                setState({
                    x: ev.clientX,
                    y: ev.clientY,
                });
            }}>
            {/* other people's cursors */}
            {Object.values(others).map((other) => (
                <div
                    className={'absolute bg-red-500 w-[2] h-[2] rounded-full'}
                    style={{
                        left: other.state.x - 1,
                        top: other.state.y - 1,
                    }}></div>
            ))}
        </div>
    );
}

const peerId = '';
const schema = {parse: (data: any) => null as any};

export function ReactReadmeSharedPresenceQuickStartAdvanced() {
    const {

        self,              // this peer's data
        setState,          // set this client's dynamic state
        others,            // everyone else's data (but not this client's)
        stats,             // the number of peers who had connected at least once
        connected,         // if this peer is connected or not
        started,           // if the presence room has been initialized or not
        error              // any errors, if any

    } = useSharedPresence<TOptionalTypeOfDynamicState>({

        peerId: peerId,                     // replace this with any string that uniquely identifies the user; ideally keep stable
        room: 'a-specific-room-key',        // if you don't want airstate to infer from url
        token: 'jwt-signed-by-your-server', // to maintain authentication & authorization
        client: customClient,               // if you don't use to use the default client with default config

        initialState: {
            x: 0,
            y: 0,
        },

        validate: (rawState: any) => {
            // return validated parsed data
            // or throw error
            return schema.parse(rawState);
        }
    });

    return <>{/* ... */}</>
}
