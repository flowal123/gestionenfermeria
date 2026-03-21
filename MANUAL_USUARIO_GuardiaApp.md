# GuardiaApp — Manual de Usuario

**Versión:** 13.3
**Dirigido a:** Personal de salud, supervisores y administración
**Actualizado:** Marzo 2026

---

## Tabla de Contenidos

1. [Introducción](#1-introducción)
2. [Acceso al Sistema](#2-acceso-al-sistema)
3. [Navegación General](#3-navegación-general)
4. [Módulos Principales](#4-módulos-principales)
   - 4.1 [Dashboard — Panel General](#41-dashboard--panel-general)
   - 4.2 [Planificación Mensual](#42-planificación-mensual)
   - 4.3 [Mi Agenda](#43-mi-agenda)
   - 4.4 [Funcionarios](#44-funcionarios)
   - 4.5 [Licencias y Ausencias](#45-licencias-y-ausencias)
   - 4.6 [Cambios de Turno](#46-cambios-de-turno)
   - 4.7 [Alertas](#47-alertas)
   - 4.8 [Generación Automática](#48-generación-automática)
   - 4.9 [Notificaciones](#49-notificaciones)
   - 4.10 [Reporte RRHH](#410-reporte-rrhh)
   - 4.11 [Usuarios y Permisos](#411-usuarios-y-permisos)
   - 4.12 [Sectores](#412-sectores)
5. [Roles de Usuario](#5-roles-de-usuario)
6. [Ejemplos Prácticos Paso a Paso](#6-ejemplos-prácticos-paso-a-paso)
7. [Referencia de Códigos de Turno](#7-referencia-de-códigos-de-turno)
8. [Buenas Prácticas](#8-buenas-prácticas)
9. [Preguntas Frecuentes (FAQ)](#9-preguntas-frecuentes-faq)
10. [Soporte](#10-soporte)

---

## 1. Introducción

### ¿Qué es GuardiaApp?

GuardiaApp es una plataforma digital de gestión de turnos y planificación del personal de salud. Permite organizar, visualizar y controlar las guardias mensuales de los funcionarios de la institución, desde la generación automática del cronograma hasta el seguimiento de licencias, cambios de turno y coberturas con suplentes.

### Objetivo principal

Centralizar en un solo lugar toda la gestión operativa del personal de enfermería y salud, reemplazando planillas manuales o dispersas. El sistema permite:

- Ver el cronograma mensual de cada funcionario
- Gestionar licencias y ausencias con cobertura automática
- Tramitar cambios de turno con flujo de aprobación
- Generar alertas automáticas ante situaciones críticas (guardias consecutivas, vacantes sin cubrir)
- Obtener reportes de cumplimiento y horas trabajadas

### A quién está dirigida

| Perfil | Uso principal |
|--------|---------------|
| **Administración / Gerencia** | Configuración completa, generación de planillas, gestión de usuarios |
| **Supervisor** | Control de planilla, aprobación de licencias y cambios, reportes |
| **Personal de enfermería** | Ver su propia agenda, solicitar licencias y cambios de turno |
| **Suplentes** | Consultar sus asignaciones del mes, aceptar o rechazar guardias |

---

## 2. Acceso al Sistema

### Cómo iniciar sesión

1. Abrí el navegador e ingresá a la dirección del sistema.
2. En la pantalla de inicio verás el formulario de acceso con dos campos:
   - **Usuario** — el nombre de usuario asignado por administración
   - **Contraseña** — la clave temporal entregada al crear tu cuenta
3. Completá ambos campos y hacé clic en **"Ingresar al Sistema"**.

> **Importante:** El sistema determina automáticamente tu rol y permisos a partir de tu usuario registrado. No es necesario seleccionar ningún perfil al ingresar.

### Mensajes de error al iniciar sesión

| Mensaje | Qué significa |
|---------|---------------|
| "Usuario o contraseña incorrectos" | Revisá que no haya errores tipográficos. Las mayúsculas importan. |
| "No tenés un usuario activo en el sistema" | Tu cuenta fue desactivada. Contactá a administración. |
| "Demasiados intentos" | Esperá unos minutos antes de volver a intentarlo. |
| "Sin conexión con el servidor" | Verificá tu conexión a internet. |

### Primera vez que ingresás

Si es tu primer acceso, el sistema te solicitará cambiar la contraseña temporal antes de continuar. Elegí una contraseña segura que recuerdes y no la compartas con nadie. Este paso es obligatorio y no puede omitirse. Si necesitás cancelar, usá el botón "Cancelar" — tu sesión se cerrará y podrás intentarlo nuevamente.

### Cierre de sesión

Para salir del sistema, hacé clic en tu nombre o iniciales que aparecen en la barra lateral izquierda (parte inferior). El sistema cerrará tu sesión de forma segura.

### Consideraciones de seguridad

- No compartas tu contraseña con compañeros.
- Si olvidás tu contraseña, contactá a la persona responsable del sistema en tu institución para que te genere una nueva.
- Al terminar tu turno en una computadora compartida, cerrá siempre la sesión.

---

## 3. Navegación General

### Estructura de pantalla

La aplicación tiene dos áreas principales:

- **Barra lateral izquierda (menú):** navegación entre secciones
- **Área central (contenido):** muestra la sección activa

### Menú principal

El menú lateral está organizado en tres grupos según tu rol:

#### PRINCIPAL
| Sección | Para qué sirve |
|---------|----------------|
| **Dashboard** | Resumen del mes, KPIs y alertas activas |
| **Planificación** | Ver y editar turnos de todos los funcionarios |
| **Mi Agenda** | Ver tus propios turnos del mes |

#### GESTIÓN
| Sección | Para qué sirve |
|---------|----------------|
| **Funcionarios** | Lista, búsqueda y edición de funcionarios |
| **Licencias** | Cargar y gestionar licencias con sus coberturas |
| **Cambios de Turno** | Solicitar y aprobar cambios entre funcionarios |
| **Alertas** | Ver todas las notificaciones del sistema |

#### ADMIN *(solo para Administrador)*
| Sección | Para qué sirve |
|---------|----------------|
| **Generación Auto.** | Crear automáticamente la planilla del mes |
| **Notificaciones** | Enviar planillas por correo a los funcionarios |
| **Reporte RRHH** | Reportes de cumplimiento, horas y ausentismo |
| **Usuarios y Permisos** | Crear y administrar usuarios del sistema |
| **Sectores** | Gestionar sectores de la institución |

### Indicadores en el menú

- **Número rojo sobre "Cambios de Turno":** cantidad de solicitudes pendientes.
- **Número rojo sobre "Alertas":** cantidad de alertas sin leer.

### Cómo moverse entre secciones

Hacé clic en cualquier ítem del menú lateral para ir a esa sección. El sistema carga la vista correspondiente de forma inmediata sin recargar la página.

### Estado de la conexión

En la parte superior del menú verás un indicador que muestra si el sistema está correctamente conectado a la base de datos. Si aparece en rojo o desaparece, puede haber un problema de conexión.

---

## 4. Módulos Principales

---

### 4.1 Dashboard — Panel General

**Quién lo ve:** Administrador y Supervisor

El Dashboard es la pantalla principal al ingresar. Muestra un resumen del estado operativo del mes seleccionado.

#### Selector de período

En la parte superior podés elegir el mes que querés visualizar. Solo se muestran los meses que ya tienen una planilla generada y aprobada.

> Si ves el mensaje "Sin planificación generada", significa que aún no se generó la planilla para ese mes. Ver sección [4.8 Generación Automática](#48-generación-automática).

#### Indicadores (KPIs)

Cuatro tarjetas resumen el estado del mes:

| Tarjeta | Qué muestra |
|---------|-------------|
| **Funcionarios** | Total de personal activo (fijos + suplentes) |
| **Cobertura del mes** | Porcentaje de funcionarios que están trabajando (sin licencia activa) |
| **Licencias del mes** | Cantidad de licencias activas, con detalle por tipo |
| **Alertas activas** | Cantidad de alertas sin resolver |

**Colores de cobertura:**
- Verde: cobertura del 90% o más (situación normal)
- Amarillo: entre 75% y 89% (atención)
- Rojo: por debajo del 75% (crítico)

#### Cobertura por sector

Debajo de las tarjetas principales aparece una grilla con el porcentaje de cobertura desglosado por cada sector de la institución.

#### Panel de alertas activas

En la parte inferior derecha se muestran hasta 3 alertas prioritarias:

| Tipo | Color | Qué significa |
|------|-------|---------------|
| **7ª Guardia consecutiva** | Rojo | Un funcionario trabajó 7 días seguidos sin descanso |
| **Vacantes sin cubrir** | Amarillo | Hay licencias sin suplente asignado |
| **Cambios pendientes** | Azul | Hay solicitudes de cambio esperando aprobación |

Podés descartar cada alerta haciendo clic en la **X** a la derecha. Los botones **"Ver"** y **"Asignar"** te llevan directamente a la sección correspondiente.

#### KPIs adicionales

Más abajo encontrás tres métricas detalladas:

- **Cumplimiento Guardias:** porcentaje de guardias realizadas sobre las asignadas
- **Horas Extra:** horas generadas por alcanzar la 7ª guardia consecutiva
- **Tasa Ausentismo:** porcentaje de faltas sobre el total de guardias programadas

---

### 4.2 Planificación Mensual

**Quién lo ve:** Administrador y Supervisor

Muestra la planilla completa del mes seleccionado con todos los funcionarios y sus turnos asignados día a día.

#### Controles superiores

- **Anterior / Siguiente:** navegá entre semanas del mes
- **Indicador de semana:** muestra el rango de fechas de la semana actual (ej: "Semana 1 — 1 al 7 Enero 2026")
- **Selector de mes:** cambiá el mes visualizado
- **Filtro por sector:** mostrá solo los funcionarios de un sector específico

#### Cómo leer la planilla

Cada fila representa un funcionario. Las columnas son los días del mes. En cada celda aparece el código del turno asignado para ese día.

Ver la tabla completa de códigos en la sección [7. Referencia de Códigos de Turno](#7-referencia-de-códigos-de-turno).

Los turnos tienen colores diferenciados para facilitar la lectura:
- Azul claro: Mañana
- Naranja: Tarde
- Violeta/oscuro: Noche
- Verde claro: Vespertino
- Amarillo: Licencias
- Rojo: Falta o alerta

#### Asignar o editar un turno individual

1. Hacé clic en la celda del funcionario y día que querés modificar.
2. Se abre el formulario **"Asignar / Editar Turno"**.
3. Completá los campos:
   - **Funcionario** y **Fecha** (ya precargados según la celda elegida)
   - **Código de turno:** elegí el tipo de turno de la lista desplegable
   - **Suplente** (aparece solo si el código seleccionado genera vacante)
   - **Nota** (opcional): observaciones del turno
4. Hacé clic en **"Guardar y Notificar"**.

> **Nota:** Los cambios individuales en la planilla no reemplazan la generación mensual. Son ajustes puntuales sobre la planilla ya generada.

---

### 4.3 Mi Agenda

**Quién lo ve:** Todos los roles (contenido adaptado según rol)

Es la vista personal de cada funcionario. Muestra el calendario mensual con los turnos asignados.

#### Para personal de enfermería

- Verás tu agenda personal del mes actual.
- Podés navegar entre meses con el selector desplegable.
- Desde esta pantalla podés:
  - Hacer clic en **"+ Nueva Licencia"** para solicitar una ausencia
  - Hacer clic en un día con turno para iniciar una solicitud de cambio

**Sección "Mis Licencias":**
Muestra tus licencias con estado:
- **Pendiente:** solicitud aún no aprobada
- **Aprobada:** licencia confirmada
- **Cerrada:** licencia finalizada

**Sección "Mis Cambios de Turno":**
Muestra el estado de tus solicitudes:
- Enviadas: esperando que la otra persona acepte
- Recibidas: alguien te propone un cambio (podés aceptar o rechazar)
- Aprobadas: listas para aplicarse en la planilla

#### Para Administrador y Supervisor

Solo ven "Mi Agenda" si tienen un funcionario vinculado a su cuenta. Si el perfil es exclusivamente de gestión, esta sección mostrará que no hay turnos asignados.

---

### 4.4 Funcionarios

**Quién lo ve:** Administrador y Supervisor

Permite consultar, agregar y editar la información del personal de la institución.

#### Tres pestañas

**Pestaña "Fijos"**

Lista de todos los funcionarios activos de la institución. Incluye buscador y filtros:
- **Buscar:** ingresá apellido o nombre
- **Filtro por sector:** mostrá solo un sector
- **Estado:** solo activos, solo inactivos, o todos

La tabla muestra: nombre, sector, turno, fecha de nacimiento, teléfono, cantidad de guardias, horas/mes, horas extra, faltas y estado.

**Pestaña "Suplentes"**

Lista de suplentes disponibles. La tabla incluye: nombre, antigüedad, porcentaje de cumplimiento, competencias, guardias realizadas, horas y estado.

**Pestaña "Competencias"**

Matriz que cruza cada funcionario (fijos y suplentes) con los sectores de la institución. Permite marcar en qué sectores tiene competencia cada persona. Esto se usa para sugerir el suplente más adecuado al cubrir una vacante.

> Las competencias quedan guardadas en la base de datos y se tienen en cuenta automáticamente en la asignación de suplentes (+2 puntos de prioridad si el suplente tiene competencia en el sector requerido).

#### Cómo agregar un nuevo funcionario

1. En la pestaña "Fijos" o "Suplentes", hacé clic en **"+ Funcionario"** o **"+ Suplente"**.
2. Completá el formulario:

| Campo | Descripción |
|-------|-------------|
| N° Funcionario | Número de legajo (ej: 565) |
| Tipo | Fijo o Suplente |
| Apellido, Nombre | Formato: APELLIDO, Nombre |
| Sector | Sector asignado (lista dinámica desde la BD) |
| Turno Fijo | Mañana, Tarde, Vespertino, Noche o Rotativo |
| Hs./semana | Horas semanales (por defecto: 36) |
| Patrón de rotación | Ver tabla abajo |
| Fecha de Nacimiento | Se usa para asignar el turno de cumpleaños automáticamente |
| Fecha de Ingreso | Se usa para alertas de ingreso |
| Alerta supervisor | Días desde ingreso para notificar (por defecto: 45) |
| Teléfono / WhatsApp | Para comunicación directa |
| Email | Para envío de agendas |

**Patrones de rotación disponibles:**

| Código | Descripción |
|--------|-------------|
| LV | Lunes a Viernes |
| LS | Lunes a Sábado |
| 4×1 | 4 días de trabajo + 1 de descanso |
| 6×1 | 6 días de trabajo + 1 de descanso |
| 36H | 36 horas semanales — flexible |
| SD | Sábado y Domingo |

> Para suplentes con titularidad momentánea (interinato), existe una opción específica para indicar el sector asignado temporalmente.

3. Hacé clic en **"Guardar"**.

#### Cómo editar un funcionario existente

En la tabla, hacé clic en el ícono de lápiz (editar) de la fila correspondiente. Se abre el mismo formulario con los datos precargados. Modificá lo necesario y guardá.

#### Cómo desactivar un funcionario

En la tabla, hacé clic en el ícono de eliminar. El sistema no borra el registro — lo marca como inactivo. Esto conserva el historial de turnos y licencias. Un funcionario inactivo no aparece en la generación de planillas.

---

### 4.5 Licencias y Ausencias

**Quién lo ve:** Administrador y Supervisor (para cargar y gestionar). Personal de enfermería puede solicitar desde Mi Agenda.

Gestión integral de todas las licencias y ausencias del personal.

#### Cuatro pestañas

**Pestaña "Licencias"**

Lista de todas las licencias registradas. Botones de filtro rápido:
- **Todas:** muestra todas las licencias sin filtro
- **Vigentes hoy:** solo las activas en la fecha de hoy
- **Sin cubrir:** licencias que generan vacante y aún no tienen suplente asignado
- **Finalizadas:** licencias ya terminadas

Desde aquí también podés usar **"Auto-asignar todas"** para que el sistema asigne automáticamente el mejor suplente disponible a todas las vacantes pendientes.

**Pestaña "Cobertura Pendiente"**

Muestra únicamente las vacantes sin cubrir agrupadas por sector. Permite asignar suplentes de forma rápida, vacante por vacante.

**Pestaña "LAR Anual 2026"**

Tabla con la planificación anual de licencias reglamentarias (LAR) por funcionario. Muestra el total de días disponibles y cómo están distribuidos mes a mes.

El botón **"Importar Excel RRHH"** permite cargar esta información desde un archivo Excel generado por RRHH.

**Pestaña "Nueva Licencia"**

Formulario para registrar una nueva licencia o ausencia.

#### Tipos de licencia disponibles

| Código | Nombre completo | Genera vacante | Duración |
|--------|----------------|----------------|----------|
| LAR | Licencia Anual Reglamentaria | No | 1–40 días |
| MAT | Maternal | Sí | 84–365 días |
| CERT | Certificación / Capacitación | Sí | 1–180 días |
| LE | Libre Especial | Sí | 1–30 días |
| F | Falta Imprevista | Sí | 1 día |
| DXF | Día por Feriado | No | 1 día |
| CPL | Cumpleaños (media guardia) | No | 1 día |

#### Cómo cargar una nueva licencia

1. Ir a **Licencias** → pestaña **"Nueva Licencia"**.
2. En **Funcionario**, escribí al menos 3 letras del apellido y elegí de la lista sugerida.
3. Seleccioná el **Tipo** de licencia.
4. Ingresá las fechas **Desde** y **Hasta**.
5. El sistema verificará automáticamente:
   - Si hay superposición con otra licencia del mismo funcionario (muestra advertencia en rojo)
   - Si la duración es válida para el tipo seleccionado
6. Si el tipo genera vacante, aparecerá la sección **"Asignar suplente"** con un listado ordenado por prioridad (antigüedad, cumplimiento, competencias). Podés elegir uno o dejarlo sin asignar por el momento.
7. Agregá observaciones opcionales si necesitás.
8. Hacé clic en **"Guardar y Notificar"**.

#### Estados de una licencia

| Estado | Significado |
|--------|-------------|
| **Pendiente** | Registrada pero sin suplente asignado todavía |
| **Activa** | En curso, con o sin cobertura asignada |
| **Finalizada** | Fecha de término ya pasó |

---

### 4.6 Cambios de Turno

**Quién lo ve:** Todos los roles (con distintas acciones según permisos)

Gestiona los intercambios de turno entre funcionarios.

#### Cómo funciona un cambio de turno

Un cambio de turno pasa por tres etapas:

1. **El solicitante** envía la propuesta al receptor
2. **El receptor** acepta o rechaza
3. **El supervisor / administración** aprueba o rechaza definitivamente

Solo cuando los tres pasos se completan con éxito, el cambio queda registrado en la planilla.

#### Sección "Pendientes de Aprobación"

Muestra las solicitudes que requieren alguna acción:
- **En verde** ("Listos para aprobar"): el receptor ya aceptó, esperan aprobación de supervisor
- **En amarillo** ("Esperando al receptor"): la otra parte todavía no respondió

Cada tarjeta muestra: quién solicita, turno que cede, receptor, turno que recibe y estado actual.

#### Sección "Historial"

Tabla con todos los cambios (aprobados, rechazados, en curso).

#### Estados posibles de un cambio

| Estado | Qué significa |
|--------|---------------|
| **Pendiente** | Esperando que el receptor acepte |
| **Aceptado por receptor** | El receptor aceptó, falta aprobación de supervisor |
| **Aprobado** | Cambio completo, ya aplicado en la planilla |
| **Rechazado por receptor** | La otra persona no aceptó |
| **Rechazado** | El supervisor no autorizó |

#### Restricciones importantes

- No se puede solicitar un cambio si ya hay una solicitud idéntica pendiente.
- Ambas partes deben estar activas y sin licencia en las fechas involucradas.
- El receptor debe tener turno compatible para el intercambio.

---

### 4.7 Alertas

**Quién lo ve:** Todos los roles (contenido filtrado según rol)

Centro de notificaciones del sistema. Muestra todos los avisos importantes ordenados por fecha.

#### Tipos de alerta

| Tipo | Color | Quién la ve |
|------|-------|-------------|
| **7ª Guardia consecutiva** | Rojo | Admin, Supervisor |
| **Vacante sin cubrir** | Amarillo | Admin, Supervisor |
| **Cambio de turno pendiente** | Azul | Admin, Supervisor, y el personal involucrado |
| **Alerta de ingreso** | Azul | Admin, Supervisor |

**7ª Guardia consecutiva:** Se genera automáticamente cuando el sistema detecta que un funcionario tiene 7 o más días de trabajo seguidos sin descanso. Implica la generación de horas extra obligatorias.

**Vacante sin cubrir:** Aparece cuando existe una licencia activa que genera vacante pero no tiene suplente asignado todavía.

**Cambio de turno pendiente:** Notifica a supervisores cuando hay cambios listos para aprobar. Al personal de enfermería le avisa si alguien le propuso un intercambio.

**Alerta de ingreso:** Informa cuando un funcionario cumple el hito de días desde su ingreso a la institución (por defecto: 45 días).

#### Marcar alertas como leídas

Hacé clic en **"Marcar todas leídas"** para limpiar el contador de alertas. Las alertas no desaparecen — quedan en el historial — pero dejan de contarse como activas.

También podés descartar alertas individuales desde el Dashboard con el botón **X** de cada una.

---

### 4.8 Generación Automática

**Quién lo ve:** Solo Administrador

Permite crear automáticamente la planilla de guardias para un mes completo.

#### Qué considera el sistema al generar

- El patrón de rotación de cada funcionario activo (LV, LS, 4×1, etc.)
- Las licencias LAR ya programadas para ese mes
- Los feriados nacionales y departamentales
- Los cumpleaños (asigna media guardia automáticamente)
- La detección de 7ª guardia consecutiva (genera alerta inmediata)
- La disponibilidad y prioridad de suplentes para cubrir vacantes
- Las competencias registradas de cada funcionario

#### Pasos para generar el mes

1. Ir a **Generación Auto.**
2. Seleccioná el **mes a generar** en el desplegable.
3. Hacé clic en **"Generar Planilla"**.
4. El sistema procesa en 8 pasos que podés ver en pantalla:
   - Cargar regímenes y licencias
   - Generar turnos por patrón
   - Detectar 7ª guardia
   - Detectar vacantes sin cobertura
   - Revisar y asignar suplentes
   - Guardar en base de datos
   - Generar turnos de cobertura
   - Crear registro de generación

5. Si hay vacantes sin cubrir, aparecerá un modal **"Cobertura de Vacantes"** donde podés:
   - Asignar suplentes manualmente para cada vacante
   - Usar **"Auto-asignar todos"** para que el sistema asigne el mejor disponible
   - Omitir por ahora y asignar más tarde desde Licencias

6. Una vez finalizado, la planilla queda en estado **"borrador"**.

#### Revisar y aprobar la planilla

Antes de publicar, podés revisar la planilla generada:

1. En el historial de la sección Generación, hacé clic en el botón de visualización de la fila correspondiente.
2. Se abre una grilla completa con todos los turnos asignados.
3. Podés hacer clic en cualquier celda para editar un turno individual.
4. Si todo está correcto, hacé clic en **"Aprobar planilla"**.

> Una vez aprobada, la planilla queda lista para enviarse desde la sección Notificaciones.

#### Estados de una generación

| Estado | Significado |
|--------|-------------|
| **Borrador** | Generado pero pendiente de validación |
| **Aprobada** | Revisada y lista para enviar a los funcionarios |
| **Cancelada** | Descartada por administración |

---

### 4.9 Notificaciones

**Quién lo ve:** Administrador y Supervisor

Permite enviar las planillas mensuales aprobadas a los funcionarios por correo electrónico.

#### Enviar agendas del mes

1. En la sección **"Agendas mensuales"** verás las planillas aprobadas disponibles para enviar.
2. Podés usar **"Vista previa"** para ver cómo recibirá el correo el funcionario.
3. Hacé clic en **"Enviar todas"** para enviar la agenda a todos los funcionarios del mes.

#### Enviar agenda individual

Si necesitás enviar solo a una persona:
1. Elegí el **Funcionario** del desplegable.
2. Seleccioná el **Mes**.
3. Hacé clic en **"Enviar agenda"**.

#### Redactar un aviso

Podés enviar comunicados generales al personal:
1. Seleccioná el **Tipo** de aviso (cambio de turno, aviso general, recordatorio, actualización de agenda).
2. Seleccioná los **Destinatarios** ("Todos los funcionarios" u otras opciones disponibles).
3. Escribí el **Mensaje**.
4. Hacé clic en **"Enviar aviso"**.

#### Historial de notificaciones

Al final de la sección encontrás una tabla con todos los avisos enviados, con fecha y descripción.

---

### 4.10 Reporte RRHH

**Quién lo ve:** Administrador y Supervisor

Genera reportes detallados de cumplimiento, asistencia, horas trabajadas y ausentismo del personal.

#### Controles del reporte

- **Mes:** seleccioná el período a analizar
- **Descargar Excel RRHH:** exporta el reporte completo a Excel
- **Imprimir / PDF:** usá Ctrl+P para guardar como PDF

#### Indicadores superiores

| Indicador | Qué mide |
|-----------|----------|
| **Hs. Trabajadas** | Total de horas efectivamente trabajadas |
| **Total Faltas** | Cantidad de ausencias sin justificar |
| **Horas Extra** | Horas generadas por 7ª guardia |
| **Cumplimiento** | Porcentaje de guardias cumplidas sobre las asignadas |

#### Tres pestañas del reporte

**Resumen por Clínica**

Tabla completa con un renglón por funcionario. Columnas: nombre, sector, turno, guardias, horas trabajadas, objetivo, diferencia, faltas, LAR tomadas, extras y cumplimiento.

**Detalle Día a Día**

Podés seleccionar un funcionario específico y ver cada día del mes con: fecha, día de la semana, código de turno, tipo y horas correspondientes.

**Ranking / Suplentes**

Dos columnas:
- **Top Cumplimiento:** los funcionarios con mejor porcentaje de guardias cumplidas
- **Actividad de Suplentes:** detalle de guardias, horas y cumplimiento de cada suplente

---

### 4.11 Usuarios y Permisos

**Quién lo ve:** Solo Administrador

Permite crear, editar y desactivar las cuentas de acceso al sistema.

#### Resumen de permisos por rol

| Rol | Acceso |
|-----|--------|
| **Admin / Gerencia** | Acceso total: planilla, generación, RRHH, usuarios, configuración |
| **Supervisor** | Planilla, licencias, cambios, generación, reportes RRHH |
| **Enfermero** | Su agenda propia, solicitar licencias y cambios |

#### Filtros disponibles

En la parte superior de la tabla de usuarios encontrás:
- **Buscar:** búsqueda por nombre de usuario
- **Filtro por rol:** Admin, Supervisor, Enfermero
- **Filtro por estado:** Activos, Inactivos, Todos

#### Crear un nuevo usuario

1. Hacé clic en **"+ Nuevo Usuario"**.
2. Elegí a qué **funcionario** está vinculada la cuenta (el sistema carga automáticamente su información).
3. Seleccioná el **Rol** del usuario.
4. El **nombre de usuario** se genera automáticamente, pero podés modificarlo.
5. Ingresá una **contraseña temporal** (mínimo 6 caracteres).
6. Indicá si el usuario debe cambiar la contraseña al primer login (recomendado: activado).
7. Hacé clic en **"Crear y Enviar Invitación"**.

#### Crear usuarios en forma masiva

El botón **"🤖 Crear usuarios faltantes"** genera automáticamente cuentas de acceso para todos los funcionarios que aún no tienen usuario en el sistema. El proceso:
- Muestra cuántos funcionarios están sin cuenta antes de ejecutar
- Asigna contraseña inicial `Clinica2026!` a cada cuenta nueva
- Activa el flag de cambio de contraseña obligatorio en el primer login
- Muestra un log en tiempo real con el resultado de cada creación

#### Migrar cuentas Auth

El botón **"🔧 Migrar cuentas"** unifica todos los usuarios de autenticación al dominio interno del sistema (`@guardiapp.app`). Útil cuando existen cuentas con dominios externos (ej: `@mp-enfermeria.com`). No modifica contraseñas ni datos del usuario.

> Se recomienda ejecutar esta migración una sola vez luego de la configuración inicial del sistema, o si se incorporan usuarios con emails de dominios distintos.

#### Editar un usuario existente

En la tabla de usuarios, hacé clic en el ícono de editar de la fila. Solo podés modificar el rol y la vinculación con el funcionario. El nombre de usuario no puede modificarse una vez creado.

#### Resetear contraseña

En la tabla, hacé clic en el ícono de clave para resetear la contraseña de un usuario. Podés ingresar una nueva contraseña temporal y activar el flag de cambio obligatorio en el próximo login.

---

### 4.12 Sectores

**Quién lo ve:** Solo Administrador

Permite gestionar los sectores de la institución (áreas de trabajo). Los sectores son dinámicos: cualquier cambio se refleja inmediatamente en todos los formularios y filtros del sistema.

#### Tabla de sectores

Muestra todos los sectores con su nombre, código y cantidad de funcionarios asignados.

#### Crear un nuevo sector

1. Hacé clic en **"+ Nuevo Sector"**.
2. Ingresá el **nombre** del sector (en mayúsculas, ej: POLI MAÑANA).
3. Ingresá el **código** corto (ej: PM).
4. Hacé clic en **"Guardar"**.

> El sector nuevo aparecerá inmediatamente en todos los desplegables del sistema (formularios de funcionarios, filtros, matriz de competencias, etc.).

#### Eliminar un sector

Solo podés eliminar un sector si no tiene funcionarios asignados. Si intentás eliminar uno con personal, el sistema te lo impedirá con un mensaje de advertencia.

---

## 5. Roles de Usuario

### Tabla comparativa de permisos

| Funcionalidad | Admin | Supervisor | Enfermero |
|---------------|:-----:|:----------:|:---------:|
| Dashboard | Sí | Sí | No |
| Planificación mensual | Sí | Sí | No |
| Mi Agenda | Sí* | Sí* | Sí |
| Funcionarios | Sí | Sí | No |
| Licencias | Sí | Sí | Solo solicitar |
| Cambios de Turno | Sí (aprobar) | Sí (aprobar) | Sí (solicitar/aceptar) |
| Alertas | Sí | Sí | Solo propias |
| Generación Auto. | Sí | No | No |
| Notificaciones | Sí | Sí | No |
| Reporte RRHH | Sí | Sí | No |
| Usuarios y Permisos | Sí | No | No |
| Sectores | Sí | No | No |

*Solo si tienen un funcionario vinculado a su cuenta de usuario.

### Pantalla de inicio según rol

- **Admin / Supervisor:** al ingresar, van directamente al **Dashboard**.
- **Enfermero / Suplente:** al ingresar, van directamente a **Mi Agenda**.

### Rol Administrador / Gerencia

Es el rol con mayor nivel de acceso. Puede:
- Generar planillas mensuales automáticas
- Aprobar o cancelar generaciones
- Crear y administrar cuentas de usuario
- Gestionar sectores
- Enviar agendas por correo
- Ver y administrar todo el personal
- Migrar cuentas de autenticación

### Rol Supervisor

Acceso amplio de gestión sin configuración del sistema. Puede:
- Ver y editar la planilla mensual
- Cargar y gestionar licencias
- Aprobar o rechazar cambios de turno
- Ver reportes RRHH completos
- Enviar notificaciones al personal

### Rol Enfermero

Acceso limitado a su información personal. Puede:
- Ver su propia agenda mensual
- Solicitar licencias (requieren aprobación)
- Solicitar cambios de turno (requieren aceptación + aprobación)
- Aceptar o rechazar cambios de turno que le propongan
- Ver sus alertas personales

---

## 6. Ejemplos Prácticos Paso a Paso

---

### Ejemplo 1: Cómo solicitar un cambio de turno (Enfermero)

**Situación:** Necesitás cambiar tu turno del martes 15 con otro funcionario.

1. Ingresá al sistema y entrá a **Mi Agenda**.
2. Hacé clic en el día de tu turno en el calendario para iniciar la solicitud.
3. En el formulario **"Solicitud de Cambio"**:
   - En **"MI TURNO (a ceder)"**: la fecha y código de tu turno ya estarán precargados. Verificalos.
   - En **"INTERCAMBIO CON"**: el sistema mostrará compañeros disponibles con turnos compatibles. Hacé clic en la persona con quien querés intercambiar.
   - En **"Turno a recibir"**: indicá la fecha y código del turno que vas a tomar.
   - En **"Motivo"**: explicá brevemente el motivo (opcional pero recomendado).
4. Hacé clic en **"Enviar Solicitud"**.
5. El sistema notifica a la otra persona. Cuando acepte, pasa a supervisor para aprobación final.
6. Podés seguir el estado en **Mi Agenda** → sección "Mis Cambios de Turno".

---

### Ejemplo 2: Cómo cargar una licencia (Supervisor / Admin)

**Situación:** Un funcionario tiene certificado médico del 10 al 14 de abril.

1. Ir a **Licencias** → pestaña **"Nueva Licencia"**.
2. En **Funcionario**: escribí el apellido y seleccionalo de la lista.
3. En **Tipo**: seleccioná **CERT — Certificación**.
4. En **Desde**: 10/04/2026. En **Hasta**: 14/04/2026.
5. El sistema verificará que no hay superposición con otra licencia existente.
6. Como CERT genera vacante, aparece la sección de suplente. Elegí el suplente disponible o dejá "Sin asignar por ahora".
7. Agregá observaciones si necesitás (ej: "Certificado Dr. Rodríguez").
8. Hacé clic en **"Guardar y Notificar"**.
9. La licencia queda registrada y los turnos del funcionario se actualizan automáticamente en la planilla.

---

### Ejemplo 3: Cómo revisar y gestionar alertas (Supervisor / Admin)

**Situación:** Hay alertas pendientes en el sistema.

1. El número sobre el ícono de **Alertas** en el menú lateral indica cuántas hay sin leer.
2. Hacé clic en **Alertas** para ver el listado completo.
3. Revisá cada alerta:
   - **7ª Guardia consecutiva** → Verificar en la planilla si corresponde ajustar el turno del funcionario indicado.
   - **Vacante sin cubrir** → Hacé clic en **"Asignar"** para ir directamente a la licencia correspondiente y asignar un suplente.
   - **Cambio pendiente** → Hacé clic en **"Ver"** para ir a Cambios de Turno y aprobar o rechazar.
4. Una vez que tomaste acción, hacé clic en **"Marcar todas leídas"** para limpiar el contador.

---

### Ejemplo 4: Cómo generar la planilla del mes (Admin)

**Situación:** Hay que generar la planilla de Mayo.

1. Ir a **Generación Auto.**
2. En el desplegable **"Mes a generar"**, seleccioná **Mayo 2026**.
3. Verificá que no haya una generación existente para ese mes en el historial inferior.
4. Hacé clic en **"Generar Planilla"**.
5. El sistema procesa en 8 pasos. Esperá a que finalice (puede tardar unos segundos).
6. Si hay vacantes sin suplente asignado, aparece el modal de cobertura:
   - Podés asignar suplentes manualmente o usar **"Auto-asignar todos"**.
   - O hacé clic en **"Omitir por ahora"** y asigná desde Licencias más tarde.
7. La generación queda en estado **"borrador"**.
8. Para revisar: hacé clic en el botón de vista de la generación en el historial.
9. Revisá la planilla. Si está correcta, hacé clic en **"Aprobar planilla"**.
10. Ir a **Notificaciones** → hacé clic en **"Enviar todas"** para enviar las agendas a todos los funcionarios.

---

### Ejemplo 5: Cómo aceptar o rechazar un cambio propuesto (Enfermero)

**Situación:** Un compañero te propone un cambio de turno.

1. Verás el número en el menú de **Cambios de Turno** o una alerta en tus **Alertas**.
2. Ir a **Mi Agenda** → sección "Mis Cambios de Turno".
3. Verás la propuesta con el detalle: quién te lo pide, qué turno cedés y qué turno recibís.
4. Si aceptás: hacé clic en **"Aceptar"**. La solicitud pasa al supervisor para aprobación final.
5. Si no podés o no querés: hacé clic en **"Rechazar"**. El solicitante será notificado automáticamente.

---

### Ejemplo 6: Cómo consultar el reporte RRHH de un mes (Supervisor / Admin)

**Situación:** Necesitás verificar el cumplimiento de guardia del mes de marzo.

1. Ir a **Reporte RRHH**.
2. En el selector de **Mes**, elegí **Marzo 2026**.
3. Revisá los indicadores superiores: horas trabajadas, faltas, extras y cumplimiento general.
4. En la pestaña **"Resumen por Clínica"** verás el detalle completo por funcionario.
5. Para ver el detalle de una persona: ir a la pestaña **"Detalle Día a Día"** y seleccionarla en el filtro.
6. Para exportar: hacé clic en **"Descargar Excel RRHH"** o usá **Ctrl+P** para guardar como PDF.

---

### Ejemplo 7: Cómo crear usuarios masivamente (Admin)

**Situación:** Se incorporaron 20 nuevos funcionarios y necesitás darles acceso al sistema.

1. Ir a **Usuarios y Permisos**.
2. Hacé clic en **"🤖 Crear usuarios faltantes"**.
3. El sistema muestra cuántos funcionarios no tienen cuenta todavía.
4. Confirmá la operación.
5. Observá el log en tiempo real: cada línea muestra si la cuenta fue creada (✓), ya existía (↗) o hubo un error (✗).
6. Al finalizar, todos los nuevos usuarios podrán ingresar con su nombre de usuario y la contraseña inicial `Clinica2026!`. Se les pedirá cambiarla en el primer login.

---

## 7. Referencia de Códigos de Turno

### Turnos laborales

| Código | Nombre | Turno |
|--------|--------|-------|
| M | Mañana | Aprox. 6:00–14:00 |
| MS | Mañana Especial | Mañana con asignación especial |
| MC | Mañana Complemento | Mañana con complemento de horas |
| MG | Mañana Gimnasio | Mañana en gimnasio |
| MO | Mañana Oficina | Mañana en oficina |
| MU | Mañana Urgencia | Mañana en urgencias |
| MD | Mañana Domicilio | Mañana con atención domiciliaria |
| T | Tarde | Aprox. 14:00–22:00 |
| TS | Tarde Especial | Tarde con asignación especial |
| TO | Tarde Oficina | Tarde en oficina |
| TU | Tarde Urgencia | Tarde en urgencias |
| RS | Rotativo Especial | Rotativo especial |
| N | Noche | Aprox. 22:00–6:00 |
| NO | Noche Oficina | Noche en oficina |
| NU | Noche Urgencia | Noche en urgencias |
| V | Vespertino | Turno vespertino |
| VO | Vespertino Oficina | Vespertino en oficina |
| VU | Vespertino Urgencia | Vespertino en urgencias |
| VD | Vespertino Domicilio | Vespertino con atención domiciliaria |

### Licencias y ausencias

| Código | Nombre | Descripción |
|--------|--------|-------------|
| LAR | Licencia Anual Reglamentaria | Vacaciones anuales |
| MAT | Maternal | Licencia por maternidad/paternidad |
| CERT | Certificación | Certificado médico o capacitación |
| LE | Libre Especial | Licencia especial acordada |
| F | Falta | Ausencia imprevista |
| DXF | Día por Feriado | Compensación de feriado |
| CPL | Cumpleaños | Media guardia por cumpleaños |

### Códigos especiales

| Código | Descripción |
|--------|-------------|
| LXC | Cambio de turno aprobado — el turno fue intercambiado con otro funcionario |
| NC | No Convocar — funcionario no disponible para ser llamado |
| CMP | Cumpleaños — asignado automáticamente por el sistema |
| 7a | Séptima guardia consecutiva — genera alerta de horas extra |

---

## 8. Buenas Prácticas

### Uso correcto del sistema

- **Registrá las licencias antes de que empiecen**, no después. El sistema necesita los datos para generar coberturas y actualizar la planilla correctamente.
- **Asigná siempre un suplente** cuando la licencia genera vacante. Una vacante sin cubrir genera una alerta que persiste hasta resolverse.
- **Revisá las alertas del Dashboard** al comenzar cada jornada. Las alertas de 7ª guardia requieren acción inmediata.
- **Aprobá la planilla antes de enviarla.** Las planillas en estado "borrador" no están disponibles en Notificaciones.
- **Completá la matriz de Competencias** para todos los funcionarios. Esto permite que el sistema sugiera el suplente más adecuado con prioridad automática.

### Orden recomendado de trabajo mensual (para Administración)

1. Cargar todas las licencias LAR ya programadas para el mes siguiente.
2. Ir a **Generación Auto.** y generar la planilla.
3. Revisar el borrador generado, ajustar turnos individuales si es necesario.
4. Asignar suplentes para todas las vacantes (desde Licencias → Cobertura Pendiente).
5. Aprobar la planilla.
6. Enviar agendas desde Notificaciones.

### Evitar errores comunes

| Error frecuente | Cómo evitarlo |
|-----------------|---------------|
| Licencia con fechas superpuestas | El sistema avisa automáticamente; revisá el mensaje antes de guardar |
| Generar el mes sin licencias cargadas | Cargá primero todas las LAR programadas |
| Enviar agenda antes de aprobar la planilla | Aprobá siempre el borrador antes de ir a Notificaciones |
| Crear suplente sin asignar competencias | Completá la matriz de Competencias en Funcionarios para mejorar las sugerencias automáticas |
| Modificar turnos sin verificar el impacto | Revisá el reporte RRHH después de cambios masivos en la planilla |
| Funcionario de gestión con turnos en planilla | Desvinculá el funcionario del usuario y desactivalo si no es parte de la rotación |

---

## 9. Preguntas Frecuentes (FAQ)

**¿Por qué no puedo ingresar al sistema?**
Verificá que el nombre de usuario y la contraseña sean correctos (las mayúsculas importan). Si el problema persiste, contactá a administración para que revisen si tu cuenta está activa.

**¿Por qué no veo ningún dato después de ingresar?**
El sistema carga los datos al iniciar sesión. Esto puede tardar unos segundos. Si persiste el problema, verificá tu conexión a internet y recargá la página.

**¿Por qué no veo el Dashboard ni la Planificación?**
Esas secciones son exclusivas de los roles Administrador y Supervisor. Si sos enfermero o suplente, tu pantalla de inicio es Mi Agenda.

**¿Por qué el Dashboard muestra "Sin planificación generada"?**
La planilla del mes seleccionado aún no fue generada o aprobada. El Administrador debe generarla desde "Generación Auto." y luego aprobarla.

**¿Por qué los indicadores muestran 0% o cero?**
Puede ser que no haya datos de turnos para ese mes. Verificá que la planilla esté generada y aprobada para el período seleccionado.

**¿Por qué no puedo editar los datos de un funcionario?**
Solo los roles Administrador y Supervisor pueden editar funcionarios. Si tenés ese rol y aún así no podés, verificá si el funcionario está marcado como inactivo.

**¿Puedo cancelar una licencia ya cargada?**
Sí, pero deberás hacerlo desde la tabla de Licencias. Consultá con administración si implica ajustes en la planilla o en la cobertura asignada.

**¿Qué pasa si se genera una 7ª guardia automáticamente?**
El sistema crea una alerta visible en el Dashboard y en Alertas. El funcionario genera horas extra que quedan registradas en el reporte RRHH del mes.

**¿Por qué mi solicitud de cambio de turno sigue en "Pendiente"?**
La otra persona todavía no aceptó tu propuesta. Una vez que acepte, pasa al supervisor. Podés ver el estado actualizado en Mi Agenda → "Mis Cambios de Turno".

**¿Puedo tener más de una solicitud de cambio activa a la vez?**
El sistema evita solicitudes duplicadas (mismo funcionario, misma fecha, mismo turno). Podés tener solicitudes simultáneas para días diferentes.

**¿Qué pasa si el suplente asignado a una licencia ya no está disponible?**
Debés actualizar la cobertura desde Licencias, seleccionando la licencia y cambiando el suplente asignado. El sistema actualizará los turnos correspondientes.

**¿Cómo sé que mi agenda fue enviada por correo?**
Podés verificarlo en Notificaciones → sección "Historial de notificaciones". Aparece el registro de cada envío con fecha.

**¿Por qué no aparece un suplente en la lista de disponibles?**
Puede ser que el suplente esté marcado como inactivo o que ya tenga una asignación en las mismas fechas que generaría superposición.

**¿Por qué mi agenda muestra turnos de otra persona?**
Verificá con administración que tu usuario esté vinculado al funcionario correcto. Un usuario con funcionario mal vinculado mostrará la agenda del funcionario erróneo.

---

## 10. Soporte

### Ante problemas técnicos

1. **Recargá la página** — muchos problemas de visualización se resuelven con una recarga (F5 o Ctrl+R).
2. **Verificá tu conexión a internet** — el sistema requiere conexión activa para funcionar.
3. **Limpiá la caché del navegador** — si los datos parecen desactualizados, limpiar la caché puede ayudar.
4. **Probá con otro navegador** — la aplicación es compatible con Chrome, Firefox, Edge y Safari actualizados.

### A quién contactar

Para problemas que no podés resolver por tu cuenta:

- **Problemas de acceso o contraseña:** contactá al Administrador del sistema de tu institución.
- **Datos incorrectos en la planilla:** informale a tu supervisor o al área de administración.
- **Errores del sistema (pantalla en blanco, mensajes de error inesperados):** comunicalo al responsable técnico del sistema en tu institución.

### Información a tener lista al reportar un problema

Al reportar un problema, tené a mano:
- Tu nombre de usuario
- La sección donde ocurrió el problema
- Qué acción estabas realizando
- El mensaje de error exacto (si apareció alguno)
- Hora aproximada en que ocurrió

---

## Apéndice: Observaciones sobre la Interfaz

*Esta sección documenta aspectos del sistema que pueden resultar confusos o que están en proceso de mejora.*

---

**OBS-01 — Cobertura Pendiente vs. Sin cubrir**
La pestaña "Cobertura Pendiente" dentro de Licencias y el filtro "Sin cubrir" muestran información similar. La pestaña Cobertura Pendiente agrupa por sector y es más completa; el filtro "Sin cubrir" en la primera pestaña es más rápido para acceder.

**OBS-02 — Generación y Planificación son pasos de un mismo proceso**
La sección Generación Auto. crea la planilla, y la sección Planificación es donde se visualiza y edita. Son dos etapas complementarias: primero se genera, luego se revisa y edita en Planificación.

**OBS-03 — El estado "Pendiente" en licencias tiene dos significados**
Una licencia puede estar en estado "Pendiente" porque no tiene suplente asignado, o porque fue creada recientemente y aún no está activa. El contexto (fecha de inicio) ayuda a distinguirlos.

**OBS-04 — La aprobación de supervisor en cambios de turno es obligatoria**
Aunque el receptor acepte el cambio, este no se aplica en la planilla hasta que el supervisor lo aprueba. La aceptación del receptor es solo el primer paso del flujo.

**OBS-05 — Exportación a PDF desde Reporte RRHH**
La opción de PDF no tiene un botón dedicado — se realiza usando la función de impresión del navegador (Ctrl+P → "Guardar como PDF").

**OBS-06 — Sectores dinámicos**
Los sectores se cargan desde la base de datos al iniciar sesión. Si se crea un sector nuevo y no aparece en algún desplegable, recargá la página para actualizar los datos.

**OBS-07 — Mi Agenda para roles de gestión**
Los usuarios con rol Administrador o Supervisor solo verán contenido en "Mi Agenda" si tienen un funcionario vinculado a su cuenta y ese funcionario tiene turnos en la planilla. Si el perfil es exclusivamente de gestión (sin vínculo a un funcionario), la sección mostrará que no hay turnos asignados.

---

*Este manual fue generado a partir del análisis del código fuente de GuardiaApp versión 13.3 — Actualizado Marzo 2026.*
