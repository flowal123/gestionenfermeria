// functions/index.js
// Deployar con: firebase deploy --only functions

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { initializeApp }     = require('firebase-admin/app');
const { getFirestore }      = require('firebase-admin/firestore');
const { getMessaging }      = require('firebase-admin/messaging');

initializeApp();

exports.notificarNuevoPase = onDocumentCreated(
  'historial/{paseId}',
  async (event) => {
    const pase = event.data?.data();
    if (!pase) return;

    const db        = getFirestore();
    const messaging = getMessaging();

    // 1. Obtener todos los tokens FCM registrados
    const tokensSnap = await db.collection('fcmTokens').get();
    if (tokensSnap.empty) return;

    // 2. Construir el mensaje
    const title = `🏥 ${pase.clinicaNombre} — ${pase.sectorNombre}`;
    const body  = `Turno ${pase.turno} · ${pase.fecha}\n▲ ${pase.entrega}  ▼ ${pase.recibe}`;

    // 3. Filtrar tokens por rol/scope y enviar
    const tokens = [];
    tokensSnap.forEach(doc => {
      const t = doc.data();

      // El autor del pase no recibe notificación propia
      if (t.userName === pase.autor) return;

      // Admin recibe todo
      if (t.rol === 'admin') { tokens.push(t.token); return; }

      // Nurse recibe todo (puede filtrar en app)
      if (t.rol === 'nurse') { tokens.push(t.token); return; }

      // Enfermero: solo si es de su clínica y sector
      if (t.rol === 'enfermero') {
        const mismaClinica = !t.clinicaId || t.clinicaId === pase.clinicaId;
        const mismoSector  = !t.sectorId  || t.sectorId  === pase.sectorId;
        if (mismaClinica && mismoSector) tokens.push(t.token);
      }
    });

    if (!tokens.length) return;

    // 4. Enviar en batches de 500 (límite FCM)
    const batchSize = 500;
    const results   = [];
    for (let i = 0; i < tokens.length; i += batchSize) {
      const batch = tokens.slice(i, i + batchSize);
      try {
        const response = await messaging.sendEachForMulticast({
          tokens: batch,
          notification: { title, body },
          webpush: {
            notification: {
              title,
              body,
              icon:  '/icon-192.png',
              badge: '/icon-192.png',
              tag:   'pase-guardia',
              renotify: true,
              requireInteraction: false,
            },
            fcmOptions: { link: '/' }
          },
          android: {
            notification: { title, body, channelId: 'pase-guardia', priority: 'high' }
          }
        });

        // Limpiar tokens inválidos de Firestore
        const deletePromises = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const code = resp.error?.code;
            if (
              code === 'messaging/invalid-registration-token' ||
              code === 'messaging/registration-token-not-registered'
            ) {
              // Buscar y eliminar el token inválido
              tokensSnap.forEach(doc => {
                if (doc.data().token === batch[idx]) {
                  deletePromises.push(db.collection('fcmTokens').doc(doc.id).delete());
                }
              });
            }
          }
        });
        await Promise.all(deletePromises);
        results.push(response);
      } catch (e) {
        console.error('Error sending FCM batch:', e);
      }
    }

    console.log(`Notificaciones enviadas: ${tokens.length} tokens para pase ${event.params.paseId}`);
  }
);
