# LOCAVO — PROTOCOLO MAESTRO DE DESARROLLO Y AUDITORÍA

**Versión:** 1.0
**Propietario del producto:** Jorge Ochoa
**Modelo operativo:** Fundador único asistido por inteligencia artificial
**Proyecto:** Locavo
**Mercado inicial:** México
**Ciudad inicial:** Culiacán, Sinaloa
**Plataformas:** Android, iOS mediante PWA e instalable en navegador
**Filosofía:** Offline-first, deterministic-first, automation-first, Mexico-first

> **Nota de estado:** Este documento se conserva **verbatim** tal como lo autorizó el propietario.
> Las inexactitudes fácticas detectadas en la auditoría §35 (plataforma, offline, determinismo,
> gobernanza) NO se editan dentro de las secciones numeradas; se corrigen en el **Anexo de
> Auditoría §35** al final del archivo, hasta que el propietario ratifique cada corrección.

---

# 1. PROPÓSITO DEL DOCUMENTO

Este documento establece el proceso obligatorio para diseñar, implementar, auditar, corregir, validar y aprobar cada ronda de desarrollo de Locavo.

Su objetivo no es producir código rápidamente.

Su objetivo es permitir que un fundador único pueda producir y mantener software con la disciplina de un equipo de ingeniería mucho más grande.

El proceso divide claramente las responsabilidades:

* Jorge define la visión, prioridades y decisiones finales.
* ChatGPT diseña la arquitectura y audita de forma independiente.
* Claude implementa el trabajo autorizado.
* Los tests y quality gates verifican el comportamiento.
* Git conserva evidencia exacta de cada cambio.
* La Constitución de Locavo gobierna todas las decisiones.

Ningún modelo de inteligencia artificial tiene autoridad final sobre el proyecto.

La autoridad final pertenece al propietario del producto.

---

# 2. MODELO DE OPERACIÓN

Locavo será desarrollado y operado por una sola persona.

Por lo tanto, toda decisión debe considerar:

* mantenimiento futuro;
* tiempo requerido por el propietario;
* necesidad de soporte;
* complejidad operativa;
* automatización posible;
* dependencia de terceros;
* costo de infraestructura;
* riesgo de crecimiento;
* facilidad de auditoría;
* capacidad de recuperación.

Locavo no debe depender de la futura contratación de empleados para funcionar correctamente.

Una característica que solo puede mantenerse con un equipo grande no debe introducirse prematuramente.

La arquitectura debe multiplicar la capacidad del fundador.

---

# 3. PRINCIPIO CENTRAL

Antes de implementar cualquier característica se debe responder:

> ¿Esta decisión permite que Jorge haga más trabajo con menos intervención futura?

Una característica debe cumplir por lo menos una de estas condiciones:

1. Reducir trabajo manual.
2. Automatizar una operación repetitiva.
3. Crear infraestructura reutilizable.
4. Mejorar significativamente la experiencia del usuario.
5. Reducir riesgo técnico u operativo.
6. Preparar una capacidad futura claramente autorizada.
7. Reemplazar una dependencia costosa o difícil de mantener.

Si no cumple ninguna, debe posponerse o rechazarse.

---

# 4. ROLES PERMANENTES

## 4.1 Jorge — Founder and Product Authority

Jorge es responsable de:

* visión del producto;
* prioridades;
* experiencia deseada;
* mercado inicial;
* decisiones comerciales;
* aprobación de arquitectura;
* aprobación de cambios de alcance;
* autorización de commits;
* autorización de pushes;
* autorización de releases;
* aceptación final.

Jorge no necesita definir cada detalle técnico.

La arquitectura y las herramientas deben traducir su intención en especificaciones ejecutables.

## 4.2 ChatGPT — Arquitecto y Auditor Independiente

ChatGPT tiene dos funciones separadas.

### Función de arquitectura

Antes de que Claude programe, ChatGPT debe:

* entender el objetivo;
* analizar el estado real del repositorio;
* identificar riesgos;
* definir límites;
* definir arquitectura;
* definir aceptación;
* definir tests obligatorios;
* definir exclusiones;
* preparar el handoff para Claude.

### Función de auditoría

Después de que Claude termine, ChatGPT debe:

* revisar la evidencia;
* verificar el diff;
* comprobar que se respetó el alcance;
* buscar duplicación;
* identificar deuda técnica;
* revisar determinismo;
* revisar rendimiento;
* revisar compatibilidad offline;
* revisar mantenimiento para un fundador único;
* clasificar hallazgos;
* aprobar, aprobar con condiciones o rechazar.

