import React from 'react';

import { LegalPage } from '../components/LegalPage';

export default function SupportScreen() {
  return (
    <LegalPage
      title="Soporte"
      intro="Respuestas rápidas a las dudas más comunes de esta fase de demostración."
      sections={[
        {
          heading: '¿Cómo activo mi ubicación?',
          bullets: [
            'En Inicio, toca "Usar mi ubicación actual" y acepta el permiso cuando el sistema lo pida.',
            'Si antes lo rechazaste, actívalo desde los ajustes del sistema: busca Locavo en Aplicaciones → Permisos → Ubicación.',
          ],
          paragraphs: [],
        },
        {
          heading: '¿Y si no quiero compartir mi ubicación?',
          paragraphs: [
            'Puedes usar Locavo sin permiso de ubicación: en Ajustes elige una zona manual de Culiacán (Centro, Tres Ríos, Zona Universitaria o Las Vegas/Sur) y los resultados se ordenarán desde ahí.',
          ],
        },
        {
          heading: 'El mapa no carga',
          bullets: [
            'Revisa tu conexión a internet: las teselas del mapa la necesitan.',
            'Usa el botón "Reintentar mapa" del aviso.',
            'Aunque el mapa falle, la lista de lugares, la búsqueda y la recomendación siguen funcionando.',
          ],
          paragraphs: [],
        },
        {
          heading: 'Google Maps no abre',
          bullets: [
            'Vuelve a intentarlo desde el aviso que aparece en pantalla.',
            'El enlace funciona aunque no tengas la app de Google Maps: se abrirá en el navegador.',
            'Verifica que tengas un navegador habilitado en tu dispositivo.',
          ],
          paragraphs: [],
        },
        {
          heading: '¿Cómo instalo Locavo como aplicación (PWA)?',
          bullets: [
            'Abre la versión web de Locavo en Chrome o Edge.',
            'En Android: toca el menú ⋮ y elige "Agregar a pantalla principal" o "Instalar aplicación".',
            'En escritorio: usa el icono de instalación en la barra de direcciones.',
            'En iPhone (Safari): botón Compartir → "Agregar a pantalla de inicio".',
          ],
          paragraphs: [],
        },
      ]}
      note="El canal formal de contacto de soporte será publicado antes del lanzamiento."
    />
  );
}
