import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, describe, expect, it } from 'vitest'
import { WorkflowStepper } from './WorkflowStepper'

function render(component: React.ReactElement) {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => {
    root.render(component)
  })
  return { container, root }
}

describe('WorkflowStepper', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('renders state 1: No sheets (Upload active)', () => {
    const { container } = render(
      <WorkflowStepper sheetsLength={0} takeoffItemsLength={0} />
    )
    
    // We need to wait for react state to settle if there's any, but here it's purely props.
    // However, data-testid might need flushSync or act if react versions disagree, but typically createRoot needs act.
    
    const step1 = container.querySelector('[data-testid="step-1"]')
    const step2 = container.querySelector('[data-testid="step-2"]')
    const step3 = container.querySelector('[data-testid="step-3"]')

    expect(step1?.getAttribute('data-status')).toBe('active')
    expect(step1?.className).toContain('bg-blue-50')
    expect(step1?.textContent).toContain('📄 Upload PDFs')

    expect(step2?.getAttribute('data-status')).toBe('pending')
    expect(step3?.getAttribute('data-status')).toBe('pending')
  })

  it('renders state 2: Sheets exist, no selection (Measure active)', () => {
    const { container } = render(
      <WorkflowStepper sheetsLength={2} takeoffItemsLength={0} />
    )
    
    const step1 = container.querySelector('[data-testid="step-1"]')
    const step2 = container.querySelector('[data-testid="step-2"]')
    const step3 = container.querySelector('[data-testid="step-3"]')

    expect(step1?.getAttribute('data-status')).toBe('complete')
    expect(step1?.className).toContain('bg-green-50')
    expect(step1?.textContent).toContain('✅')

    expect(step2?.getAttribute('data-status')).toBe('active')
    expect(step2?.className).toContain('bg-blue-50')
    
    expect(step3?.getAttribute('data-status')).toBe('pending')
  })

  it('renders state 3: Sheet selected, no items (Measure active)', () => {
    const { container } = render(
      <WorkflowStepper sheetsLength={2} takeoffItemsLength={0} />
    )
    
    const step1 = container.querySelector('[data-testid="step-1"]')
    const step2 = container.querySelector('[data-testid="step-2"]')
    const step3 = container.querySelector('[data-testid="step-3"]')

    expect(step1?.getAttribute('data-status')).toBe('complete')
    
    // Measure should be active because items are 0
    expect(step2?.getAttribute('data-status')).toBe('active')
    expect(step2?.className).toContain('bg-blue-50')

    expect(step3?.getAttribute('data-status')).toBe('pending')
  })

  it('renders state 4: Items exist (Export active)', () => {
    const { container } = render(
      <WorkflowStepper sheetsLength={2} takeoffItemsLength={5} />
    )
    
    const step1 = container.querySelector('[data-testid="step-1"]')
    const step2 = container.querySelector('[data-testid="step-2"]')
    const step3 = container.querySelector('[data-testid="step-3"]')

    expect(step1?.getAttribute('data-status')).toBe('complete')
    expect(step2?.getAttribute('data-status')).toBe('complete')
    
    expect(step3?.getAttribute('data-status')).toBe('active')
    expect(step3?.className).toContain('bg-blue-50')
  })
})
