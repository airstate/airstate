import { getDefaultClient, sharedState } from '@airstate/client';

type TOptionalSharedStateType = {tomato: string};
const customClient = getDefaultClient();

{
    // HTML
    `
    <button id="b">OFF - Click to Toggle</button>
    `


    // TS
    const button = document.getElementById('b')!;

    const state = sharedState<boolean>({
        initialValue: false
    });

    state.onUpdate((value) => {
        button.innerHTML = `${value ? 'ON' : 'OFF'} - Click to Toggle`;
    });

    button.addEventListener('click', () => {
        state.update((prev) => !prev);
    });
}


{
    const state = sharedState<TOptionalSharedStateType>({

        initialValue: { tomato: 'reddish' }, // the initial state
        channel: 'a-specific-room-key',      // if you don't want airstate to infer from url
        token: 'jwt-signed-by-your-server',  // to maintain authentication & authorization
        client: customClient                 // if you don't want to use the default client

    });

    state.onSynced(() => {
        /* ideally, start making updates after this event */
    });

    state.onUpdate((nextState) => {
        /* do what you want with this */
    });

    state.onConnect(() => {
        /* connection established */
    });

    state.onDisconnect(() => {
        /* connection lost */
    });

    state.onError((error) => {
        /* something went wrong */
    });

    state.update({ tomato: 'sometimes green' });                                  // set the state to this value for every client
    state.update((prev) => ({ ...prev, tomato: 'sometimes green' }));  // functional updates

    state.synced;    // a boolean which contains if the first sync has occurred or not
    state.destroy(); // destroys the state instance and reclaims all memory
}

