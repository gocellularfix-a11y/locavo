import React from 'react';

import { LegalPage } from '../components/LegalPage';

export default function TermsScreen() {
  return (
    <LegalPage
      title="Términos de uso"
      intro="Condiciones de la fase actual de demostración de Locavo."
      sections={[
        {
          heading: 'Información demostrativa',
          paragraphs: [
            'La información mostrada en esta fase es demostrativa: los lugares son datos simulados y no representan negocios reales verificados.',
            'Todavía no existe una relación comercial entre Locavo y los negocios que aparecen en la aplicación.',
          ],
        },
        {
          heading: 'Aproximaciones',
          paragraphs: [
            'Los horarios, distancias y tiempos de traslado son aproximados y pueden no reflejar la realidad. No se usa información de tráfico en tiempo real.',
            'Antes de tomar decisiones importantes (por ejemplo, un horario de cierre o la disponibilidad de un servicio), confirma la información directamente con el lugar.',
          ],
        },
        {
          heading: 'Navegación',
          paragraphs: [
            'Locavo no ofrece navegación propia paso a paso. Al pedir indicaciones se abre Google Maps, que es un servicio externo con sus propios términos y condiciones.',
          ],
        },
      ]}
      note="Documento inicial de producto. Será revisado antes de la publicación comercial."
    />
  );
}
