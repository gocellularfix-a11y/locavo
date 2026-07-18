import { useRouter } from 'expo-router';
import React from 'react';

import { EmptyState } from '../components/FeedbackStates';
import { ScreenContainer } from '../components/ScreenContainer';

export default function NotFoundScreen() {
  const router = useRouter();
  return (
    <ScreenContainer>
      <EmptyState
        title="Pantalla no encontrada"
        message="La ruta que intentaste abrir no existe."
        actionLabel="Ir al inicio"
        onAction={() => router.replace('/')}
      />
    </ScreenContainer>
  );
}
