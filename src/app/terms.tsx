import React from 'react';

import { LegalPage } from '../components/LegalPage';
import { useI18n } from '../i18n/I18nContext';

export default function TermsScreen() {
  const { t } = useI18n();
  return (
    <LegalPage
      title={t('terms.title')}
      intro={t('terms.intro')}
      sections={[
        {
          heading: t('terms.demo.title'),
          paragraphs: [t('terms.demo.body1'), t('terms.demo.body2')],
        },
        {
          heading: t('terms.approx.title'),
          paragraphs: [t('terms.approx.body1'), t('terms.approx.body2')],
        },
        {
          heading: t('terms.nav.title'),
          paragraphs: [t('terms.nav.body')],
        },
      ]}
      note={t('legal.note')}
    />
  );
}
