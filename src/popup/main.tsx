import React from "react";
import ReactDOM from "react-dom/client";
import Popup from "./Popup";
import "../index.css"; // Direct entry point for Tailwind CSS v4
import "@fontsource/archivo/400.css";
import "@fontsource/archivo/500.css";
import "@fontsource/archivo/600.css";
import "@fontsource/archivo/700.css";
import "@fontsource/archivo/800.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";
import "@fontsource/jetbrains-mono/600.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <Popup />
    </React.StrictMode>
);
