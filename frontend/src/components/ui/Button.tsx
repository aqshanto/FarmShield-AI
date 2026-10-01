import { type HTMLMotionProps, motion } from 'framer-motion'
import type { ReactNode } from 'react'
import { spring } from '@/lib/motion'
import { type ButtonSize, type ButtonVariant, buttonStyles } from './button-styles'
import { Spinner } from './Spinner'

export interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'children'> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
  children?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconRight,
  disabled,
  className,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  const inactive = disabled || loading

  return (
    <motion.button
      type={type}
      disabled={inactive}
      aria-busy={loading || undefined}
      // Springy squish on press; hover lift comes from CSS in buttonStyles.
      whileTap={inactive ? undefined : { scale: 0.95 }}
      transition={spring.snappy}
      className={buttonStyles({ variant, size, className })}
      {...props}
    >
      {loading ? <Spinner className="size-4" /> : icon}
      {children}
      {!loading && iconRight}
    </motion.button>
  )
}