ChatGPT no debe aprobar una ronda únicamente porque los tests estén verdes.

Los tests pueden demostrar que el código funciona, pero no necesariamente que la arquitectura sea correcta.

## 4.3 Claude — Principal Software Engineer

Claude es responsable de:

* inspeccionar el repositorio;
* seguir la especificación autorizada;
* reproducir defectos antes de corregirlos;
* implementar cambios mínimos y correctos;
* reutilizar implementaciones canónicas;
* añadir pruebas de alto valor;
* ejecutar quality gates;
* documentar resultados;
* detenerse antes del commit salvo autorización expresa.

Claude no debe:

* redefinir el producto;
* ampliar el alcance;
* introducir servicios no autorizados;
* duplicar motores existentes;
* cambiar arquitectura sin aprobación;
* efectuar refactors generales no solicitados;
* añadir dependencias sin justificación;
* hacer commit o push sin autorización;
* ocultar riesgos;
* afirmar pruebas físicas que no se realizaron.

---

# 5. FUENTE DE VERDAD

El orden de autoridad es:

1. Decisión explícita de Jorge.
2. Constitución vigente de Locavo.
3. Especificación autorizada de la ronda.
4. Arquitectura canónica del repositorio.
5. Tests de aceptación.
6. Código existente.
7. Paquetes externos o candidatos.
8. Sugerencias de modelos de inteligencia artificial.

Cuando un paquete externo contradice la arquitectura actual, la arquitectura canónica gana.

Cuando el código existente contradice una especificación nueva explícitamente autorizada, la especificación autorizada gana.

Las contradicciones deben señalarse; nunca resolverse silenciosamente.

---

# 6. CICLO OBLIGATORIO DE DESARROLLO

Toda ronda seguirá este orden:

```text
Visión del fundador
        ↓
Investigación del estado real
        ↓
Diseño arquitectónico
        ↓
Handoff de implementación
        ↓
Pre-flight de Claude
        ↓
Reproducción del defecto o baseline
        ↓
Implementación mínima
        ↓
Pruebas focalizadas
        ↓
Quality gates completos
        ↓
Reporte antes del commit
        ↓
Auditoría independiente de ChatGPT
        ↓
Correcciones de auditoría
        ↓
Revalidación completa
        ↓
Aprobación del fundador
        ↓
Commit
        ↓
Push
        ↓
Aceptación física o de producción
        ↓
Cierre y actualización del baseline
```

No se debe saltar directamente de una idea a la implementación.

---

# 7. FASE A — DEFINICIÓN DE LA RONDA

Antes de entregar trabajo a Claude, ChatGPT debe producir una especificación que incluya:

## 7.1 Identidad de la ronda

* Nombre.
* Código del milestone.
* Objetivo.
* Problema real que resuelve.
* Razón para hacerlo ahora.
* Baseline esperado.
* Commit base.
* Branch autorizada.
* Estado esperado del working tree.

## 7.2 Alcance autorizado

Debe describir exactamente:

* módulos permitidos;
* archivos probablemente afectados;
* comportamiento que debe cambiar;
* comportamiento que debe preservarse;
* plataformas incluidas;
* datos incluidos;
* interfaces incluidas.

## 7.3 Fuera de alcance

Debe incluir una lista explícita de cosas que Claude no puede hacer.

Ejemplos:

* no rediseñar UI;
* no introducir Supabase;
* no añadir Google Places;
* no introducir LLM;
* no crear migraciones;
* no cambiar identidad UUID;
* no añadir telemetría remota;
* no actualizar paquetes;
* no cambiar versiones;
* no crear instalador;
* no publicar release;
* no hacer commit;
* no hacer push.

## 7.4 Invariantes

Debe identificar los comportamientos que no pueden romperse.

Ejemplos:

* funcionamiento offline;
* identidad canónica;
* compatibilidad Web y Android;
* siete idiomas;
* CityPack activo;
* fallback local;
* búsqueda determinista;
* datos de fuentes separados;
* ausencia de servicios remotos;
* build reproducible.

## 7.5 Criterios de aceptación

Cada criterio debe ser verificable.

No usar criterios vagos como:

* “hacerlo mejor”;
* “mejorar inteligencia”;
* “hacerlo más rápido”;
* “modernizar código”.

Usar criterios como:

