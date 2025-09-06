import { useCallback, useEffect, useReducer, useRef } from 'react';
import clsx from 'clsx';

export const TORCH_DIAMETER = 300;

export function Overlay({
    centers,
    isDark,
}: {
    centers: {
        name: string;
        color: string;
        pos: [number, number];
    }[];
    isDark: boolean;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

    const [r, forceRender] = useReducer((x) => x + 1, 0);

    const render = useCallback(
        (centers: [number, number][]) => {
            if (!ctxRef.current) {
                const canvas = canvasRef.current;

                if (!canvas) {
                    return;
                }

                const ctx = canvas.getContext('2d');

                if (!ctx) {
                    return;
                }

                ctxRef.current = ctx;
            }

            const ctx = ctxRef.current;

            ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

            ctx.fillStyle = 'rgba(70,65,60,0.8)';
            ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

            ctx.globalCompositeOperation = 'destination-out';

            centers.forEach((center) => {
                const x = Math.round(window.innerWidth / 2 + center[0]);
                const y = Math.round(window.innerHeight / 2 + center[1]);
                const radius = Math.round(TORCH_DIAMETER / 2);

                // Create a radial gradient: transparent in the center, opaque at the edge
                const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
                gradient.addColorStop(0, 'rgba(0,0,0,1)');
                gradient.addColorStop(0.75, 'rgba(0,0,0,0.9)');
                gradient.addColorStop(1, 'rgba(0,0,0,0)');

                ctx.beginPath();
                ctx.arc(x, y, radius, 0, 2 * Math.PI);
                ctx.closePath();

                ctx.fillStyle = gradient;
                ctx.fill();
            });

            ctx.globalCompositeOperation = 'source-over';
        },
        [centers],
    );

    useEffect(() => {
        render(centers.map((center) => center.pos));
    }, [centers, r, render]);

    useEffect(() => {
        window.addEventListener('resize', () => {
            forceRender();
        });
    }, []);

    return (
        <div className={'absolute w-full h-full top-0 left-0 z-10 pointer-events-none'}>
            <canvas
                className={clsx(
                    'absolute w-full h-full top-0 left-0 transition-opacity',
                    isDark ? 'opacity-100' : 'opacity-0',
                )}
                ref={canvasRef}
                width={window.innerWidth}
                height={window.innerHeight}
            />
            {centers.map((center) => {
                const x = Math.round(window.innerWidth / 2 + center.pos[0]);
                const y = Math.round(window.innerHeight / 2 + center.pos[1]);

                return (
                    <>
                        <div
                            style={{ left: x, top: y, color: center.color }}
                            className={'absolute w-2 h-2 -translate-1 rounded-full'}>
                            <svg
                                width="15"
                                height="15"
                                viewBox="0 0 57 57"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg">
                                <g clip-path="url(#cursor)">
                                    <path
                                        d="M0.827852 4.63513C0.024448 2.2776 2.27766 0.0243849 4.63519 0.827789L54.0385 17.6635C56.724 18.5787 56.7561 22.3655 54.0864 23.326L32.7942 30.9868C31.9525 31.2897 31.2899 31.9523 30.987 32.794L23.3261 54.0864C22.3656 56.7561 18.5788 56.724 17.6636 54.0384L0.827852 4.63513Z"
                                        fill="currentcolor"
                                    />
                                </g>
                                <defs>
                                    <clipPath id="cursor">
                                        <rect width="57" height="57" fill="white" />
                                    </clipPath>
                                </defs>
                            </svg>
                        </div>
                        <div
                            style={{
                                left: x,
                                top: y,
                                background: center.color,
                            }}
                            className={clsx(
                                'absolute translate-2 shadow text-white text-sm px-4 py-1 text-nowrap rounded-full',
                            )}>
                            {center.name}
                        </div>
                    </>
                );
            })}
        </div>
    );
}
