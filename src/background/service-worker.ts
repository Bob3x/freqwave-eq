/// <reference types="chrome"/>

import type {
    AnyMessage,
    EngineState,
    InitCaptureMsg,
    StateChangedMsg,
    SwToOffscreenMessage,
} from "../messages/types";

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

let engineState: EngineState = "idle";
let capturedTabId: number | null = null;
let capturedHostname: string | null = null;
let capturedWindowId: number | null = null;
let savedWindowState: string | null = null;

// Whether we've ever created the offscreen document this SW lifetime.
// The doc is persistent (not destroyed on STOP), so once true it stays true.
let offscreenDocCreated = false;

// Resolves when the offscreen doc sends OFFSCREEN_READY.
let offscreenReadyResolve: (() => void) | null = null;
let offscreenReadyPromise: Promise<void> = Promise.resolve();

// ---------------------------------------------------------------------------
// Persist state across SW suspensions via session storage.
// session storage clears on browser close but survives the ~30-second
// idle suspension that MV3 service workers undergo.
// ---------------------------------------------------------------------------

const SESSION_KEY = "freqwave_sw_state";

interface PersistedState {
    engineState: EngineState;
    capturedTabId: number | null;
    capturedHostname: string | null;
    capturedWindowId: number | null;
    savedWindowState: string | null;
}

function persistState(): void {
    const data: PersistedState = { engineState, capturedTabId, capturedHostname, capturedWindowId, savedWindowState };
    chrome.storage.session.set({ [SESSION_KEY]: data }).catch(() => { /* ok */ });
}

// Restore is awaited before processing START_CAPTURE / QUERY_STATE so that
// state is always current even on first wake after suspension.
const stateRestored: Promise<void> = chrome.storage.session
    .get(SESSION_KEY)
    .then((result) => {
        const saved = result[SESSION_KEY] as PersistedState | undefined;
        if (!saved) return;

        // If the SW was suspended mid-"starting", treat it as idle.
        if (saved.engineState === "starting") return;

        engineState = saved.engineState;
        capturedTabId = saved.capturedTabId;
        capturedHostname = saved.capturedHostname;
        capturedWindowId = saved.capturedWindowId ?? null;
        savedWindowState = saved.savedWindowState ?? null;

        // If we were active, the offscreen doc is still alive.
        if (engineState === "active") offscreenDocCreated = true;
    })
    .catch(() => { /* storage unavailable — start fresh */ });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function broadcastState() {
    const msg: StateChangedMsg = {
        kind: "STATE_CHANGED",
        state: engineState,
        capturedTabId,
        capturedHostname,
    };
    chrome.runtime.sendMessage(msg).catch(() => { /* no popup open */ });
    persistState();
}

async function ensureOffscreenDocument(): Promise<void> {
    if (offscreenDocCreated) return;

    const offscreenUrl = chrome.runtime.getURL("src/offscreen/offscreen.html");

    // hasDocument() guards against SW suspension resetting offscreenDocCreated
    // while the offscreen doc itself is still alive.
    const exists = await chrome.offscreen.hasDocument();
    if (!exists) {
        offscreenReadyPromise = new Promise<void>((resolve) => {
            offscreenReadyResolve = resolve;
        });

        await chrome.offscreen.createDocument({
            url: offscreenUrl,
            reasons: [chrome.offscreen.Reason.USER_MEDIA],
            justification: "Capture and process tab audio via Web Audio API.",
        });

        await offscreenReadyPromise;
    }

    offscreenDocCreated = true;
}

