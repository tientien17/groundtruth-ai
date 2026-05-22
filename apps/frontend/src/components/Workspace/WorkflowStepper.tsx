import React from 'react'

export interface WorkflowStepperProps {
  sheetsLength: number
  takeoffItemsLength: number
}

export function WorkflowStepper({
  sheetsLength,
  takeoffItemsLength,
}: WorkflowStepperProps) {
  const isUploadComplete = sheetsLength > 0
  const isMeasureComplete = takeoffItemsLength > 0
  
  const isUploadActive = sheetsLength === 0
  const isMeasureActive = isUploadComplete && !isMeasureComplete
  const isExportActive = isMeasureComplete

  const steps = [
    {
      id: 1,
      label: '📄 Upload PDFs',
      isComplete: isUploadComplete,
      isActive: isUploadActive,
    },
    {
      id: 2,
      label: '📐 Measure',
      isComplete: isMeasureComplete,
      isActive: isMeasureActive,
    },
    {
      id: 3,
      label: '📊 Export',
      isComplete: false, // Export is never "complete" in the stepper itself, just active
      isActive: isExportActive,
    },
  ]

  return (
    <div className="w-full bg-white border-b border-slate-200 py-3" data-testid="workflow-stepper">
      <div className="max-w-3xl mx-auto flex items-center justify-center gap-x-8">
        {steps.map((step, index) => {
          const isLast = index === steps.length - 1

          let statusClass = 'text-slate-400'
          let bgClass = ''
          
          if (step.isComplete) {
            statusClass = 'text-green-600'
            bgClass = 'bg-green-50'
          } else if (step.isActive) {
            statusClass = 'text-blue-600 animate-pulse'
            bgClass = 'bg-blue-50'
          }

          return (
            <React.Fragment key={step.id}>
              <div 
                className={`flex items-center gap-x-2 px-4 py-1.5 rounded-full ${bgClass} transition-colors duration-200`}
                data-testid={`step-${step.id}`}
                data-status={step.isComplete ? 'complete' : step.isActive ? 'active' : 'pending'}
              >
                <span className={`text-sm font-medium ${statusClass}`}>
                  {step.isComplete ? '✅' : step.label}
                  {step.isComplete && <span className="ml-1">{step.label.split(' ')[1]} {step.label.split(' ')[2]}</span>}
                </span>
              </div>
              
              {!isLast && (
                <div className="flex-1 h-px bg-slate-200 max-w-[64px]" />
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
