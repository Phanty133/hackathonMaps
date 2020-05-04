const apiKey = "LNCdN7WjGR4hrb0aWcycP-1BHvC4PcYumIaD2e3KA3I";
let register;
let platform;
let map;
let markerGroup;
let infoBubble;

function loadRegister(){
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

		req.open("GET", "register.json");
		req.send();
	});
}

function init(){
	loadRegister().then((data)=>{
		register = data;
		console.log("Register loaded!");

		document.getElementById("modalBG").style.display = "none";
	}).catch((err)=>{
		console.error(err);

		const msgEl = document.getElementById("loadingMessage");
		msgEl.className = "error";
		msgEl.innerText = `${err.status} ${err.text}`;
	});

	initMap();
	document.getElementById("searchBtn").addEventListener("click", searchHandler);
	document.getElementById("nameInput").addEventListener("keyup", (e)=>{
		if(e.keyCode === 13){
			document.getElementById("searchBtn").click();
		}
	});
}

function searchNameInRegister(sub){
	const outputSet = new Set();
	const alsoTerminated = document.getElementById("currentInput").checked;

	for(const entry of register){
		if(entry.name === undefined) continue; 

		const name = entry.name.toString().toLowerCase();
		const index = name.indexOf(sub.toLowerCase());

		if(index !== -1){
			if(
				(index === 0 || !name.charAt(index - 1).match(/[a-z]/i))
				&& (index === name.length - 1 || !name.charAt(index + sub.length).match(/[a-zēūīāšķļžčņ]/i))
			){
				if(alsoTerminated || (!alsoTerminated && entry.terminated === "")){
					outputSet.add(entry);
				}
			}
		}
	}

	return outputSet;
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

	const query = document.getElementById("nameInput").value;
	const checkOtherCases = document.getElementById("caseInput").checked;
	let dataset = new Set();

	if(checkOtherCases){
		const possibleCases = generatePossibleNameCases(query);
		
		for(const nameCase of possibleCases){
			searchNameInRegister(nameCase).forEach(item => dataset.add(item));
		}
	}
	else{
		dataset = searchNameInRegister(query);
	}

	markerGroup.removeObjects(markerGroup.getObjects());

	if(dataset.size === 0) showSearchLoader(false);

	let i = 0;
	dataset.forEach((business) => {
		showBusinessOnMap(business);
		if(++i === dataset.size){
			showSearchLoader(false);
		}
	});

	document.getElementById("businessFound").style.display = "block";
	document.getElementById("businessCount").innerText = dataset.size;
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

function generatePossibleNameCases(name){
	const possibleCases = [name];
	const declination = getNameDeclination(name);
	let base = name.substring(0, name.length - 1);

	if(declination === 2 || declination === 3){
		base = name.substring(0, name.length - 2);
	}

	switch(declination){
		case 1:
			possibleCases.push(
				`${base}a`,
				`${base}am`,
				`${base}u`,
				`${base}ā`
			);
			break;
		case 2:
			let softBase = base;

			switch(base.slice(-1)){
				case "n":
					softBase = `${base.substring(0, base.length - 1)}ņ`
					break;
				case "k":
					softBase = `${base.substring(0, base.length - 1)}ķ`
					break;
				case "s":
					softBase = `${base.substring(0, base.length - 1)}š`
					break;
			}

			possibleCases.push(
				`${softBase}a`,
				`${base}im`,
				`${base}i`,
				`${base}ī`
			);
			break;
		case 3:
			possibleCases.push(
				`${base}um`,
				`${base}u`,
				`${base}ū`
			);
			break;
		case 4:
			possibleCases.push(
				`${base}as`,
				`${base}ai`,
				`${base}u`,
				`${base}ā`
			);
			break;
		case 5:
			possibleCases.push(
				`${base}es`,
				`${base}ei`,
				`${base}i`,
				`${base}ē`
			);
			break;
	}

	return possibleCases;
}

function getNameDeclination(name){ // Returns 1 - 6
	switch(name.slice(-1)){ // Check last letter
		case "s":
			switch(name.slice(-2)){ // Check last 2 letters
				case "is":
					return 2;
				case "us":
					return 3;
				default:
					return 1;
			}
		case "a":
			return 4;
		case "e":
			return 5;
		default:
			return 1;
	}
}

function showBusinessOnMap(business){
	let service = platform.getSearchService();

	service.geocode({
		q: business.address
	}, (result) => {
		if(result.items.length !== 0){
			const infoContainer = document.createElement("div");
			infoContainer.className = "infoContainer";

			const title = document.createElement("span");
			title.innerText = business.name;
			title.className = "infoTitle";
			infoContainer.appendChild(title);

			const regNum = document.createElement("span");
			regNum.innerHTML = `<b>Reģistrācijas numurs: </b>${business.regcode}`;
			infoContainer.appendChild(regNum);

			const regDate = new Date(business.registered);

			const registeredDate = document.createElement("span");
			registeredDate.innerHTML = `<b>Reģistrēts:</b> ${regDate.toLocaleDateString()}`;
			infoContainer.appendChild(registeredDate);

			if(business.terminated !== ""){
				const termDate = new Date(business.terminated);

				const terminatedDate = document.createElement("span");
				terminatedDate.innerHTML = `<b>Likvidēts:</b> ${termDate.toLocaleDateString()}`;
				infoContainer.appendChild(terminatedDate);
			}

			const address = document.createElement("span");
			address.innerHTML = `<b>Adrese: </b> ${business.address}`;
			infoContainer.appendChild(address);

			markerGroup.addObject(new H.map.Marker(result.items[0].position, {data: infoContainer}));
		}
	});
}

init();