/**
 * Debounce Utility
 * Performance optimization for filter changes and API calls
 * @see specs/003-consumption-filters-llm/tasks.md T052
 */

/**
 * Creates a debounced version of a function that delays invoking until
 * after `wait` milliseconds have elapsed since the last invocation.
 *
 * @param fn - The function to debounce
 * @param wait - The number of milliseconds to delay (default: 300ms)
 * @param immediate - If true, trigger on the leading edge instead of trailing
 * @returns A debounced version of the function with cancel() method
 */
export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  wait = 300,
  immediate = false
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const debounced = function (this: unknown, ...args: Parameters<T>) {
    const callNow = immediate && !timeoutId

    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      timeoutId = null
      if (!immediate) {
        fn.apply(this, args)
      }
    }, wait)

    if (callNow) {
      fn.apply(this, args)
    }
  }

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  return debounced
}

/**
 * Creates a throttled version of a function that only invokes at most
 * once per every `wait` milliseconds.
 *
 * @param fn - The function to throttle
 * @param wait - The number of milliseconds to throttle (default: 300ms)
 * @returns A throttled version of the function
 */
export function throttle<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  wait = 300
): (...args: Parameters<T>) => void {
  let lastCall = 0
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  return function (this: unknown, ...args: Parameters<T>) {
    const now = Date.now()
    const remaining = wait - (now - lastCall)

    if (remaining <= 0) {
      if (timeoutId) {
        clearTimeout(timeoutId)
        timeoutId = null
      }
      lastCall = now
      fn.apply(this, args)
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        lastCall = Date.now()
        timeoutId = null
        fn.apply(this, args)
      }, remaining)
    }
  }
}

/**
 * Vue composable for debounced ref updates
 * Useful for search inputs and filter fields
 *
 * @param initialValue - Initial value
 * @param delay - Debounce delay in ms (default: 300ms)
 * @returns Object with value ref and debounced value ref
 */
import { ref, watch, type Ref } from 'vue'

export function useDebouncedRef<T>(
  initialValue: T,
  delay = 300
): { value: Ref<T>; debouncedValue: Ref<T> } {
  const value = ref(initialValue) as Ref<T>
  const debouncedValue = ref(initialValue) as Ref<T>

  let timeoutId: ReturnType<typeof setTimeout> | null = null

  watch(value, (newValue) => {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    timeoutId = setTimeout(() => {
      debouncedValue.value = newValue
    }, delay)
  })

  return { value, debouncedValue }
}

export default {
  debounce,
  throttle,
  useDebouncedRef
}
