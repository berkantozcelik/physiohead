/**
 * PhysioHead - Leadership Static World Map Mode
 * Theme-fitting static vector map pinpointing all 47 members across 22 countries.
 * Zero external tile dependencies, 100% offline & fast.
 */
document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('map-mode-toggle-btn');
  const gridLabel = document.getElementById('label-grid-mode');
  const mapLabel = document.getElementById('label-map-mode');
  const mapSection = document.getElementById('leadership-map-section');
  const gridView = document.getElementById('leadership-grid-view');
  const pinsContainer = document.getElementById('static-map-pins');

  if (!mapSection || !gridView) return;

  // Real city coordinates (latitude / longitude). Pins are placed by projecting
  // these onto assets/img/world-map.svg (Simplemaps, Robinson projection, 2000x857).
  // To add a city, add its lat/lon here; no hand-tuned percentages needed.
  const CITY_LOCATIONS = {
    'Milano, Italy': { lat: 45.464, lon: 9.19, city: 'Milan', country: 'Italy' },
    'Milan, Italy': { lat: 45.464, lon: 9.19, city: 'Milan', country: 'Italy' },
    'Rome, Italy': { lat: 41.903, lon: 12.496, city: 'Rome', country: 'Italy' },
    'Parma, Italy': { lat: 44.801, lon: 10.328, city: 'Parma', country: 'Italy' },
    'Mersin, Türkiye': { lat: 36.812, lon: 34.641, city: 'Mersin', country: 'Türkiye' },
    'Yozgat, Türkiye': { lat: 39.82, lon: 34.808, city: 'Yozgat', country: 'Türkiye' },
    'Istanbul, Türkiye': { lat: 41.008, lon: 28.978, city: 'Istanbul', country: 'Türkiye' },
    'Cairo, Egypt': { lat: 30.044, lon: 31.236, city: 'Cairo', country: 'Egypt' },
    'Beni-Suef, Egypt': { lat: 29.074, lon: 31.097, city: 'Beni-Suef', country: 'Egypt' },
    'London, UK': { lat: 51.507, lon: -0.128, city: 'London', country: 'United Kingdom' },
    'Sao Paulo, Brazil': { lat: -23.55, lon: -46.633, city: 'São Paulo', country: 'Brazil' },
    'São Paulo, Brazil': { lat: -23.55, lon: -46.633, city: 'São Paulo', country: 'Brazil' },
    'Recife, Brazil': { lat: -8.048, lon: -34.877, city: 'Recife', country: 'Brazil' },
    'New York, NY, USA': { lat: 40.713, lon: -74.006, city: 'New York', country: 'USA' },
    'Bronx, NY, USA': { lat: 40.845, lon: -73.865, city: 'New York (Bronx)', country: 'USA' },
    'Boston, MA, USA': { lat: 42.36, lon: -71.059, city: 'Boston', country: 'USA' },
    'Winston Salem, NC, USA': { lat: 36.1, lon: -80.244, city: 'Winston-Salem', country: 'USA' },
    'Miami, FL, USA': { lat: 25.762, lon: -80.192, city: 'Miami', country: 'USA' },
    'Brussels, Belgium': { lat: 50.85, lon: 4.352, city: 'Brussels', country: 'Belgium' },
    'Sydney, Australia': { lat: -33.869, lon: 151.209, city: 'Sydney', country: 'Australia' },
    'Melbourne, Australia': { lat: -37.814, lon: 144.963, city: 'Melbourne', country: 'Australia' },
    'Taipei, Taiwan': { lat: 25.033, lon: 121.565, city: 'Taipei', country: 'Taiwan' },
    'Tehran, Iran': { lat: 35.689, lon: 51.389, city: 'Tehran', country: 'Iran' },
    'Tabriz, Iran': { lat: 38.08, lon: 46.292, city: 'Tabriz', country: 'Iran' },
    'Mexico City, Mexico': { lat: 19.433, lon: -99.133, city: 'Mexico City', country: 'Mexico' },
    'Copenhagen, Denmark': { lat: 55.676, lon: 12.568, city: 'Copenhagen', country: 'Denmark' },
    'Athens, Greece': { lat: 37.984, lon: 23.728, city: 'Athens', country: 'Greece' },
    'Seoul, South Korea': { lat: 37.567, lon: 126.978, city: 'Seoul', country: 'South Korea' },
    'Marrakech, Morocco': { lat: 31.629, lon: -7.981, city: 'Marrakech', country: 'Morocco' },
    'Ulaanbaatar, Mongolia': { lat: 47.886, lon: 106.906, city: 'Ulaanbaatar', country: 'Mongolia' },
    'Dar es Salaam, Tanzania': { lat: -6.792, lon: 39.208, city: 'Dar es Salaam', country: 'Tanzania' },
    'Kathmandu, Nepal': { lat: 27.717, lon: 85.324, city: 'Kathmandu', country: 'Nepal' },
    'Baku, Azerbaijan': { lat: 40.409, lon: 49.867, city: 'Baku', country: 'Azerbaijan' },
    'Tokyo, Japan': { lat: 35.676, lon: 139.65, city: 'Tokyo', country: 'Japan' },
    'Berlin, Germany': { lat: 52.52, lon: 13.405, city: 'Berlin', country: 'Germany' },
    'Uppsala, Sweden': { lat: 59.858, lon: 17.639, city: 'Uppsala', country: 'Sweden' },
  };

  // Robinson projection lookup table: [latitude, X length factor, Y distance factor]
  const ROBINSON = [
    [0, 1.0, 0.0], [5, 0.9986, 0.062], [10, 0.9954, 0.124], [15, 0.99, 0.186],
    [20, 0.9822, 0.248], [25, 0.973, 0.31], [30, 0.96, 0.372], [35, 0.9427, 0.434],
    [40, 0.9216, 0.4958], [45, 0.8962, 0.5571], [50, 0.8679, 0.6176], [55, 0.835, 0.6769],
    [60, 0.7986, 0.7346], [65, 0.7597, 0.7903], [70, 0.7186, 0.8435], [75, 0.6732, 0.8936],
    [80, 0.6213, 0.9394], [85, 0.5722, 0.9761], [90, 0.5322, 1.0],
  ];

  // Calibration of the SVG artwork (fitted against country outlines in world-map.svg)
  const MAP_W = 2000;
  const MAP_H = 857;
  const MAP_X0 = 987.69; // x of longitude 0
  const MAP_KX = 5.6354; // px per degree of longitude at the equator
  const MAP_Y0 = 501.07; // y of the equator
  const MAP_KY = 515.4; // px per unit of Robinson Y

  function projectToPercent(lat, lon) {
    const a = Math.min(Math.abs(lat), 89.999);
    const i = Math.floor(a / 5);
    const t = (a - i * 5) / 5;
    const X = ROBINSON[i][1] + (ROBINSON[i + 1][1] - ROBINSON[i][1]) * t;
    const Y = (ROBINSON[i][2] + (ROBINSON[i + 1][2] - ROBINSON[i][2]) * t) * Math.sign(lat);
    return {
      x: ((MAP_X0 + MAP_KX * lon * X) / MAP_W) * 100,
      y: ((MAP_Y0 - MAP_KY * Y) / MAP_H) * 100,
    };
  }

  // Parse all members from the existing DOM cards to keep single source of truth
  const cardElements = Array.from(document.querySelectorAll('.person-card'));
  const members = [];
  const cityGroups = {};

  cardElements.forEach((card, index) => {
    const photoEl = card.querySelector('.person-photo img');
    const fallbackEl = card.querySelector('.person-photo.is-fallback span');
    const nameEl = card.querySelector('h4');
    const roleEl = card.querySelector('.person-role');
    const affEl = card.querySelector('.person-affiliation');

    const name = nameEl ? nameEl.textContent.trim() : `Member ${index + 1}`;
    const role = roleEl ? roleEl.textContent.trim() : '';
    const affiliation = affEl ? affEl.textContent.trim() : '';
    const photo = photoEl ? photoEl.getAttribute('src') : '';
    const fallback = fallbackEl ? fallbackEl.textContent.trim() : (name.split(' ').map(n => n[0]).slice(0, 2).join(''));

    // Use the city that appears first in the affiliation text (the primary affiliation)
    let locMeta = null;
    let firstIndex = Infinity;
    for (const [key, val] of Object.entries(CITY_LOCATIONS)) {
      const at = affiliation.indexOf(key);
      if (at !== -1 && at < firstIndex) {
        firstIndex = at;
        locMeta = val;
      }
    }

    if (!locMeta) {
      if (affiliation.includes('Albert Einstein College of Medicine')) {
        locMeta = CITY_LOCATIONS['Bronx, NY, USA'];
      } else if (affiliation.includes('Baku')) {
        locMeta = CITY_LOCATIONS['Baku, Azerbaijan'];
      } else {
        locMeta = null;
      }
    }

    if (!locMeta) {
      console.warn(`[map] No city found in affiliation for ${name}; not shown on map.`);
      return;
    }

    const projected = projectToPercent(locMeta.lat, locMeta.lon);

    const cityKey = `${locMeta.city}, ${locMeta.country}`;
    if (!cityGroups[cityKey]) {
      cityGroups[cityKey] = [];
    }

    const memberData = {
      id: index + 1,
      name,
      role,
      affiliation,
      photo,
      fallback,
      city: locMeta.city,
      country: locMeta.country,
      baseX: projected.x,
      baseY: projected.y,
      cityKey
    };

    cityGroups[cityKey].push(memberData);
    members.push(memberData);
  });

  // Calculate separated coordinates for cities with multiple members
  // Members at the same or neighbouring cities (e.g. Milan + Parma, New York + Bronx)
  // share one cluster: the cluster keeps the true map position and its pins fan out
  // around it by a fixed pixel distance, so they never stack on top of each other.
  const clusters = [];
  members.forEach((m) => {
    let cluster = clusters.find((c) => Math.abs(c.x - m.baseX) < 0.8 && Math.abs(c.y - m.baseY) < 1.6);
    if (!cluster) {
      cluster = { x: m.baseX, y: m.baseY, items: [] };
      clusters.push(cluster);
    }
    cluster.items.push(m);
  });

  const PIN_SPACING = 34; // px between neighbouring pins in a cluster
  clusters.forEach((cluster) => {
    const count = cluster.items.length;
    const sumX = cluster.items.reduce((acc, m) => acc + m.baseX, 0);
    const sumY = cluster.items.reduce((acc, m) => acc + m.baseY, 0);
    cluster.x = sumX / count;
    cluster.y = sumY / count;
    const radius = count === 1 ? 0 : Math.max(PIN_SPACING / 2, (PIN_SPACING * count) / (2 * Math.PI));
    const start = count === 2 ? Math.PI : -Math.PI / 2;
    cluster.items.forEach((m, idx) => {
      const angle = start + (2 * Math.PI * idx) / count;
      m.pinX = cluster.x;
      m.pinY = cluster.y;
      m.offX = Math.round(radius * Math.cos(angle));
      m.offY = Math.round(radius * Math.sin(angle));
      m.clusterSize = count;
    });
  });

  // Populate Country Filter Dropdown
  const countrySelect = document.getElementById('map-country-filter');
  if (countrySelect) {
    const countryCounts = {};
    members.forEach((m) => {
      countryCounts[m.country] = (countryCounts[m.country] || 0) + 1;
    });
    const sortedCountries = Object.keys(countryCounts).sort();
    countrySelect.innerHTML = `<option value="all">All Countries (${sortedCountries.length})</option>` +
      sortedCountries.map((c) => `<option value="${c}">${c} (${countryCounts[c]})</option>`).join('');
  }

  // Render static pins
  let isPinsRendered = false;
  const pinElements = new Map();

  function renderMapPins() {
    if (isPinsRendered || !pinsContainer) return;
    pinsContainer.innerHTML = '';

    // Mark the true location of clustered pins with a small dot
    clusters.forEach((cluster) => {
      if (cluster.items.length < 2) return;
      const dot = document.createElement('span');
      dot.className = 'static-map-cluster-dot';
      dot.setAttribute('aria-hidden', 'true');
      dot.style.cssText = `position: absolute; left: ${cluster.x}%; top: ${cluster.y}%; width: 8px; height: 8px; margin: -4px 0 0 -4px; border-radius: 50%; background: #0d9488; box-shadow: 0 0 0 3px rgba(13, 148, 136, 0.25); pointer-events: none; z-index: 5;`;
      pinsContainer.appendChild(dot);
    });

    members.forEach((member) => {
      const pin = document.createElement('div');
      pin.className = 'static-map-pin';
      pin.style.cssText = `position: absolute; left: calc(${member.pinX}% + ${member.offX}px); top: calc(${member.pinY}% + ${member.offY}px); width: 32px; height: 38px; transform: translate(-50%, -100%); cursor: pointer; z-index: 10; outline: none;`;
      pin.setAttribute('data-id', member.id);
      pin.setAttribute('tabindex', '0');
      pin.setAttribute('role', 'button');
      pin.setAttribute('aria-label', `${member.name}, ${member.city}, ${member.country}`);

      pin.innerHTML = `
        <div class="pin-avatar-badge" style="width: 32px; height: 32px; border-radius: 50%; border: 2px solid #0d9488; background: #ffffff; overflow: hidden; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(11, 61, 145, 0.28); box-sizing: border-box;">
          ${
            member.photo
              ? `<img src="${member.photo}" alt="${member.name}" class="pin-avatar-img" style="width: 32px; height: 32px; max-width: 32px; max-height: 32px; object-fit: cover; display: block; border-radius: 50%;" loading="lazy" />`
              : `<span class="pin-avatar-fallback" style="font-size: 0.72rem; font-weight: 700; color: #0d9488;">${member.fallback || 'PH'}</span>`
          }
        </div>
        <div class="pin-stem" style="width: 0; height: 0; border-left: 4px solid transparent; border-right: 4px solid transparent; border-top: 6px solid #0d9488; margin: 0 auto;"></div>
        <div class="pin-dot" style="width: 6px; height: 6px; background: #0d9488; border-radius: 50%; margin: -2px auto 0;"></div>
        <div class="pin-tooltip">
          <div class="pin-tooltip-location">📍 ${member.city}, ${member.country}</div>
          <div class="pin-tooltip-name">${member.name}</div>
          <div class="pin-tooltip-role">${member.role}</div>
        </div>
      `;

      pin.addEventListener('click', () => {
        if (mapZoom.wasDrag()) return;
        highlightPin(pin);
        showMemberInDrawer(member);
      });

      pin.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          highlightPin(pin);
          showMemberInDrawer(member);
        }
      });

      pinsContainer.appendChild(pin);
      pinElements.set(member.id, pin);
    });

    isPinsRendered = true;
  }

  function highlightPin(activePin) {
    pinElements.forEach((pin) => {
      pin.classList.remove('is-active-pin');
    });
    if (activePin) {
      activePin.classList.add('is-active-pin');
    }
  }

  function showMemberInDrawer(member) {
    const drawer = document.getElementById('map-member-drawer');
    if (!drawer) return;

    drawer.innerHTML = `
      <div class="drawer-card">
        <div class="drawer-photo">
          ${
            member.photo
              ? `<img src="${member.photo}" alt="${member.name}" />`
              : `<span>${member.fallback || 'PH'}</span>`
          }
        </div>
        <div class="drawer-info">
          <div class="drawer-location-badge">📍 ${member.city}, ${member.country}</div>
          <h3>${member.name}</h3>
          <p class="drawer-role">${member.role}</p>
          <p class="drawer-aff">${member.affiliation}</p>
        </div>
        <button class="drawer-close" type="button" aria-label="Close" onclick="document.getElementById('map-member-drawer').innerHTML=''">&times;</button>
      </div>
    `;
    drawer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // Filter & Search handlers
  function applyFilters() {
    const countryValue = countrySelect ? countrySelect.value : 'all';
    const searchInput = document.getElementById('map-search-input');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const matchingMembers = [];

    members.forEach((m) => {
      const pin = pinElements.get(m.id);
      if (!pin) return;

      const matchesCountry = countryValue === 'all' || m.country === countryValue;
      const matchesQuery = !query ||
        m.name.toLowerCase().includes(query) ||
        m.city.toLowerCase().includes(query) ||
        m.country.toLowerCase().includes(query) ||
        m.role.toLowerCase().includes(query) ||
        m.affiliation.toLowerCase().includes(query);

      if (matchesCountry && matchesQuery) {
        pin.classList.remove('is-dimmed');
        pin.classList.add('is-matched');
        matchingMembers.push(m);
      } else {
        pin.classList.add('is-dimmed');
        pin.classList.remove('is-matched');
      }
    });

    // Zoom to the chosen country (or to search results), back out for "all"
    if (countryValue !== 'all' || query) {
      if (matchingMembers.length) {
        mapZoom.focusOn(matchingMembers.map((m) => ({ x: m.pinX, y: m.pinY })));
      }
    } else {
      mapZoom.fit();
    }

    // If single match found, open its drawer profile
    if (matchingMembers.length === 1) {
      const singlePin = pinElements.get(matchingMembers[0].id);
      highlightPin(singlePin);
      showMemberInDrawer(matchingMembers[0]);
    }
  }

  if (countrySelect) {
    countrySelect.addEventListener('change', applyFilters);
  }

  const searchInput = document.getElementById('map-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
  }

  const resetBtn = document.getElementById('map-reset-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (countrySelect) countrySelect.value = 'all';
      if (searchInput) searchInput.value = '';
      applyFilters();
      mapZoom.fit();
      highlightPin(null);
      const drawer = document.getElementById('map-member-drawer');
      if (drawer) drawer.innerHTML = '';
    });
  }

  // ---------------------------------------------------------------------------
  // Zoom & pan. The stage is resized (not CSS-scaled), so pins keep their size
  // and spread apart as you zoom in.
  // ---------------------------------------------------------------------------
  const mapZoom = (() => {
    const wrap = document.getElementById('static-world-map-wrap');
    const stage = document.getElementById('static-world-map-stage');
    const zoomInBtn = document.getElementById('map-zoom-in');
    const zoomOutBtn = document.getElementById('map-zoom-out');
    const fitBtn = document.getElementById('map-zoom-fit');
    if (!wrap || !stage) return { show() {}, fit() {}, focusOn() {}, wasDrag: () => false };

    const RATIO = MAP_H / MAP_W;
    const MIN_VIEW_HEIGHT = 360; // px: phones keep a usable map height
    const MAX_ZOOM = 8;
    let zoom = 1;
    let minZoom = 1;
    let baseWidth = 0;
    let ready = false;

    wrap.classList.add('is-zoomable');

    function measure() {
      baseWidth = wrap.clientWidth;
      const viewHeight = Math.max(Math.round(baseWidth * RATIO), MIN_VIEW_HEIGHT);
      wrap.style.height = `${viewHeight}px`;
      minZoom = Math.max(1, viewHeight / (baseWidth * RATIO));
    }

    function updateButtons() {
      if (zoomInBtn) zoomInBtn.disabled = zoom >= MAX_ZOOM - 0.001;
      if (zoomOutBtn) zoomOutBtn.disabled = zoom <= minZoom + 0.001;
      if (fitBtn) fitBtn.disabled = zoom <= minZoom + 0.001;
    }

    // Set zoom keeping the map point under (cx, cy) - wrap-relative px - fixed
    function setZoom(next, cx = wrap.clientWidth / 2, cy = wrap.clientHeight / 2) {
      const prevW = stage.offsetWidth || baseWidth * zoom;
      const prevH = stage.offsetHeight || prevW * RATIO;
      const fx = (wrap.scrollLeft + cx) / prevW;
      const fy = (wrap.scrollTop + cy) / prevH;
      zoom = Math.min(MAX_ZOOM, Math.max(minZoom, next));
      const w = baseWidth * zoom;
      const h = w * RATIO;
      stage.style.width = `${w}px`;
      stage.style.height = `${h}px`;
      wrap.scrollLeft = fx * w - cx;
      wrap.scrollTop = fy * h - cy;
      updateButtons();
    }

    // Center the view on a map point given in stage percentages
    function centerOn(xPct, yPct) {
      wrap.scrollLeft = (xPct / 100) * stage.offsetWidth - wrap.clientWidth / 2;
      wrap.scrollTop = (yPct / 100) * stage.offsetHeight - wrap.clientHeight / 2;
    }

    function fit() {
      setZoom(minZoom);
      centerOn(50, 45);
    }

    // Zoom so a set of pins (percent coordinates) fills the view
    function focusOn(points) {
      if (!points.length) return;
      const xs = points.map((p) => p.x);
      const ys = points.map((p) => p.y);
      const minX = Math.min(...xs), maxX = Math.max(...xs);
      const minY = Math.min(...ys), maxY = Math.max(...ys);
      const pad = 90; // px around the pins (room for photos and clusters)
      const spanX = Math.max(maxX - minX, 0.5) / 100;
      const spanY = Math.max(maxY - minY, 0.5) / 100;
      const zx = (wrap.clientWidth - 2 * pad) / (spanX * baseWidth);
      const zy = (wrap.clientHeight - 2 * pad) / (spanY * baseWidth * RATIO);
      setZoom(Math.min(zx, zy, 5));
      centerOn((minX + maxX) / 2, (minY + maxY) / 2 - 1.5);
    }

    function show() {
      const keep = ready ? zoom / minZoom : null;
      measure();
      if (!ready) {
        ready = true;
        // Phones start zoomed so pins are readable; wide screens show the whole world
        setZoom(Math.max(minZoom, 860 / baseWidth));
        centerOn(50, 45);
      } else {
        setZoom(minZoom * keep);
      }
    }

    function wrapPoint(clientX, clientY) {
      const r = wrap.getBoundingClientRect();
      return [clientX - r.left, clientY - r.top];
    }

    if (zoomInBtn) zoomInBtn.addEventListener('click', () => setZoom(zoom * 1.6));
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => setZoom(zoom / 1.6));
    if (fitBtn) fitBtn.addEventListener('click', fit);

    // Trackpad pinch (reported as ctrl + wheel) and Ctrl/Cmd + mouse wheel.
    // A plain wheel keeps scrolling the page.
    wrap.addEventListener('wheel', (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const [cx, cy] = wrapPoint(e.clientX, e.clientY);
      setZoom(zoom * Math.exp(-e.deltaY * 0.01), cx, cy);
    }, { passive: false });

    wrap.addEventListener('dblclick', (e) => {
      if (e.target.closest('.static-map-pin')) return;
      const [cx, cy] = wrapPoint(e.clientX, e.clientY);
      setZoom(zoom * 2, cx, cy);
    });

    // Mouse drag to pan (touch uses native scrolling)
    let drag = null;
    let dragMoved = false;
    wrap.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, left: wrap.scrollLeft, top: wrap.scrollTop };
      dragMoved = false;
    });
    window.addEventListener('pointermove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (!dragMoved && Math.hypot(dx, dy) > 4) {
        dragMoved = true;
        wrap.classList.add('is-dragging');
      }
      if (dragMoved) {
        wrap.scrollLeft = drag.left - dx;
        wrap.scrollTop = drag.top - dy;
      }
    });
    window.addEventListener('pointerup', () => {
      drag = null;
      wrap.classList.remove('is-dragging');
    });

    // Two-finger pinch on touch screens
    let pinch = null;
    const touchDist = (t) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    wrap.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        pinch = { dist: touchDist(e.touches), zoom };
      }
    }, { passive: true });
    wrap.addEventListener('touchmove', (e) => {
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const [cx, cy] = wrapPoint(
        (e.touches[0].clientX + e.touches[1].clientX) / 2,
        (e.touches[0].clientY + e.touches[1].clientY) / 2
      );
      setZoom(pinch.zoom * (touchDist(e.touches) / pinch.dist), cx, cy);
    }, { passive: false });
    wrap.addEventListener('touchend', (e) => {
      if (e.touches.length < 2) pinch = null;
    });

    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (ready && mapSection.style.display !== 'none') show();
      }, 120);
    });

    return { show, fit, focusOn, wasDrag: () => dragMoved };
  })();

  // TRUE TOGGLE BUTTON LOGIC (Pure Button, NO Checkbox)
  let isMapMode = false;

  function setViewMode(toMaps) {
    isMapMode = toMaps;

    if (toggleBtn) {
      toggleBtn.classList.toggle('is-active', isMapMode);
      toggleBtn.setAttribute('aria-checked', String(isMapMode));
    }

    if (gridLabel) {
      gridLabel.classList.toggle('is-active', !isMapMode);
    }
    if (mapLabel) {
      mapLabel.classList.toggle('is-active', isMapMode);
    }

    if (isMapMode) {
      mapSection.style.display = 'block';
      gridView.style.display = 'none';
      renderMapPins();
      mapZoom.show();
    } else {
      mapSection.style.display = 'none';
      gridView.style.display = 'block';
    }
  }

  // Bind sliding toggle button click
  if (toggleBtn) {
    toggleBtn.addEventListener('click', (e) => {
      e.preventDefault();
      setViewMode(!isMapMode);
    });
  }

  // Bind clicking on labels
  if (gridLabel) {
    gridLabel.addEventListener('click', () => setViewMode(false));
    gridLabel.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setViewMode(false);
      }
    });
  }

  if (mapLabel) {
    mapLabel.addEventListener('click', () => setViewMode(true));
    mapLabel.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setViewMode(true);
      }
    });
  }
});
