(function () {
  // ===== Util =====
  const isVisible = el => !!el && el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden';

  function collectIframesDeep(root = document) {
    const found = new Set();
    function walk(node) {
      if (!node) return;
      if (node.querySelectorAll) node.querySelectorAll('iframe').forEach(ifr => found.add(ifr));
      if (node.shadowRoot) walk(node.shadowRoot);
      if (node.children) Array.from(node.children).forEach(walk);
    }
    walk(root);
    return Array.from(found);
  }

  function findNextButton() {
    const els = Array.from(document.querySelectorAll('button, a, div'));
    return els.find(el =>
      (el.innerText || '').trim().toLowerCase() === 'selanjutnya' &&
      isVisible(el) &&
      !el.disabled
    );
  }

  function findYouTubeIframeCandidate() {
    const iframes = collectIframesDeep();
    for (const ifr of iframes) {
      const ds = ifr.getAttribute('data-src') || ifr.getAttribute('data-lazy-src');
      const src = (ifr.getAttribute('src') || ds || '').toLowerCase();
      const isYT = src.includes('youtube.com/embed') || src.includes('youtube-nocookie.com/embed');
      if (isYT && isVisible(ifr)) return ifr;
    }
    return null;
  }

  // ===== Handshake: tunggu sampai player siap =====
  function waitForYouTubeReady(iframe, { timeoutMs = 10000 } = {}) {
    return new Promise((resolve, reject) => {
      let done = false;
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error('Timeout menunggu onReady dari YouTube'));
      }, timeoutMs);

      function cleanup() {
        done = true;
        clearTimeout(timer);
        window.removeEventListener('message', onMsg, true);
      }

      function onMsg(ev) {
        if (!ev || !ev.data) return;
        // hanya pesan dari youtube
        const originOk =
          typeof ev.origin === 'string' &&
          (ev.origin.includes('youtube.com') || ev.origin.includes('youtube-nocookie.com'));
        if (!originOk) return;

        let data = ev.data;
        if (typeof data === 'string') {
          try { data = JSON.parse(data); } catch { /* ignore */ }
        }
        if (!data || typeof data !== 'object') return;

        // pastikan ini balasan dari iframe target
        if (ev.source !== iframe.contentWindow) return;

        // YouTube biasanya mengirim salah satu dari ini lebih dulu
        if (data.event === 'onReady' || data.event === 'infoDelivery' || data.info != null) {
          if (!done) {
            cleanup();
            resolve();
          }
        }
      }

      window.addEventListener('message', onMsg, true);

      // kirim "listening" ping berkala sampai ada balasan
      const sendListening = () => {
        if (done) return;
        try {
          iframe.contentWindow.postMessage(
            JSON.stringify({ event: 'listening', id: iframe.id || null }),
            '*'
          );
        } catch {}
      };
      sendListening();
      const listeningInterval = setInterval(() => {
        if (done) return clearInterval(listeningInterval);
        sendListening();
      }, 300);
    });
  }

  // ===== Play aman: handshake -> mute -> play =====
  async function playIframeMutedWhenReady(iframe) {
    try {
      // pastikan ada id (berguna untuk identifikasi, tidak mengubah src)
      if (!iframe.id) iframe.id = 'yt-iframe-' + Math.random().toString(36).slice(2, 9);

      // validasi origin param (opsional: hanya log peringatan, tidak mengubah src)
      try {
        const u = new URL(iframe.src, location.href);
        const paramOrigin = u.searchParams.get('origin');
        if (paramOrigin && paramOrigin !== location.origin) {
          console.warn('[yt] origin param pada iframe berbeda:', paramOrigin, '!=', location.origin);
        }
      } catch {}

      await waitForYouTubeReady(iframe);
      // setelah siap, kirim mute lalu play
      iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'mute', args: [] }), '*');
      iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func: 'playVideo', args: [] }), '*');
      console.log('[yt] play (muted) setelah onReady');
    } catch (e) {
      console.warn('[yt] gagal memutar (handshake):', e.message);
    }
  }

  // ===== Orkestrasi: klik "Selanjutnya" -> cari iframe -> handshake -> play =====
  let inFlight = false;
  let lastClickAt = 0;

  function clickNextThenPlay() {
    const btn = findNextButton();
    if (!btn) return false;

    const now = Date.now();
    if (now - lastClickAt < 400) return true; // debounce
    lastClickAt = now;

    btn.click();
    console.log("[auto-click] Klik tombol 'Selanjutnya'.");

    if (!inFlight) {
      inFlight = true;
      setTimeout(async () => {
        const ifr = findYouTubeIframeCandidate();
        if (!ifr) {
          // jika belum ada, tunggu sampai muncul lalu play
          const start = Date.now();
          const poll = setInterval(() => {
            const cand = findYouTubeIframeCandidate();
            if (cand || Date.now() - start > 15000) {
              clearInterval(poll);
              if (cand) playIframeMutedWhenReady(cand).finally(() => (inFlight = false));
              else {
                console.warn('[auto] iframe YouTube tidak ketemu.');
                inFlight = false;
              }
            }
          }, 250);
        } else {
          await playIframeMutedWhenReady(ifr);
          inFlight = false;
        }
      }, 100); // beri jeda kecil agar DOM baru terpasang
    }
    return true;
  }

  // Observer: tiap perubahan DOM, coba jalankan alur
  const observer = new MutationObserver(() => {
    clickNextThenPlay();
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Eksekusi awal
  clickNextThenPlay();
})();
