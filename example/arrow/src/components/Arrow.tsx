import { useParams } from 'wouter';
import { useSharedState } from '@airstate/react';
import { scope } from 'scope-utilities';
import { QRCodeSVG } from 'qrcode.react';

export function Arrow() {
    const { room } = useParams();

    const [angle] = useSharedState<number>(0, {
        channel: 'airstate-demo_arrow__' + (room ?? 'default'),
    });

    const qrCodeURL = scope(new URL(window.location.href))
        .also((url) => {
            url.pathname = `/${room}/remote`;
        })
        .let((url) => url.toString())
        .value();

    return (
        <>
            <div className={'fixed top-0 left-0 w-screen h-screen flex flex-col justify-center items-center'}>
                <div
                    className={
                        'font-[Merriweather_Sans] font-light text-[40rem] size-96 leading-0 flex flex-col items-center justify-center'
                    }
                    style={{
                        transform: `rotateZ(${angle}deg)`,
                    }}>
                    ↑
                </div>
            </div>
            <div className={'size-28 bg white border-1 border-black fixed bottom-5 right-5 p-2'}>
                <QRCodeSVG value={qrCodeURL} bgColor={'transparent'} className={'w-full h-full'} />
            </div>
        </>
    );
}
