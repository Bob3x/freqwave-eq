import React, { useState } from "react";
import { Trash2, Plus, Check, X } from "lucide-react";

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
        <div className="w-full flex items-center justify-between gap-2 px-3 py-2 bg-slate-800/80 rounded-lg border border-slate-700 text-sm">
            {/* Label / Section Title */}
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Preset
            </span>

            {/* Inline Save Flow or Dropdown Trigger */}
            {isNaming ? (
                <div className="flex items-center gap-1.5 flex-1 max-w-[200px]">
                    <input
                        type="text"
                        value={newPresetName}
                        onChange={(e) => setNewPresetName(e.target.value)}
                        placeholder="Preset Name..."
                        autoFocus
                        className="w-full px-2 py-1 text-xs bg-slate-900 border border-indigo-500/50 rounded text-slate-100 focus:outline-none"
                        onKeyDown={(e) => e.key === "Enter" && handleSaveSubmit()}
                    />
                    <button
                        onClick={handleSaveSubmit}
                        className="p-1 hover:bg-emerald-500/20 text-emerald-400 rounded transition-colors"
                        title="Confirm Save">
                        <Check size={14} />
                    </button>
                    <button
                        onClick={() => setIsNaming(false)}
                        className="p-1 hover:bg-rose-500/20 text-rose-400 rounded transition-colors"
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
                            className="flex items-center justify-between gap-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-950 border border-slate-700/80 rounded text-xs font-medium text-slate-200 transition-all min-w-[130px]">
                            <span className="truncate">{displayLabel}</span>
                            <span className="text-slate-500 text-[10px]">▼</span>
                        </button>

                        {/* Dropdown Menu Popup */}
                        {isOpen && (
                            <>
                                {/* Backdrop to close on outside click */}
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setIsOpen(false)}
                                />

                                <div className="absolute right-0 mt-1 w-48 max-h-56 overflow-y-auto bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50 text-xs divide-y divide-slate-800">
                                    {/* Built-in Presets Group */}
                                    <div className="py-1">
                                        <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                            Default Presets
                                        </div>
                                        {builtInPresets.map((preset) => (
                                            <button
                                                key={preset.id}
                                                onClick={() => {
                                                    onSelectPreset(preset);
                                                    setIsOpen(false);
                                                }}
                                                className={`w-full text-left px-3 py-1.5 hover:bg-indigo-600/20 transition-colors ${
                                                    activePresetId === preset.id
                                                        ? "text-indigo-400 font-semibold"
                                                        : "text-slate-300"
                                                }`}>
                                                {preset.name}
                                            </button>
                                        ))}
                                    </div>

                                    {/* Custom Presets Group */}
                                    <div className="py-1">
                                        <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                            My Presets
                                        </div>
                                        {customPresets.length === 0 ? (
                                            <div className="px-3 py-1.5 text-slate-500 italic text-[11px]">
                                                No custom presets
                                            </div>
                                        ) : (
                                            customPresets.map((preset) => (
                                                <div
                                                    key={preset.id}
                                                    className="group flex items-center justify-between px-3 py-1.5 hover:bg-indigo-600/20 transition-colors cursor-pointer"
                                                    onClick={() => {
                                                        onSelectPreset(preset);
                                                        setIsOpen(false);
                                                    }}>
                                                    <span
                                                        className={`truncate ${
                                                            activePresetId === preset.id
                                                                ? "text-indigo-400 font-semibold"
                                                                : "text-slate-300"
                                                        }`}>
                                                        {preset.name}
                                                    </span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation(); // Prevents loading the preset on delete
                                                            onDeletePreset(preset.id);
                                                        }}
                                                        className="opacity-0 group-hover:opacity-100 p-0.5 text-slate-500 hover:text-rose-400 transition-all"
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
                        className="flex items-center gap-1 px-2 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 rounded text-xs transition-colors"
                        title="Save Current Sliders as Preset">
                        <Plus size={12} />
                        <span>Save</span>
                    </button>
                </div>
            )}
        </div>
    );
};
