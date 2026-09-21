/* International Gateway — Web Push Service Worker */

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
