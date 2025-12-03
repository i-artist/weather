/* eslint-disable @typescript-eslint/no-explicit-any */
import { Select } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';

const options = {
  key: 'MJt519IvahtrHKWpiqosIqp8j0NgvvA2',
  verbose: true,
  lat: 34.4,
  lon: 113.5,
  zoom: 5,
};

type WindyAPI = {
  map: any;
};

type LeafletPopup = {
  setLatLng: (coords: [number, number]) => LeafletPopup;
  setContent: (content: string) => LeafletPopup;

  openOn: (map: unknown) => void;
};

type LeafletLike = {
  popup: () => LeafletPopup;
  marker: (coords: [number, number], options: any) => any;
  icon: (options: any) => any;
};

type WindyWindow = Window & {
  windyInit?: (opts: typeof options, callback: (api: WindyAPI) => void) => void;
  L?: LeafletLike;
};

export function Windy() {
  const initializedRef = useRef(false);
  const [markers, setMarkers] = useState<any[]>([]);
  const windyRef = useRef<WindyAPI>(null);
  const tryInit = useCallback((geoJson: any) => {
    if (initializedRef.current || typeof window === 'undefined') {
      return;
    }

    const windyWindow = window as WindyWindow;
    const windyInitFn = windyWindow.windyInit;
    const leaflet = windyWindow.L;

    if (!windyInitFn || !leaflet) {
      return;
    }

    const windDriven = leaflet.icon({
      iconUrl: 'wind.gif',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, 0],
    });
    const solarDriven = leaflet.icon({
      iconUrl: 'solar.gif',
      iconSize: [24, 24],
      iconAnchor: [12, 12],
      popupAnchor: [0, 0],
    });
    initializedRef.current = true;
    windyInitFn(options, (windyAPI: WindyAPI) => {
      const { map } = windyAPI;
      windyRef.current = windyAPI;
      for (const item of geoJson.features) {
        const { geometry, properties } = item;
        const { coordinates } = geometry;
        const { wfname = '' } = properties;
        const [lon, lat] = coordinates;
        const icon = wfname?.includes('风') ? windDriven : solarDriven;
        const marker = leaflet
          .marker([lat, lon], {
            icon: icon,
          })
          .addTo(map);
        marker.bindPopup(wfname);
        // leaflet.popup().setLatLng([lat, lon]).setContent(name).openOn(map);
      }
    });
  }, []);

  const onSelectChange = (value: any) => {
    const marker = markers.find((item: any) => item.value === value);
    if (marker) {
      console.log(windyRef.current?.map?.flyTo);

      windyRef.current?.map?.flyTo({
        lat: marker.coordinates[1],
        lon: marker.coordinates[0],
      });
      (window as any).L.popup()
        .setLatLng([marker.coordinates[1], marker.coordinates[0]])
        .setContent(marker.label)
        .openOn(windyRef.current?.map);
      //   (windyRef.current?.map as any).flyTo({
      //     center: marker.coordinates,
      //     zoom: 9, // 放大到合适的级别
      //     essential: true,
      //     maxDuration: 300,
      //   });

      //   new Popup()
      //     .setLngLat(marker.coordinates)
      //     .setHTML(`找到结果：<strong>${marker.label}</strong>`)
      //     .addTo(weather.current?.map);

      //   console.log(`已找到 1 个匹配项，定位到：${marker.label}`);
      return marker;
    }
  };

  useEffect(() => {
    fetch('/marker.json')
      .then((res) => res.json())
      .then((json) => {
        const features = json.features;
        const options = features.map((item: any) => ({
          label: item.properties.wfname,
          value: item.properties.wfname,
          coordinates: item.geometry.coordinates,
        }));
        setMarkers(options);
        tryInit(json);
      });
  }, [tryInit]);
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div className="search-point">
        <Select
          style={{ width: 160 }}
          options={markers}
          showSearch={{
            filterOption: (inputValue, option: any) =>
              option?.label?.indexOf(inputValue) !== -1,
          }}
          onChange={onSelectChange}
        ></Select>
      </div>
      <div
        id="windy"
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '12px',
          // overflow: 'hidden',
          // position: 'relative',
          // background: '#0f172a',
          // boxShadow: '0 10px 25px rgba(15, 23, 42, 0.6)',
        }}
      ></div>
    </div>
  );
}
