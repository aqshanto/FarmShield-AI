import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Teach tailwind-merge our custom tokens so they aren't mistaken for text colors.
const twMerge = extendTailwindMerge<'text-gradient'>({
  extend: {
    theme: { text: ['display'] },
    classGroups: { 'text-gradient': ['text-gradient-brand'] },
  },
})

// Merge conditional class names; later Tailwind classes win over earlier ones.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
