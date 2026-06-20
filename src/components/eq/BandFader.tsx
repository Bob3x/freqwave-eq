import { useCallback } from "react";

const ACCENT = "var(--accent, #a9e80c)";

interface BandFaderProps {
    freq: string;
    value: number;   // dB, −12 to +12
    onChange: (db: number) => void;
}

export function BandFader({ freq, value, onChange }: BandFaderProps) {
    const pct    = (value + 12) / 24;
    const lo     = Math.min(pct, 0.5);
    const hi     = Math.max(pct, 0.5);
    const dbText = (value > 0 ? "+" : "") + value.toFixed(1);
    const dbColor = Math.abs(value) < 0.05 ? "#5d5d65" : ACCENT;

    const handleBottom = `calc(${(pct * 100).toFixed(1)}% - 7px)`;
    const fillBottom   = `${(lo * 100).toFixed(1)}%`;
    const fillHeight   = `${((hi - lo) * 100).toFixed(1)}%`;

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        e.preventDefault();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const set = (clientY: number) => {
            const p  = Math.max(0, Math.min(1, 1 - (clientY - rect.top) / rect.height));
            const db = Math.round((p * 24 - 12) * 10) / 10;
            onChange(db);
        };
        set(e.clientY);
        const move = (ev: PointerEvent) => set(ev.clientY);
        const up   = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
    }, [onChange]);

    return (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center" }}>
            {/* dB readout */}
            <div style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "11px", fontWeight: 500,
                color: dbColor, transition: "color .15s",
            }}>
                {dbText}
            </div>

            {/* Fader hit area */}
            <div
                onPointerDown={handlePointerDown}
                onDoubleClick={e => { e.preventDefault(); onChange(0); }}
                style={{
                    position: "relative", width: "34px", height: "100px",
                    margin: "6px 0", cursor: "ns-resize", touchAction: "none",
                    display: "flex", justifyContent: "center",
                }}
            >
                {/* Track */}
                <div style={{
                    position: "absolute", top: 0, bottom: 0, width: "5px",
                    borderRadius: "3px",
                    background: "rgba(255,255,255,.06)",
                    boxShadow: "inset 0 1px 3px rgba(0,0,0,.7)",
                }} />

                {/* Zero-line tick */}
                <div style={{
                    position: "absolute", left: "50%", top: "50%",
                    width: "14px", height: "1px", marginLeft: "-7px",
                    background: "rgba(255,255,255,.14)",
                }} />

                {/* Fill (extends from center toward handle) */}
                <div style={{
                    position: "absolute", left: "50%",
                    width: "5px", marginLeft: "-2.5px",
                    borderRadius: "3px",
                    background: ACCENT,
                    boxShadow: "0 0 8px rgba(169,232,12,.5)",
                    bottom: fillBottom, height: fillHeight,
                }} />

                {/* Handle */}
                <div style={{
                    position: "absolute", left: "50%",
                    width: "30px", height: "14px", marginLeft: "-15px",
                    borderRadius: "4px",
                    background: "linear-gradient(180deg,#3a3c43,#222328)",
                    border: "1px solid rgba(0,0,0,.6)",
                    boxShadow: "0 3px 6px -1px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.12)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    bottom: handleBottom,
                }}>
                    <div style={{
                        width: "14px", height: "2px", borderRadius: "1px",
                        background: ACCENT,
                        boxShadow: "0 0 6px rgba(169,232,12,.7)",
                    }} />
                </div>
            </div>

            {/* Frequency label */}
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "11px", color: "#83838b" }}>
                {freq}
            </div>
        </div>
    );
}