* una coincidencia exacta de nombre debe superar coincidencias genéricas;
* dos ejecuciones con los mismos datos deben producir el mismo orden;
* ninguna página puede repetir un resultado anterior;
* el build web debe completar con exit code 0;
* no se deben añadir dependencias;
* el resultado debe funcionar sin conexión.

---

# 8. FASE B — PRE-FLIGHT OBLIGATORIO

Claude debe comenzar con operaciones de solo lectura.

Debe reportar:

* directorio correcto;
* branch actual;
* HEAD;
* origin correspondiente;
* estado del working tree;
* últimos commits;
* versión actual;
* existencia de archivos no rastreados;
* paquetes externos relevantes;
* checksums cuando aplique;
* invariantes principales observados.

Claude no debe modificar archivos hasta terminar el pre-flight.

Si el working tree no está limpio y la ronda exige un árbol limpio, debe detenerse y reportarlo.

No debe eliminar, guardar, mover ni incorporar cambios existentes sin autorización.

---

# 9. FASE C — AUDITORÍA ANTES DE IMPLEMENTAR

Claude debe inspeccionar el código actual antes de proponer una solución.

Debe localizar:

* implementación canónica;
* servicios involucrados;
* contratos;
* modelos de dominio;
* repositorios;
* adaptadores;
* tests existentes;
* composición de dependencias;
* consumidores del comportamiento;
* riesgos de compatibilidad.

Debe responder:

1. ¿Ya existe una solución parcial?
2. ¿Existe un motor canónico reutilizable?
3. ¿La nueva propuesta duplicaría lógica?
4. ¿El defecto está en dominio, servicio, repositorio o UI?
5. ¿Cuál es el cambio mínimo?
6. ¿Qué comportamiento puede afectarse?
7. ¿Qué pruebas ya cubren el área?
8. ¿Conviene extender tests existentes o crear nuevos?

---

# 10. FASE D — DEMOSTRACIÓN DEL DEFECTO

Cuando la ronda corrige un defecto, Claude debe demostrarlo antes de cambiar producción.

La demostración preferida es un test automatizado que:

* falle contra el código actual;
* represente la ruta real;
* use datos deterministas;
* falle por la causa esperada;
* no dependa de temporizadores;
* no dependa de red;
* no dependa de datos aleatorios;
* no pruebe solamente un mock irrelevante.

El reporte debe incluir:

* escenario;
* resultado esperado;
* resultado real;
* mensaje de fallo;
* causa raíz;
* prueba de que el fallo corresponde al defecto.

No debe implementarse una corrección basada únicamente en sospechas.

---

# 11. FASE E — IMPLEMENTACIÓN

La implementación debe ser:

* mínima;
* focalizada;
* determinista;
* reutilizable cuando sea razonable;
* compatible con la arquitectura;
* fácil de revertir;
* fácil de auditar.

## 11.1 Reglas de implementación

Claude debe:

* reutilizar motores canónicos;
* evitar nueva abstracción sin consumidor;
* evitar código “por si acaso”;
* evitar flags temporales sin plan;
* evitar duplicar scoring;
* evitar duplicar modelos de identidad;
* evitar lógica escondida en UI;
* preservar contratos públicos;
* manejar errores explícitamente;
* documentar límites de seguridad;
* incluir desempates estables;
* mantener orden determinista.

## 11.2 Cambio mínimo

“Cambio mínimo” no significa el menor número posible de líneas.

Significa:

> El cambio más pequeño que corrige completamente la causa raíz sin crear deuda injustificada.

Un parche de dos líneas que oculta el síntoma no es preferible a una corrección estructural bien limitada.

---

# 12. FASE F — FILOSOFÍA DE TESTING

El objetivo no es maximizar el número de tests.

El objetivo es:

> Maximizar la confianza y minimizar el mantenimiento futuro.

## 12.1 Prioridad de pruebas

1. Regresión de la causa raíz.
2. Invariante arquitectónico.
3. Integridad de datos.
4. Determinismo.
5. Paginación.
6. Compatibilidad.
7. Manejo de errores.
8. Rendimiento cuando sea material.

## 12.2 Reglas

Preferir:

* extender archivos de test existentes;
* fixtures pequeños;
* datos legibles;
* tests de comportamiento;
* ruta real de servicio;
* nombres que expliquen la regresión.

Evitar:

* duplicar cobertura;
* snapshots gigantes;
* tests dependientes de hora actual;
* datos aleatorios;
* sleep;
* red;
* implementación interna innecesariamente acoplada;
* pruebas triviales de getters y setters.

