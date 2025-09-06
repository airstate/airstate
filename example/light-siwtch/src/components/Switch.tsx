import clsx from 'clsx';

export function Switch({ state, onChange }: { state: 'on' | 'off'; onChange: (state: 'on' | 'off') => void }) {
    return (
        <div
            className="w-24 rounded-full border-2 border-black h-12 absolute p-1 flex flex-row items-center overflow-hidden shadow-lg"
            onClick={() => onChange(state === 'on' ? 'off' : 'on')}>
            <div
                className={clsx(
                    'absolute h-9 w-9 rounded-full bg-white border-2 transition-all shadow',
                    state === 'off' ? 'left-1' : 'left-13',
                )}></div>
            <div className={clsx('absolute transition-all select-none', state === 'on' ? 'left-5' : '-left-24')}>
                ON
            </div>
            <div className={clsx('absolute transition-all select-none', state === 'off' ? 'left-12' : 'left-24')}>
                OFF
            </div>
        </div>
    );
}
