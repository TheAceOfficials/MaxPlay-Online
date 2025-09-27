"use client";
import React, { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import styles from "./customPlayer.module.css";

/**
 * CustomPlayer.tsx
 * - HLS via hls.js
 * - Custom controls, quality, audio tracks, subtitles, scrubbing preview, double-tap, long-press, watermark, AirPlay
 *
 * Usage: <CustomPlayer />
 *
 * Notes: Provide m3u8 or mp4 url in input. For thumbnails, provide sprite/VTT externally (TODO).
 */

function isHls(url?: string) {
  if (!url) return false;
  return /\.m3u8(\?.*)?$/i.test(url);
}

export default function CustomPlayer() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const rafRef = useRef<number | null>(null);

  // UI state
  const [src, setSrc] = useState("");
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [current, setCurrent] = useState(0);
  const [bufferedEnd, setBufferedEnd] = useState(0);
  const [volume, setVolume] = useState<number>(() => {
    const v = typeof window !== "undefined" ? localStorage.getItem("mp_vol") : null;
    return v ? Number(v) : 1;
  });
  const [muted, setMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [availableLevels, setAvailableLevels] = useState<{height?: number, bitrate?: number, label: string, index: number}[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<number>(-1); // -1 = auto
  const [audioTracks, setAudioTracks] = useState<{id:number, name:string}[]>([]);
  const [selectedAudioTrack, setSelectedAudioTrack] = useState<number | null>(null);
  const [subTracks, setSubTracks] = useState<TextTrack[]>([]);
  const [activeSubIndex, setActiveSubIndex] = useState<number>(-1);
  const [playbackRate, setPlaybackRate] = useState<number>(() => {
    const v = typeof window !== "undefined" ? localStorage.getItem("mp_rate") : null;
    return v ? Number(v) : 1;
  });

  // scrubbing preview state
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [showControls, setShowControls] = useState(true);

  // touch long-press
  const longPressTimer = useRef<number | null>(null);

  // watermark
  const [watermarkText, setWatermarkText] = useState("MaxPlay");
  const [showWatermark, setShowWatermark] = useState(true);

  // helper to attach HLS source
  const attachSrc = (url: string) => {
    const v = videoRef.current!;
    // cleanup existing
    if (hlsRef.current) {
      try { hlsRef.current.destroy(); } catch {}
      hlsRef.current = null;
    }
    if (isHls(url) && !v.canPlayType("application/vnd.apple.mpegurl")) {
      if (Hls.isSupported()) {
        const hls = new Hls({ capLevelToPlayerSize: true, maxBufferLength: 60 });
        hlsRef.current = hls;
        hls.loadSource(url);
        hls.attachMedia(v);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          // populate levels
          const levels = hls.levels.map((lvl, i) => ({
            height: (lvl as any).height,
            bitrate: lvl.bitrate,
            label: (lvl as any).height ? `${(lvl as any).height}p` : `${Math.round(lvl.bitrate/1000)}kbps`,
            index: i
          }));
          setAvailableLevels(levels);
          setSelectedLevel(-1); // auto
          // audio tracks
          const aTracks = (hls.audioTracks || []).map((t, i) => ({ id: i, name: t.name || t.lang || `audio ${i}` }));
          setAudioTracks(aTracks);
          setSelectedAudioTrack(aTracks.length ? 0 : null);
          // listen to level switch events for selection feedback
          hls.on(Hls.Events.LEVEL_SWITCHED, () => {
            const level = hls.currentLevel;
            setSelectedLevel(level);
          });
        });
        hls.on(Hls.Events.ERROR, (_evt, data) => {
          console.warn("hls error", data);
        });
      } else {
        alert("HLS not supported in this browser.");
      }
    } else {
      // Native playback (mp4 etc)
      v.src = url;
      setAvailableLevels([]);
      setSelectedLevel(-1);
    }
  };

  // play / pause handling
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = volume;
    v.muted = muted;
    v.playbackRate = playbackRate;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => setCurrent(v.currentTime || 0);
    const onDur = () => setDuration(v.duration || 0);
    const onProgress = () => {
      try {
        const b = v.buffered;
        if (b && b.length) setBufferedEnd(b.end(b.length - 1));
      } catch {}
    };

    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("durationchange", onDur);
    v.addEventListener("progress", onProgress);

    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("durationchange", onDur);
      v.removeEventListener("progress", onProgress);
    };
  }, [volume, muted, playbackRate]);

  // persist volume and rate
  useEffect(() => {
    localStorage.setItem("mp_vol", String(volume));
  }, [volume]);
  useEffect(() => {
    localStorage.setItem("mp_rate", String(playbackRate));
    if (videoRef.current) videoRef.current.playbackRate = playbackRate;
  }, [playbackRate]);

  // keyboard shortcuts (space, left/right, up/down, f)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!videoRef.current) return;
      if (e.key === " " || e.code === "Space") {
        e.preventDefault();
        togglePlay();
      } else if (e.key === "ArrowRight") {
        seekBy(10);
      } else if (e.key === "ArrowLeft") {
        seekBy(-10);
      } else if (e.key === "f") {
        toggleFullscreen();
      } else if (e.key === "m") {
        toggleMute();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // helpers
  const togglePlay = async () => {
    if (!videoRef.current) return;
    if (videoRef.current.paused) {
      try { await videoRef.current.play(); } catch {}
    } else {
      videoRef.current.pause();
    }
  };
  const seekTo = (time: number) => {
    if (!videoRef.current || !isFinite(time)) return;
    videoRef.current.currentTime = Math.max(0, Math.min(time, videoRef.current.duration || 0));
  };
  const seekBy = (delta: number) => {
    if (!videoRef.current) return;
    seekTo((videoRef.current.currentTime || 0) + delta);
  };
  const toggleMute = () => {
    setMuted((m) => {
      const next = !m;
      if (videoRef.current) videoRef.current.muted = next;
      return next;
    });
  };
  const toggleFullscreen = async () => {
    const el = videoRef.current?.parentElement || document.documentElement;
    if (!el) return;
    try {
      if (!document.fullscreenElement) await el.requestFullscreen();
      else await document.exitFullscreen();
      setIsFullscreen(Boolean(document.fullscreenElement));
    } catch {}
  };

  // level (quality) change
  const setQuality = (levelIndex: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    if (levelIndex === -1) {
      hls.currentLevel = -1; // auto
      setSelectedLevel(-1);
    } else {
      hls.currentLevel = levelIndex;
      setSelectedLevel(levelIndex);
    }
  };

  // audio track change
  const setAudio = (index: number) => {
    const hls = hlsRef.current;
    if (hls) {
      hls.audioTrack = index;
      setSelectedAudioTrack(index);
    } else {
      // native: try textTracks / audioTracks - limited browser support
      setSelectedAudioTrack(index);
    }
  };

  // subtitle management: add external VTT or uploaded file
  const addSubtitleFromUrl = (label: string, url: string, lang = "en") => {
    const v = videoRef.current!;
    if (!v) return;
    const track = document.createElement("track");
    track.kind = "subtitles";
    track.label = label;
    track.srclang = lang;
    track.src = url;
    track.mode = "disabled";
    v.appendChild(track);
    // update list after it loads
    setTimeout(() => refreshSubTracks());
  };
  const addSubtitleFromFile = (file: File, label = file.name, lang = "en") => {
    const v = videoRef.current!;
    if (!v) return;
    const blobUrl = URL.createObjectURL(file);
    addSubtitleFromUrl(label, blobUrl, lang);
  };
  const refreshSubTracks = () => {
    const v = videoRef.current!;
    const tracks: TextTrack[] = [];
    for (let i = 0; i < v.textTracks.length; i++) {
      tracks.push(v.textTracks[i]);
    }
    setSubTracks(tracks);
  };
  const activateSub = (index: number) => {
    const v = videoRef.current!;
    for (let i = 0; i < v.textTracks.length; i++) {
      v.textTracks[i].mode = i === index ? "showing" : "disabled";
    }
    setActiveSubIndex(index);
  };
  const disableSubs = () => {
    const v = videoRef.current!;
    for (let i = 0; i < v.textTracks.length; i++) {
      v.textTracks[i].mode = "disabled";
    }
    setActiveSubIndex(-1);
  };

  // double-tap seek detection
  const lastTapRef = useRef<number>(0);
  const onVideoTap = (ev: React.MouseEvent) => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // double tap detected
      // choose left/right based on click position
      const rect = (ev.target as HTMLElement).getBoundingClientRect();
      const x = ev.clientX - rect.left;
      if (x < rect.width / 2) seekBy(-10);
      else seekBy(10);
    }
    lastTapRef.current = now;
  };

  // long-press detection for touch: long press sets playbackRate to 2 and resumes original on end
  const onTouchStart = () => {
    longPressTimer.current = window.setTimeout(() => {
      const v = videoRef.current!;
      if (v) {
        v.playbackRate = 2;
      }
    }, 450);
  };
  const onTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    // restore rate
    if (videoRef.current) videoRef.current.playbackRate = playbackRate;
  };

  // scrubbing preview (time tooltip). If you have thumbnails sprite mapping, map here.
  const onProgressBarMove = (clientX: number) => {
    const bar = document.getElementById("mp_progress_bar");
    if (!bar || !videoRef.current) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const time = (videoRef.current.duration || 0) * pct;
    setHoverTime(time);
    // TODO: show sprite image by mapping time -> vtt sprite frame
  };
  const onProgressBarLeave = () => setHoverTime(null);

  // AirPlay (Safari)
  const openAirPlayPicker = () => {
    const v = videoRef.current as any;
    if (v && typeof v.webkitShowPlaybackTargetPicker === "function") {
      try { v.webkitShowPlaybackTargetPicker(); } catch (e) { console.warn(e); }
    } else {
      alert("AirPlay not available on this browser. On Android use 'Open in App' or Chromecast integration.");
    }
  };

  // attach src on submit
  const onLoadUrl = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!src) return;
    attachSrc(src);
    // if native HLS on Safari, set src
    if (videoRef.current && isHls(src) && videoRef.current.canPlayType("application/vnd.apple.mpegurl")) {
      videoRef.current.src = src;
      videoRef.current.play().catch(() => {});
    } else {
      // for both HLS.js and mp4, try play after small delay
      setTimeout(() => videoRef.current?.play().catch(() => {}), 300);
    }
  };

  // update audio tracks list for native tracks (some browsers)
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const handler = () => {
      // refresh audio tracks if available (not standardized)
      // We check hlsRef (preferred) — otherwise fallback to textTracks
      refreshSubTracks();
    };
    v.addEventListener("loadedmetadata", handler);
    return () => v.removeEventListener("loadedmetadata", handler);
  }, []);

  // cleanup on unmount
  useEffect(() => {
    return () => {
      if (hlsRef.current) try { hlsRef.current.destroy(); } catch {}
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // UI helpers
  const formatTime = (s: number) => {
    if (!isFinite(s)) return "--:--";
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = Math.floor(s % 60);
    return h ? `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}` : `${m}:${String(sec).padStart(2,"0")}`;
  };

  return (
    <div className={styles.playerWrap}>
      <form className={styles.urlBar} onSubmit={onLoadUrl}>
        <input
          placeholder="Enter video URL (m3u8 / mp4 / dash...)"
          value={src}
          onChange={(e) => setSrc(e.target.value)}
          className={styles.urlInput}
        />
        <button className={styles.actionBtn} onClick={onLoadUrl} type="submit">Load</button>
        <button
          type="button"
          className={styles.actionBtn}
          onClick={openAirPlayPicker}
          title="AirPlay / Cast (AirPlay supported here)"
        >
          Cast
        </button>
      </form>

      <div
        className={styles.videoContainer}
        onMouseMove={() => setShowControls(true)}
      >
        <video
          ref={videoRef}
          className={styles.video}
          onClick={togglePlay}
          onMouseDown={onVideoTap as any}
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          controls={false}
          playsInline
        />

        {/* Watermark */}
        {showWatermark && (
          <div className={styles.watermark}>{watermarkText}</div>
        )}

        {/* Controls */}
        <div className={`${styles.controls} ${showControls ? styles.controlsVisible : ""}`}>
          <div className={styles.row}>
            <button onClick={togglePlay} className={styles.controlBtn}>
              {playing ? "❚❚" : "►"}
            </button>
            <div
              id="mp_progress_bar"
              className={styles.progressWrap}
              onMouseMove={(e) => onProgressBarMove(e.clientX)}
              onMouseLeave={onProgressBarLeave}
              onClick={(e) => {
                const bar = document.getElementById("mp_progress_bar");
                if (!bar || !videoRef.current) return;
                const rect = bar.getBoundingClientRect();
                const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                seekTo((videoRef.current.duration || 0) * pct);
              }}
            >
              <div
                className={styles.bufferBar}
                style={{ width: `${(bufferedEnd / (duration || 1)) * 100}%` }}
              />
              <div
                className={styles.playedBar}
                style={{ width: `${((current) / (duration || 1)) * 100}%` }}
              />
              {hoverTime !== null && (
                <div className={styles.scrubPreview}>
                  {/* If you provide sprite mapping, replace this with image */}
                  <div className={styles.previewTime}>{formatTime(hoverTime)}</div>
                </div>
              )}
            </div>

            <div className={styles.timeText}>{formatTime(current)} / {formatTime(duration)}</div>

            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={muted ? 0 : volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                if (videoRef.current) videoRef.current.volume = v;
                if (v === 0) setMuted(true); else setMuted(false);
              }}
              className={styles.volume}
            />
            <button className={styles.controlBtn} onClick={toggleMute}>{muted ? "🔈" : "🔊"}</button>

            <select
              value={playbackRate}
              onChange={(e) => setPlaybackRate(Number(e.target.value))}
              className={styles.select}
              title="Playback rate"
            >
              <option value={0.5}>0.5x</option>
              <option value={0.75}>0.75x</option>
              <option value={1}>1x</option>
              <option value={1.25}>1.25x</option>
              <option value={1.5}>1.5x</option>
              <option value={2}>2x</option>
            </select>

            <button className={styles.controlBtn} onClick={toggleFullscreen}>⤢</button>
          </div>

          <div className={styles.rowSub}>
            {/* Quality */}
            <label className={styles.label}>Quality</label>
            <select
              value={selectedLevel}
              onChange={(e) => setQuality(Number(e.target.value))}
              className={styles.selectSmall}
            >
              <option value={-1}>Auto</option>
              {availableLevels.map((l) => (
                <option key={l.index} value={l.index}>{l.label}</option>
              ))}
            </select>

            {/* Audio */}
            <label className={styles.label}>Audio</label>
            <select
              value={selectedAudioTrack ?? ""}
              onChange={(e) => setAudio(Number(e.target.value))}
              className={styles.selectSmall}
            >
              {audioTracks.length ? (
                audioTracks.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)
              ) : (
                <option value="">(single)</option>
              )}
            </select>

            {/* Subtitles */}
            <label className={styles.label}>Subtitles</label>
            <select
              value={activeSubIndex}
              onChange={(e) => {
                const idx = Number(e.target.value);
                if (isNaN(idx) || idx < 0) disableSubs();
                else activateSub(idx);
              }}
              className={styles.selectSmall}
            >
              <option value={-1}>Off</option>
              {subTracks.map((t, i) => <option key={i} value={i}>{t.label || t.language || `Track ${i+1}`}</option>)}
            </select>

            {/* Subtitle add (url/file) */}
            <input
              placeholder="Subtitle URL (vtt)"
              className={styles.subInput}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = (e.target as HTMLInputElement).value.trim();
                  if (val) addSubtitleFromUrl("ext", val);
                }
              }}
            />
            <input
              type="file"
              accept=".vtt"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) addSubtitleFromFile(f);
                e.currentTarget.value = "";
              }}
              className={styles.subFile}
            />

            {/* Watermark toggle */}
            <label className={styles.label}>Watermark</label>
            <input value={watermarkText} onChange={(e) => setWatermarkText(e.target.value)} className={styles.wmInput} />
            <button className={styles.smallBtn} onClick={() => setShowWatermark(!showWatermark)}>{showWatermark ? "Hide" : "Show"}</button>

            {/* Share/Open in app fallback */}
            <button className={styles.smallBtn} onClick={() => {
              if (navigator.share) {
                navigator.share({ title: "Open stream", url: src });
              } else {
                navigator.clipboard?.writeText(src || "");
                alert("Link copied");
              }
            }}>Share / Open</button>
          </div>
        </div>
      </div>
    </div>
  );
}
