import { useSharedState } from '@airstate/react';
import { getDefaultClient } from '@airstate/client';

const customClient = getDefaultClient();
type TOptionalTypeOfState = any;

export function ReactReadmeSharedStateQuickStart() {
    // every client on example.com/tomato will see the
    // save value in `state`
    const [state, setState] = useSharedState<boolean>(false);

    const toggle = () => {
        setState((prev) => !prev);
    };

    return (
        <button onClick={toggle}>
            {state ? 'ON' : 'OFF'} - Click to Toggle
        </button>
    );
}

const schema = {parse: (data: any) => null as any};

export function ReactReadmeSharedStateQuickStartAdvanced() {
    const [
        
        state,     // the data everyone sees
        setState,  // change the data everyone sees
        isReady,   // if the first-sync has occurred or not
        error      // `any` but typically an instance of `Error`
        
    ] = useSharedState<TTypeOfState>(

        { potato: 'brownish' },     // the initial state
        
        {
            channel: 'a-specific-room-key',      // if you don't want airstate to infer from url
            token: 'jwt-signed-by-your-server',  // to maintain authentication & authorization
            client: customClient,                // if you don't want to use the default client
            validate: (rawState: any): TTypeOfState => {
                // return the validated data
                // or throw error
                return schema.parse(rawState);
            }
        }
    );

    return <>{/* ... */}</>;
}

