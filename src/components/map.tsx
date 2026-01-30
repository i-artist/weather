/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useState } from "react";
// import * as maptilersdk from '@maptiler/sdk';
import { Popup } from "@maptiler/sdk";
import "@maptiler/sdk/dist/maptiler-sdk.css";
import { Select } from "antd";
import "./map.css";
import { Weather } from "./weather";

export default function WeatherMap() {
  const weather = useRef(null as any);
  const [markers, setMarkers] = useState<any[]>([]);
  // const onClickWeatherItem = (type: string) => {
  //     console.log('onClickWeatherItem', type);
  //     weather?.current?.onLayerChange(type);
  // }

  useEffect(() => {
    const _weather = new Weather();
    weather.current = _weather;

    fetch("marker.json")
      .then((res) => res.json())
      .then((data) => {
        const features = data.features;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const options = features.map((item: any) => ({
          label: item.properties.wfname,
          value: item.properties.wfname,
          coordinates: item.geometry.coordinates,
        }));
        setMarkers(options);
      });
    return () => {
      _weather?.map?.remove();
    };
  }, []);

  const onSelectChange = (value: any) => {
    const marker = markers.find((item: any) => item.value === value);
    if (marker) {
      weather.current?.map.flyTo({
        center: marker.coordinates,
        zoom: 1, // 放大到合适的级别
        essential: true,
        maxDuration: 300,
      });

      new Popup()
        .setLngLat(marker.coordinates)
        .setHTML(`找到结果：<strong>${marker.label}</strong>`)
        .addTo(weather.current?.map);

      console.log(`已找到 1 个匹配项，定位到：${marker.label}`);
      return marker;
    }
  };
  return (
    <div className="map-wrap">
      {/* <div id="time-info">
                <span id="time-text"></span>
                <button id="play-pause-bt" className="button">Play 3600x</button>
                <input type="range" id="time-slider" min="0" max="11" step="1" />
            </div>
            <div id="variable-name">Wind</div>
            <div id="pointer-data"></div> */}

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
      <div id="map"></div>

      {/* <div className='weather-items'>
                <div className='weather-item' onClick={() => onClickWeatherItem('temperature')}>
                    温度
                </div>
                <div className='weather-item' onClick={() => onClickWeatherItem('wind')}>
                    风力
                </div>
                <div className='weather-item' onClick={() => onClickWeatherItem('radar')}>
                    雷达
                </div>
                <div className='weather-item' onClick={() => onClickWeatherItem('precipitation')}>
                    降水
                </div>
            </div> */}
    </div>
  );
}
