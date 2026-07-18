# Locavo — Guía de aceptación en dispositivo

Esta guía es para el propietario del proyecto. Sirve para confirmar, con un
teléfono real en la mano, que Locavo funciona bien antes de dar por buena la
fase. No necesitas conocimientos técnicos: sigue los pasos en orden y anota lo
que veas.

> **Importante:** hasta que alguien complete esta guía en un teléfono físico,
> el estado del proyecto es **TECHNICALLY READY — OWNER DEVICE ACCEPTANCE
> PENDING**. Ninguna validación automática sustituye esta prueba.

---

## Preparación

1. Instala la app **Expo Go** en tu teléfono (Play Store o App Store).
2. Conecta la computadora y el teléfono a la **misma red Wi-Fi**.
3. En la computadora, dentro de la carpeta del proyecto, ejecuta:

   ```bash
   npm install
   npm run start:lan
   ```

4. Escanea el código QR que aparece en la terminal:
   - **Android:** desde la propia app Expo Go.
   - **iPhone:** con la cámara; te ofrecerá abrir en Expo Go.
5. Si el QR no conecta (redes que bloquean dispositivos entre sí), detén el
   servidor (Ctrl+C) y usa el modo túnel:

   ```bash
   npm run start:tunnel
   ```

Cuando termines todas las pruebas, **detén el servidor con Ctrl+C**.

---

## Escenario A — Inicio limpio

1. Abre Locavo (primera vez, sin configurar nada).
2. Confirma que ves el logo **locavo** y la frase **"No busques. Decide."**
3. Confirma que aparecen las 8 categorías (Comida, Cerveza, Café, Hospedaje,
   Farmacias, Gasolineras, Tiendas, Vida nocturna).
4. Confirma que no aparece ningún error ni pantalla en blanco.
5. Confirma que en la parte inferior de Inicio se avisa que los lugares son
   **datos de demostración**.

## Escenario B — Ubicación concedida

1. En Inicio, toca **"Usar mi ubicación actual"**.
2. Acepta el permiso cuando el sistema lo pida.
3. Confirma que el texto de ubicación cambia a **"Tu ubicación actual"**.
4. Entra a **Explorar** y confirma que hay resultados con distancias.
5. Confirma que el mapa carga y muestra marcadores.
6. Confirma que aparece la tarjeta **"MEJOR OPCIÓN AHORA"** con una
   explicación de por qué se recomienda.

## Escenario C — Ubicación rechazada

*(Si ya concediste el permiso: desinstala y reinstala Expo Go, o revoca el
permiso de ubicación de Expo Go en los ajustes del sistema.)*

1. Toca **"Usar mi ubicación actual"** y **rechaza** el permiso.
2. Confirma que la app **no se bloquea** y muestra un mensaje claro.
3. Ve a **Ajustes** (pestaña inferior) y elige una zona manual, por ejemplo
   **Tres Ríos**.
4. Vuelve a Explorar y confirma que hay resultados ordenados desde esa zona.

## Escenario D — Mapa

1. En Explorar, toca una **tarjeta** de la lista y confirma que su marcador
   se destaca en el mapa (más grande y de color distinto).
2. Toca un **marcador** del mapa y confirma que su tarjeta se destaca.
3. Activa el **modo avión** (o apaga Wi-Fi y datos).
4. Recarga la pantalla Explorar (sal y vuelve a entrar): confirma que
   aparece el aviso **"No pudimos cargar el mapa"** con el botón
   **"Reintentar mapa"**, y que la **lista sigue funcionando**.
5. Desactiva el modo avión, toca **"Reintentar mapa"** y confirma que el
   mapa vuelve.

## Escenario E — Google Maps

1. Abre el detalle de cualquier lugar.
2. Toca **"Cómo llegar"**.
3. Confirma que se abre **Google Maps** (o el navegador si no está
   instalada) con la ruta al destino.
4. Regresa a Locavo (botón atrás / cambio de app).
5. Confirma que Locavo sigue exactamente donde estaba.

## Escenario F — Tema

1. En Ajustes prueba **Según el sistema**, **Modo claro** y **Modo oscuro**.
2. Confirma que toda la interfaz cambia de forma coherente (no solo el fondo).
3. Deja **Modo oscuro**, cierra la app por completo y vuelve a abrirla.
4. Confirma que sigue en modo oscuro (la preferencia persiste).

## Escenario G — Búsqueda

En Inicio o Explorar busca, una por una:

```
cafe
café
farmacia
cerveza
hotel
```

Confirma que `cafe` y `café` devuelven los **mismos resultados** y que cada
búsqueda encuentra lugares de la categoría esperada.

## Escenario H — Instalación PWA

1. En la computadora ejecuta:

   ```bash
   npm run acceptance:web
   ```

2. En el navegador del teléfono (misma red) abre la dirección que indica la
   terminal usando la IP de la computadora, por ejemplo
   `http://192.168.1.XX:4173`.
3. Instala la app: en Chrome/Edge Android, menú ⋮ → **"Agregar a pantalla
   principal"** / **"Instalar aplicación"**; en iPhone (Safari), Compartir →
   **"Agregar a pantalla de inicio"**.
4. Abre Locavo desde el icono instalado y confirma que abre **sin barra de
   navegador** (modo standalone) con su icono coral.
5. En el navegador, abre directamente estas rutas y confirma que cargan y
   permiten volver a la app:
   - `/privacy`
   - `/terms`
   - `/support`
6. Al terminar, detén el servidor con Ctrl+C.

---

## Registro de resultados

Copia esta tabla por cada dispositivo probado:

| Campo | Valor |
| --- | --- |
| Dispositivo | |
| Sistema operativo | |
| Versión | |
| Escenario | A / B / C / D / E / F / G / H |
| Resultado | OK / Falla |
| Problema observado | |
| Captura/video | |

## Decisión final

```
OWNER DEVICE ACCEPTANCE:
[ ] Approved
[ ] Approved with minor corrections
[ ] Rejected — corrections required
```

Firmado por: ______________________ Fecha: ____________
