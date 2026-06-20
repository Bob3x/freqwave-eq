import { FreqWavePopup } from "../components/eq/FreqWavePopup";

export default function Popup() {
    return (
        <div
            style={{
                "--accent": "#a9e80c",
                width: "520px",
                height: "570px",
            } as React.CSSProperties}
        >
            <FreqWavePopup />
        </div>
    );
}
