import { useEffect, useRef } from 'react';

/**
 * RemoteDisplay renders the video stream received from the Host
 * during GB/GBC dual‑emulation mode. The Client sees their Game Boy
 * screen streamed from the Host's tgbdual instance.
 */
export function RemoteDisplay({ remoteStream, connectionLabel }) {
  const videoRef = useRef(null);

  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
    }

    return () => {
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [remoteStream]);

  if (!remoteStream) {
    return null;
  }

  return (
    <div className="remote-display-wrapper">
      <div className="remote-display-header">
        <span className="eyebrow">Remote Player View</span>
        {connectionLabel ? (
          <span className="remote-display-label">{connectionLabel}</span>
        ) : null}
      </div>
      <div className="remote-screen-shell">
        <video
          ref={videoRef}
          className="remote-video"
          autoPlay
          playsInline
          muted
        />
      </div>
    </div>
  );
}
