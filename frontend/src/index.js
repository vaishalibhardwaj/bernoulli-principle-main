import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import "@/styles.css";
import "@/ops.css";
import "@/theme.css";
import "@/future.css";
import "@/aurora.css";
import "@/calm.css";
import "@/opsgaps.css";
import "@/theme/tokens.css";
import "@/theme/system.css";
import "@/theme/look.css";
import App from "@/App";
import { StoreProvider } from "@/state/store";
import { Toaster } from "sonner";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <StoreProvider>
      <App />
      <Toaster position="bottom-right" closeButton duration={3600} toastOptions={{ className: "ds-toast" }} />
    </StoreProvider>
  </React.StrictMode>,
);
