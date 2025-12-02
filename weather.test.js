import { Map, MapStyle, config } from '@maptiler/sdk';
import '@maptiler/sdk/dist/maptiler-sdk.css';
import { MarkerLayout } from '@maptiler/marker-layout';

const appContainer = document.getElementById('map');

config.apiKey = 'YOUR_MAPTILER_API_KEY_HERE';

// Creating a map
const map = new Map({
    container: appContainer,
    style: MapStyle.STREETS,
    zoom: 9.14,
    center: [13.3608, 52.5478],
});

// Creating the div that will contain all the markers
const markerContainer = document.createElement("div");
appContainer.appendChild(markerContainer);

(async () => {
    await map.onReadyAsync();

    const markerManager = new MarkerLayout(map, {
        layers: ["Capital city labels", "City labels", "Place labels", "Town labels"],
        markerSize: [140, 80],
        markerAnchor: "top",
        offset: [0, -8], // so that the tip of the marker bottom pin lands on the city dot
        sortingProperty: "rank",

        // no filtering so that we get as many features as possible
    });

    // This object contains the marker DIV so that they can be updated rather than fully recreated every time
    const markerLogicContainer = {};

    let markerStatus = null;

    // This function will be used as the callback for some map events
    const updateMarkers = () => {
        markerStatus = markerManager.update();

        if (!markerStatus) return;

        // Remove the div that corresponds to removed markers
        markerStatus.removed.forEach((abstractMarker) => {
            const markerDiv = markerLogicContainer[abstractMarker.id];
            delete markerLogicContainer[abstractMarker.id];
            markerContainer.removeChild(markerDiv);
        });

        // Update the div that corresponds to updated markers
        markerStatus.updated.forEach((abstractMarker) => {
            const markerDiv = markerLogicContainer[abstractMarker.id];
            updateMarkerDiv(abstractMarker, markerDiv);
        });

        // Create the div that corresponds to the new markers
        markerStatus.new.forEach((abstractMarker) => {
            const markerDiv = makeMarker(abstractMarker);
            markerLogicContainer[abstractMarker.id] = markerDiv;
            markerContainer.appendChild(markerDiv);
        });
    }

    const softUpdateMarkers = () => {
        // A previous run of .update() yieding no result or not being ran at all
        // would stop the soft update
        if (!markerStatus) return;

        markerStatus.updated.forEach((abstractMarker) => {
            markerManager.softUpdateAbstractMarker(abstractMarker);
            const markerDiv = markerLogicContainer[abstractMarker.id];
            updateMarkerDiv(abstractMarker, markerDiv);
        })

        markerStatus.new.forEach((abstractMarker) => {
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


function makeMarker(abstractMarker) {

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

function updateMarkerDiv(abstractMarker, marker) {
    marker.style.setProperty("width", `${abstractMarker.size[0]}px`);
    marker.style.setProperty("height", `${abstractMarker.size[1]}px`);
    marker.style.setProperty("transform", `translate(${abstractMarker.position[0]}px, ${abstractMarker.position[1]}px)`);
}