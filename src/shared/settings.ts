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

export interface SiteProfile {
    master: number;
    preamp: number;
    bands: number[];
    preset: PresetName | null;
    eqPreset: string | null;
    customPresets: UserPreset[];
    compressorEnabled: boolean;
}

export const STANDARD_PRESETS: readonly StandardPreset[] = [
    { id: "flat", name: "Flat", isBuiltIn: true, gains: [0, 0, 0, 0, 0, 0, 0, 0] },
    { id: "bass-boost", name: "Bass Boost", isBuiltIn: true, gains: [6, 4, 2, 0, 0, 0, 0, 0] },
    { id: "rock", name: "Rock", isBuiltIn: true, gains: [4, 3, -1, -2, 1, 3, 4, 3] },
    { id: "pop", name: "Pop", isBuiltIn: true, gains: [-1, 2, 4, 4, 2, 0, 2, 3] },
    { id: "jazz", name: "Jazz", isBuiltIn: true, gains: [3, 2, 0, 2, 1, 3, 4, 4] },
    { id: "vocal", name: "Vocal / Podcast", isBuiltIn: true, gains: [-3, -2, 1, 4, 4, 2, 0, -1] }
];

export interface FreqWaveSettings extends SiteProfile {
    globalProfile: SiteProfile;
    siteProfileEnabled: boolean;
    siteProfiles: Record<string, SiteProfile>;
}

export const STORAGE_KEY = "freqwave_settings";

const DEFAULT_PROFILE: SiteProfile = {
    master: 0,
    preamp: 0,
    bands: [0, 0, 0, 0, 0, 0, 0, 0],
    preset: null,
    eqPreset: "flat",
    customPresets: [],
    compressorEnabled: false
};

export const DEFAULT_SETTINGS: FreqWaveSettings = {
    ...DEFAULT_PROFILE,
    globalProfile: { ...DEFAULT_PROFILE, bands: [...DEFAULT_PROFILE.bands] },
    siteProfileEnabled: false,
    siteProfiles: {}
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
        compressorEnabled: settings?.compressorEnabled ?? DEFAULT_SETTINGS.compressorEnabled,
        globalProfile: normalizeSiteProfile(settings?.globalProfile ?? settings ?? DEFAULT_PROFILE),
        siteProfileEnabled: settings?.siteProfileEnabled ?? DEFAULT_SETTINGS.siteProfileEnabled,
        siteProfiles: normalizeSiteProfiles(settings?.siteProfiles)
    };
}

function normalizeSiteProfiles(
    profiles: Record<string, SiteProfile> | undefined
): Record<string, SiteProfile> {
    if (!profiles || typeof profiles !== "object") return {};
    return Object.fromEntries(
        Object.entries(profiles)
            .filter(
                ([hostname, profile]) =>
                    hostname.length > 0 && profile && typeof profile === "object"
            )
            .map(([hostname, profile]) => [hostname, normalizeSiteProfile(profile)])
    );
}

function normalizeSiteProfile(profile: Partial<SiteProfile>): SiteProfile {
    return {
        master: Number(profile.master) || 0,
        preamp: Number(profile.preamp) || 0,
        bands:
            Array.isArray(profile.bands) && profile.bands.length === 8
                ? profile.bands.map((gain) => Math.max(-12, Math.min(12, Number(gain) || 0)))
                : [...DEFAULT_PROFILE.bands],
        preset: profile.preset ?? null,
        eqPreset: profile.eqPreset ?? DEFAULT_PROFILE.eqPreset,
        customPresets: normalizeCustomPresets(profile.customPresets),
        compressorEnabled: profile.compressorEnabled ?? false
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
