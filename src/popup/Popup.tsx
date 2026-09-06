import { FreqWavePopup } from "../components/eq/FreqWavePopup";

export default function Popup() {
    return (
        <div
            style={
                {
                    "--accent": "#84e80c",
                    width: "560px",
                    height: "600px"
                } as React.CSSProperties
            }>
            <FreqWavePopup />
        </div>
    );
}
