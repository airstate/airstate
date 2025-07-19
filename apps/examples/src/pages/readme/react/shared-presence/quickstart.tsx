import { useSharedPresence } from '@airstate/react';
import { getDefaultClient } from '@airstate/client';

const customClient = getDefaultClient();
type TOptionalTypeOfDynamicState = any;

export function ReactReadmeSharedPresenceQuickStart() {
    const { others, setDynamicState } = useSharedPresence({
        peerKey: `${Math.random()}`, // replace this with any string that uniquely identifies the user
        initialDynamicState: {
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
                setDynamicState({
                    x: ev.clientX,
                    y: ev.clientY,
                });
            }}>
            {/* other people's cursors */}
            {Object.values(others).map((other) => (
                <div
                    className={'absolute bg-red-500 w-[2] h-[2] rounded-full'}
                    style={{
                        top: (other.dynamicState?.state.y ?? 0) - 1,
                        left: (other.dynamicState?.state.x ?? 0) - 1,
                    }}></div>
            ))}
        </div>
    );
}

export function ReactReadmeSharedPresenceQuickStartAdvanced() {
    const {

        self,              // this client's data
        setDynamicState,   // set this client's dynamic state
        others,            // everyone else's data (but not this client's)
        summary,           // the number of peers that are online and focused
        setFocus,          // set if this client is currently on the page and active

    } = useSharedPresence<TOptionalTypeOfDynamicState>({

        peerKey: `${Math.random()}`,        // any string that uniquely identifies the user; could be email.
        roomId: 'a-specific-room-key',     // if you don't want airstate to infer from url
        token: 'jwt-signed-by-your-server', // to maintain authentication & authorization
        client: customClient,               // if you don't use to use the default client with default config

        initialDynamicState: {
            x: 0,
            y: 0,
        },

    });

    return <>{/* ... */}</>
}
