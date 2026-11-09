/**
 * PhysioHead - Activities hub
 * Tabs (Webinars / Meetings / Educational materials) with deep links
 * (activities.html#webinars, #meetings, #educational-materials) and an
 * in-page YouTube player for webinar cards.
 */
document.addEventListener('DOMContentLoaded', () => {
  const tabs = Array.from(document.querySelectorAll('.hub-tab'));
  if (tabs.length) {
    const select = (tab, { focus = false, updateHash = true } = {}) => {
      tabs.forEach((t) => {
        const active = t === tab;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', String(active));
        t.tabIndex = active ? 0 : -1;
        const panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !active;
      });
      if (focus) tab.focus();
      if (updateHash && tab.dataset.hash) {
        history.replaceState(null, '', `#${tab.dataset.hash}`);
      }
    };

    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => select(tab));
      tab.addEventListener('keydown', (e) => {
        const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
        if (e.key in keys) {
          e.preventDefault();
          select(tabs[(i + keys[e.key] + tabs.length) % tabs.length], { focus: true });
        } else if (e.key === 'Home') {
          e.preventDefault();
          select(tabs[0], { focus: true });
        } else if (e.key === 'End') {
          e.preventDefault();
          select(tabs[tabs.length - 1], { focus: true });
        }
      });
    });

    const fromHash = () => {
      const hash = decodeURIComponent(location.hash.replace('#', ''));
      const tab = tabs.find((t) => t.dataset.hash === hash);
      if (tab) {
        select(tab, { updateHash: false });
        document.getElementById('activity-library')?.scrollIntoView({ block: 'start' });
      }
    };
    fromHash();
    window.addEventListener('hashchange', fromHash);
  }

  // In-page video player
  const dialog = document.getElementById('video-dialog');
  if (!dialog) return;
  const frame = dialog.querySelector('.video-frame');
  const titleEl = dialog.querySelector('#video-dialog-title');
  const linkEl = dialog.querySelector('.video-dialog-link');
  const closeBtn = dialog.querySelector('.video-dialog-close');

  const closePlayer = () => {
    if (dialog.open) dialog.close();
  };

  // Remove the iframe on close so the video stops playing
  dialog.addEventListener('close', () => {
    frame.innerHTML = '';
    document.body.classList.remove('has-video-open');
  });

  closeBtn.addEventListener('click', closePlayer);

  // Click on the dark backdrop closes the player
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) closePlayer();
  });

  document.querySelectorAll('[data-video-id]').forEach((card) => {
    card.addEventListener('click', () => {
      const id = card.dataset.videoId;
      const title = card.dataset.videoTitle || 'Webinar';
      titleEl.textContent = title;
      linkEl.href = `https://www.youtube.com/watch?v=${encodeURIComponent(id)}`;

      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&modestbranding=1`;
      iframe.title = title;
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      iframe.allowFullscreen = true;
      frame.innerHTML = '';
      frame.appendChild(iframe);

      document.body.classList.add('has-video-open');
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    });
  });
});
