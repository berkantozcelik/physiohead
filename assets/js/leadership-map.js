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

  // Exact coordinates matching the vector world map projection (percentage 0-100)
  const CITY_COORDINATES = {
    'Milano, Italy': { baseX: 51.25, baseY: 23.92, city: 'Milan', country: 'Italy' },
    'Milan, Italy': { baseX: 51.25, baseY: 23.92, city: 'Milan', country: 'Italy' },
    'Rome, Italy': { baseX: 52.10, baseY: 26.37, city: 'Rome', country: 'Italy' },
    'Parma, Italy': { baseX: 51.50, baseY: 24.74, city: 'Parma', country: 'Italy' },
    'Mersin, Türkiye': { baseX: 58.60, baseY: 29.75, city: 'Mersin', country: 'Türkiye' },
    'Yozgat, Türkiye': { baseX: 58.25, baseY: 28.00, city: 'Yozgat', country: 'Türkiye' },
    'Istanbul, Türkiye': { baseX: 56.90, baseY: 26.60, city: 'Istanbul', country: 'Türkiye' },
    'Cairo, Egypt': { baseX: 57.50, baseY: 34.42, city: 'Cairo', country: 'Egypt' },
    'Beni-Suef, Egypt': { baseX: 57.50, baseY: 35.59, city: 'Beni-Suef', country: 'Egypt' },
    'London, UK': { baseX: 48.75, baseY: 19.60, city: 'London', country: 'United Kingdom' },
    'Sao Paulo, Brazil': { baseX: 36.75, baseY: 67.68, city: 'São Paulo', country: 'Brazil' },
    'São Paulo, Brazil': { baseX: 36.75, baseY: 67.68, city: 'São Paulo', country: 'Brazil' },
    'Recife, Brazil': { baseX: 39.75, baseY: 58.34, city: 'Recife', country: 'Brazil' },
    'New York, NY, USA': { baseX: 30.25, baseY: 27.42, city: 'New York', country: 'USA' },
    'Bronx, NY, USA': { baseX: 30.30, baseY: 27.19, city: 'New York (Bronx)', country: 'USA' },
    'Boston, MA, USA': { baseX: 30.90, baseY: 26.25, city: 'Boston', country: 'USA' },
    'Winston Salem, NC, USA': { baseX: 29.25, baseY: 30.11, city: 'Winston-Salem', country: 'USA' },
    'Miami, FL, USA': { baseX: 28.75, baseY: 36.76, city: 'Miami', country: 'USA' },
    'Brussels, Belgium': { baseX: 49.75, baseY: 20.07, city: 'Brussels', country: 'Belgium' },
    'Sydney, Australia': { baseX: 88.50, baseY: 74.68, city: 'Sydney', country: 'Australia' },
    'Melbourne, Australia': { baseX: 86.90, baseY: 77.60, city: 'Melbourne', country: 'Australia' },
    'Taipei, Taiwan': { baseX: 80.60, baseY: 38.27, city: 'Taipei', country: 'Taiwan' },
    'Tehran, Iran': { baseX: 62.75, baseY: 30.34, city: 'Tehran', country: 'Iran' },
    'Tabriz, Iran': { baseX: 61.75, baseY: 28.94, city: 'Tabriz', country: 'Iran' },
    'Mexico City, Mexico': { baseX: 24.00, baseY: 41.42, city: 'Mexico City', country: 'Mexico' },
    'Copenhagen, Denmark': { baseX: 51.75, baseY: 16.92, city: 'Copenhagen', country: 'Denmark' },
    'Athens, Greece': { baseX: 55.40, baseY: 29.40, city: 'Athens', country: 'Greece' },
    'Seoul, South Korea': { baseX: 82.10, baseY: 29.40, city: 'Seoul', country: 'South Korea' },
    'Marrakech, Morocco': { baseX: 46.75, baseY: 33.26, city: 'Marrakech', country: 'Morocco' },
    'Ulaanbaatar, Mongolia': { baseX: 76.75, baseY: 21.59, city: 'Ulaanbaatar', country: 'Mongolia' },
    'Dar es Salaam, Tanzania': { baseX: 59.75, baseY: 57.76, city: 'Dar es Salaam', country: 'Tanzania' },
    'Kathmandu, Nepal': { baseX: 71.25, baseY: 35.59, city: 'Kathmandu', country: 'Nepal' },
    'Baku, Azerbaijan': { baseX: 62.10, baseY: 27.54, city: 'Baku', country: 'Azerbaijan' },
    'Tokyo, Japan': { baseX: 85.60, baseY: 30.11, city: 'Tokyo', country: 'Japan' },
    'Berlin, Germany': { baseX: 52.25, baseY: 18.90, city: 'Berlin', country: 'Germany' },
    'Uppsala, Sweden': { baseX: 53.10, baseY: 14.24, city: 'Uppsala', country: 'Sweden' },
  };

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

    let locMeta = null;
    for (const [key, val] of Object.entries(CITY_COORDINATES)) {
      if (affiliation.includes(key)) {
        locMeta = val;
        break;
      }
    }

    if (!locMeta) {
      if (affiliation.includes('Albert Einstein College of Medicine')) {
        locMeta = CITY_COORDINATES['New York, NY, USA'];
      } else if (affiliation.includes('Baku')) {
        locMeta = CITY_COORDINATES['Baku, Azerbaijan'];
      } else {
        locMeta = { baseX: 50.0, baseY: 30.0, city: 'Global', country: 'International' };
      }
    }

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
      baseX: locMeta.baseX,
      baseY: locMeta.baseY,
      cityKey
    };

    cityGroups[cityKey].push(memberData);
    members.push(memberData);
  });

  // Calculate separated coordinates for cities with multiple members
  members.forEach((m) => {
    const group = cityGroups[m.cityKey];
    if (group.length === 1) {
      m.pinX = m.baseX;
      m.pinY = m.baseY;
    } else {
      const idx = group.indexOf(m);
      const count = group.length;
      const radiusX = 1.15; // horizontal offset %
      const radiusY = 2.10; // vertical offset %
      const angle = (2 * Math.PI / count) * idx - (Math.PI / 2);
      m.pinX = m.baseX + radiusX * Math.cos(angle);
      m.pinY = m.baseY + radiusY * Math.sin(angle);
    }
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

    members.forEach((member) => {
      const pin = document.createElement('div');
      pin.className = 'static-map-pin';
      pin.style.cssText = `position: absolute; left: ${member.pinX}%; top: ${member.pinY}%; width: 32px; height: 38px; transform: translate(-50%, -100%); cursor: pointer; z-index: 10; outline: none;`;
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
      highlightPin(null);
      const drawer = document.getElementById('map-member-drawer');
      if (drawer) drawer.innerHTML = '';
    });
  }

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
