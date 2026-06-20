import { useCallback, useEffect, useState } from "react";
import type {
    EngineState,
    QueryStateMsg,
    SetBandGainMsg,
    SetMasterGainMsg,
    SetPreampGainMsg,
    StartCaptureMsg,
    StateChangedMsg,
    StopCaptureMsg,
} from "../../messages/types";
import { BandFader } from "./BandFader";
import { Knob } from "./Knob";
import { Spectrum } from "./Spectrum";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCENT = "var(--accent, #a9e80c)";

const FREQS = ["32Hz", "64Hz", "125Hz", "250Hz", "500Hz", "1kHz", "4kHz", "8kHz"] as const;

const PRESETS = {
    OFF:      [ 0,  0,  0,  0,  0,  0,  0,  0],
    DIALOGUE: [-3, -2,  0,  2,  3,  4,  2,  0],
    LEVELER:  [ 1,  1,  1,  0,  0,  1,  1,  1],
    CLARITY:  [-1,  0,  1,  2,  3,  5,  6,  4],
} as const;
type PresetName = keyof typeof PRESETS;
const PRESET_ORDER: PresetName[] = ["OFF", "DIALOGUE", "LEVELER", "CLARITY"];

// ---------------------------------------------------------------------------
// dB mapping (unchanged from previous wiring)
// ---------------------------------------------------------------------------

function masterPctToDb(pct: number): number { return (pct / 100) * 60 - 60; }
function preampPctToDb(pct: number): number { return (pct / 100) * 36 - 24; }

// ---------------------------------------------------------------------------
// Message senders (module-level — no closure over component state)
// ---------------------------------------------------------------------------

function sendMasterGain(pct: number) {
    const msg: SetMasterGainMsg = { kind: "SET_MASTER_GAIN", gainDb: masterPctToDb(pct) };
    chrome.runtime.sendMessage(msg).catch(() => { /* engine may be idle */ });
}

function sendPreampGain(pct: number) {
    const msg: SetPreampGainMsg = { kind: "SET_PREAMP_GAIN", gainDb: preampPctToDb(pct) };
    chrome.runtime.sendMessage(msg).catch(() => { /* engine may be idle */ });
}

