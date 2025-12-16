import { Map, MapStyle, config } from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import { WindLayer, TemperatureLayer, RadarLayer, PrecipitationLayer, ColorRamp } from '@maptiler/weather';
import { MarkerLayout } from '@maptiler/marker-layout';


export class Weather {
    map?: Map
    constructor() { this.init(); }
    onLayerChange(type: string) {
        if (!this.map) return;
        const map = this.map;
        if (type === 'wind') {
            // const windLayer = new WindLayer();
            // map.setPaintProperty("Water", 'fill-color', "rgba(0, 0, 0, 0.4)");

            // map.addLayer(windLayer, 'Water');
            map.moveLayer("Wind");
        } else if (type === 'temperature') {
            // const temperatureLayer = new TemperatureLayer();
            map.setPaintProperty("Temperature", 'fill-color', "rgba(0, 0, 0, 0.4)");
            // map.addLayer(temperatureLayer, 'Water');
            map.moveLayer("Temperature");
        } else if (type === 'radar') {
            // const radarLayer = new RadarLayer();
            // map.setPaintProperty("Radar", 'fill-color', "rgba(0, 0, 0, 0.4)");
            // map.addLayer(radarLayer, 'Water');
            map.moveLayer("Radar");
        } else if (type === 'precipitation') {
            // const precipitationLayer = new PrecipitationLayer();
            // map.setPaintProperty("Precipitation", 'fill-color', "rgba(0, 0, 0, 0.4)");
            // map.addLayer(precipitationLayer, 'Water');
            map.moveLayer("Precipitation");
        }


    }
    init() {
        config.apiKey = 'lUrJ4YNOW1rB4GnQJ7GJ';
        const map = ((window as any).map = new Map({
            container: 'map', // container's id or the HTML element to render the map
            style: MapStyle.BASE_V4,
            zoom: 3,
            center: [113.5, 34.4],
            projection: 'globe',
            // projectionControl: true,
            geolocate: true,
            geolocateControl: true,
            language: 'zh',
        }));
        // const timeTextDiv = document.getElementById("time-text")!;
        // const timeSlider = document.getElementById("time-slider")! as HTMLInputElement & { value: number };
        // const playPauseButton = document.getElementById("play-pause-bt")!;
        // const pointerDataDiv = document.getElementById("pointer-data")!;
        // let pointerLngLat: any = null;
        this.map = map;
        const windLayer = new WindLayer({ id: "Wind" });

        map.on('load', function () {
            map.setPaintProperty("Water", 'fill-color', "rgba(0, 0, 0, 0.4)");
            map.addLayer(windLayer, 'Water');
        });
        map.on('load', async () => {

            // const coordinatesA = [113.564, 34.4]; // [经度, 纬度]
            // const markerEl = document.createElement('div');
            // markerEl.className = 'custom-marker'; // 用于 CSS 样式
            // markerEl.style.backgroundColor = 'blue';
            // markerEl.style.width = '20px';
            // markerEl.style.height = '20px';
            // markerEl.style.borderRadius = '50%';
            // markerEl.style.cursor = 'pointer';
            // // 创建 Marker
            // const markerA = new Marker({
            //     element: markerEl, // 传入自定义的 HTML 元素
            //     anchor: 'bottom'   // 锚点设置在底部
            // })
            //     .setLngLat(coordinatesA as any)
            //     .setPopup(
            //         // 添加一个弹窗
            //         new Popup({ offset: 25 })
            //             .setHTML('<h3>地标A</h3><p>这是一个HTML Marker</p>')
            //     )
            //     .addTo(map);
            // 示例：假设 MapTiler 样式中包含名为 "Boundary line" 的图层
            // 您需要根据您使用的具体样式来确定图层ID
            // const boundaryLayerIds = ["Boundary line", "Country border"]; // 示例图层ID

            // boundaryLayerIds.forEach(id => {

            //     if (map.getLayer(id)) {
            //         map.setLayoutProperty(id, 'visibility', 'none');
            //     }
            // });

            const chinaJSON = await fetch('https://geojson.cn/api/china/1.6.2/china.json').then(res => res.json());
            const data = await fetch('/marker.json').then(res => res.json());
            console.log('data', data, chinaJSON);

            map.addSource('custom-points-data', {
                type: 'geojson',
                data: data // 您的自定义数据
            });

            map.addLayer({
                'id': 'custom-points-layer',
                'type': 'symbol', // 关键类型：Symbol
                'source': 'custom-points-data',
                'layout': {
                    // 图标设置 (Symbol)
                    'icon-image': 'building-icon',      // 使用上面加载的图标ID
                    'icon-size': 0.8,                   // 缩放大小
                    'icon-allow-overlap': true,         // 允许图标重叠

                    // 文本设置 (Label)
                    'text-field': ['get', 'wfname'],      // 显示 GeoJSON properties 中的 'name' 字段
                    'text-font': ['Noto Sans Regular'], // 字体，确保地图样式支持
                    'text-size': 14,
                    'text-offset': [0, 1.5],            // 文本相对于图标的位置 [X, Y]
                    'text-anchor': 'top',                // 文本锚点

                },
                'paint': {
                    'text-color': '#000000',            // 文本颜色
                    'text-halo-color': '#ffffff',       // 文本描边颜色
                    'text-halo-width': 1.5,              // 文本描边宽度

                }
            });
        });
        const appContainer = map.getContainer();
        const markerContainer = document.createElement("div");
        appContainer.appendChild(markerContainer);

        (async () => {
            await map.onReadyAsync();

            const markerManager = new MarkerLayout(map, {
                layers: ["City labels"],
                markerSize: [140, 80],
                markerAnchor: "top",
                offset: [0, -8], // so that the tip of the marker bottom pin lands on the city dot
                sortingProperty: "rank",
                // filter: ((feature) => {
                //     return ["city", "village", "town"].includes(feature.properties.class)
                // }),

                // no filtering so that we get as many features as possible
            });
            const temperatureLayer = new TemperatureLayer({ opacity: 0.7 });

            // Radar will be using the cloud color ramp and used as a cloud overlay
            const radarLayer = new RadarLayer({ colorramp: ColorRamp.builtin.RADAR_CLOUD });

            // From the wind layer, we only display the particles (the background is using the NULL color ramp, which is transparent).
            // The slower particles are transparent, the fastest are opaque white
            const windLayer = new WindLayer({ colorramp: ColorRamp.builtin.NULL, color: [255, 255, 255, 0], fastColor: [255, 255, 255, 100] });

            // The precispitation layer is created but actually not displayed.
            // It will only be used for picking precipitation metrics at the locations of the markers
            const precipitationLayer = new PrecipitationLayer({ colorramp: ColorRamp.builtin.NULL });

            // Setting the water layer partially transparent to increase the visual separation between land and water
            map.setPaintProperty("Water", "fill-color", "rgba(0, 0, 0, 0.7)")
            map.addLayer(temperatureLayer, "Place labels");
            map.addLayer(windLayer)
            map.addLayer(radarLayer);
            map.addLayer(precipitationLayer);
            await temperatureLayer.onSourceReadyAsync();
            await radarLayer.onSourceReadyAsync();
            await windLayer.onSourceReadyAsync();
            await precipitationLayer.onSourceReadyAsync();
            // This object contains the marker DIV so that they can be updated rather than fully recreated every time
            const markerLogicContainer: any = {};

            let markerStatus: any = null;

            // This function will be used as the callback for some map events
            const updateMarkers = () => {
                markerStatus = markerManager.update();
                if (!markerStatus) return;

                // Remove the div that corresponds to removed markers
                markerStatus.removed.forEach((abstractMarker: any) => {
                    const markerDiv = markerLogicContainer[abstractMarker.id];
                    delete markerLogicContainer[abstractMarker.id];
                    markerContainer.removeChild(markerDiv);
                });

                // Update the div that corresponds to updated markers
                markerStatus.updated.forEach((abstractMarker: any) => {
                    const markerDiv = markerLogicContainer[abstractMarker.id];
                    updateMarkerDiv(abstractMarker, markerDiv);
                });

                // Create the div that corresponds to the new markers
                markerStatus.new.forEach((abstractMarker: any) => {
                    const markerDiv = makeMarker(abstractMarker);
                    markerLogicContainer[abstractMarker.id] = markerDiv;
                    markerContainer.appendChild(markerDiv);
                });
            }

            const softUpdateMarkers = () => {
                // A previous run of .update() yieding no result or not being ran at all
                // would stop the soft update
                if (!markerStatus) return;

                markerStatus.updated.forEach((abstractMarker: any) => {
                    markerManager.softUpdateAbstractMarker(abstractMarker);
                    const markerDiv = markerLogicContainer[abstractMarker.id];
                    updateMarkerDiv(abstractMarker, markerDiv);
                })

                markerStatus.new.forEach((abstractMarker: any) => {
                    markerManager.softUpdateAbstractMarker(abstractMarker);
                    const markerDiv = markerLogicContainer[abstractMarker.id];
                    updateMarkerDiv(abstractMarker, markerDiv);
                })
            }
            console.log(softUpdateMarkers, updateMarkers)
            // While moving the map, this event is triggered many times per seconds
            // so we only perform a soft update (that could be debounced)
            // map.on("move", softUpdateMarkers);

            // When done moving, we perform a full update
            // map.on("moveend", updateMarkers)

            // Full update at init
            // updateMarkers();
        })()


        function makeMarker(abstractMarker: any) {
            const marker = document.createElement("div");
            marker.classList.add("marker");
            marker.classList.add('fade-in-animation');
            marker.style.setProperty("width", `${abstractMarker.size[0]}px`);
            marker.style.setProperty("height", `${abstractMarker.size[1]}px`);
            marker.style.setProperty("transform", `translate(${abstractMarker.position[0]}px, ${abstractMarker.position[1]}px)`);

            const feature = abstractMarker.features[0];

            marker.innerHTML = `
    <div class="markerPointy"></div>
    <div class="markerBody">

      <div class="markerTop">
        ${feature.properties["name:en"] || feature.properties["name"]}
      </div>

      <div class="markerBottom">
        <ul>
          <li><b>Name:</b> ${feature.properties.name}</li>
          <li><b>Class:</b> ${feature.properties.class}</li>
          <li><b>Rank:</b> ${feature.properties.rank}</li>
        </ul>
      </div>
    </div>
  `
            return marker;
        }

        function updateMarkerDiv(abstractMarker: any, marker: any) {
            marker.style.setProperty("width", `${abstractMarker.size[0]}px`);
            marker.style.setProperty("height", `${abstractMarker.size[1]}px`);
            marker.style.setProperty("transform", `translate(${abstractMarker.position[0]}px, ${abstractMarker.position[1]}px)`);
        }
    }
}