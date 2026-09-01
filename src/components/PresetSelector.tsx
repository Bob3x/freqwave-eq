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
}

export const PresetSelector: React.FC<PresetSelectorProps> = ({
    presets,
    activePresetId,
    currentGains,
    onSelectPreset,
    onSavePreset,
    onDeletePreset
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
        <div className="w-full flex items-center justify-between gap-2 px-3 py-1.5 bg-[#0f1012] rounded-[10px] border border-white/10 text-xs">
            {/* Label / Section Title */}
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[#5d5d65]">
                Preset
            </span>

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
                            className="flex items-center gap-2 px-0 py-0 bg-transparent hover:text-[#84e80c] border-0 text-[11px] font-medium text-[#d7d7dc] transition-colors min-w-32.5">
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
                        className="flex items-center justify-center p-0.5 bg-transparent hover:text-[#84e80c] text-[#84e80c] border-0 rounded transition-colors"
                        title="Save Current Sliders as Preset">
                        <Plus size={15} />
                    </button>
                </div>
            )}
        </div>
    );
};
