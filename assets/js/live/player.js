/**
 * PhysioHead Live - video player.
 * Today the broadcast arrives through an unlisted YouTube stream. If the SIG
 * later moves to another relay, add a provider here; nothing else changes.
 */
const providers = {
  youtube({ videoId, title, autoplay }) {
    const iframe = document.createElement('iframe');
    // Browsers only allow a video to start by itself when it is muted.
    const start = autoplay ? '&autoplay=1&mute=1' : '';
    const origin = encodeURIComponent(window.location.origin);
    iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?rel=0&modestbranding=1&playsinline=1&enablejsapi=1&origin=${origin}${start}`;
    if (autoplay) {
      // Ask the player to start again once it has loaded, in case the first
      // automatic start was skipped. Muted playback is always allowed.
      iframe.addEventListener('load', () => {
        const send = (func, args = []) => iframe.contentWindow?.postMessage(
          JSON.stringify({ event: 'command', func, args }), 'https://www.youtube-nocookie.com');
        [600, 1800].forEach((delay) => setTimeout(() => { send('mute'); send('playVideo'); }, delay));
      });
    }
    iframe.title = title || 'PhysioHead webinar';
    iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
    iframe.referrerPolicy = 'strict-origin-when-cross-origin';
    iframe.allowFullscreen = true;
    return iframe;
  },
};

export function mountPlayer(container, { provider = 'youtube', videoId, title, autoplay = false } = {}) {
  const build = providers[provider];
  if (!build || !videoId) return { destroy() {} };
  const node = build({ videoId, title, autoplay });
  container.replaceChildren(node);
  return { destroy() { node.remove(); } };
}
