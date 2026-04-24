import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  number: number;
  label: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  onStepChange?: (step: number) => void;
}

const StepIndicator = ({ steps, currentStep, onStepChange }: StepIndicatorProps) => {
  return (
    <div className="mb-10">
      {/* Progress bar */}
      <div className="relative flex items-center justify-between">
        {/* Background line */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[2px] bg-border" />
        
        {/* Active line */}
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 h-[2px] bg-primary transition-all duration-500 ease-out"
          style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
        />

        {steps.map((step) => {
          const isCompleted = currentStep > step.number;
          const isCurrent = currentStep === step.number;

          return (
            <div key={step.number} className="relative flex flex-col items-center">
              <button
                type="button"
                onClick={() => onStepChange?.(step.number)}
                className={cn(
                  "w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 relative z-10",
                  isCompleted && "bg-primary text-primary-foreground shadow-card",
                  isCurrent && "bg-primary text-primary-foreground shadow-premium ring-4 ring-primary/15",
                  !isCompleted && !isCurrent && "bg-card text-muted-foreground border-2 border-border",
                  onStepChange ? "cursor-pointer hover:brightness-110" : "cursor-default"
                )}
                disabled={!onStepChange}
              >
                {isCompleted ? <Check className="w-4 h-4" strokeWidth={3} /> : step.number}
              </button>
              <span
                className={cn(
                  "absolute -bottom-6 text-[11px] font-medium whitespace-nowrap transition-colors duration-300",
                  isCurrent ? "text-foreground font-semibold" : isCompleted ? "text-primary/70" : "text-muted-foreground/60"
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StepIndicator;
