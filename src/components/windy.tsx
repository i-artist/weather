/* eslint-disable @typescript-eslint/no-explicit-any */
import { Select } from 'antd';
import axios from 'axios';
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

// function kelvinToCelsius(kelvin: number, decimal = 1) {
//   return Number((kelvin - 273.15).toFixed(decimal));
// }

export function Windy() {
  const initializedRef = useRef(false);
  const [markers, setMarkers] = useState<any[]>([]);
  const windyRef = useRef<WindyAPI>(null);
  const onShowPopup = useCallback((marker: any) => {
    (window as any).L.popup()
      .setLatLng([marker.coordinates[1], marker.coordinates[0]])
      .setContent(`名称：${marker.label} `)
      .openOn(windyRef.current?.map);
    axios
      .post(
        'https://api-pro-openet.terraqt.com/v1/aifs_surface/point',
        {
          lon: marker.coordinates[0],
          lat: marker.coordinates[1],
          mete_vars: ['ssrd', 'u10m', 'v10m'],
          // time: dayjs().subtract(1, 'day').format('YYYY-MM-DD HH:mm:ss'),
          // time: dayjs().add(1, 'day').format('YYYY-MM-DD') + ' 08:00:00',
        },
        {
          headers: {
            token: 'jBDMwETZyMzNhBDMwEGMwM2YwkzNzYWN',
          },
        },
      )
      .then((res) => {
        console.log(res);
        const values = res?.data?.data?.data?.[0]?.values?.[0];
        const ssrd = values?.[0];
        const u10m = values?.[1];
        const v10m = values?.[2];

        const content = marker.label?.includes('风')
          ? `
                <div>地面10米风U分量：${u10m ? u10m?.toFixed(2) : '0'}m/s</div>
                <div>地面10米风V分量：${v10m ? v10m?.toFixed(2) : '0'}m/s</div>
          `
          : ` <div>平均辐照度：${ssrd ? ssrd.toFixed(2) : '0'}W/m²</div>`;
        (window as any).L.popup()
          .setLatLng([marker.coordinates[1], marker.coordinates[0]])
          .setContent(
            `名称：${marker.label}
               ${content}
               
            `,
          )
          .openOn(windyRef.current?.map);
      })
      .catch(() => {
        (window as any).L.popup()
          .setLatLng([marker.coordinates[1], marker.coordinates[0]])
          .setContent(`名称：${marker.label} `)
          .openOn(windyRef.current?.map);
      });
  }, []);

  const tryInit = useCallback(
    (geoJson: any) => {
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
          marker.on('click', () => {
            onShowPopup({ label: wfname, coordinates: [lon, lat] });
          });
          // leaflet.popup().setLatLng([lat, lon]).setContent(name).openOn(map);
        }
      });
    },
    [onShowPopup],
  );

  const onSelectChange = (value: any) => {
    const marker = markers.find((item: any) => item.value === value);
    if (marker) {
      console.log(windyRef.current?.map?.flyTo);

      windyRef.current?.map?.flyTo({
        lat: marker.coordinates[1],
        lon: marker.coordinates[0],
      });
      onShowPopup(marker);

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
