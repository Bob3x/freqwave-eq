import { useCallback, useEffect, useRef, useState } from "react";
import type {
    EngineState,
    QueryStateMsg,
    SetBandGainMsg,
    SetCompressorMsg,
    SetMasterGainMsg,
    SetPreampGainMsg,
    StartCaptureMsg,
    StateChangedMsg,
    StopCaptureMsg
} from "../../messages/types";
import {
    DEFAULT_SETTINGS,
    loadSettings,
    normalizeSettings,
    saveSettings,
    STORAGE_KEY,
    STANDARD_PRESETS,
    type FreqWaveSettings,
    type PresetName
} from "../../shared/settings";
import { BandFader } from "./BandFader";
import { Knob } from "./Knob";
import { Spectrum } from "./Spectrum";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function truncateMiddle(str: string, max = 26): string {
    if (str.length <= max) return str;
    const keep = max - 1; // chars excluding the ellipsis
    const tail = Math.floor(keep * 0.4);
    const head = keep - tail;
    return str.slice(0, head) + "…" + str.slice(str.length - tail);
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACCENT = "var(--accent, #84e80c)";

const FREQS = ["32Hz", "64Hz", "125Hz", "250Hz", "500Hz", "1kHz", "4kHz", "8kHz"] as const;

const PRESETS = {
    OFF: [0, 0, 0, 0, 0, 0, 0, 0],
    DIALOGUE: [-3, -2, 0, 2, 3, 4, 2, 0],
    LEVELER: [1, 1, 1, 0, 0, 1, 1, 1],
    CLARITY: [-1, 0, 1, 2, 3, 5, 6, 4]
} as const;

const PRESET_ORDER: PresetName[] = ["OFF", "DIALOGUE", "LEVELER", "CLARITY"];

// ---------------------------------------------------------------------------
// Message senders — knobs emit dB directly, no intermediate mapping
// ---------------------------------------------------------------------------

function getChromeStorageSync() {
    return globalThis.chrome?.storage?.sync;
}

function sendRuntimeMessage<TResponse = unknown>(
    msg: unknown,
    callback?: (response: TResponse | undefined) => void
) {
    const runtime = globalThis.chrome?.runtime;
    if (!runtime?.sendMessage) return;

    try {
        const result = runtime.sendMessage(msg as never, callback as never);
        if (result && typeof (result as Promise<unknown>).catch === "function") {
            (result as Promise<unknown>).catch(() => {
                /* ignore */
            });
        }
    } catch {
        /* ignore */
    }
}

function sendMasterGain(db: number) {
    const msg: SetMasterGainMsg = { kind: "SET_MASTER_GAIN", gainDb: db };
    sendRuntimeMessage(msg);
}

function sendPreampGain(db: number) {
    const msg: SetPreampGainMsg = { kind: "SET_PREAMP_GAIN", gainDb: db };
    sendRuntimeMessage(msg);
}

function sendBandGain(bandIndex: number, gainDb: number) {
    const msg: SetBandGainMsg = { kind: "SET_BAND_GAIN", bandIndex, gainDb };
    sendRuntimeMessage(msg);
}

function sendCompressor(enabled: boolean) {
    const msg: SetCompressorMsg = { kind: "SET_COMPRESSOR", enabled };
    sendRuntimeMessage(msg);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FreqWavePopup() {
    // Engine state — not persisted (capture auto-stops on Chrome restart)
    const [engineState, setEngineState] = useState<EngineState>("idle");
    const [capturedHostname, setCapturedHostname] = useState<string | null>(null);
    const [statusError, setStatusError] = useState<string | null>(null);

    // EQ settings — null while loading from storage (avoids flash of wrong defaults)
    const [settings, setSettings] = useState<FreqWaveSettings | null>(() =>
        getChromeStorageSync() ? null : DEFAULT_SETTINGS
    );

    // Storage persistence refs
    const settingsLoadedRef = useRef(false); // skip write-back on the initial load
    const latestSettings = useRef<FreqWaveSettings | null>(null); // for flush-on-close

    // ── Load settings from chrome.storage.sync on mount ──────────────────────
    useEffect(() => {
        const storage = getChromeStorageSync();
        if (!storage) return;

        storage.get(STORAGE_KEY, (result) => {
            loadSettings()
                .then(setSettings)
                .catch(() => setSettings(DEFAULT_SETTINGS));
        });
    }, []);

    // ── Persist settings on change (debounced 300 ms) ────────────────────────
    useEffect(() => {
        if (settings === null) return;
        latestSettings.current = settings;
        if (!settingsLoadedRef.current) {
            // First fire = initial load; mark loaded but don't write back
            settingsLoadedRef.current = true;
            return;
        }

        const timer = setTimeout(() => {
            saveSettings(settings);
        }, 300);

        return () => clearTimeout(timer);
    }, [settings]);

    // ── Flush immediately when popup window closes ────────────────────────────
    useEffect(() => {
        const flush = () => {
            if (document.visibilityState === "hidden" && latestSettings.current !== null) {
                saveSettings(latestSettings.current);
            }
        };
        document.addEventListener("visibilitychange", flush);
        return () => document.removeEventListener("visibilitychange", flush);
    }, []);

    // ── Engine state sync on mount ────────────────────────────────────────────
    useEffect(() => {
        const msg: QueryStateMsg = { kind: "QUERY_STATE" };
        sendRuntimeMessage<{ state: EngineState; capturedHostname: string | null }>(msg, (res) => {
            if (res) {
                setEngineState(res.state);
                setCapturedHostname(res.capturedHostname);
            }
        });
    }, []);

    // ── Stay in sync while popup is open ─────────────────────────────────────
    useEffect(() => {
        const listener = (message: unknown) => {
            const msg = message as StateChangedMsg;
            if (msg?.kind === "STATE_CHANGED") {
                setEngineState(msg.state);
                setCapturedHostname(msg.capturedHostname);
            }
        };
        const runtime = globalThis.chrome?.runtime;
        runtime?.onMessage?.addListener(listener);
        return () => runtime?.onMessage?.removeListener(listener);
    }, []);

    // ── Re-sync EQ to the audio graph whenever the engine (re-)activates ─────
    // The offscreen graph is rebuilt fresh on every INIT_CAPTURE, so gains reset
    // to Web Audio defaults. Push current settings whenever we enter "active".
    const prevEngineState = useRef<EngineState>("idle");
    useEffect(() => {
        if (engineState === "active" && prevEngineState.current !== "active") {
            const s = latestSettings.current;
            if (s !== null) {
                sendMasterGain(s.master);
                sendPreampGain(s.preamp);
                s.bands.forEach((db, i) => sendBandGain(i, db));
                sendCompressor(s.compressorEnabled);
            }
        }
        prevEngineState.current = engineState;
    }, [engineState]);

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleBadgeClick = useCallback(() => {
        if (engineState === "starting") return;
        if (engineState === "active") {
            const msg: StopCaptureMsg = { kind: "STOP_CAPTURE" };
            sendRuntimeMessage(msg);
        } else {
            const msg: StartCaptureMsg = { kind: "START_CAPTURE" };
            sendRuntimeMessage<{ ok?: boolean; error?: string }>(msg, (res) => {
                if (res && !res.ok) {
                    setStatusError(res.error as string);
                    setTimeout(() => setStatusError(null), 4000);
                }
            });
        }
    }, [engineState]);

    const applyPreset = useCallback((name: PresetName) => {
        const values = [...PRESETS[name]] as number[];
        setSettings((s) => ({
            ...(s ?? DEFAULT_SETTINGS),
            bands: values,
            preset: name,
            eqPreset: s?.eqPreset ?? DEFAULT_SETTINGS.eqPreset,
            compressorEnabled: name === "LEVELER" ? true : (s?.compressorEnabled ?? false)
        }));
        values.forEach((db, i) => sendBandGain(i, db));
        if (name === "LEVELER") sendCompressor(true);
    }, []);

    const handleZeroEQ = useCallback(() => {
        const zeros = [0, 0, 0, 0, 0, 0, 0, 0];
        setSettings(() => ({
            master: 0,
            preamp: 0,
            bands: zeros,
            preset: "OFF",
            eqPreset: "FLAT",
            compressorEnabled: false
        }));
        zeros.forEach((_, i) => sendBandGain(i, 0));
        sendMasterGain(0);
        sendPreampGain(0);
        sendCompressor(false);
    }, []);

    const handleMasterChange = useCallback((db: number) => {
        setSettings((s) => ({ ...(s ?? DEFAULT_SETTINGS), master: db }));
        sendMasterGain(db);
    }, []);

    const handlePreampChange = useCallback((db: number) => {
        setSettings((s) => ({ ...(s ?? DEFAULT_SETTINGS), preamp: db }));
        sendPreampGain(db);
    }, []);

    const handleBandChange = useCallback((i: number, db: number) => {
        setSettings((s) => {
            const newBands = [...(s?.bands ?? DEFAULT_SETTINGS.bands)];
            newBands[i] = db;
            return { ...(s ?? DEFAULT_SETTINGS), bands: newBands, preset: null, eqPreset: null };
        });
        sendBandGain(i, db);
    }, []);

    const handleStandardPresetChange = useCallback(
        (event: React.ChangeEvent<HTMLSelectElement>) => {
            const name = event.target.value as FreqWaveSettings["eqPreset"];
            const selected = STANDARD_PRESETS.find((preset) => preset.name === name);
            if (!selected) return;

            const values = [...selected.bands];
            setSettings((s) => ({
                ...(s ?? DEFAULT_SETTINGS),
                bands: values,
                eqPreset: selected.name
            }));
            values.forEach((db, i) => sendBandGain(i, db));
        },
        []
    );

    const compressorEnabled = settings?.compressorEnabled ?? false;

    const handleCompressorToggle = useCallback(() => {
        const enabled = !compressorEnabled;
        sendCompressor(enabled);
        setSettings((s) => {
            return { ...(s ?? DEFAULT_SETTINGS), compressorEnabled: enabled };
        });
    }, [compressorEnabled]);

    // ── Guard: don't render until settings are loaded from storage ────────────
    if (settings === null) return null;

    const { master, preamp, bands, preset, eqPreset } = settings;

    // ---------------------------------------------------------------------------
    // Badge visuals
    // ---------------------------------------------------------------------------

    const engineColor =
        engineState === "active" ? ACCENT : engineState === "starting" ? "#f59e0b" : "#6a6a72";

    const engineGlow =
        engineState === "active"
            ? "rgba(132,232,12,.9)"
            : engineState === "starting"
              ? "rgba(245,158,11,.8)"
              : "rgba(0,0,0,0)";

    const engineLabel =
        engineState === "active"
            ? "Engine On"
            : engineState === "starting"
              ? "Starting…"
              : "Engine Off";

    const dotPulse = engineState !== "idle" ? "pulse 1.5s ease-in-out infinite" : "none";

    // ---------------------------------------------------------------------------
    // Preset pill position
    // ---------------------------------------------------------------------------

    const presetIdx = PRESET_ORDER.indexOf(preset ?? "OFF");

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------

    return (
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                flexDirection: "column",
                padding: "20px",
                background: "linear-gradient(165deg,#1d1e23 0%,#131418 100%)",
                fontFamily: "'Archivo', sans-serif",
                boxSizing: "border-box",
                overflow: "hidden"
            }}>
            {/* ── HEADER ── */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "12px"
                }}>
                {/* Logo */}
                <div
                    style={{
                        display: "flex",
                        alignItems: "baseline",
                        gap: "1px",
                        fontWeight: 800,
                        fontSize: "22px",
                        letterSpacing: "-.02em"
                    }}>
                    <span style={{ color: "#f3f3f5" }}>Freq</span>
                    <span style={{ color: ACCENT }}>Wave</span>
                    <span
                        style={{
                            color: "#7d7d85",
                            fontWeight: 500,
                            marginLeft: "7px",
                            fontSize: "18px"
                        }}>
                        EQ
                    </span>
                </div>

                {/* Engine badge + meta */}
                <div
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: "4px"
                    }}>
                    <div
                        onClick={handleBadgeClick}
                        style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "8px 14px",
                            borderRadius: "999px",
                            cursor: engineState === "starting" ? "default" : "pointer",
                            userSelect: "none",
                            background: "#141518",
                            border: "1px solid rgba(255,255,255,.08)",
                            boxShadow: "inset 0 1px 0 rgba(255,255,255,.04)"
                        }}>
                        <span
                            style={{
                                width: "8px",
                                height: "8px",
                                borderRadius: "50%",
                                background: engineColor,
                                boxShadow: `0 0 10px ${engineGlow}`,
                                animation: dotPulse,
                                display: "inline-block"
                            }}
                        />
                        <span
                            style={{
                                fontSize: "11px",
                                letterSpacing: ".14em",
                                textTransform: "uppercase",
                                fontWeight: 600,
                                color: engineColor,
                                transition: "color .2s"
                            }}>
                            {engineLabel}
                        </span>
                    </div>

                    <span
                        title={capturedHostname ?? undefined}
                        style={{
                            fontSize: "9px",
                            color: "#5d5d65",
                            fontFamily: "'JetBrains Mono', monospace",
                            paddingRight: "2px",
                            visibility:
                                engineState === "active" && capturedHostname ? "visible" : "hidden",
                            maxWidth: "190px",
                            overflow: "hidden",
                            whiteSpace: "nowrap",
                            display: "inline-block"
                        }}>
                        {capturedHostname
                            ? `Capturing: ${truncateMiddle(capturedHostname)}`
                            : "Capturing: –"}
                    </span>
                    {statusError && (
                        <span
                            style={{
                                fontSize: "9px",
                                color: "#f87171",
                                fontFamily: "'JetBrains Mono', monospace",
                                maxWidth: "220px",
                                textAlign: "right",
                                lineHeight: 1.3
                            }}>
                            {statusError}
                        </span>
                    )}
                </div>
            </div>

            {/* ── CONTROLS ROW ── */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: "16px",
                    marginBottom: "8px"
                }}>
                {/* Knobs */}
                <div
                    style={{
                        display: "flex",
                        gap: "18px",
                        alignItems: "flex-start",
                        flexShrink: 0
                    }}>
                    <Knob
                        label="Master Volume"
                        size="large"
                        defaultValue={master}
                        onChange={handleMasterChange}
                    />
                    <div style={{ paddingTop: "18px" }}>
                        <Knob
                            label="Pre-Amp"
                            size="small"
                            defaultValue={preamp}
                            onChange={handlePreampChange}
                        />
                    </div>
                </div>

                {/* Voice Enhancer presets */}
                <div style={{ flex: 1, textAlign: "right" }}>
                    <div style={{ marginBottom: "8px" }}>
                        <label
                            htmlFor="standard-preset"
                            style={{
                                display: "block",
                                fontSize: "11px",
                                fontWeight: 500,
                                color: "#5d5d65",
                                letterSpacing: ".08em",
                                textTransform: "uppercase"
                            }}>
                            EQ Presets
                        </label>
                        <select
                            id="standard-preset"
                            value={eqPreset ?? ""}
                            onChange={handleStandardPresetChange}
                            style={{
                                marginTop: "6px",
                                maxWidth: "150px",
                                padding: "5px 8px",
                                borderRadius: "7px",
                                border: "1px solid rgba(255,255,255,.1)",
                                background: "#16171b",
                                color: eqPreset ? "#d7d7dc" : "#6a6a72",
                                fontFamily: "'Archivo', sans-serif",
                                fontSize: "11px",
                                cursor: "pointer"
                            }}>
                            <option value="" disabled>
                                Select preset
                            </option>
                            {STANDARD_PRESETS.map((standardPreset) => (
                                <option key={standardPreset.name} value={standardPreset.name}>
                                    {standardPreset.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div
                        style={{
                            fontSize: "11px",
                            fontWeight: 500,
                            color: "#5d5d65",
                            letterSpacing: ".08em",
                            textTransform: "uppercase"
                        }}>
                        Voice Enhancer
                    </div>
                    {/* Mode buttons */}
                    <div
                        style={{
                            display: "flex",
                            gap: "2px",
                            marginTop: "6px",
                            justifyContent: "flex-end"
                        }}>
                        {PRESET_ORDER.map((name, i) => (
                            <button
                                key={name}
                                onClick={() => applyPreset(name)}
                                style={{
                                    border: "none",
                                    background: "none",
                                    cursor: "pointer",
                                    padding: "5px 7px",
                                    fontFamily: "'Archivo', sans-serif",
                                    fontSize: "11px",
                                    fontWeight: presetIdx === i ? 700 : 500,
                                    letterSpacing: ".07em",
                                    textTransform: "uppercase",
                                    color: presetIdx === i ? ACCENT : "#4a4a54",
                                    transition: "color .15s"
                                }}>
                                {name.charAt(0) + name.slice(1).toLowerCase()}
                            </button>
                        ))}
                    </div>
                    <button
                        type="button"
                        aria-pressed={compressorEnabled}
                        onClick={handleCompressorToggle}
                        style={{
                            border: `1px solid ${compressorEnabled ? "rgba(132,232,12,.5)" : "rgba(255,255,255,.1)"}`,
                            borderRadius: "999px",
                            background: compressorEnabled ? "rgba(132,232,12,.1)" : "#16171b",
                            color: compressorEnabled ? ACCENT : "#6a6a72",
                            cursor: "pointer",
                            padding: "4px 9px",
                            fontFamily: "'Archivo', sans-serif",
                            fontSize: "9px",
                            fontWeight: 600,
                            letterSpacing: ".08em",
                            textTransform: "uppercase"
                        }}>
                        Compressor {compressorEnabled ? "On" : "Bypass"}
                    </button>
                </div>
            </div>

            {/* ── SPECTRUM ── */}
            <Spectrum bands={bands} engineActive={engineState === "active"} />

            {/* ── EQ BANDS ── */}
            <div
                style={{
                    marginTop: "8px",
                    padding: "12px 18px 10px",
                    borderRadius: "14px",
                    background: "#0f1012",
                    border: "1px solid rgba(255,255,255,.06)",
                    boxShadow: "inset 0 2px 6px rgba(0,0,0,.5)"
                }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                    {FREQS.map((freq, i) => (
                        <BandFader
                            key={freq}
                            freq={freq}
                            value={bands[i]}
                            onChange={(db) => handleBandChange(i, db)}
                        />
                    ))}
                </div>
            </div>

            {/* ── FOOTER ── */}
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: "10px"
                }}>
                <div
                    style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: "10px",
                        letterSpacing: ".1em",
                        color: "#44444c"
                    }}>
                    <a
                        href="https://github.com/Bob3x/freqwave-eq"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            color: "inherit",
                            textDecoration: "none",
                            transition: "color .18s"
                        }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLAnchorElement).style.color = "#9a9aaa";
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLAnchorElement).style.color = "inherit";
                        }}>
                        FreqWave EQ
                    </a>
                    <span style={{ margin: "0 8px" }}>v1.0.1</span>
                    <a
                        href="https://www.buymeacoffee.com/borislavginov"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                            margin: "0 80px",
                            color: "inherit",
                            textDecoration: "none",
                            transition: "color .18s"
                        }}
                        onMouseEnter={(e) => {
                            (e.currentTarget as HTMLAnchorElement).style.color = "#9a9aaa";
                        }}
                        onMouseLeave={(e) => {
                            (e.currentTarget as HTMLAnchorElement).style.color = "inherit";
                        }}>
                        Buy me a coffee
                    </a>
                </div>
                <button
                    onClick={handleZeroEQ}
                    style={{
                        fontFamily: "'Archivo', sans-serif",
                        fontSize: "11px",
                        fontWeight: 600,
                        letterSpacing: ".1em",
                        textTransform: "uppercase",
                        color: "#a4a4ac",
                        padding: "8px 16px",
                        borderRadius: "9px",
                        background: "#16171b",
                        border: "1px solid rgba(255,255,255,.1)",
                        cursor: "pointer",
                        transition: "color .18s, border-color .18s, box-shadow .18s"
                    }}
                    onMouseEnter={(e) => {
                        const el = e.currentTarget;
                        el.style.color = ACCENT;
                        el.style.borderColor = "rgba(132,232,12,.5)";
                        el.style.boxShadow = "0 0 16px rgba(132,232,12,.15)";
                    }}
                    onMouseLeave={(e) => {
                        const el = e.currentTarget;
                        el.style.color = "#a4a4ac";
                        el.style.borderColor = "rgba(255,255,255,.1)";
                        el.style.boxShadow = "none";
                    }}>
                    Reset
                </button>
            </div>

            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}`}</style>
        </div>
    );
}
