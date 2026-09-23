/* =========================================================
   International Gateway — Service Worker
   PWA + Web Push de pedidos
   ========================================================= */

const CACHE_NAME = "international-gateway-v2";

const APP_SHELL = [
  "./",
  "./index.html",
  "./manifest.json",
  "./ig-push.js"
];

/* =========================================================
   INSTALACIÓN PWA
   ========================================================= */

self.addEventListener("install", function (event) {

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
        return cache.addAll(APP_SHELL);
      })
      .then(function () {
        return self.skipWaiting();
      })
  );

});

/* =========================================================
   ACTIVACIÓN
   ========================================================= */

self.addEventListener("activate", function (event) {

  event.waitUntil(
    caches.keys()
      .then(function (keys) {

        return Promise.all(
          keys
            .filter(function (key) {
              return key !== CACHE_NAME;
            })
            .map(function (key) {
              return caches.delete(key);
            })
        );

      })
      .then(function () {
        return self.clients.claim();
      })
  );

});

/* =========================================================
   CACHÉ / OFFLINE
   ========================================================= */

self.addEventListener("fetch", function (event) {

  if (event.request.method !== "GET") {
    return;
  }

  var requestUrl = new URL(event.request.url);

  /* Solo recursos del propio International Gateway */
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  /* No interceptar el propio Service Worker */
  if (
    requestUrl.pathname.endsWith("/sw.js")
  ) {
    return;
  }

  /* Navegación: red primero, caché si estamos offline */
  if (event.request.mode === "navigate") {

    event.respondWith(

      fetch(event.request, {
        cache: "no-store"
      })

        .then(function (response) {

          var copy = response.clone();

          caches.open(CACHE_NAME)
            .then(function (cache) {
              cache.put(event.request, copy);
            });

          return response;

        })

        .catch(function () {

          return caches.match(event.request)
            .then(function (cached) {

              return (
                cached ||
                caches.match("./index.html")
              );

            });

        })

    );

    return;
  }

  /* Recursos locales: red primero y caché como respaldo */
  event.respondWith(

    fetch(event.request)

      .then(function (response) {

        if (response && response.ok) {

          var copy = response.clone();

          caches.open(CACHE_NAME)
            .then(function (cache) {
              cache.put(event.request, copy);
            });

        }

        return response;

      })

      .catch(function () {

        return caches.match(event.request);

      })

  );

});

/* =========================================================
   WEB PUSH — NUEVO PEDIDO
   ========================================================= */

self.addEventListener("push", function (event) {

  var data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {}

  var title =
    data.title ||
    "🚨 NUEVO PEDIDO — International Gateway";

  var body =
    data.body ||
    "Hay un nuevo pedido.";

  var url =
    data.url ||
    "./?ig=open-orders";

  event.waitUntil(

    self.registration.showNotification(
      title,
      {
        body: body,

        icon: "/icon-192.png",
        badge: "/icon-192.png",

        tag:
          "ig-order-" +
          (data.orderId || Date.now()),

        renotify: true,

        requireInteraction: true,

        silent: false,

        vibrate: [
          300,
          120,
          300,
          120,
          700
        ],

        data: {
          url: url,
          orderId:
            data.orderId || null
        }
      }
    )

  );

});

/* =========================================================
   CLIC EN NOTIFICACIÓN
   ========================================================= */

self.addEventListener(
  "notificationclick",
  function (event) {

    event.notification.close();

    var targetUrl =
      (
        event.notification.data &&
        event.notification.data.url
      ) || "./?ig=open-orders";

    event.waitUntil(

      self.clients
        .matchAll({
          type: "window",
          includeUncontrolled: true
        })

        .then(function (clients) {

          for (
            var i = 0;
            i < clients.length;
            i++
          ) {

            var client = clients[i];

            if ("focus" in client) {

              try {

                client.postMessage({
                  type:
                    "IG_OPEN_ORDERS"
                });

              } catch (e) {}

              return client.focus();

            }

          }

          if (self.clients.openWindow) {

            return self.clients.openWindow(
              targetUrl
            );

          }

        })

    );

  }
);
