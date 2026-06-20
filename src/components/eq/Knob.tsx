import { useCallback, useRef } from "react";

const ACCENT = "var(--accent, #a9e80c)";

interface KnobProps {
    label: string;
    subLabel: string;
    size: "large" | "small";
    defaultValue?: number;
    onChange?: (value: number) => void;
}

export function Knob({ label, subLabel, size, defaultValue = 50, onChange }: KnobProps) {
    // Captured once at mount — double-click always resets to this initial value
    const resetTarget = useRef(defaultValue);

    const large      = size === "large";
    const svgSize    = large ? 132 : 92;
    const cx         = svgSize / 2;
    const r          = large ? 56  : 38;
    const arcLen     = large ? 263.9 : 179.1;
    const totalLen   = large ? 352   : 239;
    const sw         = large ? 5 : 4;
    const bodySize   = large ? 88 : 60;

    const activeDash   = `${((defaultValue / 100) * arcLen).toFixed(1)} ${totalLen}`;
    const rotation     = -135 + (defaultValue / 100) * 270;
    const needleLeft   = large ? "calc(50% - 2px)"  : "calc(50% - 1.5px)";
    const needleTop    = large ? "16px" : "12px";
    const needleW      = large ? "4px"  : "3px";
    const needleH      = large ? "25px" : "17px";
    const needleOrigin = large ? "50% 50px" : "50% 34px";
    const bodyShadow   = large
        ? "inset 0 2px 3px rgba(255,255,255,.06),inset 0 -8px 16px rgba(0,0,0,.6),0 10px 22px -8px rgba(0,0,0,.85)"
        : "inset 0 2px 3px rgba(255,255,255,.06),inset 0 -6px 12px rgba(0,0,0,.6),0 8px 16px -6px rgba(0,0,0,.85)";

    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        e.preventDefault();
        const startY   = e.clientY;
        const startVal = defaultValue;
        const move = (ev: PointerEvent) => {
            const nv = Math.max(0, Math.min(100, startVal + (startY - ev.clientY) * 0.6));
            onChange?.(nv);
        };
        const up = () => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
    }, [defaultValue, onChange]);

    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        onChange?.(resetTarget.current);
    }, [onChange]);

    return (
        <div style={{ textAlign: "center" }}>
            <div
                onPointerDown={handlePointerDown}
                onDoubleClick={handleDoubleClick}
                style={{ position: "relative", width: svgSize, height: svgSize, cursor: "ns-resize", touchAction: "none", userSelect: "none" }}
            >
                <svg
                    width={svgSize} height={svgSize}
                    viewBox={`0 0 ${svgSize} ${svgSize}`}
                    style={{ position: "absolute", inset: 0 }}
                >
                    <circle cx={cx} cy={cx} r={r} fill="none"
                        stroke="rgba(255,255,255,.07)" strokeWidth={sw} strokeLinecap="round"
                        strokeDasharray={`${arcLen} ${totalLen}`} transform={`rotate(135 ${cx} ${cx})`}
                    />
                    <circle cx={cx} cy={cx} r={r} fill="none"
                        stroke={ACCENT} strokeWidth={sw} strokeLinecap="round"
                        strokeDasharray={activeDash} transform={`rotate(135 ${cx} ${cx})`}
                        style={{ filter: "drop-shadow(0 0 5px rgba(169,232,12,.5))" }}
                    />
                </svg>

                <div style={{
                    position: "absolute", left: "50%", top: "50%",
                    width: bodySize, height: bodySize,
                    marginLeft: -(bodySize / 2), marginTop: -(bodySize / 2),
                    borderRadius: "50%",
                    background: "radial-gradient(circle at 36% 30%,#34363d 0%,#1a1b1f 62%,#141519 100%)",
                    border: "1px solid rgba(0,0,0,.55)", boxShadow: bodyShadow,
                }} />

                <div style={{
                    position: "absolute",
                    left: needleLeft, top: needleTop,
                    width: needleW, height: needleH,
                    borderRadius: "2px", background: ACCENT,
                    boxShadow: "0 0 12px rgba(169,232,12,.8)",
                    transformOrigin: needleOrigin,
                    transform: `rotate(${rotation}deg)`,
                }} />
            </div>

            <div style={{ fontSize: "10px", letterSpacing: ".18em", textTransform: "uppercase", color: "#7d7d85", fontWeight: 600, marginTop: "8px" }}>
                {label}
            </div>
            <div style={{ fontSize: "10px", color: "#5d5d65", marginTop: "3px", fontFamily: "'JetBrains Mono', monospace" }}>
                {subLabel} · <span style={{ color: ACCENT }}>{Math.round(defaultValue)}%</span>
            </div>
        </div>
    );
}
