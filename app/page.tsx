"use client";
import { useState } from "react";
import styles from "./page.module.css";
import VjsPlayer from "./components/VjsPlayer";

export default function HomePage() {
  const [url, setUrl] = useState("");
  const [lightTheme, setLightTheme] = useState(false);

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
        <button
          className={styles.playButton}
          onClick={() => url && setUrl((s) => s)} // trigger render
        >
          Play Now
        </button>
        <button className={styles.appButton} onClick={openInApp}>
          Open in App
        </button>
      </div>

      {url && (
        <div style={{ width: "min(980px, 100%)", marginTop: 12 }}>
          <VjsPlayer src={url} />
        </div>
      )}

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
