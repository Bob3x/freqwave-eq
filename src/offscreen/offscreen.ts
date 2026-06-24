import type {
    EngineStoppedMsg,
    OffscreenReadyMsg,
    SwToOffscreenMessage,
} from "../messages/types";

// ---------------------------------------------------------------------------
// Band configuration (locked per CLAUDE.md)
// ---------------------------------------------------------------------------

const BANDS: { frequency: number; type: BiquadFilterType }[] = [
    { frequency: 32,   type: "lowshelf" },
    { frequency: 64,   type: "peaking"  },
    { frequency: 125,  type: "peaking"  },
    { frequency: 250,  type: "peaking"  },
    { frequency: 500,  type: "peaking"  },
    { frequency: 1000, type: "peaking"  },
    { frequency: 4000, type: "peaking"  },
    { frequency: 8000, type: "highshelf"},
];
const PEAKING_Q = 1.41;

// ---------------------------------------------------------------------------
// AudioContext + output element — one per offscreen doc lifetime
// ---------------------------------------------------------------------------

const audioCtx = new AudioContext();

// ---------------------------------------------------------------------------
// Graph nodes — null when engine is idle (torn down)
// ---------------------------------------------------------------------------

let activeStream: MediaStream | null = null;
let source:       MediaStreamAudioSourceNode | null = null;
let preAmp:       GainNode | null = null;
let filters:      BiquadFilterNode[] = [];
let compressor:   DynamicsCompressorNode | null = null;
let masterGain:   GainNode | null = null;
let analyser:     AnalyserNode | null = null;
let bypassed = false;

// Values received before the graph exists — applied in buildGraph.
// This handles the race where STATE_CHANGED reaches the popup before getUserMedia
// resolves, causing SET_* messages to arrive while nodes are still null.
let pendingMasterDb: number | null = null;
let pendingPreampDb: number | null = null;
const pendingBandDb: (number | null)[] = Array(8).fill(null);
let pendingCompressorEnabled: boolean | null = null;

// ---------------------------------------------------------------------------
// Build / tear down
// ---------------------------------------------------------------------------

function buildGraph(stream: MediaStream) {
    activeStream = stream;
    source     = audioCtx.createMediaStreamSource(stream);
    preAmp     = audioCtx.createGain();
    masterGain = audioCtx.createGain();
    analyser   = audioCtx.createAnalyser();

    analyser.fftSize = 2048;

    filters = BANDS.map(({ frequency, type }) => {
        const f = audioCtx.createBiquadFilter();
        f.type = type;
        f.frequency.value = frequency;
        f.gain.value = 0;
        if (type === "peaking") f.Q.value = PEAKING_Q;
        return f;
    });

    compressor = audioCtx.createDynamicsCompressor();
    // No-op defaults — passes audio unmodified until LEVELER mode activates it
    compressor.threshold.value = 0;
    compressor.ratio.value     = 1;
    compressor.knee.value      = 0;
    compressor.attack.value    = 0.003;
    compressor.release.value   = 0.25;

    // Wire: source → preAmp → filters[0..7] → compressor → masterGain → analyser → destination
    source.connect(preAmp);
    filters.reduce<AudioNode>((prev, f) => { prev.connect(f); return f; }, preAmp);
    filters[filters.length - 1].connect(compressor);
    compressor.connect(masterGain);
    masterGain.connect(analyser);
    analyser.connect(audioCtx.destination);

    // Apply any values that arrived before the graph was ready
    if (pendingPreampDb !== null) { preAmp.gain.value = dbToGain(pendingPreampDb); pendingPreampDb = null; }
    if (pendingMasterDb !== null) { masterGain.gain.value = dbToGain(pendingMasterDb); pendingMasterDb = null; }
    pendingBandDb.forEach((db, i) => { if (db !== null) { filters[i].gain.value = db; pendingBandDb[i] = null; } });
    if (pendingCompressorEnabled !== null) { applyCompressor(compressor, pendingCompressorEnabled); pendingCompressorEnabled = null; }

    // Detect stream end (captured tab closed / navigated away).
    const track = stream.getAudioTracks()[0];
    if (track) {
        track.addEventListener("ended", onStreamEnded, { once: true });
    }

    if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(console.error);
    }
}

