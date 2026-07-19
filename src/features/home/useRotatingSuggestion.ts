import { useEffect, useState } from 'react';
import { Animated, Easing } from 'react-native';

import { createSuggestionRotator, nextSuggestionIndex, suggestionTransition } from './suggestionRotator';

export interface RotatingSuggestion {
  index: number;
  opacity: Animated.Value;
  translateY: Animated.Value;
}

/**
 * Rotación animada de sugerencias del hero.
 *
 * - Avanza solo cuando `active` es verdadero (pantalla enfocada y app en
 *   primer plano); el temporizador se limpia al desactivarse o desmontar.
 * - Con movimiento reducido, el cambio es instantáneo (sin fundido).
 * - Sin regiones vivas: el lector de pantalla no anuncia cada rotación.
 */
export function useRotatingSuggestion(
  count: number,
  active: boolean,
  reducedMotion: boolean,
): RotatingSuggestion {
  const [index, setIndex] = useState(0);
  const [opacity] = useState(() => new Animated.Value(1));
  const [translateY] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!active || count <= 1) {
      return;
    }
    const transition = suggestionTransition(reducedMotion);

    const advance = () => {
      if (!transition.animated) {
        setIndex((current) => nextSuggestionIndex(current, count));
        return;
      }
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: transition.fadeMs,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: -transition.translate,
          duration: transition.fadeMs,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => {
        if (!finished) {
          return;
        }
        setIndex((current) => nextSuggestionIndex(current, count));
        translateY.setValue(transition.translate);
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: transition.fadeMs,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: transition.fadeMs,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
        ]).start();
      });
    };

    const rotator = createSuggestionRotator(advance);
    rotator.start();
    return () => {
      rotator.stop();
      opacity.stopAnimation();
      translateY.stopAnimation();
      opacity.setValue(1);
      translateY.setValue(0);
    };
  }, [active, reducedMotion, count, opacity, translateY]);

  return { index: count > 0 ? index % count : 0, opacity, translateY };
}
