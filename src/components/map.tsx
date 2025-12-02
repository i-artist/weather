import { useEffect, useRef } from 'react';
// import * as maptilersdk from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import './map.css';
import { Weather } from './weather';

export default function Map() {
  const weather = useRef(null as any);

  // const onClickWeatherItem = (type: string) => {
  //     console.log('onClickWeatherItem', type);
  //     weather?.current?.onLayerChange(type);
  // }

  useEffect(() => {
    const _weather = new Weather();
    weather.current = _weather;
    return () => {
      _weather?.map?.remove();
    };
  }, []);
  return (
    <div className="map-wrap">
      {/* <div id="time-info">
                <span id="time-text"></span>
                <button id="play-pause-bt" className="button">Play 3600x</button>
                <input type="range" id="time-slider" min="0" max="11" step="1" />
            </div>
            <div id="variable-name">Wind</div>
            <div id="pointer-data"></div> */}
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
