import React from 'react';

import { LegalPage } from '../components/LegalPage';
import { useI18n } from '../i18n/I18nContext';

export default function SupportScreen() {
  const { t } = useI18n();
  return (
    <LegalPage
      title={t('support.title')}
      intro={t('support.intro')}
      sections={[
        {
          heading: t('support.enable.title'),
          paragraphs: [],
          bullets: [t('support.enable.b1'), t('support.enable.b2')],
        },
        {
          heading: t('support.manual.title'),
          paragraphs: [t('support.manual.body')],
        },
        {
          heading: t('support.map.title'),
          paragraphs: [],
          bullets: [t('support.map.b1'), t('support.map.b2'), t('support.map.b3')],
        },
        {
          heading: t('support.maps.title'),
          paragraphs: [],
          bullets: [t('support.maps.b1'), t('support.maps.b2'), t('support.maps.b3')],
        },
        {
          heading: t('support.pwa.title'),
          paragraphs: [],
          bullets: [
            t('support.pwa.b1'),
            t('support.pwa.b2'),
            t('support.pwa.b3'),
            t('support.pwa.b4'),
          ],
        },
      ]}
      note={t('support.note')}
    />
  );
}
