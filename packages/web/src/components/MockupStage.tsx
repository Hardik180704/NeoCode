import { type ReactNode } from "react";

type MockupStageProps = {
  children: ReactNode;
  variant?: "hero" | "tour";
  className?: string;
};

export function MockupStage({ children, variant = "tour", className = "" }: MockupStageProps) {
  return (
    <div className={`mockup-stage mockup-stage-${variant} ${className}`.trim()}>
      {children}
    </div>
  );
}
