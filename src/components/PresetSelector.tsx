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
    onToggleSiteProfile
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
        <div className="w-full flex items-center justify-between gap-3 px-3 py-2 bg-[#0f1012] rounded-[10px] border border-white/5 text-xs">
            <div className="flex items-center gap-2 min-w-0">
                {/* Inline Save Flow or Dropdown Trigger */}
                {isNaming ? (
                    <div className="flex items-center gap-1 flex-1 max-w-50">
                        <input
                            type="text"
                            value={newPresetName}
                            onChange={(e) => setNewPresetName(e.target.value)}
                            placeholder="Preset Name..."
                            autoFocus
                            className="w-full px-2 py-0.5 text-[11px] bg-[#16171b] border border-[#84e80c]/50 rounded text-[#f3f3f5] focus:outline-none"
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
                    <div className="flex items-center gap-2 relative">
                        {/* Main Dropdown Button */}
                        <div className="relative">
                            <button
                                onClick={() => setIsOpen(!isOpen)}
                                className="flex items-center gap-4 px-0 py-0 bg-transparent hover:text-[#84e80c] border-0 text-[11px] font-medium text-[#5d5d65] transition-colors min-w-32.5">
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

                                    <div className="absolute right-0 mt-1 w-48 max-h-56 overflow-y-auto bg-[#16171b] border border-white/10 rounded-lg shadow-xl z-50 text-[11px] divide-y divide-white/10">
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

                        {/* Quick Save Button */}
                        <button
                            onClick={() => setIsNaming(true)}
                            className="flex items-center justify-center p-0.5 bg-transparent hover:text-[#84e80c] text-[#5d5d65] border-0 rounded transition-colors"
                            title="Save Current Sliders as Preset">
                            <Plus size={15} />
                        </button>
                    </div>
                )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
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
                    className="relative h-5 w-9 shrink-0 rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                    style={{
                        background: siteProfileEnabled ? "rgba(132,232,12,.22)" : "#1a1b1f",
                        borderColor: siteProfileEnabled
                            ? "rgba(132,232,12,.65)"
                            : "rgba(255,255,255,.16)",
                        boxShadow: siteProfileEnabled
                            ? "0 0 10px rgba(132,232,12,.16)"
                            : "inset 0 1px 3px rgba(0,0,0,.7)"
                    }}>
                    <span
                        aria-hidden="true"
                        className="absolute top-0.5 h-3.5 w-3.5 rounded-full transition-transform"
                        style={{
                            left: "2px",
                            background: siteProfileEnabled ? "#84e80c" : "#696b73",
                            boxShadow: siteProfileEnabled
                                ? "0 0 7px rgba(132,232,12,.8)"
                                : "0 1px 2px rgba(0,0,0,.7)",
                            transform: siteProfileEnabled ? "translateX(16px)" : "translateX(0)"
                        }}
                    />
                </button>
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
