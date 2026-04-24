/**
 * Módulo: mapa.js
 * Gestiona la selección interactiva de coordenadas mediante Leaflet.
 */

let map = null;
let marker = null;
let currentCallback = null;

export function initMapPicker() {
    const modal = document.getElementById('modalMapa');
    const container = document.getElementById('mapaContenedor');
    const closeBtn = document.getElementById('cerrarMapaBtn');
    const confirmBtn = document.getElementById('confirmarUbicacionBtn');
    const searchBtn = document.getElementById('mapSearchBtn');
    const searchInput = document.getElementById('mapSearchInput');

    if (!container || map) return;

    // Configuración inicial (Centrado en España)
    map = L.map(container).setView([40.4167, -3.7033], 6);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(map);

    map.on('click', (e) => {
        const { lat, lng } = e.latlng;
        updateMarker(lat, lng);
    });

    closeBtn.onclick = () => { modal.style.display = 'none'; };

    const buscar = async () => {
        const query = searchInput.value.trim();
        if (!query) return;
        
        searchBtn.disabled = true;
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
            const data = await response.json();
            if (data && data.length > 0) {
                const { lat, lon } = data[0];
                updateMarker(lat, lon);
                map.setView([lat, lon], 14);
            } else {
                Swal.fire('Mapa', 'No se encontró la ubicación.', 'warning');
            }
        } catch (error) {
            console.error("Error en geocoding:", error);
        } finally {
            searchBtn.disabled = false;
        }
    };

    searchBtn.onclick = buscar;
    searchInput.onkeydown = (e) => { if (e.key === 'Enter') buscar(); };
    
    confirmBtn.onclick = () => {
        if (marker && currentCallback) {
            const pos = marker.getLatLng();
            currentCallback(pos.lat.toFixed(7), pos.lng.toFixed(7));
            modal.style.display = 'none';
        } else {
            Swal.fire('Mapa', 'Por favor, selecciona un punto en el mapa primero.', 'info');
        }
    };
}

function updateMarker(lat, lng) {
    if (marker) {
        marker.setLatLng([lat, lng]);
    } else {
        marker = L.marker([lat, lng], { draggable: true }).addTo(map);
    }
}

export function abrirMapaPicker(callback, initialLat = null, initialLng = null) {
    const modal = document.getElementById('modalMapa');
    const searchInput = document.getElementById('mapSearchInput');
    if (!modal) return;

    currentCallback = callback;
    if (searchInput) searchInput.value = "";
    modal.style.display = 'flex';

    // Leaflet requiere recalcular el tamaño tras mostrar un contenedor oculto
    setTimeout(() => { 
        map.invalidateSize(); 
        
        if (initialLat && initialLng && !isNaN(initialLat) && !isNaN(initialLng)) {
            const lat = parseFloat(initialLat);
            const lng = parseFloat(initialLng);
            updateMarker(lat, lng);
            map.setView([lat, lng], 13);
        } else if (marker) {
            map.removeLayer(marker);
            marker = null;
        }
    }, 200);
}