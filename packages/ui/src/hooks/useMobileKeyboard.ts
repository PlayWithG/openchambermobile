/**
 * useMobileKeyboard
 *
 * Reads the keyboard-open state and inset that MainLayout already tracks
 * via the visualViewport API and `--oc-keyboard-inset` CSS variable.
 *
 * Components that need keyboard awareness can use this hook instead of
 * subscribing to UIStore directly.
 */
import React from 'react';
import { useUIStore } from '@/stores/useUIStore';

export interface MobileKeyboardState {
  /** True when the virtual keyboard is visible */
  isKeyboardOpen: boolean;
  /** Height of the keyboard in pixels (0 when closed) */
  keyboardInset: number;
}

/**
 * Returns live keyboard state by reading UIStore + the CSS variable
 * `--oc-keyboard-inset` that MainLayout keeps up to date.
 */
export function useMobileKeyboard(): MobileKeyboardState {
  const isKeyboardOpen = useUIStore((state) => state.isKeyboardOpen);

  // Read the current inset from the CSS variable (updated by MainLayout)
  const [keyboardInset, setKeyboardInset] = React.useState(0);

  React.useEffect(() => {
    const readInset = () => {
      const raw = getComputedStyle(document.documentElement)
        .getPropertyValue('--oc-keyboard-inset')
        .trim();
      const value = parseFloat(raw);
      setKeyboardInset(Number.isFinite(value) ? value : 0);
    };

    readInset();

    // Re-read whenever keyboard open state changes
    const observer = new MutationObserver(readInset);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['style'],
    });

    return () => observer.disconnect();
  }, [isKeyboardOpen]);

  return { isKeyboardOpen, keyboardInset };
}
