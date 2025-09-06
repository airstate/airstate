import { useMemo } from 'react';

export function useRandomColor(key?: string) {
    return useMemo(() => {
        const colors = [
            '#d45917',
            '#60bf0d',
            '#02cc78',
            '#009bde',
            '#325ddb',
            '#722ec9',
            '#a822bf',
            '#cc2b83',
            '#cf2d4e',
        ];

        return colors[Math.floor(Math.random() * colors.length)];
    }, [key]);
}
