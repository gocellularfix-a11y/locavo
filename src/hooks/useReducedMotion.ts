import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Preferencia de movimiento reducido del sistema (iOS/Android/web).
 * Degrada a `false` cuando la plataforma no expone la consulta.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (mounted) {
          setReduced(Boolean(value));
        }
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', (value) => {
      setReduced(Boolean(value));
    });
    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, []);

  return reduced;
}