function sendToOffscreen(msg: SwToOffscreenMessage) {
    chrome.runtime.sendMessage(msg).catch(() => {
        console.warn("[SW] Could not reach offscreen doc:", msg.kind);
    });
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

chrome.runtime.onMessage.addListener(
    (message: AnyMessage, _sender, sendResponse) => {
        const kind = (message as { kind: string }).kind;

        switch (kind) {
            // ------------------------------------------------------------------
            case "OFFSCREEN_READY":
                offscreenReadyResolve?.();
                offscreenReadyResolve = null;
                return false;

            // ------------------------------------------------------------------
            case "ENGINE_STOPPED":
                engineState = "idle";
                capturedTabId = null;
                capturedHostname = null;
                capturedWindowId = null;
                savedWindowState = null;
                broadcastState();
                return false;

            // ------------------------------------------------------------------
            case "START_CAPTURE": {
                (async () => {
                    await stateRestored;

                    if (engineState !== "idle") {
                        sendResponse({
                            ok: false,
                            error: `Engine is active on ${capturedHostname ?? "another tab"}. Stop it first.`,
                        });
                        return;
                    }

                    try {
                        const [activeTab] = await chrome.tabs.query({
                            active: true,
                            currentWindow: true,
                        });
                        if (!activeTab?.id) throw new Error("No active tab.");

                        engineState = "starting";
                        capturedTabId = activeTab.id;
                        capturedHostname = activeTab.url
                            ? new URL(activeTab.url).hostname
                            : null;
                        capturedWindowId = activeTab.windowId ?? null;
                        broadcastState();

                        const streamId = await chrome.tabCapture.getMediaStreamId({
                            targetTabId: activeTab.id,
                        });

                        await ensureOffscreenDocument();

                        const initMsg: InitCaptureMsg = { kind: "INIT_CAPTURE", streamId };
                        sendToOffscreen(initMsg);

                        engineState = "active";
                        broadcastState();
                        sendResponse({ ok: true });
                    } catch (err) {
                        console.error("[SW] START_CAPTURE failed:", err);
                        engineState = "idle";
                        capturedTabId = null;
                        capturedHostname = null;
                        broadcastState();
                        sendResponse({ ok: false, error: String(err) });
                    }
                })();
                return true; // keep channel open for async sendResponse
            }

            // ------------------------------------------------------------------
            case "STOP_CAPTURE":
                sendToOffscreen({ kind: "TEARDOWN_CAPTURE" });
                engineState = "idle";
                capturedTabId = null;
                capturedHostname = null;
                capturedWindowId = null;
                savedWindowState = null;
                broadcastState();
                sendResponse({ ok: true });
                return false;

            // ------------------------------------------------------------------
            case "QUERY_STATE": {
                (async () => {
                    await stateRestored;
                    sendResponse({ state: engineState, capturedTabId, capturedHostname });
                })();
                return true; // async
            }

            // ------------------------------------------------------------------
            default:
                return false;
        }
    }
);

// ---------------------------------------------------------------------------
// Fullscreen bridge
// When a captured tab's content calls requestFullscreen(), Chrome fires
// onStatusChanged with fullscreen:true but does NOT enter fullscreen itself —
// the capturing extension must call chrome.windows.update to drive it.
// ---------------------------------------------------------------------------

chrome.tabCapture.onStatusChanged.addListener(async (info) => {
    if (info.status !== "active") return;
    if (info.tabId !== capturedTabId) return;
    await handleFullscreenChange(info.fullscreen ?? false);
});

async function handleFullscreenChange(fullscreen: boolean): Promise<void> {
    if (capturedWindowId == null) return;
    try {
        if (fullscreen) {
            const win = await chrome.windows.get(capturedWindowId);
            if (win.state !== "fullscreen") {
                savedWindowState = win.state ?? "normal";
                persistState();
                await chrome.windows.update(capturedWindowId, { state: "fullscreen" });
            }
        } else if (savedWindowState !== null) {
            // Only restore if we drove the fullscreen entry
            await chrome.windows.update(capturedWindowId, { state: savedWindowState as chrome.windows.WindowState });
            savedWindowState = null;
            persistState();
        }
    } catch {
        // Window may have been closed; ignore
    }
}

// ---------------------------------------------------------------------------
// Install / update
// ---------------------------------------------------------------------------

chrome.runtime.onInstalled.addListener(({ reason }) => {
    if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
        console.log("[EQ SW] Extension installed.");
    } else if (reason === chrome.runtime.OnInstalledReason.UPDATE) {
        console.log("[EQ SW] Extension updated.");
    }
});
