import React from "react";
import { UploadCloud, FileText, X, FileSpreadsheet } from "lucide-react";
import { DEMO_FILES } from "@/mock/sampleFiles";

export default function FileDropZone({ fileName, onPick, onClear, hint, accept }) {
  const [drag, setDrag] = React.useState(false);
  const inputRef = React.useRef(null);

  const pick = (name) => onPick && onPick(name);

  if (fileName) {
    const isSheet = /\.xlsx?$/.test(fileName);
    return (
      <div className="file-chip" data-testid="file-chip">
        {isSheet ? <FileSpreadsheet className="fc" /> : <FileText className="fc" />}
        <span className="fn tnum">{fileName}</span>
        <span style={{ fontSize: 11.5, color: "hsl(var(--muted))" }}>{DEMO_FILES[fileName]?.size || ""}</span>
        <button className="fx" onClick={onClear} aria-label="Remove file" data-testid="file-clear"><X size={16} /></button>
      </div>
    );
  }

  return (
    <div className={`dropzone ${drag ? "drag" : ""}`} data-testid="dropzone"
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) pick(f.name); }}>
      <div className="dz-ico"><UploadCloud size={22} /></div>
      <h4>{hint || "Upload a sample statement to auto-fill file settings"}</h4>
      <p>Drag &amp; drop or click to browse. CSV, XLSX, XLS, PDF supported.</p>
      <button className="btn btn-outline" onClick={() => inputRef.current?.click()} data-testid="dropzone-browse">
        <UploadCloud size={15} /> Browse files
      </button>
      <input ref={inputRef} type="file" accept={accept} style={{ display: "none" }} data-testid="dropzone-input"
        onChange={(e) => { const f = e.target.files[0]; if (f) pick(f.name); }} />
      <div className="demo-files">
        <span style={{ fontSize: 11.5, color: "hsl(var(--muted))", alignSelf: "center" }}>Use demo file:</span>
        {Object.keys(DEMO_FILES).map((f) => (
          <button key={f} className="demo-file-link tnum" onClick={() => pick(f)} data-testid={"demo-file-" + f}>
            <FileText size={13} /> {f}
          </button>
        ))}
      </div>
    </div>
  );
}
