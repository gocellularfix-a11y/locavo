import React from 'react';

import { LegalPage } from '../components/LegalPage';

export default function PrivacyScreen() {
  return (
    <LegalPage
      title="Privacidad"
      intro="Así maneja Locavo tu información en la fase actual de demostración (Fase 1)."
      sections={[
        {
          heading: 'Ubicación',
          paragraphs: [
            'Locavo solicita tu ubicación únicamente para mostrarte lugares cercanos y ordenar los resultados. La lectura es puntual: ocurre solo cuando tú la pides.',
          ],
          bullets: [
            'No hay seguimiento continuo de tu posición.',
            'No se usa ubicación en segundo plano.',
            'No se guarda historial de recorridos.',
            'Tu ubicación no se envía a ningún servidor de Locavo.',
            'Si rechazas el permiso, puedes usar una zona manual de Culiacán y la app sigue funcionando.',
          ],
        },
        {
          heading: 'Cuenta y datos personales',
          paragraphs: [
            'Locavo no requiere cuenta, registro ni datos personales para usarse en esta fase.',
          ],
        },
        {
          heading: 'Analítica',
          paragraphs: [
            'La analítica de esta fase es demostrativa y permanece únicamente en tu dispositivo (por ejemplo, qué categoría se seleccionó). No se conecta ningún servicio externo de analítica y no se registran coordenadas en los eventos.',
          ],
        },
        {
          heading: 'Datos de lugares',
          paragraphs: [
            'Los lugares mostrados actualmente son datos simulados de demostración, identificados con el prefijo "Demo". No representan negocios reales verificados.',
          ],
        },
        {
          heading: 'Servicios externos',
          paragraphs: [
            'Cuando pides indicaciones, Google Maps se abre externamente (app o navegador) y aplica su propia política de privacidad.',
            'El mapa interno usa teselas de proveedores externos (OpenStreetMap), por lo que cargarlas puede requerir conexión con esos servidores.',
          ],
        },
      ]}
      note="Documento inicial de producto. Será revisado antes de la publicación comercial."
    />
  );
}