## 12.3 Tests obligatorios para inteligencia

Cuando corresponda:

* misma entrada, misma salida;
* desempates estables;
* ausencia de duplicados;
* comportamiento con datos faltantes;
* evidencia insuficiente;
* límites;
* paginación;
* idiomas;
* normalización;
* fallback;
* offline;
* corpus grande representativo.

---

# 13. FASE G — QUALITY GATES

Antes de detenerse para auditoría, Claude debe ejecutar todos los gates autorizados.

Como mínimo:

```text
npm run typecheck
npm run lint
npm test -- --ci
npm run build:web
```

Cuando corresponda:

```text
build Android
tests de integración
tests de rendimiento
validación de city packs
validación de checksums
validación de esquema
instalación física
prueba offline real
navegación real
smoke test de producción
```

Claude debe reportar:

* comando;
* exit code;
* cantidad de suites;
* cantidad de tests;
* warnings;
* errores;
* tiempo;
* artefactos generados;
* limitaciones.

No debe afirmar que Android fue validado si únicamente se ejecutó un build web.

---

# 14. FASE H — REPORTE ANTES DEL COMMIT

Claude debe detenerse antes del commit y entregar un reporte estructurado.

El reporte debe contener:

1. Pre-flight.
2. Estado inicial de Git.
3. Invariantes confirmados.
4. Auditoría del código existente.
5. Defecto reproducido.
6. Causa raíz.
7. Solución aplicada.
8. Archivos modificados.
9. Tests añadidos.
10. Tests reutilizados.
11. Rendimiento.
12. Memoria.
13. Compatibilidad.
14. Quality gates.
15. Estado Android/Web/iOS.
16. Riesgos restantes.
17. Deuda introducida.
18. Elementos fuera de alcance preservados.
19. Diff stat.
20. Commit propuesto.
21. Estado final del working tree.
22. Confirmación de que no hubo commit ni push.

---

# 15. AUDITORÍA INDEPENDIENTE DE CHATGPT

Después del reporte de Claude, ChatGPT debe revisar el cambio como si fuera un auditor independiente.

No debe limitarse al resumen de Claude.

Cuando sea posible, debe revisar:

* diff real;
* archivos completos relevantes;
* tests;
* contratos;
* arquitectura;
* historial;
* resultados de gates;
* riesgos reconocidos;
* riesgos omitidos.

## 15.1 Categorías de auditoría

### A. Corrección

* ¿Resuelve la causa raíz?
* ¿El comportamiento coincide con la especificación?
* ¿Existen casos no cubiertos?
* ¿La solución falla silenciosamente?

### B. Arquitectura

* ¿Respeta las capas?
* ¿Reutiliza lo canónico?
* ¿Introduce una segunda fuente de verdad?
* ¿Acopla módulos indebidamente?
* ¿Crea dependencias circulares?
* ¿Coloca lógica de dominio en UI?

### C. Determinismo

* ¿Misma entrada produce misma salida?
* ¿Los desempates son explícitos?
* ¿Usa hora actual, timestamps o aleatoriedad?
* ¿El orden depende de Map, Set o base de datos sin orden explícito?

### D. Identidad

* ¿Preserva UUID canónico?
* ¿Evita IDs derivados inconsistentes?
* ¿Mantiene fuentes separadas?
* ¿Evita duplicados?

### E. Offline

* ¿Funciona sin red?
* ¿Añade una dependencia remota accidental?
* ¿El fallback sigue funcionando?
* ¿Los datos locales siguen empaquetados?

### F. Rendimiento

* ¿Escanea la ciudad completa?
* ¿Carga demasiados shards?
* ¿Crea estructuras grandes por consulta?
* ¿Escala con resultados o con todo el dataset?
* ¿Tiene límites explícitos?
* ¿Los límites pueden truncar resultados legítimos?

### G. Mantenimiento

* ¿Puede Jorge entender y mantener el cambio?
* ¿Aumenta soporte?
* ¿Introduce configuración adicional?
* ¿Requiere monitoreo manual?
* ¿Crea una operación futura repetitiva?
* ¿La complejidad está justificada?

### H. Testing

* ¿El test habría fallado antes?
* ¿Prueba la ruta real?
* ¿Existe cobertura de regresión?
* ¿Se duplicó cobertura?
* ¿Los tests son deterministas?
* ¿Los resultados verdes son creíbles?

### I. Alcance

