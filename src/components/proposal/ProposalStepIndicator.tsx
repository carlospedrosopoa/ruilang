import { Check } from "lucide-react";

interface Step {
  number: number;
  label: string;
}

interface ProposalStepIndicatorProps {
  steps: Step[];
  currentStep: number;
}

const ProposalStepIndicator = ({ steps, currentStep }: ProposalStepIndicatorProps) => {
  return (
    <div className="flex items-center justify-between w-full max-w-2xl mx-auto">
      {steps.map((step, idx) => {
        const isActive = step.number === currentStep;
        const isCompleted = step.number < currentStep;

        return (
          <div key={step.number} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ${
                  isCompleted
                    ? "bg-primary text-primary-foreground"
                    : isActive
                    ? "bg-primary text-primary-foreground shadow-elevated ring-4 ring-primary/20"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {isCompleted ? <Check className="w-4 h-4" /> : step.number}
              </div>
              <span
                className={`mt-1.5 text-[10px] font-medium whitespace-nowrap transition-colors ${
                  isActive ? "text-primary" : isCompleted ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={`h-[2px] flex-1 mx-2 mt-[-14px] transition-colors duration-300 ${
                  step.number < currentStep ? "bg-primary" : "bg-muted"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};

export default ProposalStepIndicator;
