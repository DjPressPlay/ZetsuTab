/*=========================================================
   ZInfinityAuth.js — Universal Z-Auth Connector
   Author: Artworqq Kevin Suber Jr (Zetsumetsu Corp)
   Version: 1.0.3 — Oct 2025
=========================================================*/

(() => {
  const ZAUTH_ORIGIN = "https://zetsuinfinityauth.netlify.app";

  const ZInfinityAuth = {
    client_id: null,
    token: null,
    popup: null,
    callback: null,

    /*-----------------------------------
     *  INIT
     *-----------------------------------*/
    init({ client_id, callback }) {
      if (!client_id) throw new Error("ZInfinityAuth.init → client_id required");

      this.client_id = client_id;
      this.callback = callback || null;
      this.token = localStorage.getItem("zinfinity_token");

      // 🔹 Listen for popup messages
      window.addEventListener("message", (e) => {
        if (e.origin !== ZAUTH_ORIGIN || !e.data) return;

        const { type, token, user } = e.data;
        if (type === "ZAUTH_SUCCESS" && token) {
          this.token = token;
          localStorage.setItem("zinfinity_token", token);
          if (typeof this.callback === "function")
            this.callback({ type, token, user });
          if (this.popup && !this.popup.closed) this.popup.close();
        }
      });

      // 🔹 Auto-verify existing session
      if (this.token) {
        this.verify().then((res) => {
          if (res.verified && typeof this.callback === "function")
            this.callback({ type: "ZAUTH_VERIFIED", ...res });
        });
      }

      console.log(`[ZInfinityAuth] Initialized → ${client_id}`);
    },

    /*-----------------------------------
     *  OPEN AUTH POPUP
     *-----------------------------------*/
    open() {
      const w = 420,
        h = 640;
      const y = window.outerHeight / 2 + window.screenY - h / 2;
      const x = window.outerWidth / 2 + window.screenX - w / 2;

      const url = `${ZAUTH_ORIGIN}/ZIAuth.html?mode=popup&client=${encodeURIComponent(
        this.client_id
      )}`;

      this.popup = window.open(
        url,
        "ZInfinityAuth",
        `width=${w},height=${h},left=${x},top=${y},resizable=no,menubar=no,toolbar=no,location=no,status=no`
      );

      if (!this.popup) {
        console.warn("⚠️ Popup blocked by browser.");
        return false;
      }
      return true;
    },

    /*-----------------------------------
     *  VERIFY EXISTING TOKEN
     *-----------------------------------*/
    async verify() {
      if (!this.token) return { verified: false };

      try {
        const res = await fetch(`${ZAUTH_ORIGIN}/.netlify/functions/verify`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
          },
          body: JSON.stringify({
            token: this.token,
            client_id: this.client_id,
          }),
          mode: "cors",
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (err) {
        console.error("[ZInfinityAuth] verify() failed →", err);
        return { verified: false, error: err.message };
      }
    },

    /*-----------------------------------
     *  SEND LOG / WEBHOOK
     *-----------------------------------*/
    async log(action, data = {}) {
      if (!this.token) return { error: "No token available" };

      try {
        const res = await fetch(`${ZAUTH_ORIGIN}/.netlify/functions/log`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
          },
          body: JSON.stringify({
            token: this.token,
            client_id: this.client_id,
            action,
            data,
            time: new Date().toISOString(),
          }),
          mode: "cors",
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (err) {
        console.error("[ZInfinityAuth] log() error →", err);
        return { error: err.message };
      }
    },

    /*-----------------------------------
     *  LOGOUT / CLEAR SESSION
     *-----------------------------------*/
    logout() {
      this.token = null;
      localStorage.removeItem("zinfinity_token");
      console.log("[ZInfinityAuth] Session cleared.");
    },
  };

  // ✅ Export to window (safe attach)
  if (!window.ZInfinityAuth) {
    Object.defineProperty(window, "ZInfinityAuth", {
      value: ZInfinityAuth,
      writable: false,
    });
  }
})();
