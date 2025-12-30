/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRequest } from 'ahooks';
import { FloatButton, Select } from 'antd';
import { useCallback, useEffect, useRef, useState } from 'react';
import geojson from '../assets/geojson.json';
import { DayProgress } from './day-progress';
import { FutureWeatherModal } from './future-weather';
import './leaflet.ChineseTmsProviders';
import { CaretRightOutlined, FullscreenExitOutlined, FullscreenOutlined, PauseOutlined, PlayCircleOutlined } from '@ant-design/icons';

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
  geoJSON: any;
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
  const [location, setLocation] = useState<string>('');
  const windyRef = useRef<WindyAPI>(null);
  const [baseInfo, setBaseInfo] = useState<any>({});
  const [currentPopup, setCurrentPopup] = useState<any>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);

  // 添加轮播相关状态
  const [isCarouselRunning, setIsCarouselRunning] = useState(false);
  const [currentCarouselIndex, setCurrentCarouselIndex] = useState(0);
  const carouselTimerRef = useRef<number | null>(null);


  useEffect(() => {
    document.addEventListener('fullscreenchange', () => {
      setIsFullScreen(Boolean(document.fullscreenElement));
    });
  }, []);
  useRequest(
    async () => {
      const res = await fetch('https://demo.theonly.vip:16666/api/baseinfo');
      const json = await res.json();
      console.log(
        '获取基础信息：',
        json,
        json?.data?.cli?.dps?.ModelData || {},
      );
      setBaseInfo(json?.data?.cli?.dps?.ModelData || {});
    },
    {
      pollingInterval: 3000,
      // ready: false,
    },
  );

  const onShowPopup = useCallback(
    (marker: any) => {
      (window as any).L.popup()
        .setLatLng([marker.coordinates[1], marker.coordinates[0]])
        .setContent(`名称：${marker.label} `)
        .openOn(windyRef.current?.map);
      const item = baseInfo[marker.id] || {};
      console.log('显示弹窗：', baseInfo, marker, baseInfo[marker.id], item);

      // const content = marker.label?.includes('风')
      //   ? `
      //             <div>地面10米风U分量：${u10m ? u10m?.toFixed(2) : '0'}m/s</div>
      //             <div>地面10米风V分量：${v10m ? v10m?.toFixed(2) : '0'}m/s</div>
      //       `
      //   : ` <div>平均辐照度：${ssrd ? ssrd.toFixed(2) : '0'}W/m²</div>`;
      const content =
        marker.type === '风电'
          ? `
              <div>平均风速: <span class="popup-content">${toFixed(item?.sn_top_TrendWindSpeed_wf) || '0'
          }m/s</span></div>
              <div>有功功率: <span class="popup-content">${toRealNumber(item?.sn_top_ActivePower_wf) || '0'
          }MW</span></div>
         `
          : ` 
               <div>平均辐照度: <span class="popup-content">${toFixed(item?.sn_top_TrendAvgIrradiance_pvf) || '0'
          }W/m²</span></div>
               <div>有功功率: <span class="popup-content">${toRealNumber(item?.sn_top_ActivePower_pvf) || '0'
          }MW</span></div>
         `;
      const popup = (window as any).L.popup()
        .setLatLng([marker.coordinates[1], marker.coordinates[0]])
        .setContent(
          `名称：${marker.label}
               ${content}
               
            `,
        )
        .openOn(windyRef.current?.map);
      popup._marker = marker;
    },
    [baseInfo],
  );
  console.log('currentPopup:', currentPopup);
  useEffect(() => {
    if (currentPopup && baseInfo && windyRef.current) {
      onShowPopup(currentPopup);
    }
  }, [baseInfo, currentPopup]);

  const tryInit = useCallback(
    (json: any) => {
      if (initializedRef.current || typeof window === 'undefined') {
        return;
      }

      const windyWindow = window as WindyWindow;
      const windyInitFn = windyWindow.windyInit;
      const leaflet = windyWindow.L as any;

      if (!windyInitFn || !leaflet) {
        return;
      }
      const windIcon = leaflet.icon({
        iconUrl: 'wind.gif',
        iconSize: [36, 36],
        iconAnchor: [12, 12],
        popupAnchor: [0, 0],
      });

      const electricIcon = leaflet.icon({
        iconUrl: 'location.svg',
        iconSize: [42, 42],
        iconAnchor: [12, 12],
        popupAnchor: [0, 0],
      });
      initializedRef.current = true;

      windyInitFn(options, (windyAPI: WindyAPI) => {
        const { map, picker } = windyAPI as any;
        map.eachLayer((layer: any) => {
          // if (layer.options && layer.options.attribution?.includes('Windy')) {
          map.removeLayer(layer);
          // }
        });

        map.on('popupclose', (e: any) => {
          setCurrentPopup(null);
        });
        map.on('popupopen', (e: any) => {
          setTimeout(() => {
            setCurrentPopup(e.popup._marker);
          }, 0);
        });
        map.on('click', (e: any) => {
          const { lat, lng } = e.latlng;
          console.log('点击位置：', lat, lng);
          picker.open({ lat, lon: lng });
          // broadcast.once('redrawFinished', () => {
          //   // Opening of a picker (async)
          // });
        });
        // leaflet.tileLayer
        //   .chinaProvider('MapBox.Normal.Map2', {
        //     maxZoom: 24,
        //     minZoom: 3,
        //   })
        //   .addTo(map);

        leaflet.tileLayer
          .chinaProvider('TianDiTu.Normal.Annotion', {
            maxZoom: 24,
            minZoom: 3,
          })
          .addTo(map);

        // leaflet.tileLayer
        //   .chinaProvider('GaoDe.Satellite.Annotion', {
        //     maxZoom: 24,
        //     minZoom: 3,
        //   })
        //   .addTo(map);

        // leaflet
        //   .tileLayer(
        //     'https://tiles-s.windy.com/tiles/v10.0/darkmap/{z}/{x}/{y}.png',
        //   )
        //   .addTo(map);
        windyRef.current = windyAPI;

        // const imageUrl = './taiwan.png',
        //   imageBounds = [
        //     [23.812216, 120.22655],
        //     [24.173941, 121.72544],
        //   ];
        // (leaflet as any).imageOverlay(imageUrl, imageBounds).addTo(map);
        // leaflet
        //   .marker([25.037, 121.563], {})
        //   .bindTooltip('中国台湾', { permanent: true, direction: 'top' })
        //   .addTo(map);
        leaflet
          .geoJSON(geojson, {
            style: function (feature) {
              const name = feature.properties?.name || '';
              if (name === '十段线' || name === '南海诸岛') {
                return { color: 'rgba(227, 51, 51, 0.92)', weight: 1 };
              }
              return { color: 'rgba(32, 77, 84, 0.92)', weight: 1 };
            },
          })
          .addTo(map);

        for (const item of json.features) {
          const { geometry, properties } = item;
          const { coordinates } = geometry;
          const { name: wfname = '', id, type } = properties;
          const [lon, lat] = coordinates;
          const icon = type === '风电' ? windIcon : electricIcon;
          const marker = leaflet
            .marker([lat, lon], {
              icon: icon,
            })
            .addTo(map);
          marker.bindPopup(wfname);
          marker.on('click', () => {
            onShowPopup({ label: wfname, id, type, coordinates: [lon, lat] });
            setLocation(`${lon},${lat}`);
          });

          marker.on('mouseover', () => {
            onShowPopup({ label: wfname, id, type, coordinates: [lon, lat] });
            setTimeout(() => {
              console.log('鼠标移上去了：', wfname);
              setCurrentPopup(() => ({
                label: wfname,
                id,
                type,
                coordinates: [lon, lat],
              }));
            }, 0);
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
    fetch('/marker2.json')
      .then((res) => res.json())
      .then((json) => {
        const features = json.features;
        const options = features.map((item: any) => ({
          label: item.properties.name,
          value: item.properties.id,
          coordinates: item.geometry.coordinates,
        }));
        setMarkers(options);
        tryInit(json);
      });
  }, [tryInit]);

  // 添加轮播控制函数
  const toggleCarousel = () => {
    if (isCarouselRunning) {
      // 停止轮播
      if (carouselTimerRef.current) {
        clearInterval(carouselTimerRef.current);
        carouselTimerRef.current = null;
      }
    } else {
      // 开始轮播
      startCarousel();
    }
    setIsCarouselRunning(!isCarouselRunning);
  };

  const startCarousel = () => {
    // 清除可能存在的定时器
    if (carouselTimerRef.current) {
      clearInterval(carouselTimerRef.current);
    }

    // 立即执行一次当前站点的切换
    const currentMarker = markers[currentCarouselIndex];
    if (currentMarker) {
      onSelectChange(currentMarker.value);
    }

    // 设置定时器，每5秒切换一次
    carouselTimerRef.current = setInterval(() => {
      setCurrentCarouselIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % markers.length;
        const nextMarker = markers[nextIndex];
        if (nextMarker) {
          onSelectChange(nextMarker.value);
        }
        return nextIndex;
      });
    }, 5000);
  };

  // 组件卸载时清除定时器
  useEffect(() => {
    return () => {
      if (carouselTimerRef.current) {
        clearInterval(carouselTimerRef.current);
      }
    };
  }, []);
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
      <FloatButton.Group>
        <FloatButton
          icon={isCarouselRunning ? <PauseOutlined /> : <CaretRightOutlined />}
          onClick={toggleCarousel}
          tooltip="站点轮播"
        ></FloatButton>
        <FloatButton
          icon={
            isFullScreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />
          }
          onClick={() => {
            if (isFullScreen) {
              document.exitFullscreen();
            } else {
              document.body?.requestFullscreen();
            }
          }}
        />
      </FloatButton.Group>
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
      <DayProgress></DayProgress>
      <FutureWeatherModal
        location={location}
        onClose={() => setLocation('')}
      ></FutureWeatherModal>
    </div>
  );
}

const toRealNumber = (value: any) => {
  const val = Number(value);
  if (isNaN(val)) {
    return 0;
  }
  if (val < 0) {
    return 0;
  }
  return (val / 1000).toFixed(2);
};

function toFixed(value: any, fixed = 2) {
  const val = Number(value);
  if (isNaN(val)) {
    return '0';
  }
  return val.toFixed(fixed);
}