export function getPhoneRotation(beta: number, gamma: number): number {
    const b = (beta * Math.PI) / 180;
    const g = (gamma * Math.PI) / 180;

    const gx = Math.sin(g) * Math.cos(b);
    const gy = Math.sin(b);

    return (Math.atan2(gx, gy) * 180) / Math.PI;
}
