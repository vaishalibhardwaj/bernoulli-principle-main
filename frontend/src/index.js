import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import "@/styles.css";
import "@/ops.css";
import "@/theme.css";
import "@/future.css";
import App from "@/App";
import { StoreProvider } from "@/state/store";
import { Toaster } from "sonner";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <StoreProvider>
      <App />
      <Toaster position="bottom-right" richColors closeButton duration={3200} />
    </StoreProvider>
  </React.StrictMode>,
);
