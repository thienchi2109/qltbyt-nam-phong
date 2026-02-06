/**
 * Tests for BulkImportDialogParts.tsx UI components
 *
 * Validates:
 * 1. BulkImportFileInput - File input rendering and props
 * 2. BulkImportErrorAlert - Error alert rendering
 * 3. BulkImportValidationErrors - Validation error list
 * 4. BulkImportSuccessMessage - Success message with file info
 * 5. BulkImportSubmitButton - Submit button states
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import * as React from 'react'
import {
  BulkImportFileInput,
  BulkImportErrorAlert,
  BulkImportValidationErrors,
  BulkImportSuccessMessage,
  BulkImportSubmitButton,
} from '../BulkImportDialogParts'

describe('BulkImportFileInput', () => {
  it('should render with default label', () => {
    const ref = React.createRef<HTMLInputElement>()
    render(
      <BulkImportFileInput
        id="test-input"
        fileInputRef={ref}
        onFileChange={() => {}}
      />
    )

    expect(screen.getByLabelText('Chon file')).toBeInTheDocument()
  })

  it('should render with custom label', () => {
    const ref = React.createRef<HTMLInputElement>()
    render(
      <BulkImportFileInput
        id="test-input"
        fileInputRef={ref}
        onFileChange={() => {}}
        label="Custom Label"
      />
    )

    expect(screen.getByLabelText('Custom Label')).toBeInTheDocument()
  })

  it('should accept file input with correct accept attribute', () => {
    const ref = React.createRef<HTMLInputElement>()
    render(
      <BulkImportFileInput
        id="test-input"
        fileInputRef={ref}
        onFileChange={() => {}}
        accept=".xlsx, .xls, .csv"
      />
    )

    const input = screen.getByLabelText('Chon file')
    expect(input).toHaveAttribute('accept', '.xlsx, .xls, .csv')
  })

  it('should use default accept attribute', () => {
    const ref = React.createRef<HTMLInputElement>()
    render(
      <BulkImportFileInput
        id="test-input"
        fileInputRef={ref}
        onFileChange={() => {}}
      />
    )

    const input = screen.getByLabelText('Chon file')
    expect(input).toHaveAttribute('accept', '.xlsx, .xls')
  })

  it('should call onFileChange when file is selected', () => {
    const ref = React.createRef<HTMLInputElement>()
    const handleChange = vi.fn()
    render(
      <BulkImportFileInput
        id="test-input"
        fileInputRef={ref}
        onFileChange={handleChange}
      />
    )

    const input = screen.getByLabelText('Chon file')
    fireEvent.change(input, { target: { files: [] } })

    expect(handleChange).toHaveBeenCalled()
  })

  it('should be disabled when disabled prop is true', () => {
    const ref = React.createRef<HTMLInputElement>()
    render(
      <BulkImportFileInput
        id="test-input"
        fileInputRef={ref}
        onFileChange={() => {}}
        disabled={true}
      />
    )

    const input = screen.getByLabelText('Chon file')
    expect(input).toBeDisabled()
  })

  it('should forward ref to input element', () => {
    const ref = React.createRef<HTMLInputElement>()
    render(
      <BulkImportFileInput
        id="test-input"
        fileInputRef={ref}
        onFileChange={() => {}}
      />
    )

    expect(ref.current).toBeInstanceOf(HTMLInputElement)
  })
})

describe('BulkImportErrorAlert', () => {
  it('should return null when error is null', () => {
    const { container } = render(<BulkImportErrorAlert error={null} />)
    expect(container.firstChild).toBeNull()
  })

  it('should return null when error is empty string', () => {
    const { container } = render(<BulkImportErrorAlert error="" />)
    // Empty string is falsy, should still render the error
    // Actually checking the implementation - empty string is still truthy in JSX
    // Let me check - if (!error) return null; - empty string is falsy
    expect(container.firstChild).toBeNull()
  })

  it('should render error message', () => {
    render(<BulkImportErrorAlert error="File khong hop le" />)

    expect(screen.getByText('File khong hop le')).toBeInTheDocument()
  })

  it('should have alert triangle icon', () => {
    render(<BulkImportErrorAlert error="Error message" />)

    // Check for aria-hidden icon
    const icon = document.querySelector('[aria-hidden="true"]')
    expect(icon).toBeInTheDocument()
  })

  it('should have destructive styling class', () => {
    const { container } = render(<BulkImportErrorAlert error="Error" />)

    const alert = container.firstChild as HTMLElement
    expect(alert.className).toContain('text-destructive')
    expect(alert.className).toContain('bg-destructive')
  })
})

describe('BulkImportValidationErrors', () => {
  it('should return null when errors array is empty', () => {
    const { container } = render(<BulkImportValidationErrors errors={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('should render list of errors', () => {
    const errors = ['Error 1', 'Error 2', 'Error 3']
    render(<BulkImportValidationErrors errors={errors} />)

    errors.forEach((error) => {
      expect(screen.getByText(error)).toBeInTheDocument()
    })
  })

  it('should show header text', () => {
    render(<BulkImportValidationErrors errors={['Error']} />)

    expect(screen.getByText('Du lieu khong hop le:')).toBeInTheDocument()
  })

  it('should use default maxHeight', () => {
    const { container } = render(
      <BulkImportValidationErrors errors={['Error']} />
    )

    const list = container.querySelector('ul')
    expect(list).toHaveStyle({ maxHeight: '10rem' })
  })

  it('should use custom maxHeight', () => {
    const { container } = render(
      <BulkImportValidationErrors errors={['Error']} maxHeight="20rem" />
    )

    const list = container.querySelector('ul')
    expect(list).toHaveStyle({ maxHeight: '20rem' })
  })

  it('should render as unordered list', () => {
    const { container } = render(
      <BulkImportValidationErrors errors={['Error 1', 'Error 2']} />
    )

    const list = container.querySelector('ul')
    expect(list).toBeInTheDocument()
    expect(list?.querySelectorAll('li').length).toBe(2)
  })
})

describe('BulkImportSuccessMessage', () => {
  it('should render file name', () => {
    render(
      <BulkImportSuccessMessage fileName="test-file.xlsx" recordCount={10} />
    )

    expect(screen.getByText('test-file.xlsx')).toBeInTheDocument()
  })

  it('should render record count', () => {
    render(
      <BulkImportSuccessMessage fileName="test.xlsx" recordCount={25} />
    )

    expect(screen.getByText('25')).toBeInTheDocument()
  })

  it('should have status role for accessibility', () => {
    render(
      <BulkImportSuccessMessage fileName="test.xlsx" recordCount={10} />
    )

    expect(screen.getByRole('status')).toBeInTheDocument()
  })

  it('should have aria-live polite for screen readers', () => {
    render(
      <BulkImportSuccessMessage fileName="test.xlsx" recordCount={10} />
    )

    const status = screen.getByRole('status')
    expect(status).toHaveAttribute('aria-live', 'polite')
  })

  it('should have primary styling', () => {
    const { container } = render(
      <BulkImportSuccessMessage fileName="test.xlsx" recordCount={10} />
    )

    const message = container.firstChild as HTMLElement
    expect(message.className).toContain('text-primary')
    expect(message.className).toContain('bg-primary')
  })
})

describe('BulkImportSubmitButton', () => {
  it('should render with record count', () => {
    render(
      <BulkImportSubmitButton
        isSubmitting={false}
        disabled={false}
        recordCount={10}
        onClick={() => {}}
      />
    )

    expect(screen.getByRole('button')).toHaveTextContent('Nhap 10 ban ghi')
  })

  it('should use singular label for 1 record', () => {
    render(
      <BulkImportSubmitButton
        isSubmitting={false}
        disabled={false}
        recordCount={1}
        labelSingular="danh muc"
        labelPlural="danh muc"
        onClick={() => {}}
      />
    )

    expect(screen.getByRole('button')).toHaveTextContent('Nhap 1 danh muc')
  })

  it('should use plural label for multiple records', () => {
    render(
      <BulkImportSubmitButton
        isSubmitting={false}
        disabled={false}
        recordCount={5}
        labelSingular="item"
        labelPlural="items"
        onClick={() => {}}
      />
    )

    expect(screen.getByRole('button')).toHaveTextContent('Nhap 5 items')
  })

  it('should show loading state when submitting', () => {
    render(
      <BulkImportSubmitButton
        isSubmitting={true}
        disabled={false}
        recordCount={10}
        onClick={() => {}}
      />
    )

    expect(screen.getByRole('button')).toHaveTextContent('Dang nhap...')
  })

  it('should be disabled when disabled prop is true', () => {
    render(
      <BulkImportSubmitButton
        isSubmitting={false}
        disabled={true}
        recordCount={10}
        onClick={() => {}}
      />
    )

    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('should call onClick when clicked', () => {
    const handleClick = vi.fn()
    render(
      <BulkImportSubmitButton
        isSubmitting={false}
        disabled={false}
        recordCount={10}
        onClick={handleClick}
      />
    )

    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalled()
  })

  it('should show spinner icon when submitting', () => {
    const { container } = render(
      <BulkImportSubmitButton
        isSubmitting={true}
        disabled={false}
        recordCount={10}
        onClick={() => {}}
      />
    )

    const spinner = container.querySelector('.animate-spin')
    expect(spinner).toBeInTheDocument()
  })

  it('should not show spinner when not submitting', () => {
    const { container } = render(
      <BulkImportSubmitButton
        isSubmitting={false}
        disabled={false}
        recordCount={10}
        onClick={() => {}}
      />
    )

    const spinner = container.querySelector('.animate-spin')
    expect(spinner).not.toBeInTheDocument()
  })
})
