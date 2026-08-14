import { type ReactNode } from "react";
import { MockupStage } from "./MockupStage";

type MacFrameProps = {
  children: ReactNode;
  scene: "alpine" | "monolith";
  title: string;
  variant?: string;
};

export function MacFrame({ children, scene, title, variant = "" }: MacFrameProps) {
  return (
    <MockupStage variant="tour" className={`mockup-scene mockup-scene-${scene} ${variant}`.trim()}>
      <div className="mac-window">
        <div className="mac-titlebar" aria-hidden="true">
          <div className="mac-controls"><i /><i /><i /></div>
          <span className="mac-title">{title}</span>
          <span className="mac-status"><i /> NEOCODE</span>
        </div>
        {children}
      </div>
    </MockupStage>
  );
}
