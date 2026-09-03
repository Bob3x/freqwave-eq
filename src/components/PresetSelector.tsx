import React, { useState } from "react";
import { Trash2, Plus, Check, X, ChevronDown } from "lucide-react";

export interface Preset {
    id: string;
    name: string;
    isBuiltIn: boolean;
    gains: number[];
}

interface PresetSelectorProps {
    presets: Preset[];
    activePresetId: string | "custom";
    currentGains: number[];
    onSelectPreset: (preset: Preset) => void;
    onSavePreset: (name: string, gains: number[]) => void;
    onDeletePreset: (id: string) => void;
    siteHostname: string | null;
    siteProfileEnabled: boolean;
    onToggleSiteProfile: () => void;
    engineActive?: boolean;
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({
    presets,
    activePresetId,
    currentGains,
    onSelectPreset,
    onSavePreset,
    onDeletePreset,
    siteHostname,
    siteProfileEnabled,
    onToggleSiteProfile,
    engineActive = false
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isNaming, setIsNaming] = useState(false);
    const [newPresetName, setNewPresetName] = useState("");

    const builtInPresets = presets.filter((p) => p.isBuiltIn);
    const customPresets = presets.filter((p) => !p.isBuiltIn);

    const activePreset = presets.find((p) => p.id === activePresetId);
    const displayLabel = activePreset ? activePreset.name : "Custom*";

    const handleSaveSubmit = () => {
        if (newPresetName.trim()) {
            onSavePreset(newPresetName.trim(), currentGains);
            setNewPresetName("");
            setIsNaming(false);
        }
    };

    return (
        <div className="flex w-full items-center justify-between gap-3 rounded-[10px] bg-[#0f1012] px-3 py-2 text-xs">
            <div className="order-2 flex min-w-0 items-center gap-1 px-0 py-0">
                {/* Inline Save Flow or Dropdown Trigger */}
                {isNaming ? (
                    <div className="flex min-w-0 flex-1 items-center gap-1">
                        <input
                            type="text"
                            value={newPresetName}
                            onChange={(e) => setNewPresetName(e.target.value)}
                            placeholder="Preset Name..."
                            autoFocus
                            className="w-full min-w-0 rounded border border-[#84e80c]/50 bg-[#16171b] px-2 py-1 text-[11px] text-[#f3f3f5] focus:outline-none"
                            onKeyDown={(e) => e.key === "Enter" && handleSaveSubmit()}
                        />
                        <button
                            onClick={handleSaveSubmit}
                            className="p-1 hover:bg-[#84e80c]/10 text-[#84e80c] rounded transition-colors"
                            title="Confirm Save">
                            <Check size={14} />
                        </button>
                        <button
                            onClick={() => setIsNaming(false)}
                            className="p-1 hover:bg-red-400/10 text-[#f87171] rounded transition-colors"
                            title="Cancel">
                            <X size={14} />
                        </button>
                    </div>
                ) : (
                    <div className="relative flex items-center gap-1">
                        {/* Main Dropdown Button */}
                        <div className="relative">
                            <button
                                onClick={() => setIsOpen(!isOpen)}
                                title="Choose a preset"
                                className="flex min-w-24 items-center gap-2 rounded-[5px] border-0 bg-transparent px-2 py-1 text-[11px] font-medium text-[#5d5d65] transition-colors hover:bg-white/4 hover:text-[#84e80c]">
                                <span className="truncate">{displayLabel}</span>
                                <ChevronDown size={13} className="shrink-0 text-[#5d5d65]" />
                            </button>

                            {/* Dropdown Menu Popup */}
                            {isOpen && (
                                <>
                                    {/* Backdrop to close on outside click */}
                                    <div
                                        className="fixed inset-0 z-40"
                                        onClick={() => setIsOpen(false)}
                                    />

                                    <div className="preset-menu absolute right-0 z-50 mt-2 w-40 max-h-40 overflow-y-auto rounded-lg bg-[#111214] text-[11px] shadow-xl divide-y divide-white/10">
                                        {/* Built-in Presets Group */}
                                        <div className="py-1">
                                            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#5d5d65]">
                                                Default Presets
                                            </div>
                                            {builtInPresets.map((preset) => (
                                                <button
                                                    key={preset.id}
                                                    onClick={() => {
                                                        onSelectPreset(preset);
                                                        setIsOpen(false);
                                                    }}
                                                    className={`w-full text-left px-3 py-1.5 hover:bg-[#84e80c]/10 transition-colors ${
                                                        activePresetId === preset.id
                                                            ? "text-[#84e80c] font-semibold"
                                                            : "text-[#b8b8c0]"
                                                    }`}>
                                                    {preset.name}
                                                </button>
                                            ))}
                                        </div>

                                        {/* Custom Presets Group */}
                                        <div className="py-1">
                                            <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#5d5d65]">
                                                My Presets
                                            </div>
                                            {customPresets.length === 0 ? (
                                                <div className="px-3 py-1.5 text-[#5d5d65] italic text-[11px]">
                                                    No custom presets
                                                </div>
                                            ) : (
                                                customPresets.map((preset) => (
                                                    <div
                                                        key={preset.id}
                                                        className="group flex items-center justify-between px-3 py-1.5 hover:bg-[#84e80c]/10 transition-colors cursor-pointer"
                                                        onClick={() => {
                                                            onSelectPreset(preset);
                                                            setIsOpen(false);
                                                        }}>
                                                        <span
                                                            className={`truncate ${
                                                                activePresetId === preset.id
                                                                    ? "text-[#84e80c] font-semibold"
                                                                    : "text-[#b8b8c0]"
                                                            }`}>
                                                            {preset.name}
                                                        </span>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation(); // Prevents loading the preset on delete
                                                                onDeletePreset(preset.id);
                                                            }}
                                                            className="opacity-0 group-hover:opacity-100 p-0.5 text-[#5d5d65] hover:text-[#f87171] transition-all"
                                                            title="Delete Preset">
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
                {!isNaming && (
                    <div className="flex items-center gap-1">
                        {/* Quick Save Button */}
                        <button
                            onClick={() => setIsNaming(true)}
                            className="flex h-6 w-6 items-center justify-center rounded-[5px] border-0 bg-transparent p-0 text-[#5d5d65] transition-colors hover:bg-white/4 hover:text-[#84e80c]"
                            title="Save Current Settings as Preset">
                            <Plus size={15} />
                        </button>
                    </div>
                )}
            </div>

            <div className="order-1 flex shrink-0 items-center gap-2">
                <button
                    type="button"
                    role="switch"
                    aria-checked={siteProfileEnabled}
                    aria-label="Site Memory"
                    title={
                        siteHostname
                            ? `Remember settings for ${siteHostname}`
                            : "Site Memory unavailable"
                    }
                    disabled={!siteHostname}
                    onClick={onToggleSiteProfile}
                    className="relative h-4.5 w-4.5 shrink-0 cursor-pointer rounded-full border transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                    style={{
                        background: "#25272c",
                        borderColor: "rgba(0,0,0,.7)",
                        boxShadow:
                            siteProfileEnabled && engineActive
                                ? "0 0 9px rgba(132,232,12,.28), inset 0 1px 1px rgba(235,255,190,.65), inset 0 -2px 3px rgba(44,104,0,.75), 0 2px 3px rgba(0,0,0,.7)"
                                : "inset 0 1px 1px rgba(255,255,255,.18), inset 0 -2px 3px rgba(0,0,0,.8), 0 2px 3px rgba(0,0,0,.65)",
                        backgroundImage:
                            siteProfileEnabled && engineActive
                                ? "radial-gradient(circle at 50% 44%, rgba(210,255,141,.95) 0%, rgba(132,232,12,.7) 18%, rgba(132,232,12,.24) 48%, rgba(31,32,37,0) 78%), radial-gradient(circle at 35% 28%, #555860 0%, #303239 42%, #17181c 100%)"
                                : "radial-gradient(circle at 35% 28%, #686b73 0%, #494b53 20%, #303239 56%, #17181c 100%)"
                    }}></button>
                <div className="text-right leading-none">
                    <div className="text-[9px] font-semibold uppercase tracking-wider text-[#5d5d65]">
                        Site Profile
                    </div>
                    <div
                        className="mt-1 max-w-28 truncate text-[9px] font-mono text-[#7d7d85]"
                        title={siteHostname ?? undefined}>
                        {siteHostname ?? "No Source"}
                    </div>
                </div>
            </div>
        </div>
    );
};
