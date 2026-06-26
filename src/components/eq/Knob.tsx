import { useCallback, useEffect, useRef } from "react";

const ACCENT   = "var(--accent, #84e80c)";
const MIN_DB   = -12;
const MAX_DB   =  12;
const HALF_DB  = (MAX_DB - MIN_DB) / 2; // 12

// Tick definitions: db value + visual kind
const TICKS: { db: number; kind: "zero" | "major" | "minor" }[] = [
    { db: -12, kind: "major" },
    { db:  -9, kind: "minor" },
    { db:  -6, kind: "major" },
    { db:  -3, kind: "minor" },
    { db:   0, kind: "zero"  },
    { db:   3, kind: "minor" },
    { db:   6, kind: "major" },
    { db:   9, kind: "minor" },
    { db:  12, kind: "major" },
];

interface KnobProps {
    label: string;
    size: "large" | "small";
    defaultValue?: number;   // dB, −12 to +12; 0 = unity (default)
    onChange?: (db: number) => void;
}

export function Knob({ label, size, defaultValue = 0, onChange }: KnobProps) {
    // Always 0 — double-click resets to factory default, not whatever was persisted at mount
    const resetTarget = useRef(0);
    // Stable ref so drag closures always read the current value without stale capture
    const currentValue = useRef(defaultValue);
    useEffect(() => { currentValue.current = defaultValue; }, [defaultValue]);

    const large    = size === "large";
    const svgSize  = large ? 132 : 92;
    const cx       = svgSize / 2;
    const r        = large ? 56  : 38;
    const arcLen   = large ? 263.9 : 179.1;  // 270° worth of arc at each radius
    const totalLen = large ? 352   : 239;     // full circumference
    const sw       = large ? 5 : 4;
    const bodySize = large ? 88 : 60;

    // Needle: 0 dB = 12 o'clock (0°), ±12 dB = ±135°
    const rotation = (defaultValue / HALF_DB) * 135;

    // Arc fill — extends from the CENTER of the arc (12 o'clock) toward current value.
    // Center of arc path = arcLen / 2 pixels from the start of the path.
    const halfArc = arcLen / 2;
    let activeDash: string;
    if (Math.abs(defaultValue) < 0.01) {
        // Exactly zero: no fill
        activeDash = `0 ${totalLen}`;
    } else if (defaultValue > 0) {
        // Positive: fill from center clockwise
        const fillLen = (defaultValue / HALF_DB) * halfArc;
        activeDash = `0 ${halfArc.toFixed(1)} ${fillLen.toFixed(1)} ${totalLen}`;
    } else {
        // Negative: fill from value position (left of center) up to center
        const fraction = (defaultValue - MIN_DB) / (MAX_DB - MIN_DB);
        const startPos = fraction * arcLen;
        const fillLen  = halfArc - startPos;
        activeDash = `0 ${startPos.toFixed(1)} ${fillLen.toFixed(1)} ${totalLen}`;
    }

    // Tick mark radii — placed in the gap between the arc inner edge and knob body
    const tickOuterR      = large ? 52 : 35;
    const tickInnerMajor  = large ? 45 : 30;
    const tickInnerMinor  = large ? 48 : 33;
    const tickInnerZero   = large ? 43 : 29;  // longest tick for 0 dB emphasis

    const ticks = TICKS.map(({ db, kind }) => {
        const rad = (db / HALF_DB) * 135 * (Math.PI / 180);
        const innerR = kind === "zero" ? tickInnerZero : kind === "major" ? tickInnerMajor : tickInnerMinor;
        return {
            db, kind,
            x1: cx + tickOuterR * Math.sin(rad),
            y1: cx - tickOuterR * Math.cos(rad),
            x2: cx + innerR    * Math.sin(rad),
            y2: cx - innerR    * Math.cos(rad),
        };
    });

    // Needle geometry (unchanged from previous design)
    const needleLeft   = large ? "calc(50% - 2px)"   : "calc(50% - 1.5px)";
    const needleTop    = large ? "16px"  : "12px";
    const needleW      = large ? "4px"   : "3px";
    const needleH      = large ? "25px"  : "17px";
    const needleOrigin = large ? "50% 50px" : "50% 34px";
    const bodyShadow   = large
        ? "inset 0 2px 3px rgba(255,255,255,.06),inset 0 -8px 16px rgba(0,0,0,.6),0 10px 22px -8px rgba(0,0,0,.85)"
        : "inset 0 2px 3px rgba(255,255,255,.06),inset 0 -6px 12px rgba(0,0,0,.6),0 8px 16px -6px rgba(0,0,0,.85)";

    // Arc color: #84e80c = HSL(87°, 90%, 48%). Hue and saturation fixed throughout.
    // Lightness stays at 48% (full neon) across the middle range; only dims slightly
    // in the last 25% of travel (|dB| > 9 dB) to acknowledge the extreme.
    const arcT           = Math.min(1, Math.abs(defaultValue) / 12);
    const edgeT          = Math.max(0, (arcT - 0.75) / 0.25);
    const arcL           = 48 - 8 * edgeT;
    const arcStroke      = `hsl(87,90%,${arcL.toFixed(1)}%)`;
    const arcGlowOpacity = (0.20 + 0.30 * arcT).toFixed(2);

    // dB readout: "0.0 dB", "+2.4 dB", "-3.6 dB"
    const isZero = Math.abs(defaultValue) < 0.05;
    const dbText = isZero ? "0.0 dB" : `${defaultValue > 0 ? "+" : ""}${defaultValue.toFixed(1)} dB`;

    // Drag: 0.15 dB/px → full 24 dB range over ~160 px of vertical travel
    const handlePointerDown = useCallback((e: React.PointerEvent) => {
        e.preventDefault();
        document.body.style.cursor = "grabbing";
        const startY   = e.clientY;
        const startVal = currentValue.current;
        const move = (ev: PointerEvent) => {
            const nv = Math.max(MIN_DB, Math.min(MAX_DB, startVal + (startY - ev.clientY) * 0.15));
            onChange?.(nv);
        };
        const up = () => {
            document.body.style.cursor = "";
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", up);
        };
        window.addEventListener("pointermove", move);
        window.addEventListener("pointerup", up);
    }, [onChange]);

    const handleDoubleClick = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        onChange?.(resetTarget.current);
    }, [onChange]);

    return (
        <div style={{ textAlign: "center" }}>
            <div
                onPointerDown={handlePointerDown}
                onDoubleClick={handleDoubleClick}
                style={{ position: "relative", width: svgSize, height: svgSize, cursor: "pointer", touchAction: "none", userSelect: "none" }}
            >
                <svg
                    width={svgSize} height={svgSize}
                    viewBox={`0 0 ${svgSize} ${svgSize}`}
                    style={{ position: "absolute", inset: 0 }}
                >
                    {/* Active fill — extends from 12 o'clock toward current value */}
                    <circle cx={cx} cy={cx} r={r} fill="none"
                        stroke={arcStroke} strokeWidth={sw} strokeLinecap="butt"
                        strokeDasharray={activeDash} transform={`rotate(135 ${cx} ${cx})`}
                        style={{ filter: `drop-shadow(0 0 5px rgba(132,232,12,${arcGlowOpacity}))` }}
                    />
                    {/* Tick marks */}
                    {ticks.map(({ db, kind, x1, y1, x2, y2 }) => (
                        <line key={db}
                            x1={x1.toFixed(2)} y1={y1.toFixed(2)}
                            x2={x2.toFixed(2)} y2={y2.toFixed(2)}
                            stroke={
                                kind === "zero"  ? "rgba(255,255,255,.42)" :
                                kind === "major" ? "rgba(255,255,255,.18)" :
                                                   "rgba(255,255,255,.09)"
                            }
                            strokeWidth={kind === "zero" ? 1.5 : 1}
                            strokeLinecap="round"
                        />
                    ))}
                </svg>

                {/* Knob body */}
                <div style={{
                    position: "absolute", left: "50%", top: "50%",
                    width: bodySize, height: bodySize,
                    marginLeft: -(bodySize / 2), marginTop: -(bodySize / 2),
                    borderRadius: "50%",
                    background: "radial-gradient(circle at 36% 30%,#34363d 0%,#1a1b1f 62%,#141519 100%)",
                    border: "1px solid rgba(0,0,0,.55)", boxShadow: bodyShadow,
                }} />

                {/* Needle */}
                <div style={{
                    position: "absolute",
                    left: needleLeft, top: needleTop,
                    width: needleW, height: needleH,
                    borderRadius: "2px", background: ACCENT,
                    boxShadow: "0 0 12px rgba(132,232,12,.8)",
                    transformOrigin: needleOrigin,
                    transform: `rotate(${rotation}deg)`,
                }} />
            </div>

            {/* Knob name */}
            <div style={{ fontSize: "10px", letterSpacing: ".18em", textTransform: "uppercase", color: "#7d7d85", fontWeight: 600, marginTop: "8px" }}>
                {label}
            </div>
            {/* dB readout */}
            <div style={{ fontSize: "10px", color: isZero ? "#5d5d65" : ACCENT, marginTop: "3px", fontFamily: "'JetBrains Mono', monospace" }}>
                {dbText}
            </div>
        </div>
    );
}