* ¿Claude tocó archivos no autorizados?
* ¿Introdujo mejoras no solicitadas?
* ¿Cambió dependencias?
* ¿Cambió lockfile?
* ¿Creó artefactos?
* ¿Hizo commit o push?

---

# 16. CLASIFICACIÓN DE HALLAZGOS

ChatGPT debe clasificar cada hallazgo:

## BLOCKER

No se puede aprobar ni hacer commit.

Ejemplos:

* pérdida de datos;
* error de identidad;
* violación de arquitectura;
* defecto no corregido;
* tests falsos;
* dependencia remota prohibida;
* comportamiento no determinista crítico;
* cambio fuera de alcance material.

## HIGH

Debe corregirse antes de cerrar la ronda.

Ejemplos:

* regresión probable;
* truncamiento incorrecto;
* contrato roto;
* escalabilidad inmediata deficiente;
* falta de prueba esencial;
* duplicación de motor canónico.

## MEDIUM

Debe corregirse en la ronda salvo justificación fuerte.

Ejemplos:

* complejidad evitable;
* falta de telemetría local útil;
* prueba incompleta;
* documentación necesaria;
* naming confuso.

## LOW

No bloquea, pero debe registrarse.

Ejemplos:

* comentario mejorable;
* test adicional no esencial;
* refactor futuro;
* mejora menor de claridad.

## NOTE

Observación informativa sin acción obligatoria.

---

# 17. VEREDICTO DE AUDITORÍA

ChatGPT solo puede emitir uno de estos veredictos:

## REJECTED

Existen blockers o la solución no cumple el objetivo.

## REVISION REQUIRED

La dirección es correcta, pero hay findings que deben corregirse.

## CONDITIONALLY APPROVED

Puede avanzar con condiciones explícitas, normalmente una aceptación física o evidencia adicional.

## APPROVED FOR COMMIT

La implementación está lista para commit, pero no necesariamente para producción.

## APPROVED FOR RELEASE

La implementación, validaciones físicas, artefactos y riesgos están aceptados para publicación.

---

# 18. RONDA DE CORRECCIÓN

Cuando ChatGPT encuentre problemas, debe preparar un prompt de corrección para Claude.

Ese prompt debe:

* enumerar findings exactos;
* citar archivos y líneas;
* explicar impacto;
* separar obligatorios de opcionales;
* mantener alcance;
* prohibir refactors generales;
* exigir tests;
* repetir gates;
* detenerse antes del commit.

Claude debe responder a cada finding individualmente.

No debe declarar “resuelto” sin evidencia.

---

# 19. REVALIDACIÓN

Después de las correcciones:

* ejecutar tests focalizados;
* ejecutar suites relacionadas;
* ejecutar todos los quality gates;
* revisar diff acumulado;
* verificar ausencia de archivos no autorizados;
* comprobar que no se rompieron invariantes;
* repetir auditoría cuando el cambio sea material.

Una corrección puede crear un defecto nuevo.

Por ello, no se debe aprobar únicamente porque desapareció el fallo inicial.

---

# 20. GIT Y CONTROL DE CAMBIOS

## 20.1 Estado inicial

Cada ronda debe comenzar preferentemente con:

* branch autorizada;
* HEAD conocido;
* origin sincronizado;
* working tree limpio.

## 20.2 Commits

Cada commit debe:

* representar una unidad coherente;
* tener un mensaje específico;
* incluir tests relevantes;
* evitar archivos no relacionados;
* evitar artefactos;
* evitar logs;
* evitar secretos;
* evitar paquetes externos sin aprobación.

## 20.3 Autorización

Claude debe detenerse antes de:

* commit;
* amend;
* rebase;
* merge;
* push;
* tag;
* release;
* publicación.

Solo Jorge puede autorizar estas acciones.

## 20.4 Formato recomendado

```text
type(scope): acción concreta
```

Ejemplos:

```text
fix(search): rank complete candidate set before pagination
feat(citypack): add deterministic pack manifest validation
test(identity): cover stable UUID generation across imports
docs(architecture): define canonical place evidence model
```

---

# 21. REGLAS DE PAQUETES EXTERNOS

Todo ZIP, motor candidato, repositorio de referencia o código externo debe tratarse como material no confiable hasta auditarse.

Proceso:

1. Mantenerlo fuera del repositorio.
2. Verificar checksum.
3. Extraerlo fuera del repositorio.
4. Leer documentación.
5. Leer código.
6. Comparar con implementaciones actuales.
7. Crear matriz:

   * adoptar;
   * adaptar;
   * posponer;
   * rechazar.