function teardownGraph() {
    // Stop the MediaStream tracks first — this releases the tabCapture stream
    // so Chrome allows a new capture on the same tab next time.
    activeStream?.getAudioTracks().forEach(t => t.stop());
    activeStream = null;

    try { source?.disconnect(); } catch { /* already disconnected */ }
    try { preAmp?.disconnect(); } catch { /* already disconnected */ }
    filters.forEach(f => { try { f.disconnect(); } catch { /* ok */ } });
    try { compressor?.disconnect(); } catch { /* already disconnected */ }
    try { masterGain?.disconnect(); } catch { /* already disconnected */ }
    try { analyser?.disconnect(); } catch { /* already disconnected */ }

    source = preAmp = compressor = masterGain = analyser = null;
    filters = [];
}

function onStreamEnded() {
    teardownGraph();
    const msg: EngineStoppedMsg = { kind: "ENGINE_STOPPED" };
    chrome.runtime.sendMessage(msg).catch(() => { /* SW may be sleeping */ });
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener((message: SwToOffscreenMessage) => {
    switch (message.kind) {
        case "INIT_CAPTURE": {
            const { streamId } = message;
            navigator.mediaDevices
                .getUserMedia({
                    audio: {
                        // @ts-expect-error — Chrome-specific constraint not in TS lib
                        mandatory: {
                            chromeMediaSource: "tab",
                            chromeMediaSourceId: streamId,
                        },
                    },
                    video: false,
                })
                .then((stream) => {
                    teardownGraph(); // clean up any previous graph
                    buildGraph(stream);
                })
                .catch((err) => {
                    console.error("[Offscreen] getUserMedia failed:", err);
                    const msg: EngineStoppedMsg = { kind: "ENGINE_STOPPED" };
                    chrome.runtime.sendMessage(msg).catch(() => { /* ok */ });
                });
            return false;
        }

        case "TEARDOWN_CAPTURE":
            teardownGraph();
            pendingMasterDb = null;
            pendingPreampDb = null;
            pendingBandDb.fill(null);
            pendingCompressorEnabled = null;
            return false;

        case "SET_BAND_GAIN": {
            const f = filters[message.bandIndex];
            if (f) f.gain.value = message.gainDb;
            else pendingBandDb[message.bandIndex] = message.gainDb;
            return false;
        }

        case "SET_PREAMP_GAIN":
            if (preAmp) preAmp.gain.value = dbToGain(message.gainDb);
            else pendingPreampDb = message.gainDb;
            return false;

        case "SET_MASTER_GAIN":
            if (masterGain) masterGain.gain.value = dbToGain(message.gainDb);
            else pendingMasterDb = message.gainDb;
            return false;

        case "SET_BYPASS":
            bypassed = message.bypassed;
            if (masterGain) {
                // Bypass by muting master gain — graph stays connected
                masterGain.gain.value = bypassed ? 0 : 1;
            }
            return false;

        case "SET_COMPRESSOR":
            if (compressor) applyCompressor(compressor, message.enabled);
            else pendingCompressorEnabled = message.enabled;
            return false;

        default:
            return false;
    }
});

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function dbToGain(db: number): number {
    return Math.pow(10, db / 20);
}

function applyCompressor(node: DynamicsCompressorNode, enabled: boolean): void {
    if (enabled) {
        node.threshold.value = -24;
        node.ratio.value     =   4;
        node.knee.value      =  30;
        node.attack.value    =  0.01;
        node.release.value   =  0.15;
    } else {
        // No-op: threshold at 0 dBFS is never crossed, ratio 1:1 = no gain reduction
        node.threshold.value =   0;
        node.ratio.value     =   1;
        node.knee.value      =   0;
        node.attack.value    =   0.003;
        node.release.value   =   0.25;
    }
}

// ---------------------------------------------------------------------------
// Signal readiness
// ---------------------------------------------------------------------------

const readyMsg: OffscreenReadyMsg = { kind: "OFFSCREEN_READY" };
chrome.runtime.sendMessage(readyMsg);
