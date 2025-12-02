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
            style: MapStyle.BASIC,
            zoom: 5,
            center: [113.5, 34.4],
            // projection: 'globe',
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
        const temperatureLayer = new TemperatureLayer();
        const radarLayer = new RadarLayer({ id: 'Radar' });
        const precipitationLayer = new PrecipitationLayer({ id: 'Precipitation' });

        map.on('load', function () {
            map.setPaintProperty("Water", 'fill-color', "rgba(0, 0, 0, 0.4)");
            map.addLayer(windLayer, 'Water');


            map.addLayer(temperatureLayer, 'Temperature');
            map.addLayer(radarLayer, 'Radar');
            map.addLayer(precipitationLayer, 'Precipitation');
        });

        // timeSlider.addEventListener("input", (evt) => {
        //     weatherLayer.setAnimationTime(parseInt((timeSlider.value / 1000).toString()))
        // });

        // Event called when all the datasource for the next days are added and ready.
        // From now on, the layer nows the start and end dates.
        // weatherLayer.on("sourceReady", event => {
        //     const startDate = weatherLayer.getAnimationStartDate();
        //     const endDate = weatherLayer.getAnimationEndDate();
        //     const currentDate = weatherLayer.getAnimationTimeDate();
        //     refreshTime()

        //     timeSlider.min = +startDate;
        //     timeSlider.max = +endDate;
        //     timeSlider.value = +currentDate;
        // });

        // // Called when the animation is progressing
        // weatherLayer.on("tick", event => {
        //     refreshTime();
        //     updatePointerValue(pointerLngLat);
        // });

        // // Called when the time is manually set
        // weatherLayer.on("animationTimeSet", event => {
        //     refreshTime()
        // });

        // When clicking on the play/pause
        // let isPlaying = false;
        // playPauseButton.addEventListener("click", () => {
        //     if (isPlaying) {
        //         weatherLayer.animateByFactor(0);
        //         playPauseButton.innerText = "Play 3600x";
        //     } else {
        //         weatherLayer.animateByFactor(3600);
        //         playPauseButton.innerText = "Pause";
        //     }

        //     isPlaying = !isPlaying;
        // });

        // Update the date time display
        // function refreshTime() {
        //     const d = weatherLayer.getAnimationTimeDate();
        //     timeTextDiv.innerText = d.toString();
        //     timeSlider.value = +d;
        // }

        // map.on('mouseout', function (evt) {
        //     if (!evt.originalEvent.relatedTarget) {
        //         pointerDataDiv.innerText = "";
        //         pointerLngLat = null;
        //     }
        // });

        // function updatePointerValue(lngLat: any) {
        //     if (!lngLat) return;
        //     pointerLngLat = lngLat;
        //     const value = weatherLayer.pickAt(lngLat.lng, lngLat.lat);
        //     if (!value) {
        //         pointerDataDiv.innerText = "";
        //         return;
        //     }
        //     pointerDataDiv.innerText = `${value.speedMetersPerSecond.toFixed(1)} m/s`
        // }

        // map.on('mousemove', (e: any) => {
        // updatePointerValue(e.lngLat);
        // });
        map.on("style.load", () => {
            console.log("style loaded, modify labels");
            map.setLayoutProperty("country-label", "text-field", [
                "case",
                ["==", ["get", "iso_3166_1"], "TW"],
                "台湾",
                ["get", "name"]
            ]);
        });
        map.on('load', async () => {
            // 示例：假设 MapTiler 样式中包含名为 "Boundary line" 的图层
            // 您需要根据您使用的具体样式来确定图层ID
            const boundaryLayerIds = ["Boundary line", "Country border"]; // 示例图层ID

            boundaryLayerIds.forEach(id => {

                if (map.getLayer(id)) {
                    map.setLayoutProperty(id, 'visibility', 'none');
                }
            });

            const data = await fetch('https://geojson.cn/api/china/1.6.2/china.json').then(res => res.json());
            console.log('data', data);

            map.addSource('custom-china-boundary', {
                type: 'geojson',
                data: data // 您的自定义数据
            });

            const labelLayerId = 'Place labels'; // 示例图层 ID，您可能需要替换
            console.log('map.getLayer(labelLayerId)', map.getLayer(labelLayerId))

            if (map.getLayer(labelLayerId)) {
                // 构建新的 'text-field' 表达式
                // 表达式逻辑：如果 'name' 属性是 '中華民國' (或 'Republic of China' / 'Taiwan, Province of China' 等), 则显示 '臺灣' (或 '台湾')，否则保持原样。

                const originalTextField = map.getLayoutProperty(labelLayerId, 'text-field');

                // 使用 'case' 表达式进行替换
                const newTextField = [
                    'case',
                    // 检查原始属性（这里假设是 'name' 属性）
                    ['==', ['get', 'name'], '中華民國'], '臺灣',
                    ['==', ['get', 'name'], 'Republic of China'], 'Taiwan',
                    ['==', ['get', 'name'], 'Taiwan, Province of China'], 'Taiwan',

                    // 默认值：使用原始的 text-field 设置
                    originalTextField || ['get', 'name']
                ];

                // 应用新的表达式到图层
                map.setLayoutProperty(labelLayerId, 'text-field', newTextField);

                console.log("地图标签已修改：中華民國 -> 臺灣");
            } else {
                console.error(`无法找到标签图层: ${labelLayerId}`);
            }

            // 3. 添加 Layer 来渲染边界线
            // map.addLayer({
            //     id: 'custom-china-line',
            //     type: 'line',
            //     source: 'custom-china-boundary',
            //     paint: {
            //         'line-color': '#003CFF', // 边界线颜色
            //         'line-width': 2         // 边界线宽度
            //     }
            // }, 'water');

            // ... 继续步骤三：添加您的自定义 GeoJSON
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

            // While moving the map, this event is triggered many times per seconds
            // so we only perform a soft update (that could be debounced)
            map.on("move", softUpdateMarkers);

            // When done moving, we perform a full update
            map.on("moveend", updateMarkers)

            // Full update at init
            updateMarkers();
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