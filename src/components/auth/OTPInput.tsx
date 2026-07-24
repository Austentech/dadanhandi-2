'use client'

import { useRef, useState, useCallback, KeyboardEvent, ClipboardEvent, InputHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

interface OTPInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  length?: number
  value: string
  onChange: (value: string) => void
  error?: boolean
  disabled?: boolean
  autoFocus?: boolean
}

const OTPInput = forwardRef<HTMLInputElement, OTPInputProps>(
  ({ length = 6, value, onChange, error, disabled, autoFocus, className, ...props }, ref) => {
    const inputRefs = useRef<(HTMLInputElement | null)[]>([])
    const [focusedIndex, setFocusedIndex] = useState(-1)

    const setRef = useCallback(
      (index: number) => (el: HTMLInputElement | null) => {
        inputRefs.current[index] = el
        if (index === 0 && ref) {
          if (typeof ref === 'function') ref(el)
          else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = el
        }
      },
      [ref]
    )

    const focusInput = useCallback(
      (index: number) => {
        if (index >= 0 && index < length) {
          inputRefs.current[index]?.focus()
          setFocusedIndex(index)
        }
      },
      [length]
    )

    const handleKeyDown = useCallback(
      (index: number) => (e: KeyboardEvent<HTMLInputElement>) => {
        if (disabled) return

        if (e.key === 'Backspace') {
          e.preventDefault()
          const currentVal = value[index] || ''
          if (currentVal) {
            const newValue = value.slice(0, index) + '' + value.slice(index + 1)
            onChange(newValue)
          } else if (index > 0) {
            const newValue = value.slice(0, index - 1) + '' + value.slice(index)
            onChange(newValue)
            focusInput(index - 1)
          }
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault()
          focusInput(index - 1)
        } else if (e.key === 'ArrowRight') {
          e.preventDefault()
          focusInput(index + 1)
        }
      },
      [disabled, value, onChange, focusInput]
    )

    const handleInput = useCallback(
      (index: number) => (e: React.ChangeEvent<HTMLInputElement>) => {
        if (disabled) return

        const char = e.target.value.replace(/\D/g, '')
        if (char.length === 0) return

        const digit = char[0]
        const newValue = value.slice(0, index) + digit + value.slice(index + 1)
        onChange(newValue)

        if (index < length - 1) {
          focusInput(index + 1)
        }
      },
      [disabled, value, length, onChange, focusInput]
    )

    const handlePaste = useCallback(
      (e: ClipboardEvent<HTMLInputElement>) => {
        if (disabled) return
        e.preventDefault()

        const pastedData = e.clipboardData.getData('text/plain').replace(/\D/g, '').slice(0, length)
        if (pastedData.length > 0) {
          onChange(pastedData)
          const nextIndex = Math.min(pastedData.length, length - 1)
          focusInput(nextIndex)
        }
      },
      [disabled, length, onChange, focusInput]
    )

    const handleFocus = useCallback((index: number) => () => {
      setFocusedIndex(index)
      inputRefs.current[index]?.select()
    }, [])

    const handleBlur = useCallback(() => {
      setFocusedIndex(-1)
    }, [])

    return (
      <div
        className={cn('otp-input-container', error && 'otp-input-error', disabled && 'otp-input-disabled', className)}
        role="group"
        aria-label="One-time password"
      >
        {Array.from({ length }, (_, index) => {
          const digit = value[index] || ''
          const isFocused = focusedIndex === index
          const isFilled = digit !== ''

          return (
            <input
              key={index}
              ref={setRef(index)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              autoComplete={index === 0 ? 'one-time-code' : 'off'}
              autoFocus={autoFocus && index === 0}
              disabled={disabled}
              value={digit}
              aria-label={`Digit ${index + 1} of ${length}`}
              aria-invalid={error}
              className={cn(
                'otp-digit',
                isFocused && 'otp-digit-focused',
                isFilled && 'otp-digit-filled',
                error && 'otp-digit-error'
              )}
              onChange={handleInput(index)}
              onKeyDown={handleKeyDown(index)}
              onPaste={index === 0 ? handlePaste : undefined}
              onFocus={handleFocus(index)}
              onBlur={handleBlur}
              {...props}
            />
          )
        })}
      </div>
    )
  }
)

OTPInput.displayName = 'OTPInput'

export default OTPInput
