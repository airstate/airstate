import { Redirect, Route, Router } from 'wouter';
import { nanoid } from 'nanoid';
import { configure } from '@airstate/client';
import { Remote } from './components/Remote.tsx';
import { Arrow } from './components/Arrow.tsx';

if (!import.meta.env.VITE_AIRSTATE_APP_ID) {
    throw new Error('please set the VITE_AIRSTATE_APP_ID env variable when building');
}

configure({
    appId: import.meta.env.VITE_AIRSTATE_APP_ID,
});

function App() {
    return (
        <Router>
            <Route path={'/:room/remote'} component={Remote} />
            <Route path={'/:room'} component={Arrow} />
            <Route path={'/'}>
                <Redirect to={`/${nanoid()}`} />
            </Route>
        </Router>
    );
}

export default App;
