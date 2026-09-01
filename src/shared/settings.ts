// Persisted EQ settings — written to chrome.storage.sync on every change.
// Capture state (on/off, captured tab) is NOT stored here; that lives in
// chrome.storage.session in the service worker.

export type PresetName = "OFF" | "DIALOGUE" | "LEVELER" | "CLARITY";
export type StandardPresetName = "flat" | "bass-boost" | "rock" | "pop" | "jazz" | "vocal";

export interface StandardPreset {
    id: StandardPresetName;
    name: string;
    isBuiltIn: true;
    gains: readonly number[];
}

export interface UserPreset {
    id: string;
    name: string;
    isBuiltIn: false;
    gains: number[];
}

export const STANDARD_PRESETS: readonly StandardPreset[] = [
    { id: "flat", name: "Flat", isBuiltIn: true, gains: [0, 0, 0, 0, 0, 0, 0, 0] },
    { id: "bass-boost", name: "Bass Boost", isBuiltIn: true, gains: [6, 4, 2, 0, 0, 0, 0, 0] },
    { id: "rock", name: "Rock", isBuiltIn: true, gains: [4, 3, -1, -2, 1, 3, 4, 3] },
    { id: "pop", name: "Pop", isBuiltIn: true, gains: [-1, 2, 4, 4, 2, 0, 2, 3] },
    { id: "jazz", name: "Jazz", isBuiltIn: true, gains: [3, 2, 0, 2, 1, 3, 4, 4] },
    { id: "vocal", name: "Vocal / Podcast", isBuiltIn: true, gains: [-3, -2, 1, 4, 4, 2, 0, -1] }
];

export interface FreqWaveSettings {
    master: number; // dB, −12 to +12
    preamp: number; // dB, −12 to +12
    bands: number[]; // 8 values, dB, −12 to +12
    preset: PresetName | null; // null = custom (no named preset active)
    eqPreset: string | null;
    customPresets: UserPreset[];
    compressorEnabled: boolean;
}

export const STORAGE_KEY = "freqwave_settings";

export const DEFAULT_SETTINGS: FreqWaveSettings = {
    master: 0,
    preamp: 0,
    bands: [0, 0, 0, 0, 0, 0, 0, 0],
    preset: null,
    eqPreset: "flat",
    customPresets: [],
    compressorEnabled: false
};

export function normalizeSettings(
    settings: Partial<FreqWaveSettings> | undefined
): FreqWaveSettings {
    return {
        ...DEFAULT_SETTINGS,
        ...settings,
        bands: settings?.bands ?? DEFAULT_SETTINGS.bands,
        eqPreset: normalizeStandardPresetName(settings?.eqPreset),
        customPresets: normalizeCustomPresets(settings?.customPresets),
        // Preserve the previous LEVELER behavior for settings saved before
        // the compressor received its own control.
        compressorEnabled: settings?.compressorEnabled ?? settings?.preset === "LEVELER"
    };
}

function normalizeCustomPresets(presets: UserPreset[] | undefined): UserPreset[] {
    if (!Array.isArray(presets)) return [];
    return presets
        .filter(
            (preset) =>
                preset &&
                typeof preset.id === "string" &&
                typeof preset.name === "string" &&
                Array.isArray(preset.gains) &&
                preset.gains.length === 8
        )
        .map((preset) => ({
            id: preset.id,
            name: preset.name,
            isBuiltIn: false,
            gains: preset.gains.map((gain) => Math.max(-12, Math.min(12, Number(gain) || 0)))
        }));
}

function normalizeStandardPresetName(name: string | null | undefined): string | null {
    if (!name) return DEFAULT_SETTINGS.eqPreset;
    const legacyNames: Record<string, StandardPresetName> = {
        FLAT: "flat",
        BASS_BOOST: "bass-boost",
        ROCK: "rock",
        POP: "pop",
        JAZZ: "jazz"
    };
    return (
        legacyNames[name] ??
        (STANDARD_PRESETS.some((preset) => preset.id === name) ? name : DEFAULT_SETTINGS.eqPreset)
    );
}

export async function loadSettings(): Promise<FreqWaveSettings> {
    const storage = globalThis.chrome?.storage?.sync;
    if (!storage) return DEFAULT_SETTINGS;

    const result = await storage.get(STORAGE_KEY);
    return normalizeSettings(result[STORAGE_KEY] as Partial<FreqWaveSettings> | undefined);
}

export function saveSettings(settings: FreqWaveSettings): void {
    globalThis.chrome?.storage?.sync?.set({ [STORAGE_KEY]: settings });
}
