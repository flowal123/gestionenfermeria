// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/12.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.10.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyCW-jz1wDDi22bb2eycVurectqOMuI_DfY",
  authDomain:        "pase-guardia.firebaseapp.com",
  projectId:         "pase-guardia",
  storageBucket:     "pase-guardia.firebasestorage.app",
  messagingSenderId: "555094730766",
  appId:             "1:555094730766:web:511ab1a8a567aba69a745f"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(payload => {
  // Si la app está abierta en cualquier pestaña → NO mostrar notif del sistema
  // El snapshot de Firestore ya muestra el toast in-app, evitamos el duplicado
  return self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then(clientList => {
      const appIsOpen = clientList.some(c => c.url.includes('pase-guardia'));
      if (appIsOpen) return; // app abierta → el toast in-app ya alcanza

      // App cerrada → mostrar notificación del sistema
      const n = payload.notification || {};
      return self.registration.showNotification(n.title || '🏥 Nuevo pase de guardia', {
        body:     n.body || 'Hay un nuevo pase disponible',
        icon:     '/icon-192.png',
        badge:    '/icon-192.png',
        tag:      'pase-guardia',
        renotify: true,
        vibrate:  [200, 100, 200],
        actions:  [{ action: 'open', title: '👁 Ver pase' }]
      });
    });
});

// Click en notificación → abrir o enfocar la app
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = self.location.origin + '/pase-guardia-v3-firebase.html';
  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => {
        for (const client of list) {
          if (client.url.includes('pase-guardia') && 'focus' in client) {
            return client.focus();
          }
        }
        return self.clients.openWindow(url);
      })
  );
});
