/**
 * PhysioHead - Leadership World Map Mode
 * Pinpoints all 47 individuals and their institutions across the globe.
 */
document.addEventListener('DOMContentLoaded', () => {
  const toggleBtn = document.getElementById('toggle-map-btn');
  const mapSection = document.getElementById('leadership-map-section');
  const gridView = document.getElementById('leadership-grid-view');
  const mapContainer = document.getElementById('world-map');

  if (!toggleBtn || !mapSection || !mapContainer) return;

  const CITY_COORDINATES = {
    'Milano, Italy': { lat: 45.4642, lng: 9.1900, city: 'Milan', country: 'Italy' },
    'Milan, Italy': { lat: 45.4642, lng: 9.1900, city: 'Milan', country: 'Italy' },
    'Rome, Italy': { lat: 41.9028, lng: 12.4964, city: 'Rome', country: 'Italy' },
    'Parma, Italy': { lat: 44.8015, lng: 10.3279, city: 'Parma', country: 'Italy' },
    'Mersin, Türkiye': { lat: 36.8121, lng: 34.6415, city: 'Mersin', country: 'Türkiye' },
    'Yozgat, Türkiye': { lat: 39.8181, lng: 34.8147, city: 'Yozgat', country: 'Türkiye' },
    'Istanbul, Türkiye': { lat: 41.0082, lng: 28.9784, city: 'Istanbul', country: 'Türkiye' },
    'Cairo, Egypt': { lat: 30.0444, lng: 31.2357, city: 'Cairo', country: 'Egypt' },
    'Beni-Suef, Egypt': { lat: 29.0661, lng: 31.0994, city: 'Beni-Suef', country: 'Egypt' },
    'London, UK': { lat: 51.5074, lng: -0.1278, city: 'London', country: 'United Kingdom' },
    'Sao Paulo, Brazil': { lat: -23.5505, lng: -46.6333, city: 'São Paulo', country: 'Brazil' },
    'São Paulo, Brazil': { lat: -23.5505, lng: -46.6333, city: 'São Paulo', country: 'Brazil' },
    'Recife, Brazil': { lat: -8.0476, lng: -34.8770, city: 'Recife', country: 'Brazil' },
    'New York, NY, USA': { lat: 40.7128, lng: -74.0060, city: 'New York', country: 'USA' },
    'Bronx, NY, USA': { lat: 40.8448, lng: -73.8648, city: 'New York (Bronx)', country: 'USA' },
    'Boston, MA, USA': { lat: 42.3601, lng: -71.0589, city: 'Boston', country: 'USA' },
    'Winston Salem, NC, USA': { lat: 36.0999, lng: -80.2442, city: 'Winston-Salem', country: 'USA' },
    'Miami, FL, USA': { lat: 25.7617, lng: -80.1918, city: 'Miami', country: 'USA' },
    'Brussels, Belgium': { lat: 50.8503, lng: 4.3517, city: 'Brussels', country: 'Belgium' },
    'Sydney, Australia': { lat: -33.8688, lng: 151.2093, city: 'Sydney', country: 'Australia' },
    'Melbourne, Australia': { lat: -37.8136, lng: 144.9631, city: 'Melbourne', country: 'Australia' },
    'Taipei, Taiwan': { lat: 25.0330, lng: 121.5654, city: 'Taipei', country: 'Taiwan' },
    'Tehran, Iran': { lat: 35.6892, lng: 51.3890, city: 'Tehran', country: 'Iran' },
    'Tabriz, Iran': { lat: 38.0800, lng: 46.2919, city: 'Tabriz', country: 'Iran' },
    'Mexico City, Mexico': { lat: 19.4326, lng: -99.1332, city: 'Mexico City', country: 'Mexico' },
    'Copenhagen, Denmark': { lat: 55.6761, lng: 12.5683, city: 'Copenhagen', country: 'Denmark' },
    'Athens, Greece': { lat: 37.9838, lng: 23.7275, city: 'Athens', country: 'Greece' },
    'Seoul, South Korea': { lat: 37.5665, lng: 126.9780, city: 'Seoul', country: 'South Korea' },
    'Marrakech, Morocco': { lat: 31.6295, lng: -7.9811, city: 'Marrakech', country: 'Morocco' },
    'Ulaanbaatar, Mongolia': { lat: 47.8864, lng: 106.9057, city: 'Ulaanbaatar', country: 'Mongolia' },
    'Dar es Salaam, Tanzania': { lat: -6.7924, lng: 39.2083, city: 'Dar es Salaam', country: 'Tanzania' },
    'Kathmandu, Nepal': { lat: 27.7172, lng: 85.3240, city: 'Kathmandu', country: 'Nepal' },
    'Baku, Azerbaijan': { lat: 40.4093, lng: 49.8671, city: 'Baku', country: 'Azerbaijan' },
    'Tokyo, Japan': { lat: 35.6762, lng: 139.6503, city: 'Tokyo', country: 'Japan' },
    'Berlin, Germany': { lat: 52.5200, lng: 13.4050, city: 'Berlin', country: 'Germany' },
    'Uppsala, Sweden': { lat: 59.8586, lng: 17.6389, city: 'Uppsala', country: 'Sweden' },
  };

  // Extract all members from existing DOM cards to maintain single source of truth
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
    const fallback = fallbackEl ? fallbackEl.textContent.trim() : 'PH';

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
        locMeta = { lat: 20, lng: 0, city: 'Global', country: 'International' };
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
      baseLat: locMeta.lat,
      baseLng: locMeta.lng,
      cityKey
    };

    cityGroups[cityKey].push(memberData);
    members.push(memberData);
  });

  // Calculate coordinates with neat separation for cities with multiple members
  members.forEach((m) => {
    const group = cityGroups[m.cityKey];
    if (group.length === 1) {
      m.lat = m.baseLat;
      m.lng = m.baseLng;
    } else {
      const idx = group.indexOf(m);
      const count = group.length;
      const radius = 0.22; // subtle geographic offset in degrees (~18-22km)
      const angle = (2 * Math.PI / count) * idx - (Math.PI / 2);
      m.lat = m.baseLat + radius * Math.sin(angle);
      const cosLat = Math.cos((m.baseLat * Math.PI) / 180) || 1;
      m.lng = m.baseLng + (radius / cosLat) * Math.cos(angle);
    }
  });

  // Populate Country Filter Dropdown
  const countrySelect = document.getElementById('map-country-filter');
  if (countrySelect) {
    const countries = Array.from(new Set(members.map((m) => m.country))).sort();
    countrySelect.innerHTML = `<option value="all">All Countries (${countries.length})</option>` +
      countries.map((c) => `<option value="${c}">${c}</option>`).join('');
  }

  let map = null;
  let markersLayer = null;
  const markerMap = new Map();
  let isMapInitialized = false;

  function initMap() {
    if (isMapInitialized || typeof L === 'undefined') return;

    // Center map around Mediterranean / Europe / Global view initially
    map = L.map('world-map', {
      center: [28, 15],
      zoom: 2.3,
      minZoom: 1.8,
      maxZoom: 16,
      zoomControl: true,
      scrollWheelZoom: true,
      attributionControl: false
    });

    // Custom attribution control (minimalist)
    L.control.attribution({ position: 'bottomright', prefix: false })
      .addAttribution('&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OSM</a> &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>')
      .addTo(map);

    // Clean, modern, scientific Positron light tile layer
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 19
    }).addTo(map);

    markersLayer = L.featureGroup().addTo(map);

    // Add pins for all members
    members.forEach((member) => {
      const icon = L.divIcon({
        className: 'leaflet-member-marker',
        html: `
          <div class="member-pin-container" data-id="${member.id}" title="${member.name} (${member.city}, ${member.country})">
            <div class="member-pin-badge">
              ${
                member.photo
                  ? `<img src="${member.photo}" alt="${member.name}" class="member-pin-img" loading="lazy" />`
                  : `<span class="member-pin-fallback">${member.fallback || 'PH'}</span>`
              }
            </div>
            <div class="member-pin-pointer"></div>
            <div class="member-pin-pulse"></div>
          </div>
        `,
        iconSize: [44, 52],
        iconAnchor: [22, 50],
        popupAnchor: [0, -48]
      });

      const marker = L.marker([m_lat(member), m_lng(member)], { icon });

      const popupContent = `
        <div class="map-popup-card">
          <div class="popup-photo-wrap">
            ${
              member.photo
                ? `<img src="${member.photo}" alt="${member.name}" />`
                : `<div class="popup-fallback">${member.fallback || 'PH'}</div>`
            }
          </div>
          <span class="popup-city-tag">${member.city}, ${member.country}</span>
          <h4>${member.name}</h4>
          <p class="popup-role">${member.role}</p>
          <p class="popup-aff">${member.affiliation}</p>
        </div>
      `;

      marker.bindPopup(popupContent, {
        closeButton: true,
        className: 'custom-map-popup'
      });

      marker.on('click', () => {
        showMemberInDrawer(member);
      });

      markersLayer.addLayer(marker);
      markerMap.set(member.id, marker);
    });

    isMapInitialized = true;
  }

  function m_lat(m) { return m.lat; }
  function m_lng(m) { return m.lng; }

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
    if (!markersLayer) return;

    const countryValue = countrySelect ? countrySelect.value : 'all';
    const searchInput = document.getElementById('map-search-input');
    const query = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const visibleBounds = [];

    members.forEach((m) => {
      const marker = markerMap.get(m.id);
      if (!marker) return;

      const matchesCountry = countryValue === 'all' || m.country === countryValue;
      const matchesQuery = !query ||
        m.name.toLowerCase().includes(query) ||
        m.city.toLowerCase().includes(query) ||
        m.country.toLowerCase().includes(query) ||
        m.role.toLowerCase().includes(query) ||
        m.affiliation.toLowerCase().includes(query);

      if (matchesCountry && matchesQuery) {
        if (!markersLayer.hasLayer(marker)) {
          markersLayer.addLayer(marker);
        }
        visibleBounds.push([m.lat, m.lng]);
      } else {
        if (markersLayer.hasLayer(marker)) {
          markersLayer.removeLayer(marker);
        }
      }
    });

    if (visibleBounds.length > 0 && map) {
      if (visibleBounds.length === 1) {
        map.setView(visibleBounds[0], 7, { animate: true });
        const singleMember = members.find((m) => m.lat === visibleBounds[0][0] && m.lng === visibleBounds[0][1]);
        if (singleMember) {
          const marker = markerMap.get(singleMember.id);
          if (marker) marker.openPopup();
        }
      } else {
        map.fitBounds(visibleBounds, { padding: [50, 50], maxZoom: 8, animate: true });
      }
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
      if (map) {
        map.setView([28, 15], 2.3, { animate: true });
      }
      const drawer = document.getElementById('map-member-drawer');
      if (drawer) drawer.innerHTML = '';
    });
  }

  // Toggle button click listener
  let isMapMode = false;

  toggleBtn.addEventListener('click', () => {
    isMapMode = !isMapMode;
    toggleBtn.setAttribute('aria-pressed', String(isMapMode));
    toggleBtn.classList.toggle('is-active', isMapMode);

    const toggleText = toggleBtn.querySelector('.view-toggle-text');
    const toggleIcon = toggleBtn.querySelector('.view-toggle-icon');

    if (isMapMode) {
      if (toggleText) toggleText.textContent = 'Switch to Grid Mode';
      if (toggleIcon) toggleIcon.textContent = '👥';

      mapSection.style.display = 'block';
      if (gridView) gridView.style.display = 'none';

      if (!isMapInitialized) {
        initMap();
      }

      setTimeout(() => {
        if (map) {
          map.invalidateSize();
          if (markersLayer && markersLayer.getLayers().length > 0) {
            map.fitBounds(markersLayer.getBounds().pad(0.1));
          }
        }
      }, 150);
    } else {
      if (toggleText) toggleText.textContent = 'Switch to Map Mode';
      if (toggleIcon) toggleIcon.textContent = '🗺️';

      mapSection.style.display = 'none';
      if (gridView) gridView.style.display = 'block';
    }
  });
});
