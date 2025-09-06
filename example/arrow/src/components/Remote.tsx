import { useParams } from 'wouter';
import { useSharedState } from '@airstate/react';
import { useEffect, useState } from 'react';
import { getPhoneRotation } from '../utils/math.ts';

export function Remote() {
    const { room } = useParams();

    const [angle, setAngle] = useSharedState<number>(0, {
        channel: 'airstate-demo_arrow__' + (room ?? 'default'),
    });

    const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
    const [isSupported, setIsSupported] = useState<boolean>(true);

    useEffect(() => {
        // Check if DeviceOrientationEvent is supported
        if (!window.DeviceOrientationEvent) {
            setIsSupported(false);
            return;
        }

        const requestPermission = async () => {
            // For iOS 13+ devices, we need to request permission
            if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
                try {
                    const permission = await (DeviceOrientationEvent as any).requestPermission();

                    if (permission === 'granted') {
                        setPermissionGranted(true);
                    }
                } catch (error) {
                    console.error('Permission request failed:', error);
                }
            } else {
                setPermissionGranted(true);
            }
        };

        const handleOrientation = (event: DeviceOrientationEvent) => {
            if (event.alpha !== null && event.beta !== null && event.gamma !== null) {
                setAngle(Math.round(getPhoneRotation(event.beta, event.gamma) / 2) * 2);
            }
        };

        if (permissionGranted) {
            window.addEventListener('deviceorientation', handleOrientation);
        }

        // Initial permission request
        requestPermission();

        return () => {
            window.removeEventListener('deviceorientation', handleOrientation);
        };
    }, [permissionGranted]);

    const handlePermissionRequest = async () => {
        if (typeof (DeviceOrientationEvent as any).requestPermission === 'function') {
            try {
                const permission = await (DeviceOrientationEvent as any).requestPermission();
                if (permission === 'granted') {
                    setPermissionGranted(true);
                }
            } catch (error) {
                console.error('Permission request failed:', error);
            }
        }
    };

    if (!isSupported) {
        return (
            <div className="p-5 text-center">
                <h2>Device Orientation Not Supported</h2>
                <p>Your device or browser doesn't support device orientation events.</p>
            </div>
        );
    }

    return (
        <div className="top-0 left-0 fixed p-5 text-center w-screen h-screen flex flex-col justify-center items-center font-mono">
            {!permissionGranted ? (
                <div>
                    <p className="mb-4">Permission is required to access device orientation data.</p>
                    <button
                        onClick={handlePermissionRequest}
                        className="px-5 py-2.5 text-base bg-blue-600 text-white border-none rounded cursor-pointer hover:bg-blue-700 transition-colors">
                        Grant Permission
                    </button>
                </div>
            ) : (
                <div>
                    <div
                        className={
                            'font-[Merriweather_Sans] font-light text-[30rem] size-96 leading-0 flex flex-col items-center justify-center'
                        }>
                        ↑
                    </div>
                    <div className={`text-2xl font-bold mb-5`}>
                        <div>{angle}</div>
                    </div>
                </div>
            )}
        </div>
    );
}
