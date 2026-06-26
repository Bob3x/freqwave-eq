import { useEffect, useRef } from "react";

interface SpectrumProps {
    bands: number[];        // 8 dB values, −12 to +12
    engineActive: boolean;
}

export function Spectrum({ bands, engineActive }: SpectrumProps) {
    const canvasRef   = useRef<HTMLCanvasElement>(null);
    const bandsRef    = useRef(bands);
    const engineRef   = useRef(engineActive);

    useEffect(() => { bandsRef.current = bands; },        [bands]);
    useEffect(() => { engineRef.current = engineActive; }, [engineActive]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const dpr = window.devicePixelRatio || 1;
        let cw = 0, ch = 0;

        const resize = () => {
            cw = canvas.clientWidth;
            ch = canvas.clientHeight;
            canvas.width  = cw * dpr;
            canvas.height = ch * dpr;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        };
        resize();
        window.addEventListener("resize", resize);

        let raf: number;

        const loop = (ts: number) => {
            const W = cw, H = ch;
            if (!W) { raf = requestAnimationFrame(loop); return; }

            const bs     = bandsRef.current;
            const engine = engineRef.current;
            const t      = ts / 1000;
            const n      = bs.length;
            const mid      = H * 0.5;
            const pad      = 6;
            const maxSwing = (H / 2) - pad;
            const swingFactor = maxSwing / 15;  // 15 = clamped max of normInfl

            ctx.clearRect(0, 0, W, H);

            const steps = Math.max(64, Math.floor(W / 4));
            const pts: [number, number][] = [];

            for (let s = 0; s <= steps; s++) {
                const x = (s / steps) * W;
                let infl = 0;
                for (let i = 0; i < n; i++) {
                    const bx    = ((i + 0.5) / n) * W;
                    const sigma = (W / n) * 0.62;
                    infl += bs[i] * Math.exp(-((x - bx) ** 2) / (2 * sigma ** 2));
                }
                const amp      = engine ? 1 : 0.22;
                const noise    = engine
                    ? (Math.sin(x * 0.03 + t * 2) + Math.sin(x * 0.013 - t * 1.3) * 0.6) * 3
                    : Math.sin(x * 0.02 + t) * 1.1;
                const normInfl = Math.tanh(infl / 15) * 15;
                const yCurve   = mid - normInfl * swingFactor * amp + noise * amp * 0.3;
                pts.push([x, Math.max(pad, Math.min(H - pad, yCurve))]);
            }

            const col  = engine ? "132,232,12" : "120,124,130";
            const grad = ctx.createLinearGradient(0, 0, 0, H);
            grad.addColorStop(0, `rgba(${col},0.30)`);
            grad.addColorStop(1, `rgba(${col},0)`);

            ctx.beginPath();
            ctx.moveTo(0, H);
            pts.forEach(([x, y]) => ctx.lineTo(x, y));
            ctx.lineTo(W, H);
            ctx.closePath();
            ctx.fillStyle = grad;
            ctx.fill();

            ctx.beginPath();
            pts.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
            ctx.lineWidth   = 2;
            ctx.strokeStyle = `rgba(${col},${engine ? 0.95 : 0.5})`;
            ctx.shadowBlur  = engine ? 10 : 0;
            ctx.shadowColor = `rgba(${col},0.8)`;
            ctx.stroke();
            ctx.shadowBlur  = 0;

            raf = requestAnimationFrame(loop);
        };

        raf = requestAnimationFrame(loop);
        return () => {
            cancelAnimationFrame(raf);
            window.removeEventListener("resize", resize);
        };
    }, []);

    return (
        <div style={{
            position: "relative", height: "84px",
            borderRadius: "14px", overflow: "hidden",
            background: "#0c0d10",
            border: "1px solid rgba(255,255,255,.06)",
            boxShadow: "inset 0 2px 8px rgba(0,0,0,.6)",
            backgroundImage: [
                "linear-gradient(rgba(255,255,255,.025) 1px,transparent 1px)",
                "linear-gradient(90deg,rgba(255,255,255,.025) 1px,transparent 1px)",
            ].join(","),
            backgroundSize: "100% 32px, 12.5% 100%",
        }}>
            <canvas ref={canvasRef} style={{ width: "100%", height: "100%", display: "block" }} />
        </div>
    );
}
