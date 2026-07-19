import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

/**
 * `true` solo cuando la pantalla está enfocada Y la app en primer plano.
 * Permite pausar animaciones/temporizadores al salir o al ir a segundo
 * plano, evitando timers duplicados al volver.
 */
export function useScreenActive(): boolean {
  const [focused, setFocused] = useState(false);
  const [appActive, setAppActive] = useState(AppState.currentState !== 'background');

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      setAppActive(state === 'active');
    });
    return () => subscription.remove();
  }, []);

  return focused && appActive;
}
