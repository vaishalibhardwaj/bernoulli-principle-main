// What a maker sees right after sending a setup for approval, and the short note on how a sample file is read.
import React from "react";
import { useNavigate } from "react-router-dom";
import { Check } from "lucide-react";
import { Art } from "@/components/Art";

/** Full-screen confirmation: the setup is with a teammate, and what happens next. */
export function SentScreen({ what, name, listPath, listLabel, onAnother, anotherLabel, edited }) {
  const nav = useNavigate();
  const steps = [
    ["done", "You sent it", "Just now"],
    ["now", "A teammate checks it", "Any one of the other five can approve"],
    ["next", edited ? "The change takes effect" : "It becomes active", "From the next file received"],
  ];
  return (
    <div className="sent" data-testid="sent-screen">
      <Art name="clipboard" className="sent-art" />
      <h1>Sent for approval</h1>
      <p className="sent-lede">{what} <b>{name}</b> is with your teammates now. You will see it in To do if it is sent back to you. There is nothing more for you to do here.</p>
      <ol className="sent-steps">
        {steps.map(([s, t, d]) => (
          <li key={t} className={s}>
            <span className="sent-dot">{s === "done" && <Check size={13} strokeWidth={3} />}</span>
            <b>{t}</b><small>{d}</small>
          </li>
        ))}
      </ol>
      <div className="sent-actions">
        <button className="btn btn-primary" onClick={() => nav(listPath)} data-testid="sent-back">{listLabel}</button>
        <button className="btn btn-outline" onClick={onAnother} data-testid="sent-another">{anotherLabel}</button>
      </div>
    </div>
  );
}

/** Plain account of how a dropped sample is read. Rules first; the in-house model only suggests. */
export function HowRead({ credit }) {
  return (
    <details className="how-read" data-testid="how-read">
      <summary>How the sample is read</summary>
      <ul>
        <li><b>File type</b> comes from what is inside the file, not from its extension.</li>
        <li><b>Separator</b> is the character that splits every row into the same number of columns.</li>
        <li><b>Start row</b> is the first row whose cells look like column names ({credit ? "transaction ID, amount, status, UTR" : "date, narration, debit, credit, balance"}). <b>Start column</b> is the first column of that row that is not empty.</li>
        {!credit && <li><b>Bank and account</b> printed above the table are compared with the Bank Master.</li>}
      </ul>
      <p>These are fixed rules. They run on our own servers and the file does not leave them. When the rules cannot decide, the in-house AI model suggests an answer and the field is marked for you to check. Nothing is used until you confirm it and a teammate approves it.</p>
    </details>
  );
}
