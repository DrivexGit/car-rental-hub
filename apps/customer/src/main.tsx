import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { MotionConfig } from "framer-motion";
import App from "./App";
import { StoreProvider } from "./lib/store";
import { initTheme } from "./lib/theme";
import { I18nProvider, initLang } from "./lib/i18n";
import "./index.css";

initTheme();
initLang();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <MotionConfig reducedMotion="user">
        <I18nProvider>
          <StoreProvider>
            <App />
          </StoreProvider>
        </I18nProvider>
      </MotionConfig>
    </BrowserRouter>
  </StrictMode>,
);

if ("serviceWorker" in navigator && import.meta.env.PROD) navigator.serviceWorker.register("/sw.js");
