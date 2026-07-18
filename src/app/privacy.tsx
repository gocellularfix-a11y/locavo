import React from 'react';

import { LegalPage } from '../components/LegalPage';
import { useI18n } from '../i18n/I18nContext';

export default function PrivacyScreen() {
  const { t } = useI18n();
  return (
    <LegalPage
      title={t('privacy.title')}
      intro={t('privacy.intro')}
      sections={[
        {
          heading: t('privacy.location.title'),
          paragraphs: [t('privacy.location.body')],
          bullets: [
            t('privacy.location.b1'),
            t('privacy.location.b2'),
            t('privacy.location.b3'),
            t('privacy.location.b4'),
            t('privacy.location.b5'),
          ],
        },
        {
          heading: t('privacy.account.title'),
          paragraphs: [t('privacy.account.body')],
        },
        {
          heading: t('privacy.analytics.title'),
          paragraphs: [t('privacy.analytics.body')],
        },
        {
          heading: t('privacy.data.title'),
          paragraphs: [t('privacy.data.body')],
        },
        {
          heading: t('privacy.external.title'),
          paragraphs: [t('privacy.external.body1'), t('privacy.external.body2')],
        },
      ]}
      note={t('legal.note')}
    />
  );
}
