import { useEffect, useRef, useState } from 'react';
import { configure, sharedPresence } from '@airstate/client';
import { useSharedState } from '@airstate/react';

configure({
    appKey: 'pk_airstate_9VnWDAYQkgvw9gHxZlMa4',
});

type TProps = {
    // id: string;
};

type TPoint = {
    x: number;
    y: number;
};

type TLine = {
    color: string;
    points: TPoint[];
};

type TState = {
    currentLine: TLine;
    lines: TLine[];
};

export function Test(props: TProps) {
    const [hue] = useState(() => Math.round(Math.random() * 359));
    const [state, setState] = useSharedState<TState>({
        currentLine: {
            color: `hsl(${hue}, 50%, 50%)`,
            points: [],
        },
        lines: [],
    });

    const [isDrawing, setIsDrawing] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw all lines
        ctx.strokeStyle = `black`;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Draw saved lines
        state.lines.forEach((line) => {
            if (line.points.length < 2) return;

            ctx.beginPath();
            ctx.strokeStyle = line.color;
            ctx.moveTo(line.points[0].x, line.points[0].y);

            for (let i = 1; i < line.points.length; i++) {
                ctx.lineTo(line.points[i].x, line.points[i].y);
            }

            ctx.stroke();
        });

        // Draw current line
        if (state.currentLine.points.length >= 2) {
            ctx.beginPath();
            ctx.strokeStyle = state.currentLine.color;
            ctx.moveTo(state.currentLine.points[0].x, state.currentLine.points[0].y);

            for (let i = 1; i < state.currentLine.points.length; i++) {
                ctx.lineTo(state.currentLine.points[i].x, state.currentLine.points[i].y);
            }

            ctx.stroke();
        }
    }, [state.lines, state.currentLine]);

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        setIsDrawing(true);

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        setState((prev) => ({
            ...prev,
            currentLine: {
                color: `hsl(${hue}, 50%, 50%)`,
                points: [...prev.currentLine.points, { x, y }],
            },
        }));
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        setState((prev) => ({
            ...prev,
            currentLine: {
                ...prev.currentLine,
                points: [...prev.currentLine.points, { x, y }],
            },
        }));
    };

    const handleMouseUp = () => {
        if (isDrawing && state.currentLine.points.length > 0) {
            setState((prev) => ({
                ...prev,
                currentLine: {
                    ...prev.currentLine,
                    points: [],
                },
                lines: [...prev.lines, prev.currentLine],
            }));

            setIsDrawing(false);
        }
    };

    const handleMouseLeave = () => {
        handleMouseUp();
    };

    return (
        <div className="inline-block m-6">
            <h2 className={'text-3xl'} style={{ color: `hsl(${hue}, 50%, 50%)` }}>
                Computer
            </h2>
            <canvas
                ref={canvasRef}
                width={400}
                height={400}
                style={{ border: '1px solid black' }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
            />
        </div>
    );
}