function sendBandGain(bandIndex: number, gainDb: number) {
    const msg: SetBandGainMsg = { kind: "SET_BAND_GAIN", bandIndex, gainDb };
    chrome.runtime.sendMessage(msg).catch(() => { /* engine may be idle */ });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FreqWavePopup() {
    // Engine state (existing wiring — unchanged)
    const [engineState, setEngineState]       = useState<EngineState>("idle");
    const [capturedHostname, setCapturedHostname] = useState<string | null>(null);
    const [statusError, setStatusError]       = useState<string | null>(null);

    // Control state (new)
    const [master, setMaster] = useState(65);
    const [preamp, setPreamp] = useState(40);
    const [bands,  setBands]  = useState<number[]>([0, 0, 0, 0, 0, 0, 0, 0]);
    const [preset, setPreset] = useState<PresetName | null>(null);

    // Sync engine state on mount
    useEffect(() => {
        const msg: QueryStateMsg = { kind: "QUERY_STATE" };
        chrome.runtime.sendMessage(msg, (res) => {
            if (res) {
                setEngineState(res.state);
                setCapturedHostname(res.capturedHostname);
            }
        });
    }, []);

    // Stay in sync while popup is open
    useEffect(() => {
        const listener = (message: unknown) => {
            const msg = message as StateChangedMsg;
            if (msg?.kind === "STATE_CHANGED") {
                setEngineState(msg.state);
                setCapturedHostname(msg.capturedHostname);
            }
        };
        chrome.runtime.onMessage.addListener(listener);
        return () => chrome.runtime.onMessage.removeListener(listener);
    }, []);

    // Badge click — unchanged logic
    const handleBadgeClick = useCallback(() => {
        if (engineState === "starting") return;
        if (engineState === "active") {
            const msg: StopCaptureMsg = { kind: "STOP_CAPTURE" };
            chrome.runtime.sendMessage(msg).catch(() => { /* ok */ });
        } else {
            const msg: StartCaptureMsg = { kind: "START_CAPTURE" };
            chrome.runtime.sendMessage(msg, (res) => {
                if (res && !res.ok) {
                    setStatusError(res.error as string);
                    setTimeout(() => setStatusError(null), 4000);
                }
            });
        }
    }, [engineState]);

    // Preset apply — sets all 8 bands and sends messages
    const applyPreset = useCallback((name: PresetName) => {
        const values = [...PRESETS[name]];
        setBands(values);
        setPreset(name);
        values.forEach((db, i) => sendBandGain(i, db));
    }, []);

    // Zero EQ — flattens all bands + resets knobs to initial positions
    const handleZeroEQ = useCallback(() => {
        const zeros = [0, 0, 0, 0, 0, 0, 0, 0];
        setBands(zeros);
        setPreset("OFF");
        zeros.forEach((_, i) => sendBandGain(i, 0));
        setMaster(65);
        setPreamp(40);
        sendMasterGain(65);
        sendPreampGain(40);
    }, []);

    // Band change from fader
    const handleBandChange = useCallback((i: number, db: number) => {
        setBands(prev => { const n = [...prev]; n[i] = db; return n; });
        setPreset(null);
        sendBandGain(i, db);
    }, []);

    // ---------------------------------------------------------------------------
    // Badge visuals
    // ---------------------------------------------------------------------------

    const engineColor = engineState === "active"
        ? ACCENT
        : engineState === "starting"
        ? "#f59e0b"
        : "#6a6a72";

    const engineGlow = engineState === "active"
        ? "rgba(169,232,12,.9)"
        : engineState === "starting"
        ? "rgba(245,158,11,.8)"
        : "rgba(0,0,0,0)";

    const engineLabel = engineState === "active"
        ? "Engine Active"
        : engineState === "starting"
        ? "Starting…"
        : "Engine Off";

    const dotPulse = engineState !== "idle"
        ? "pulse 1.5s ease-in-out infinite"
        : "none";

    // ---------------------------------------------------------------------------
    // Preset pill position
    // ---------------------------------------------------------------------------

    const presetIdx = PRESET_ORDER.indexOf(preset ?? "OFF");
    const pillTx    = `${(presetIdx < 0 ? 0 : presetIdx) * 100}%`;

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------

    return (
        <div style={{
            width: "100%", height: "100%",
            display: "flex", flexDirection: "column",
            padding: "20px",
            background: "linear-gradient(165deg,#1d1e23 0%,#131418 100%)",
            fontFamily: "'Archivo', sans-serif",
            boxSizing: "border-box",
            overflow: "hidden",
        }}>
            {/* ── HEADER ── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
                {/* Logo */}
                <div style={{ display: "flex", alignItems: "baseline", gap: "1px", fontWeight: 800, fontSize: "22px", letterSpacing: "-.02em" }}>
                    <span style={{ color: "#f3f3f5" }}>Freq</span>
                    <span style={{ color: ACCENT }}>Wave</span>
                    <span style={{ color: "#7d7d85", fontWeight: 500, marginLeft: "7px", fontSize: "18px" }}>EQ</span>
                </div>

                {/* Engine badge + meta */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px" }}>
                    <div
                        onClick={handleBadgeClick}
                        style={{
                            display: "inline-flex", alignItems: "center", gap: "8px",
                            padding: "8px 14px", borderRadius: "999px",
                            cursor: engineState === "starting" ? "default" : "pointer",
                            userSelect: "none",
                            background: "#141518",
                            border: "1px solid rgba(255,255,255,.08)",
                            boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)",
                        }}
                    >
                        <span style={{
                            width: "8px", height: "8px", borderRadius: "50%",
                            background: engineColor,
                            boxShadow: `0 0 10px ${engineGlow}`,
                            animation: dotPulse,
                            display: "inline-block",
                        }} />
                        <span style={{
                            fontSize: "11px", letterSpacing: ".14em", textTransform: "uppercase",
                            fontWeight: 600, color: engineColor, transition: "color .2s",
                        }}>
                            {engineLabel}
                        </span>
                    </div>

                    {engineState === "active" && capturedHostname && (
                        <span style={{ fontSize: "9px", color: "#5d5d65", fontFamily: "'JetBrains Mono', monospace", paddingRight: "2px" }}>
                            Capturing: {capturedHostname}
                        </span>
                    )}
                    {statusError && (
                        <span style={{ fontSize: "9px", color: "#f87171", fontFamily: "'JetBrains Mono', monospace", maxWidth: "220px", textAlign: "right", lineHeight: 1.3 }}>
                            {statusError}
                        </span>
                    )}
                </div>
            </div>

            {/* ── CONTROLS ROW ── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "16px", marginBottom: "12px" }}>

                {/* Knobs */}
                <div style={{ display: "flex", gap: "18px", alignItems: "flex-start", flexShrink: 0 }}>
                    <Knob
                        label="Master Volume" subLabel="DB GAIN"
                        size="large" defaultValue={master}
                        onChange={v => { setMaster(v); sendMasterGain(v); }}
                    />
                    <div style={{ paddingTop: "18px" }}>
                        <Knob
                            label="Pre-Amp" subLabel="DB BOOST"
                            size="small" defaultValue={preamp}
                            onChange={v => { setPreamp(v); sendPreampGain(v); }}
                        />
                    </div>
                </div>

                {/* Voice Enhancer presets */}
                <div style={{ flex: 1, textAlign: "right" }}>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#e8e8ec", letterSpacing: "-.01em" }}>
                        Voice Enhancer
                    </div>
                    <div style={{
                        fontSize: "9px", letterSpacing: ".14em", textTransform: "uppercase",
                        color: "#5d5d65", marginTop: "3px", fontWeight: 600,
                        fontFamily: "'JetBrains Mono', monospace",
                    }}>
                        DSP Algorithmic Presets
                    </div>

                    {/* Pill selector */}
                    <div style={{
                        position: "relative", display: "flex",
                        marginTop: "12px", padding: "4px",
                        borderRadius: "12px",
                        background: "#0f1012",
                        border: "1px solid rgba(255,255,255,.06)",
                        boxShadow: "inset 0 2px 5px rgba(0,0,0,.5)",
                    }}>
                        {/* Sliding pill */}
                        <div style={{
                            position: "absolute", top: "4px", left: "4px", bottom: "4px",
                            width: "calc((100% - 8px) / 4)",
                            borderRadius: "8px",
                            background: "rgba(169,232,12,.12)",
                            border: "1px solid rgba(169,232,12,.45)",
                            boxShadow: "0 0 14px rgba(169,232,12,.18)",
                            transition: "transform .28s cubic-bezier(.4,0,.2,1)",
                            transform: `translateX(${pillTx})`,
                            pointerEvents: "none",
                        }} />
                        {PRESET_ORDER.map((name, i) => (
                            <button
                                key={name}
                                onClick={() => applyPreset(name)}
                                style={{
                                    position: "relative", zIndex: 1,
                                    flex: 1, border: "none", background: "none",
                                    cursor: "pointer", padding: "8px 0",
                                    fontFamily: "'Archivo', sans-serif",
                                    fontSize: "10px", fontWeight: 600,
                                    letterSpacing: ".04em", textTransform: "uppercase",
                                    color: presetIdx === i ? ACCENT : "#83838b",
                                    transition: "color .2s",
                                }}
                            >
                                {name.charAt(0) + name.slice(1).toLowerCase()}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── SPECTRUM ── */}
            <Spectrum bands={bands} engineActive={engineState === "active"} />

            {/* ── EQ BANDS ── */}
            <div style={{
                marginTop: "8px", padding: "12px 18px 10px",
                borderRadius: "14px",
                background: "#0f1012",
                border: "1px solid rgba(255,255,255,.06)",
                boxShadow: "inset 0 2px 6px rgba(0,0,0,.5)",
            }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                    {FREQS.map((freq, i) => (
                        <BandFader
                            key={freq}
                            freq={freq}
                            value={bands[i]}
                            onChange={db => handleBandChange(i, db)}
                        />
                    ))}
                </div>
            </div>

            {/* ── FOOTER ── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px" }}>
                <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: "10px", letterSpacing: ".1em", color: "#44444c",
                }}>
                    AUDIO ENHANCEMENT SUITE · V1.0
                </div>
                <button
                    onClick={handleZeroEQ}
                    style={{
                        fontFamily: "'Archivo', sans-serif",
                        fontSize: "11px", fontWeight: 600,
                        letterSpacing: ".1em", textTransform: "uppercase",
                        color: "#a4a4ac", padding: "8px 16px",
                        borderRadius: "9px",
                        background: "#16171b",
                        border: "1px solid rgba(255,255,255,.1)",
                        cursor: "pointer", transition: "color .18s, border-color .18s, box-shadow .18s",
                    }}
                    onMouseEnter={e => {
                        const el = e.currentTarget;
                        el.style.color = ACCENT;
                        el.style.borderColor = "rgba(169,232,12,.5)";
                        el.style.boxShadow = "0 0 16px rgba(169,232,12,.15)";
                    }}
                    onMouseLeave={e => {
                        const el = e.currentTarget;
                        el.style.color = "#a4a4ac";
                        el.style.borderColor = "rgba(255,255,255,.1)";
                        el.style.boxShadow = "none";
                    }}
                >
                    Zero EQ
                </button>
            </div>

            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
        </div>
    );
}
