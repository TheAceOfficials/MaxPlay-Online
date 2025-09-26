"use client";
import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import styles from "./page.module.css";

function isHls(url: string) {
  return /\.m3u8(\?.*)?$/i.test(url);
}
function isSafari() {
  if (typeof navigator === "undefined") return false;
  return /^((?!chrome|android).)safari/i.test(navigator.userAgent);
}

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [lightTheme, setLightTheme] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  const playVideo = () => {
    const v = videoRef.current;
    if (!v || !url) return;

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

  const openInApp = () => {
    if (!url) return;
    const ua = navigator.userAgent.toLowerCase();
    const isAndroid = ua.includes("android");

    if (isAndroid) {
      window.location.href = url;
      setTimeout(() => {
        if (document.visibilityState === "visible") {
          alert("If it didn't prompt, copy URL and open in VLC/MX Player.");
        }
      }, 1200);
      return;
    }

    const ok = navigator.clipboard?.writeText(url);
    Promise.resolve(ok).finally(() => {
      alert("Link copied. Use VLC > New Stream > paste the URL.");
    });
  };

  useEffect(() => {
    return () => {
      if (hlsRef.current) hlsRef.current.destroy();
    };
  }, []);

  return (
    <div className={`${styles.container} ${lightTheme ? styles.lightTheme : ""}`}>
      <button
        className={styles.themeToggle}
        onClick={() => setLightTheme(!lightTheme)}
      >
        {lightTheme ? "🌙 Dark" : "☀️ Light"}
      </button>

      <div className={styles.header}>
        <div className={styles.title}>MaxPlay - Online</div>
        <div className={styles.subtitle}>
          Stream Anything, Instantly. No Login. No Ads.
        </div>
      </div>

      <div className={styles.inputContainer}>
        <input
          className={styles.input}
          placeholder="Enter video URL"
          value={url}
          onChange={(e) => setUrl(e.target.value.trim())}
        />
        <button className={styles.playButton} onClick={playVideo}>
          Play Now
        </button>
        <button className={styles.appButton} onClick={openInApp}>
          Open in App
        </button>
      </div>

      <video
        ref={videoRef}
        controls
        playsInline
        preload="metadata"
        style={{
          width: "min(980px, 100%)",
          borderRadius: 16,
          marginTop: 12,
          display: url ? "block" : "none",
          background: "rgba(0,0,0,.35)",
          border: "1px solid rgba(255,255,255,.14)",
        }}
      />

      <div className={styles.features}>
        <div className={styles.feature}>
          <div className={styles.featureIcon}>🔒</div>
          <div className={styles.featureText}>No Need to Login or Sign Up</div>
        </div>
        <div className={styles.feature}>
          <div className={styles.featureIcon}>✖️</div>
          <div className={styles.featureText}>Completely Ad-Free Streaming</div>
        </div>
        <div className={styles.feature}>
          <div className={styles.featureIcon}>▶️ 8K</div>
          <div className={styles.featureText}>Up to 8K Ultra HD Video Quality</div>
        </div>
        <div className={styles.feature}>
          <div className={styles.featureIcon}>🎚️</div>
          <div className={styles.featureText}>Multiple Audio Tracks Support</div>
        </div>
        <div className={styles.feature}>
          <div className={styles.featureIcon}>🎧</div>
          <div className={styles.featureText}>Dolby Atmos High-Quality Audio</div>
        </div>
      </div>
    </div>
  );
}
