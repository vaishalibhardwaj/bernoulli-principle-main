import React from "react";
import { Check, AlertCircle } from "lucide-react";

export default function StepIndicator({ steps, current, status, onJump, maxReachable }) {
  // steps: [{key,label,na?}]  status: {key: 'upcoming'|'current'|'complete'|'error'|'na'}
  return (
    <>
      <div className="stepper" data-testid="step-indicator">
        {steps.map((s, i) => {
          const st = status[s.key] || (i === current ? "current" : i < current ? "complete" : "upcoming");
          const reachable = onJump && i <= (maxReachable ?? current) && st !== "na";
          return (
            <React.Fragment key={s.key}>
              <div className={`step ${st} ${reachable ? "clickable" : ""}`}
                onClick={() => reachable && onJump(i)} data-testid={"step-" + (i + 1)}>
                <div className="node">
                  {st === "complete" ? <Check /> : st === "error" ? <AlertCircle /> : st === "na" ? "N/A" : i + 1}
                </div>
                <div className="tl">{s.label}</div>
              </div>
              {i < steps.length - 1 && (
                <div className={`step-line ${i < current ? "done" : ""}`}><span className="fill" /></div>
              )}
            </React.Fragment>
          );
        })}
      </div>
      <div className="step-sub" data-testid="step-subtitle">
        Step {current + 1} of {steps.length} — {steps[current]?.label}
      </div>
    </>
  );
}