8. Copiar únicamente componentes autorizados.
9. Preferir patrones sobre copia directa.
10. Evitar una segunda fuente de verdad.

Nunca incorporar un paquete completo solamente porque compila.

---

# 22. MATRIZ ADOPTAR / ADAPTAR / POSPONER / RECHAZAR

Cada componente candidato debe evaluarse así:

```text
Componente:
Problema que resuelve:
Equivalente actual:
Duplicación:
Valor inmediato:
Valor futuro:
Complejidad:
Dependencias:
Riesgo:
Mantenimiento:
Decisión:
Justificación:
```

## ADOPTAR

El código resuelve una necesidad actual, no duplica lo canónico y cumple la arquitectura.

## ADAPTAR

El patrón es útil, pero debe implementarse usando los contratos y motores existentes.

## POSPONER

Tiene valor futuro, pero no cuenta con un consumidor autorizado ahora.

## RECHAZAR

Duplica, contradice arquitectura, añade complejidad injustificada o no tiene consumidor.

---

# 23. PRINCIPIOS DE ARQUITECTURA LOCAVO

## 23.1 Offline-first

Las capacidades esenciales deben funcionar sin conexión cuando sea técnicamente viable:

* búsqueda;
* filtros;
* categorías;
* detalles básicos;
* recomendaciones deterministas locales;
* city packs;
* navegación mediante handoff externo cuando se requiera.

La nube debe mejorar Locavo, no ser requisito para abrirlo.

## 23.2 Deterministic-first

Las reglas de negocio no deben depender de respuestas impredecibles de un LLM.

Los motores deben producir resultados repetibles.

## 23.3 AI-enhanced

La inteligencia artificial puede ayudar con:

* descripciones;
* clasificación;
* resumen;
* traducción;
* enriquecimiento;
* explicación;
* detección de anomalías;
* sugerencias de revisión.

No debe:

* inventar hechos;
* generar identidad;
* decidir reglas críticas;
* ocultar razones;
* reemplazar validaciones;
* modificar datos canónicos sin evidencia.

## 23.4 Automation-first

Antes de añadir ciudades manualmente, se debe construir:

* importer;
* normalizer;
* validator;
* deduplicator;
* category mapper;
* evidence engine;
* indexer;
* pack builder;
* pack validator;
* publisher.

## 23.5 Reusable-first

Preferir:

```text
PlaceDescriptionEngine
```

sobre:

```text
RestaurantDescriptionGenerator
HotelDescriptionGenerator
ParkDescriptionGenerator
```

La generalización debe basarse en consumidores reales, no en especulación.

---

# 24. DATOS Y EVIDENCIA

Ningún dato debe presentarse como hecho sin conocer su origen.

Cada atributo importante debe poder asociarse con:

* fuente;
* fecha de observación;
* fecha de actualización;
* nivel de confianza;
* método de adquisición;
* evidencia;
* estado de verificación.

Los datos desconocidos deben permanecer desconocidos.

No debe inferirse automáticamente:

* horario;
* accesibilidad;
* precios;
* popularidad;
* ambiente;
* seguridad;
* calidad;
* disponibilidad.

Una recomendación puede explicar incertidumbre.

Ejemplo:

```text
Recomendado por cercanía y categoría.
No hay horarios confirmados.
```

---

# 25. ESCALAMIENTO PARA MÉXICO

Locavo no se desplegará manualmente municipio por municipio.

El crecimiento debe seguir este modelo:

```text
Culiacán
   ↓
Pipeline reproducible
   ↓
Segunda ciudad
   ↓
Validación de generalidad
   ↓
Principales ciudades
   ↓
Cobertura por estados
   ↓
México
```

La expansión solo se considera escalable cuando una ciudad nueva puede generarse principalmente mediante configuración y datos, no mediante código especial.

Cada excepción específica de una ciudad debe cuestionarse.

---

# 26. PRESUPUESTO DE COMPLEJIDAD

Cada ronda debe declarar qué complejidad introduce:

* nueva abstracción;
* nuevo servicio;
* nueva dependencia;
* nuevo formato;
* nuevo job;
* nueva configuración;
* nueva operación;
* nuevo flujo de soporte;
* nueva fuente de datos;
* nueva responsabilidad.

La complejidad debe tener una justificación proporcional al valor.

No se debe gastar complejidad en capacidades hipotéticas.

---

# 27. PRESUPUESTO DE MANTENIMIENTO

Antes de aprobar una función se debe estimar:

* frecuencia de fallos;
* frecuencia de actualización;
* necesidad de revisión humana;
* dependencia de APIs;
* cambios de términos;
* costo mensual;
* soporte al usuario;
* moderación;
* recuperación;
* monitoreo.

Características de alto mantenimiento, como contenido social abierto, reseñas públicas, moderación, mensajería en tiempo real o delivery, deben posponerse hasta que exista una razón comercial fuerte.

---

# 28. DEFINITION OF DONE

Una ronda no está terminada porque el código compile.

Está terminada cuando:

* el objetivo está cumplido;
* el defecto fue demostrado cuando correspondía;
* la causa raíz fue corregida;
* el alcance fue respetado;
* los invariantes permanecen;
* los tests relevantes están verdes;
* los quality gates están verdes;
* el diff fue auditado;
* los riesgos están documentados;
* ChatGPT emitió aprobación;
* Jorge autorizó el commit;
* el commit fue creado;
* el push fue confirmado;
* la aceptación física fue realizada cuando aplique;
* el baseline fue actualizado.

---

# 29. FORMATO DEL HANDOFF PARA CLAUDE

Cada prompt de implementación debe contener:

```text
1. Contexto
2. Baseline
3. Objetivo autorizado
4. Problema observado
5. Arquitectura actual
6. Invariantes
7. Alcance
8. Fuera de alcance
9. Archivos a inspeccionar
10. Hipótesis a verificar
11. Defecto que debe reproducirse
12. Criterios de aceptación
13. Tests requeridos
14. Quality gates
15. Reglas de Git
16. Formato de reporte
17. Punto obligatorio de detención
```

---

# 30. FORMATO DEL HANDOFF PARA CHATGPT AUDITOR

El paquete de auditoría debe incluir:

```text
1. Especificación original
2. Baseline inicial
3. Reporte de Claude
4. Git status
5. Git diff
6. Archivos completos relevantes
7. Tests añadidos o modificados
8. Resultado de tests focalizados
9. Resultado de gates
10. Riesgos declarados
11. Estado de aceptación física
12. Commit propuesto
```

ChatGPT debe devolver:

```text
1. Resumen ejecutivo
2. Veredicto
3. Findings por severidad
4. Evidencia
5. Riesgos
6. Correcciones obligatorias
7. Correcciones opcionales
8. Pruebas adicionales
9. Decisión sobre commit
10. Prompt listo para Claude
```

---

# 31. REGLA DE DETENCIÓN

Claude debe detenerse inmediatamente antes de cualquier acción irreversible o de publicación.

Puntos de detención:

* antes de modificar cuando el pre-flight falla;
* después de descubrir una contradicción arquitectónica;
* después de demostrar que el defecto no existe;
* antes de añadir una dependencia;
* antes de cambiar alcance;
* antes de migración;
* antes de commit;
* antes de push;
* antes de release;
* antes de publicar datos.

Detenerse no significa abandonar.

Significa entregar evidencia para que el propietario decida.

---

# 32. FILOSOFÍA DE VELOCIDAD

Locavo debe avanzar rápido, pero no mediante improvisación.

La velocidad debe provenir de:

* arquitectura clara;
* prompts precisos;
* módulos reutilizables;
* automatización;
* tests de alto valor;
* baselines documentados;
* paquetes auditables;
* decisiones acumulativas.

No debe provenir de:

* saltarse pruebas;
* duplicar código;
* aceptar deuda silenciosa;
* permitir cambios fuera de alcance;
* construir UI sin motor;
* depender de futuras contrataciones;
* corregir manualmente datos.

---

# 33. PRINCIPIO “TRABAJO DE DIEZ”

El objetivo del proyecto no es exigirle al fundador diez veces más esfuerzo.

El objetivo es construir sistemas que multipliquen su capacidad.

Cada sistema de Locavo debe convertirse en una fuerza operativa:

```text
Importador automático      = equipo de adquisición de datos
Normalizador               = equipo de limpieza
Validador                  = equipo de QA de datos
Deduplicador               = equipo de reconciliación
City Pack Builder          = equipo de publicación
Search Engine              = equipo de descubrimiento
Recommendation Engine      = concierge local
Business Manager futuro    = gerente operativo
ChatGPT                    = arquitectura y auditoría
Claude                     = ingeniería
```

El fundador debe dirigir la fábrica, no ejecutar manualmente cada operación.

---

# 34. REGLA FINAL

Ante cualquier duda, elegir la opción que:

