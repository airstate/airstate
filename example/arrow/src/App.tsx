import { Redirect, Route, Router } from 'wouter';
import { nanoid } from 'nanoid';
import { configure } from '@airstate/client';
import { Remote } from './components/Remote.tsx';
import { Arrow } from './components/Arrow.tsx';

configure({
    appId: 'pk_airstate_mtpHCrXLo_OnSCjXXTW5C',
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
