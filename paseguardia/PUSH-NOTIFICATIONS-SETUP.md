# 🔔 Guía: Notificaciones Push con FCM
## PaseGuardia — Push Notifications Setup

---

## ARCHIVOS QUE RECIBÍS

```
pase-guardia-v3-firebase.html   ← App principal (ya tiene FCM integrado)
firebase-messaging-sw.js        ← Service Worker (va en la misma carpeta)
functions/
  index.js                      ← Cloud Function
  package.json
```

---

## PASO 1 — Activar Plan Blaze

1. Ir a https://console.firebase.google.com
2. Tu proyecto → ícono de engranaje → **Upgrade to Blaze**
3. Ingresar tarjeta de crédito (no se cobra con el uso normal)

---

## PASO 2 — Obtener VAPID Key

1. Firebase Console → tu proyecto → ⚙️ Project Settings
2. Pestaña **Cloud Messaging**
3. Sección **Web Push certificates**
4. Click **Generate key pair** (si no hay una ya)
5. Copiá la clave completa (empieza con `BN...`)

---

## PASO 3 — Pegar la VAPID Key en el HTML

Abrí `pase-guardia-v3-firebase.html` y buscá esta línea:

```javascript
const VAPID_KEY = 'REEMPLAZAR_CON_TU_VAPID_KEY';
```

Reemplazala con tu clave, por ejemplo:
```javascript
const VAPID_KEY = 'BNxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx';
```

---

## PASO 4 — Instalar Firebase CLI y desplegar la Cloud Function

```bash
# Instalar CLI (solo una vez)
npm install -g firebase-tools

# Login
firebase login

# En la carpeta donde están tus archivos:
firebase init functions
# → Seleccionar proyecto: pase-guardia
# → Lenguaje: JavaScript
# → NO instalar ESLint
# → SÍ instalar dependencias

# Copiar el index.js que te dimos a functions/index.js
# (reemplazá el que se creó)

# Desplegar
firebase deploy --only functions
```

---

## PASO 5 — Alojar los archivos (IMPORTANTE para iOS/móvil)

Para que las notificaciones funcionen en móvil, los archivos **deben estar en HTTPS**, no en file://.

**Opción más simple — Firebase Hosting (gratis):**

```bash
firebase init hosting
# → Public directory: . (punto — la carpeta actual)
# → Single page app: NO
# → Rewrite all URLs: NO

firebase deploy --only hosting
```

Tus archivos quedarán en: `https://pase-guardia.web.app`

**¿Por qué es necesario HTTPS?**
- Service Workers no funcionan en file://
- Notificaciones push requieren HTTPS
- iOS requiere HTTPS + PWA instalada

---

## PASO 6 — Firestore Rules (agregar colección fcmTokens)

En Firebase Console → Firestore → Rules, agregá esto:

```
match /fcmTokens/{tokenId} {
  allow read, write: if true; // tokens solo se escriben desde la app logueada
}
```

---

## PASO 7 — Usar la app

1. Abrir `https://pase-guardia.web.app` en cada dispositivo
2. Loguearse
3. El browser pedirá permiso para notificaciones → **Permitir**
4. Listo — cuando un enfermero guarda un pase, todos reciben la notificación

---

## Comportamiento por plataforma

| Plataforma | App abierta | App en background | App cerrada |
|-----------|-------------|-------------------|-------------|
| Chrome/PC | ✅ Toast in-app | ✅ Notif del sistema | ✅ Notif del sistema |
| Android Chrome | ✅ Toast in-app | ✅ Notif sistema | ✅ Notif sistema |
| iOS Safari (PWA instalada) | ✅ Toast in-app | ✅ Notif sistema | ✅ Notif sistema |
| iOS Safari (no instalada) | ✅ Toast in-app | ❌ No soportado | ❌ No soportado |

**Para iOS:** Ir a Safari → compartir → "Agregar a pantalla de inicio"

---

## Troubleshooting

**"No se pide permiso de notificaciones"**
→ Verificar que VAPID_KEY esté reemplazada en el HTML
→ Verificar que el archivo esté en HTTPS (no file://)

**"Se pide permiso pero no llegan notificaciones de background"**
→ Verificar que `firebase-messaging-sw.js` esté en la misma carpeta que el HTML
→ Verificar que la Cloud Function esté desplegada: `firebase functions:list`

**"La Cloud Function falla"**
→ Ver logs: `firebase functions:log`
→ Verificar que el proyecto esté en plan Blaze

---

## Costos estimados

Con 10 usuarios y 50 pases/día:
- Cloud Functions: ~1,500 invocaciones/mes → **$0** (free tier: 2M)
- FCM: completamente gratis, sin límite
- Hosting: ~1MB/mes → **$0** (free tier: 10GB)
- **Total: $0/mes**
