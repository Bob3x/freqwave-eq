import { FreqWavePopup } from "../components/eq/FreqWavePopup";

export default function Popup() {
    return (
        <div
            style={{
                "--accent": "#84e80c",
                width: "560px",
                height: "570px",
            } as React.CSSProperties}
        >
            <FreqWavePopup />
        </div>
    );
}
