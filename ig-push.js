/* =========================================================
   International Gateway — Admin Web Push
   ig-push.js
   Registra este dispositivo para recibir pedidos.
   No contiene claves privadas.
   ========================================================= */

(function () {
  "use strict";

  if (window.__IG_PUSH_V1) return;
  window.__IG_PUSH_V1 = true;

  const SUPABASE_URL =
    "https://hxtzlrsmjwrpqgjgbzyl.supabase.co";

  const SUPABASE_KEY =
    "sb_publishable_cv6J952zB8hmDtXSHMbtCQ_xGJZHN1J";

  const REGISTER_FUNCTION =
    SUPABASE_URL + "/functions/v1/register-admin-push";

  /*
   * Clave pública VAPID.
   * La privada permanece exclusivamente en Supabase.
   */
  const VAPID_PUBLIC_KEY =
    "BHrwnC3gl9Xzd94JcEp19rJOCyd-OuOYXiloFkby3UaZFuS12zeuIlglhkKT9ijSDRQFkXmCtMQ2Ygg8E3FnnXs";

  function base64ToUint8Array(base64String) {
    const padding = "=".repeat(
      (4 - (base64String.length % 4)) % 4
    );

    const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");

    const rawData = atob(base64);

    return Uint8Array.from(
      rawData,
      char => char.charCodeAt(0)
    );
  }

  async function registerServiceWorker() {
    if (!("serviceWorker" in navigator)) {
      throw new Error(
        "Este navegador no admite Service Worker."
      );
    }

    return navigator.serviceWorker.register("./sw.js", {
      scope: "./"
    });
  }

  async function getPushSubscription(registration) {
    if (!("PushManager" in window)) {
      throw new Error(
        "Este navegador no admite Web Push."
      );
    }

    let subscription =
      await registration.pushManager.getSubscription();

    /*
     * Si ya existe una suscripción válida,
     * conservarla y no crear otra.
     */
    if (subscription) {
      return subscription;
    }

    if (!("Notification" in window)) {
      throw new Error(
        "Este navegador no admite notificaciones."
      );
    }

    let permission = Notification.permission;

    if (permission !== "granted") {
      permission =
        await Notification.requestPermission();
    }

    if (permission !== "granted") {
      throw new Error(
        "Permiso de notificaciones no concedido."
      );
    }

    subscription =
      await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey:
          base64ToUint8Array(VAPID_PUBLIC_KEY)
      });

    return subscription;
  }

  async function saveSubscription(subscription) {
    if (
      !window.supabase ||
      !window.supabase.createClient
    ) {
      throw new Error(
        "Supabase no está disponible."
      );
    }

    const client =
      window.__IG_PUSH_SUPABASE ||
      (window.__IG_PUSH_SUPABASE =
        window.supabase.createClient(
          SUPABASE_URL,
          SUPABASE_KEY
        ));

    const {
      data: sessionData,
      error: sessionError
    } = await client.auth.getSession();

    if (sessionError) throw sessionError;

    const session =
      sessionData && sessionData.session;

    if (
      !session ||
      !session.access_token
    ) {
      throw new Error(
        "Iniciá sesión como administrador antes de activar las notificaciones."
      );
    }

    const json = subscription.toJSON();

    const response = await fetch(
      REGISTER_FUNCTION,
      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          "Authorization":
            "Bearer " + session.access_token,

          "apikey": SUPABASE_KEY
        },

        body: JSON.stringify({
          endpoint: json.endpoint,

          p256dh:
            json.keys &&
            json.keys.p256dh,

          auth:
            json.keys &&
            json.keys.auth,

          user_agent:
            navigator.userAgent
        })
      }
    );

    let result = {};

    try {
      result = await response.json();
    } catch (_) {}

    if (
      !response.ok ||
      !result ||
      result.ok !== true ||
      result.verified !== true
    ) {
      throw new Error(
        result.error ||
        "El servidor no confirmó el registro del dispositivo."
      );
    }

    return result;
  }

  async function enableAdminPush() {
    const registration =
      await registerServiceWorker();

    await navigator.serviceWorker.ready;

    const subscription =
      await getPushSubscription(
        registration
      );

    await saveSubscription(
      subscription
    );

    return {
      ok: true,
      subscription
    };
  }

  async function getAdminPushStatus() {
    if (!("serviceWorker" in navigator)) {
      return {
        supported: false,
        permission: "unsupported",
        subscribed: false
      };
    }

    const registration =
      await navigator.serviceWorker.getRegistration(
        "./"
      );

    if (!registration) {
      return {
        supported: true,

        permission:
          "Notification" in window
            ? Notification.permission
            : "unsupported",

        subscribed: false
      };
    }

    const subscription =
      await registration.pushManager.getSubscription();

    return {
      supported:
        "PushManager" in window,

      permission:
        "Notification" in window
          ? Notification.permission
          : "unsupported",

      subscribed:
        !!subscription,

      endpoint:
        subscription?.endpoint || null
    };
  }

  async function disableAdminPush() {
    if (!("serviceWorker" in navigator)) {
      return;
    }

    const registration =
      await navigator.serviceWorker.getRegistration(
        "./"
      );

    if (!registration) return;

    const subscription =
      await registration.pushManager.getSubscription();

    if (!subscription) return;

    await subscription.unsubscribe();
  }

  window.IGPush = {
    enable: enableAdminPush,
    status: getAdminPushStatus,
    disable: disableAdminPush
  };

})();
