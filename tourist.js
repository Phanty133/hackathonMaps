const apiKey = "LNCdN7WjGR4hrb0aWcycP-1BHvC4PcYumIaD2e3KA3I";
let objects;
let platform;
let map;
let markerGroup;
let infoBubble;

function loadObjects(){
	return new Promise((resolve, reject) => {
		const req = new XMLHttpRequest();

		req.onreadystatechange = function(){
			if(this.readyState === 4){
				if(this.status === 200){
					const registerSet = new Set(JSON.parse(this.responseText));
					resolve(registerSet);
				}
				else{
					reject({status: this.status, text: this.statusText});
				}
			}
		}

		req.open("GET", "objects.json");
		req.send();
	});
}

function init(){
	loadObjects().then((data)=>{
		objects = data;
		console.log("Objects loaded!");

		document.getElementById("modalBG").style.display = "none";
	}).catch((err)=>{
		console.error(err);

		const msgEl = document.getElementById("loadingMessage");
		msgEl.className = "error";
		msgEl.innerText = `${err.status} ${err.text}`;
	});

	initMap();
	document.getElementById("submitBtn").addEventListener("click", searchHandler);
	document.getElementById("objInput").addEventListener("keyup", (e)=>{
		if(e.keyCode === 13){
			document.getElementById("submitBtn").click();
		}
	});
}

function initMap(){
	platform = new H.service.Platform({
		'apikey': apiKey
	});

	let defaultLayers = platform.createDefaultLayers();
	map = new H.Map(
		document.getElementById("mapContainer"), 
		defaultLayers.vector.normal.map,
		{
			zoom: 8,
			center: {lng: 24.5, lat: 56.86}
		}
	);

	window.addEventListener('resize', () => map.getViewPort().resize());
	let ui = H.ui.UI.createDefault(map, defaultLayers);
	new H.mapevents.Behavior(new H.mapevents.MapEvents(map));

	markerGroup = new H.map.Group();
	map.addObject(markerGroup);

	markerGroup.addEventListener("tap", (e)=>{
		if(infoBubble){
			infoBubble.close();
		}

		infoBubble = new H.ui.InfoBubble(e.target.getGeometry(), {
			content: e.target.getData()
		});

		ui.addBubble(infoBubble);
	}, false);
}

function searchHandler(){
	showSearchLoader();

	const objCount = parseInt(document.getElementById("objInput").value);
	const useCurrentLocation = document.getElementById("locationInput").checked;

	if(objCount === undefined || objCount === 0 || isNaN(objCount) || objCount < 0) {
		showSearchLoader(false);
		return;
	}

	const waypoints = [];

	markerGroup.removeObjects(markerGroup.getObjects());

	getCurPos(useCurrentLocation).then((pos)=>{
		if(pos !== undefined){
			waypoints.push({
				type: "curLocation",
				properties: {
					Name: "Atrašanās vieta",
					description: "Jūsu pašreizējā atrašanās vieta."
				},
				geometry: {
					coordinates: [pos.coords.longitude, pos.coords.latitude]
				}
			})
		}

		waypoints.push(...selectRandomEntries(objects, objCount));

		let i = 0;
		waypoints.forEach((obj)=>{
			showObjectOnMap(obj);
			if(++i === waypoints.length){
				showSearchLoader(false);
			}
		});

		generateRoute(waypoints);
	}).catch(console.error)
}

function getCurPos(getPos = false){
	return new Promise((resolve)=>{
		if(!getPos){
			resolve();
		}
		else{
			navigator.geolocation.getCurrentPosition(resolve, ()=>{
				resolve(undefined);
			});
		}
	});
}

function randomInt(min, max){
	return Math.round(Math.random() * (max - min) + min);
}

function selectRandomEntries(data, count){
	let dataCopy = [...data];
	const output = [];

	while(output.length !== count){
		output.push(dataCopy.splice(randomInt(0, dataCopy.length - 1), 1)[0]);
	}

	return output;
}

function generateRoute(waypoints){
	const waypointCoord = waypoints.map(entry=>`${entry.geometry.coordinates[1]},${entry.geometry.coordinates[0]}`);
	waypointCoord.push(waypointCoord[0]);

	const router = platform.getRoutingService(null, 8);
	let coordClone = [...waypointCoord];
	let totalTime = 0;
	let totalDistance = 0;
	let totalRequests = 0;
	let processedRequests = 0;

	while(coordClone.length !== 0){
		let options = {
			'routingMode': 'fast',
			'transportMode': 'car',
			'return': 'polyline,summary',
			"origin": coordClone.shift()
		};

		if(coordClone.length === 1){
			options.destination = coordClone.shift();
		}
		else if(coordClone.length === 2){
			options.via = coordClone.shift();
			options.destination = coordClone.shift();
		}
		else{
			options.via = coordClone.shift();
			options.destination = coordClone[0];
		}

		totalRequests++;

		router.calculateRoute(options, (result)=>{
			renderRoute(result);
			for(const section of result.routes[0].sections){
				totalTime+=section.summary.duration;
				totalDistance+=section.summary.length;
			}

			if(++processedRequests === totalRequests){
				showTravelInfo(totalTime, totalDistance);
			}
		});
	}
}

function renderRoute(result){
	if (result.routes.length) {
		result.routes[0].sections.forEach((section) => {
			// Create a linestring to use as a point source for the route line
			let linestring = H.geo.LineString.fromFlexiblePolyline(section.polyline);
		
			// Create a polyline to display the route:
			let routeLine = new H.map.Polyline(linestring, {
				style: { strokeColor: 'blue', lineWidth: 3 }
			});
		
			// Add the route polyline and the two markers to the map:
			markerGroup.addObject(routeLine);
		
			// Set the map's viewport to make the whole route visible:
			map.getViewModel().setLookAtData({bounds: routeLine.getBoundingBox()});
		});
	}
}

function showTravelInfo(time, dist){
	document.getElementById("routeTimeText").style.display = "block";
	document.getElementById("routeDistText").style.display = "block";

	document.getElementById("routeDist").innerText = Math.round(dist / 10) / 100;

	let timeHours = Math.floor(time / 3600);
	let timeMinutes = Math.floor((time - 3600 * timeHours) / 60);

	document.getElementById("routeTime").innerText = `${timeHours}h ${timeMinutes}min`;
}

function showSearchLoader(show = true){
	const el = document.getElementById("searchLoader");

	if(show){
		el.style.display = "inline-block";
	}
	else{
		el.style.display = "none";
	}
}

function showObjectOnMap(object){
	const infoContainer = document.createElement("div");
	infoContainer.className = "infoContainer";

	const title = document.createElement("span");
	title.innerText = object.properties.Name;
	title.className = "infoTitle";
	infoContainer.appendChild(title);

	const desc = document.createElement("div");
	desc.innerHTML = "<br/>" + object.properties.description;
	infoContainer.appendChild(desc);

	const coord = object.geometry.coordinates;
	markerGroup.addObject(new H.map.Marker({lng: coord[0], lat: coord[1]}, {data: infoContainer}));
}

init();