1. preserve la arquitectura;
2. reduzca mantenimiento;
3. mantenga determinismo;
4. funcione offline;
5. reutilice infraestructura;
6. evite dependencias;
7. produzca evidencia;
8. permita automatización;
9. pueda ser mantenida por una persona;
10. conserve la posibilidad de crecer.

---

# 35. ESTADO DE ESTE DOCUMENTO

Este protocolo debe tratarse inicialmente como **versión 1.0 candidata**.

Antes de convertirlo en norma definitiva, ChatGPT Auditor debe compararlo contra:

* arquitectura real del repositorio;
* documentos existentes;
* decisiones previamente aprobadas;
* roadmap vigente;
* limitaciones reales de Android, Web y PWA;
* estado de City Packs;
* estrategia de datos;
* tests actuales;
* workflow real de Git.

El auditor debe proponer únicamente correcciones justificadas.

Después de la aprobación del propietario, el documento se convierte en la base operativa oficial de Locavo.

---

# ANEXO — AUDITORÍA §35 (v1.0, pendiente de ratificación por el propietario)

Este anexo registra las correcciones justificadas detectadas al comparar el Protocolo v1.0 contra
el estado **real** del repositorio (rama `main`, HEAD `2e2489d`, 54 suites / 539 tests). No modifica
las secciones numeradas; las corrige aquí hasta que el propietario ratifique cada punto. Severidades
según §16.

**HIGH-1 · La "Constitución de Locavo" (autoridad #2 de §5) no existe como artefacto.** Debe existir
un documento canónico y durable en el repo. Corrección: este `docs/PROTOCOL.md` es el artefacto de
gobernanza durable, referenciado desde `AGENTS.md`. Si además existe una "Constitución" separada,
debe commitearse; si no, `AGENTS.md` + este protocolo son la base de gobernanza.

**HIGH/MEDIUM-2 · "Offline-first" verificado solo para el shell nativo Android.** Validado offline
20/20 en un Samsung S25 Ultra físico. Pendientes/caveats: (a) el offline de la **PWA/web**
(`public/sw.js` cacheando el city pack) NO está validado; (b) el mapa interno **OSM/Leaflet requiere
red** ("We could not load the map" sin conexión — por diseño; la lista de lugares sigue funcionando
offline). §23.1 debe nombrar estos caveats por plataforma.

**MEDIUM-3 · La cabecera de plataformas es imprecisa.** Estado real: **Android = app NATIVA Expo/RN**
(`android/`, `gradlew assembleRelease`, APK instalado en hardware real); **Web = PWA estática**
(`web.output: "static"`, `public/sw.js`, `public/manifest.webmanifest`); **iOS = sin build ni
validación** (sin hardware). La línea "Android, iOS mediante PWA" debe corregirse a esta realidad.

**MEDIUM-4 · Regla de determinismo vs. código real.** §23.2/§15.C prohíben depender de la hora;
`src/services/places/PlaceSearchService.ts` lee `new Date()` y lo alimenta al ranking (open-now,
recencia). Es defendible (open-now depende del tiempo real) pero para testabilidad/reproducibilidad
el `now` debería inyectarse. El protocolo debe permitir explícitamente leer el reloj para hechos
genuinamente temporales, exigiendo inyección para pruebas. Ronda futura.

**MEDIUM-5 · Separación de roles.** §4/§15 exigen auditoría **independiente**: el modelo que audita no
debe ser el que implementó. Cualquier ronda cuya implementación y auditoría recaigan en el mismo
modelo debe marcarse como "auto-revisada" y pasar por auditoría independiente antes de "APPROVED FOR
COMMIT" (§17).

**LOW-6 · Reproducibilidad de build.** `android/` está gitignored; un clon nuevo requiere
`expo prebuild` antes de `assembleRelease`. Web sí es 100% reproducible (`npm run build:web`). El
invariante "build reproducible" (§7.4) debe anotar este prerrequisito de Android.

**LOW-7 · Baseline de tests.** Referencias a "535+" deben actualizarse al baseline vigente
(**539 tests / 54 suites** al momento de este anexo, tras los tests de regresión de paginación).

**NOTE (consistente):** §5 (orden de autoridad), §21/§22 (paquetes externos: checksum → extraer fuera
del repo → matriz → adaptar-no-copiar) y §24 (procedencia/evidencia: "Source: INEGI DENUE",
"not yet individually verified", sin horarios/ratings inventados) coinciden con el comportamiento
verificado del repositorio.
