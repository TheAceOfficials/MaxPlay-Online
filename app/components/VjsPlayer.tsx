"use client";
import { useEffect, useRef } from "react";
import videojs from "video.js";
import "video.js/dist/video-js.css";

type Props = { src: string };

export default function VjsPlayer({ src }: Props) {
  const elRef = useRef<HTMLVideoElement | null>(null);
  const playerRef = useRef<videojs.Player | null>(null);

  useEffect(() => {
    if (!elRef.current) return;

    if (!playerRef.current) {
      playerRef.current = videojs(elRef.current, {
        controls: true,
        fluid: true,
        preload: "auto",
        playbackRates: [0.5, 1, 1.25, 1.5, 2],
        controlBar: {
          pictureInPictureToggle: true,
          volumePanel: { inline: false },
          fullscreenToggle: true,
        },
        sources: [
          {
            src,
            type: src.endsWith(".m3u8")
              ? "application/x-mpegURL"
              : "video/mp4",
          },
        ],
      });
    } else {
      playerRef.current.src({
        src,
        type: src.endsWith(".m3u8")
          ? "application/x-mpegURL"
          : "video/mp4",
      });
    }

    return () => {
      if (playerRef.current) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [src]);

  return (
    <div data-vjs-player>
      <video ref={elRef} className="video-js vjs-default-skin" playsInline />
    </div>
  );
}
