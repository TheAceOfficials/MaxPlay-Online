"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import styles from "./page.module.css";

function isHls(url: string) {
  return /\.m3u8(\?.*)?$/i.test(url);
}

function isSafari() {
  if (typeof navigator === "undefined") return false;
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}

export default function HomePage() {
  const [url, setUrl] = useState("");
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Load video when Play Now pressed
  const playVideo = () => {
    const v = videoRef.current;
    if (!v || !url) return;

    // Cleanup old
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    if (isHls(url)) {
      if (v.canPlayType("application/vnd.apple.mpegurl") || isSafari()) {
        v.src = url;
        v.play().catch(() => {});
      } else if (Hls.isSupported()) {
        const hls = new Hls({ maxBufferLength: 30 });
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(v);
        hls.on(Hls.Events.MANIFEST_PARSED, () => v.play().catch(() => {}));
      } else {
        alert("This browser cannot play HLS. Try external app.");
      }
    } else {
      v.src = url;
      v.play().catch(() => {});
    }
  };

  // External open helpers
  const openInApp = () => {
    if (!url) return;

    // Android intent deep-link hint
    const ua = navigator.userAgent.toLowerCase();
    const isAndroid = ua.includes("android");

    if (isAndroid) {
      // Try generic chooser by navigating to the raw URL; many Android browsers show app picker
      window.location.href = url;
      // Fallback: show a chooser tip
      setTimeout(() => {
        if (document.visibilityState === "visible") {
          alert("If it didn't prompt, long-press the link and choose Open in app, or copy URL and open in VLC/MX Player.");
        }
      }, 1200);
      return;
    }

    // iOS: show copy tip (VLC: Open Network Stream)
    const ok = navigator.clipboard?.writeText(url);
    Promise.resolve(ok).finally(() => {
      alert("Link copied. In VLC: More > New Stream > paste the URL. In MPV/others, use Open URL/Network Stream.");
    });
  };

  useEffect(() => {
    return () => {
      if (hlsRef.current) hlsRef.current.destroy();
    };
  }, []);

  return (
    <div className={styles.bg}>
      <main className={styles.wrap}>
        <div className={styles.col}>
          <h1 className={styles.title}>MaxPlay - Online</h1>
          <p className={styles.subtitle}>Stream Anything, Instantly. No Login. No Ads.</p>

          <div className={styles.row}>
            <input
              className={styles.input}
              placeholder="URL"
              value={url}
              onChange={(e) => setUrl(e.target.value.trim())}
            />
            <button className={styles.btnPrimary} onClick={playVideo}>Play Now</button>
          </div>

          <button className={styles.btnGhost} onClick={openInApp}>Open in App</button>

          <video
            ref={videoRef}
            controls
            playsInline
            preload="metadata"
            style={{
              width: "min(980px, 100%)",
              borderRadius: 16,
              marginTop: 6,
              display: url ? "block" : "none",
              background: "rgba(0,0,0,.35)",
              border: "1px solid rgba(255,255,255,.14)",
            }}
          />

          <section className={styles.features}>
            <div className={styles.feature}>
              <div>🔒</div>
              <div>No Need to Login or Sign Up</div>
            </div>
            <div className={styles.feature}>
              <div>✖️</div>
              <div>Completely Ad‑Free Streaming</div>
            </div>
            <div className={styles.feature}>
              <div>▶️ 8K</div>
              <div>Up to 8K Ultra HD Video Quality</div>
            </div>
            <div className={styles.feature}>
              <div>🎚️</div>
              <div>Multiple Audio Tracks Support</div>
            </div>
            <div className={styles.feature}>
              <div>🎧 Dolby Atmos</div>
              <div>Immersive High‑Quality Audio</div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
