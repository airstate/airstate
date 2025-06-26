import { getDefaultClient, sharedPresence, sharedState } from '@airstate/client';



function genType<T extends boolean | number>(t: T): T {
    return t;
}

let t = genType(32);
t = 42;


type TOptionalSharedStateType = {tomato: string};
const customClient = getDefaultClient();

{
    const presence = sharedPresence({
        peerKey: `${Math.random()}`,
        initialDynamicState: {
            x: 0,
            y: 0
        }
    });

    const container = document.getElementById('container')!;

    presence.onUpdate(() => {

    });

    // HTML
    `
    <div
        class="absolute top-0 left-0 w-[512] h-[512] bg-blue-200"
        id="container"
    >
        <!-- will add individual cursors here -->
    </div>
    `
}


{

}

