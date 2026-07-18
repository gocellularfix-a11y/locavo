import { useRouter } from 'expo-router';
import React from 'react';

import { EmptyState } from '../components/FeedbackStates';
import { ScreenContainer } from '../components/ScreenContainer';
import { useI18n } from '../i18n/I18nContext';

export default function NotFoundScreen() {
  const router = useRouter();
  const { t } = useI18n();
  return (
    <ScreenContainer>
      <EmptyState
        title={t('state.notFoundTitle')}
        message={t('state.notFoundBody')}
        actionLabel={t('common.goHome')}
        onAction={() => router.replace('/')}
      />
    </ScreenContainer>
  );
}
