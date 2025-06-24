import { map, tileLayer, Icon, icon, marker, popup, latLng } from 'leaflet'; 

import markerIcon from 'leaflet/dist/images/marker-icon.png'; 
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'; 
import markerShadow from 'leaflet/dist/images/marker-shadow.png'; 

import { MAP_SERVICE_API_KEY } from '../config'; 

export default class Map {
    #zoom = 5; 
    #map = null; 
    #mapMarker = null; 

    static async getPlaceNameByCoordinate(latitude, longitude) {
        try {
            const url = new URL(`https://api.maptiler.com/geocoding/${longitude},${latitude}.json`);
            url.searchParams.set('key', MAP_SERVICE_API_KEY);
            url.searchParams.set('language', 'id'); 
            url.searchParams.set('limit', '1'); 

            const response = await fetch(url);
            const json = await response.json();

            const place = json.features[0].place_name.split(', ');
            return [place.at(-2), place.at(-1)].map((name) => name).join(', ');
        } catch (error) {
            console.error('getPlaceNameByCoordinate: error:', error);
            return `${latitude}, ${longitude}`;
        }
    }

    static isGeolocationAvailable() {
        return 'geolocation' in navigator;
    }

    static getCurrentPosition(options = {}) {
        return new Promise((resolve, reject) => {
            if (!Map.isGeolocationAvailable()) {
                reject('Geolocation API unsupported');
                return;
            }

            navigator.geolocation.getCurrentPosition(resolve, reject, options);
        });
    }

    static async build(selector, options = {}) {
        const defaultCenter = [-7.5762048,110.7887262];
        let center = defaultCenter;

        if (options.locate) {
            try {
                const position = await Map.getCurrentPosition();
                center = [position.coords.latitude, position.coords.longitude];
            } catch {
                console.warn('Geolocation failed, using default center');
            }
        } else if (options.center) {
            center = options.center; // Jika center disediakan di opsi, gunakan itu
        }

        // Buat instance Map baru dengan center yang sudah dipilih
        const mapInstance = new Map(selector, { ...options, center });

        // Tambahkan marker di center peta, dengan popup menampilkan koordinat lokasi
        mapInstance.#mapMarker = mapInstance.addMarker(center, {}, { content: 'Lokasi: ' + center.map(c => c.toFixed(5)).join(', ') });

        return mapInstance;
    }

    // Konstruktor untuk membuat instance peta Leaflet
    constructor(selector, options = {}) {
        // Reset _leaflet_id jika sudah ada, untuk mencegah error Leaflet saat re-inisialisasi peta di element yang sama
        if (document.querySelector(selector)._leaflet_id) {
            document.querySelector(selector)._leaflet_id = null;
        }

        this.#zoom = options.zoom ?? this.#zoom; // Set zoom level dari opsi atau default

        // Buat tile layer OpenStreetMap
        const tileOsm = tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
        });

        // Buat peta Leaflet pada elemen DOM dengan opsi dan layer yang sudah dibuat
        this.#map = map(document.querySelector(selector), {
            zoom: this.#zoom,
            scrollWheelZoom: false, // Nonaktifkan zoom scroll mouse untuk UX tertentu
            layers: [tileOsm],
            ...options,
        });
    }

    // Fungsi untuk mengubah posisi dan zoom kamera peta
    changeCamera(coordinate, zoomLevel = null) {
        if (!zoomLevel) {
            this.#map.setView(latLng(coordinate), this.#zoom); // Jika zoomLevel null, gunakan default zoom
        } else {
            this.#map.setView(latLng(coordinate), zoomLevel); // Jika ada, gunakan zoom yang diberikan
        }
    }

    // Mendapatkan koordinat tengah peta saat ini
    getCenter() {
        const { lat, lng } = this.#map.getCenter();
        return { latitude: lat, longitude: lng };
    }

    // Membuat icon marker khusus dengan gambar default Leaflet
    createIcon(options = {}) {
        return icon({
            ...Icon.Default.prototype.options,
            iconRetinaUrl: markerIcon2x,
            iconUrl: markerIcon,
            shadowUrl: markerShadow,
            ...options,
        });
    }

    // Menambahkan marker ke peta dengan opsi marker dan popup
    addMarker(coordinates, markerOptions = {}, popupOptions = null) {
        const newMarker = marker(coordinates, {
            icon: this.createIcon(),
            ...markerOptions,
        });

        // Jika diberikan opsi popup dengan konten, buat popup dan bind ke marker
        if (popupOptions && popupOptions.content) {
            const newPopup = popup(coordinates, popupOptions);
            newMarker.bindPopup(newPopup);
        }

        // Tambahkan marker ke peta
        newMarker.addTo(this.#map);
        return newMarker;
    }

    // Menambahkan event listener pada peta, misal untuk klik atau drag
    addMapEventListener(eventName, callback) {
        this.#map.on(eventName, (e) => {
            callback(e); // Panggil callback dengan event

            // Update posisi marker utama saat event terjadi (misal klik peta pindah marker)
            const { lat, lng } = e.latlng;
            if (this.#mapMarker) {
                this.#mapMarker.setLatLng([lat, lng]);
            } else {
                // Jika marker utama belum ada, buat marker baru dengan popup koordinat
                this.#mapMarker = this.addMarker([lat, lng], {}, { content: `Lokasi: ${lat.toFixed(5)}, ${lng.toFixed(5)}` });
            }
        });
    }

    // Mendapatkan instance peta Leaflet (akses langsung jika perlu)
    getMap() {
        return this.#map;
    }
}
