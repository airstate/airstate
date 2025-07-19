import { getDefaultClient, sharedPresence } from '@airstate/client';

type TOptionalShapeOfDynamicState = {
    x: number;
    y: number;
};

const customClient = getDefaultClient();


const presence = sharedPresence<TOptionalShapeOfDynamicState>({

    roomId: 'a-specific-room-key',          // if you don't want AirState to infer from URL
    peerKey: 'uniquely-identify-the-client', // yeah, email is fine; session id is also fine
    client: customClient,                    // in case you have more than one client
    token: 'jwt-signed-by-your-server',      // to maintain auth

    initialDynamicState: {                   // the initial dynamic state
        x: 0,
        y: 0,
    },

});

presence.self;   // the latest version of this client's own data
presence.others; // the latest version of every other client's data

presence.updateDynamicState({ x: 1, y: 10 }); // update the client's dynamic state for all other clients to see
presence.updateFocusState(false);   // update the client's focus state

const cleanupUpdateListener = presence.onUpdate((p) => {
    // everytime this client or some other client updates their dynamicState,
    // or focus state, this function gets called.

    p.self;    // the latest version of this client's own data
    p.others;  // the latest version of every other client's data
    p.summary; // a summary of how many clients are active and focused

    p.state;   // an object containing everything above
});

cleanupUpdateListener(); // call the returned function to un-listen

presence.onConnect(() => {
    /* connection established */
});

presence.onDisconnect(() => {
    /* connection lost */
});

presence.onError((error) => {
    /* something went wrong */
});
