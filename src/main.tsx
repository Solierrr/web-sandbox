import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "@solaria.network/web-lib/style.css";
import "./config/i18n/internationalization";
import App from "./App.tsx";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
