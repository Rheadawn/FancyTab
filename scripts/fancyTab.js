window.onload = loadWindow

//---LOAD_WINDOW---/////////////////////////////////////////////////////////////////////////////////////////////////////
async function loadWindow(){
    await setSavedSettings()
    openDataBase()
    setEventListeners()
    updateClock()
    updateSearchBar()
    updateWeatherInfo()
}



//--EVENT_LISTENERS---//////////////////////////////////////////////////////////////////////////////////////////////////
let colorOn = true
let refreshBackgroundImageOn = true
let currentBackgroundImage
let shortcutURL = ["https://twitch.tv", "https://overleaf.com", "https://youtube.com", "https://github.com", "https://gitlab.com"]
let shortcutImage = ["../images/twitchShortcut.svg", "../images/overleafShortcut.svg", "../images/youtubeShortcut.svg", "../images/githubShortcut.svg", "../images/gitlabShortcut.svg"]
let selectedShortcutIndex;

function setEventListeners(){
    //Event Listener for the POWER BUTTON
    document.getElementById("powerButton").addEventListener("click", (event) => {window.close()})

    //Event Listeners for everything BACKGROUND IMAGE related
    document.getElementById("colorButton").addEventListener("click", (event) => {
        colorOn = !colorOn
        chrome.storage.sync.set({ "colorOn": colorOn }).then(() => {});
        document.getElementById("colorButton").src = colorOn? "../images/colorOn.svg" : "../images/colorOff.svg"
        updateImageColor()
    })
    document.getElementById("refreshButton").addEventListener("click", async (event) => {
        refreshBackgroundImageOn = !refreshBackgroundImageOn
        chrome.storage.local.set({ "refreshBackgroundImageOn": refreshBackgroundImageOn }).then(() => {});
        document.getElementById("refreshButton").src = refreshBackgroundImageOn? "../images/imageRefreshOn.svg" : "../images/imageRefreshOff.svg"
        if (refreshBackgroundImageOn){
            let image = document.getElementById("backgroundImage")
            image.style.backgroundImage = `url(${await fetchRandomImage()})`
            fetchRandomImage()
        } 
        if (currentBackgroundImage) saveImageToDB(currentBackgroundImage)
    })
    
    //Event Listeners for everything SEARCH BAR related
    document.getElementById("searchBarButton").addEventListener("click", (event) => {searchBarOnClick()})
    document.getElementById("searchBarField").addEventListener("keydown", (event) => {if(event.key === "Enter"){searchBarOnClick()}})

    //Event Listeners for everything SETTINGS related
    document.getElementById("settingsIcon").addEventListener("click", (event) => {toggleSettings()})
    document.getElementById("userNameInput").addEventListener("change", (event) => {updateUserName(false)})
    let languageButtons = document.querySelectorAll("#language button")
    languageButtons.forEach((element, index) => {element.addEventListener("click", (event) => {updateLanguage(element.innerText, false)})})
    let unitMeasureButtons = document.querySelectorAll("#measureUnit button")
    unitMeasureButtons.forEach((element, index) => {element.addEventListener("click", (event) => {updateMeasureUnit(element.innerText, false)})})
    let colorSchemeButtons = document.querySelectorAll("#colorScheme button")
    colorSchemeButtons.forEach((element, index) => {element.addEventListener("click", (event) => {updateColorScheme(element.innerText, false)})})
    let searchEngineImages = document.querySelectorAll("#searchEngine img")
    searchEngineImages.forEach((element, index) => {element.addEventListener("click", (event) => {updateSearchEngine(element.id, false)})})
    
    //Event Listeners for everything SHORTCUT related
    let shortcuts = document.querySelectorAll("div.shortcutImage")
    shortcuts.forEach((element, index) => {element.addEventListener("click",(event) => {window.open(shortcutURL[index], window.name)})})
    shortcuts.forEach((element, index) => {element.addEventListener("contextmenu",(event) => {
        event.preventDefault()
        if(settingsActive) toggleSettings()
        let dialog = document.getElementById("shortcutDialog")
        dialog.open && (selectedShortcutIndex === index)? dialog.close() : dialog.show()
        selectedShortcutIndex = index
        document.getElementById("shortcutURLInput").value = shortcutURL[index]
    })})
    document.getElementById("shortcutURLInput").addEventListener("change", (event) => {
        if(event.target.checkValidity()){
            shortcutURL[selectedShortcutIndex] = event.target.value
            chrome.storage.local.set({ "shortcutURL": JSON.stringify(shortcutURL) }).then(() => {});
        }
    })
    document.getElementById("shortcutImageInput").addEventListener("change", async (event) => {
        let imageBase64 = await imageToBase64(event.target.files[0])
        shortcutImage[selectedShortcutIndex] = imageBase64
        shortcuts[selectedShortcutIndex].style.backgroundImage = `url(${imageBase64})`
        chrome.storage.local.set({ "shortcutImage": JSON.stringify(shortcutImage) }).then(() => {});
    })
    
    //Event Listener for changes to chrome SYNC STORAGE
    chrome.storage.onChanged.addListener((changes) => {setSavedSettings()})
}



//---CREDENTIALS---/////////////////////////////////////////////////////////////////////////////////////////////////////
async function getCredentials() {
    let apiCredentialsResponse = await fetch("../config.json")
     return await apiCredentialsResponse.json()
}



//---SHORTCUTS---///////////////////////////////////////////////////////////////////////////////////////////////////////
function imageToBase64(image){
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result)
        reader.onerror = reject
        reader.readAsDataURL(image);
    })
}



//---LOCAL_STORAGE---///////////////////////////////////////////////////////////////////////////////////////////////////
let db;
function openDataBase(){
    let request = indexedDB.open("localStorage")
    
    //Creating schema when opening db for first time
    request.onupgradeneeded = (event) => {
        let newDb = event.target.result
        newDb.createObjectStore("images")

        let image = document.getElementById("backgroundImage")
        image.style.backgroundImage = `url(../images/defaultBackgroundImage.jpg)`
    };
    
    //Handling success upon opening db
    request.onsuccess = (event) => {
        db = event.target.result
        loadImageFromDB()
    };
}

function loadImageFromDB(){
    let transaction = db.transaction(["images"], "readwrite");
    let imageStore = transaction.objectStore("images");
    let request = imageStore.get("image")
    let image = document.getElementById("backgroundImage")
    
    request.onerror = (event) => {
        setDefaultImage()
        if(refreshBackgroundImageOn){
            fetchRandomImage()
        }
    }
    
    request.onsuccess = (event) => {
        (request.result === undefined)? setDefaultImage() : image.style.backgroundImage = `url(${URL.createObjectURL(request.result)})`
        currentBackgroundImage = request.result
        if(refreshBackgroundImageOn){
            fetchRandomImage()
        }
    }
}

function saveImageToDB(blob){
    let transaction = db.transaction(["images"], "readwrite");
    let imageStore = transaction.objectStore("images");

    imageStore.put(blob, "image")
}



//---BACKGROUND_IMAGE---////////////////////////////////////////////////////////////////////////////////////////////////
function setDefaultImage(){
    let image = document.getElementById("backgroundImage")
    image.style.backgroundImage = `url(../images/defaultBackgroundImage.jpg)`
}

async function fetchRandomImage(){
    let credentials = await getCredentials()
    let imageResponse = await (await fetch(`https://api.unsplash.com/photos/random?client_id=${credentials.imageAPI.accessKey}&orientation=landscape&query=wallpaper,nature,animals`)).json()
    let imageURL = imageResponse.urls.raw + "&w=1920&h=1080";
    imageURLToBlobAndSave(imageURL)
    return imageURL
}

function imageURLToBlobAndSave(src) {
    fetch(src)
        .then(response => response.blob())
        .then(blob => {
            const reader = new FileReader()
            reader.readAsDataURL(blob)
            saveImageToDB(blob)
        })
}

function updateImageColor(){
    let image = document.getElementById("backgroundImage")
    if(colorOn){
        image.style.filter = `grayscale(0%)`
    }else{
        image.style.filter = `grayscale(100%)`
    }
}



//---CLOCK_UPDATE---////////////////////////////////////////////////////////////////////////////////////////////////////
function updateClock(){
    let date = new Date();

    let hours = date.getHours().toString().padStart(2, '0');
    let minutes = date.getMinutes().toString().padStart(2, '0');
    let weekday = date.toLocaleDateString('en-US', { weekday: 'long' });
    let day = date.getDate().toString().padStart(2, `0`)
    let month = (date.getMonth() + 1).toString().padStart(2, `0`)
    let year = date.getFullYear()
    
    let clockTime = document.getElementById("time")
    let clockDay = document.getElementById("day")
    let clockDate = document.getElementById("date")
    
    clockTime.innerText = `${hours}:${minutes}`
    clockDay.innerText = weekday
    clockDate.innerText = `${day}.${month}.${year}`
}



//---WEATHER_INFO---////////////////////////////////////////////////////////////////////////////////////////////////////
async function updateWeatherInfo(){
    let credentials = await getCredentials()
    let accessKey = credentials.weatherAPI.accessKey
    navigator.geolocation.getCurrentPosition(
        (position) => onGeolocationSuccess(position, accessKey),
        (positionError) => onGeolocationError(positionError, accessKey)
    )
}

async function onGeolocationSuccess(position, accessKey){
    let lat = position.coords.latitude
    let lon = position.coords.longitude
    let weatherInfo = await (await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${measureUnit.toLowerCase()}&lang=${languageCode}&appid=${accessKey}`)).json()
    displayWeatherInfo(weatherInfo)
    let forecast = await (await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${measureUnit.toLowerCase()}&lang=${languageCode}&appid=${accessKey}`)).json()
    displayForecast(forecast)
}

async function onGeolocationError(positionError, accessKey){ // On Error default location: Reken
    let weatherInfo = await (await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=51.8306&lon=7.0443&units=${measureUnit.toLowerCase()}&lang=${languageCode}&appid=${accessKey}`)).json()
    displayWeatherInfo(weatherInfo)
    let forecast = await (await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=51.8306&lon=7.0443&units=${measureUnit.toLowerCase()}&lang=${languageCode}&appid=${accessKey}`)).json()
    displayForecast(forecast)
}

function displayWeatherInfo(weatherInfo){
    let icon = document.getElementById("weatherIcon")
    setWeatherIcon(icon, weatherInfo.weather[0].id)
    setDayCycleIcon(weatherInfo)
    
    let tempActual = weatherInfo.main.temp.toFixed(1)
    let tempFeels = weatherInfo.main.feels_like.toFixed(1)
    let tempMax = weatherInfo.main.temp_max.toFixed(1)
    let tempMin = weatherInfo.main.temp_min.toFixed(1)
    let humidity = weatherInfo.main.humidity
    let cityName = weatherInfo.name
    let weatherDescription = weatherInfo.weather[0].main
    let windSpeed = weatherInfo.wind.speed
    let windDirection = weatherInfo["wind"]["deg"]
    let visibility = weatherInfo.visibility / 1000
    let rainInMM = "rain" in weatherInfo ? weatherInfo["rain"]["1h"].toFixed(0) : ""
    let snowInMM = "snow" in weatherInfo ? weatherInfo["snow"]["1h"].toFixed(0) : ""
    
    document.getElementById("amountOfRain").innerText = (rainInMM !== "")? `${rainInMM}mm` : `${snowInMM}mm`
    document.getElementById("amountOfRain").style.visibility = (rainInMM !== "" || snowInMM !== "")? "visible" : "hidden"
    document.getElementById("weatherDescription").innerText = (selectedLanguage === "English")? weatherDescription : convertWeatherDescriptionToGerman(weatherDescription)
    document.getElementById("weatherLocation").innerText = cityName
    document.getElementById("minTemp").innerText = `MIN ${tempMin}${temperatureUnit}`
    document.getElementById("maxTemp").innerText = `MAX ${tempMax}${temperatureUnit}`
    document.getElementById("actualTemp").innerText = `${tempFeels}${temperatureUnit}`
    document.getElementById("feelsLikeTemp").innerText = `FEELS LIKE ${tempActual}${temperatureUnit}`
    document.getElementById("windDirectionText").innerText = `${windDirection}°`
    document.getElementById("windDirectionIcon").style.transform = `rotate(${windDirection}deg)`
    document.getElementById("windSpeedText").innerText = `${windSpeed} ${speedUnit}`
    document.getElementById("humidityText").innerText = `${humidity}%`
    document.getElementById("visibilityText").innerText = `${visibility} km`
}

let daysOfTheWeekEnglish = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"]
let daysOfTheWeekGerman = ["SO", "MO", "DI", "MI", "DO", "FR", "SA"]
function displayForecast(forecast){
    let forecastIcons = document.querySelectorAll("#forecastDays span")
    forecastIcons.forEach((element, index) => {
        setWeatherIcon(element, forecast.list[index].weather[0].id)
    })
    
    let dayArray = (selectedLanguage === "English")? daysOfTheWeekEnglish : daysOfTheWeekGerman
    let currentDayIndex = (new Date()).getDay()
    let forecastDays = document.querySelectorAll("#forecastDays p.forecastDayName")
    forecastDays.forEach((element, index) => {
        element.innerText = dayArray[(index + currentDayIndex + 1) % 7]
    })
    
    let forecastDescriptions = document.querySelectorAll("#forecastDays p.forecastDayDescription")
    forecastDescriptions.forEach((element, index) => {
        let description = forecast.list[index].weather[0].main
        element.innerText = (selectedLanguage === "English")? description : convertWeatherDescriptionToGerman(description) 
    })
    
    document.getElementById("forecastText").innerText = (selectedLanguage === "English")? "5-DAY FORECAST" : "5-TAGE VORSCHAU"
}

function convertWeatherDescriptionToGerman(description){
    switch(description){
        case "Thunderstorm" : return "Gewitter";
        case "Drizzle" : return "Fissel";
        case "Rain" : return "Regen";
        case "Snow" : return "Schnee";
        case "Mist" : return "Nebel";
        case "Smoke" : return "Rauch";
        case "Haze" : return "Dunst";
        case "Dust" : return "Staub";
        case "Fog" : return "Nebel";
        case "Sand" : return "Sand";
        case "Ash" : return "Asche";
        case "Squall" : return "Böen";
        case "Tornado" : return "Tornado";
        case "Clear" : return "Klar";
        case "Clouds" : return "Wolken";
    }
}

function setWeatherIcon(icon, weatherCode){
    switch(true){
        case (weatherCode >= 200) && (weatherCode < 300): return icon.innerText = "thunderstorm"
        case (weatherCode >= 300) && (weatherCode < 400): return icon.innerText = "weather_mix"
        case (weatherCode >= 500) && (weatherCode < 600): return icon.innerText = "rainy"
        case (weatherCode >= 600) && (weatherCode < 700): return icon.innerText = "cloudy_snowing"
        case (weatherCode >= 700) && (weatherCode < 800): return icon.innerText = "mist"
        case (weatherCode === 800): return icon.innerText = "clear_day"
        case (weatherCode >= 800) && (weatherCode < 900): return icon.innerText = "cloud"
        default: return icon.innerText = "emergency_home"
    }
}

function setDayCycleIcon(weatherInfo){
    let currentTime = weatherInfo.dt
    let sunrise = weatherInfo.sys.sunrise
    let sunset = weatherInfo.sys.sunset
    let isDayTime = (currentTime >= sunrise) && (currentTime <= sunset)
    let isBeforeMidnight = (currentTime >= sunrise) && (currentTime >= sunset)
    let percentageOfCycleOver
    let dayCycleText = document.getElementById("dayCycleText")

    if(isDayTime){ //daytime
        let dayLength = sunset - sunrise
        percentageOfCycleOver = (currentTime - sunrise) / dayLength
        dayCycleText.innerText = (selectedLanguage === "English")? "DAY CYCLE" : "TAGESZYKLUS"
    }else if(isBeforeMidnight){ //nighttime before midnight
        let nightLength = (sunrise + 86400) - sunset
        percentageOfCycleOver = (currentTime - sunset) / nightLength
        dayCycleText.innerText = (selectedLanguage === "English")? "NIGHT CYCLE" : "NACHTZYKLUS"
    }else{ //nighttime after midnight
        let nightLength = sunrise  - (sunset - 86400)
        percentageOfCycleOver = (currentTime - (sunset - 86400)) / nightLength
        dayCycleText.innerText = (selectedLanguage === "English")? "NIGHT CYCLE" : "NACHTZYKLUS"
    }
    let x = percentageOfCycleOver * 150
    let y = Math.sin((180*(1-percentageOfCycleOver)) * Math.PI / 180) * 75

    let dayCycleIcon = document.getElementById("dayCycleIcon")
    dayCycleIcon.src = isDayTime ? "../images/dayCycleIcon.svg" : "../images/nightCycleIcon.svg"
    dayCycleIcon.style.position = "absolute"
    dayCycleIcon.style.left = x + "px"
    dayCycleIcon.style.top = isDayTime ? (76 - y) + "px" : (72 - y) + "px"
}


//---SEARCH_BAR---
let searchEngine = "google"

function updateSearchBar(){
    let searchBarField = document.getElementById("searchBarField")
    updateSearchBarPlaceholder()
    
    let searchBarPosition = searchBarField.getBoundingClientRect();
    let searchBarIcon = document.getElementById("searchBarIcon")
    searchBarIcon.left = searchBarPosition.right - searchBarIcon.style.width
    searchBarIcon.top = searchBarPosition.top
}

function updateSearchBarPlaceholder(){
    let searchBarField = document.getElementById("searchBarField")
    let date = new Date();
    let hours = date.getHours()

    if(selectedLanguage === "English"){
        switch(true){
            case (hours >= 6) && (hours <= 11): return searchBarField.placeholder = `Good Morning, ${userName}. Ready to search the world?`;
            case (hours >= 12) && (hours <= 17): return searchBarField.placeholder = `Good Afternoon, ${userName}. Ready to search the world?`;
            case (hours >= 18) && (hours <= 23): return searchBarField.placeholder = `Good Evening, ${userName}. Ready to search the world?`;
            case (hours >= 0) && (hours <= 6): return searchBarField.placeholder = `Get some sleep, ${userName}. There's still tomorrow to explore the world.`;
        }
    }else{
        switch(true){
            case (hours >= 6) && (hours <= 11): return searchBarField.placeholder = `Guten Morgen, ${userName}. Bereit, die Welt zu erkunden?`;
            case (hours >= 12) && (hours <= 17): return searchBarField.placeholder = `Guten Nachmittag, ${userName}. Bereit, die Welt zu erkunden?`;
            case (hours >= 18) && (hours <= 23): return searchBarField.placeholder = `Guten Abend, ${userName}. Bereit, die Welt zu erkunden?`;
            case (hours >= 0) && (hours <= 6): return searchBarField.placeholder = `Ruhe dich aus, ${userName}. Du kannst auch morgen die Welt erkunden.`;
        }
    }
}

function searchBarOnClick(){
    let searchBarField = document.getElementById("searchBarField")
    let query = searchBarField.value
    if(query.trim() !== ""){
        switch(searchEngine){
            case "google": return window.open(`https://google.com/search?q=${query}`, window.name)
            case "ecosia": return window.open(`https://www.ecosia.org/search?method=index&q=${query}`, window.name)
            case "duckDuckGo": return window.open(`https://duckduckgo.com/?t=h_&q=${query}`, window.name)
            case "bing": return window.open(`https://www.bing.com/search?q=${query}`, window.name)
        }
        searchBarField.value = ""
    }
}



//---SETTINGS_GENERAL---////////////////////////////////////////////////////////////////////////////////////////////////
let settingsActive = false;

async function setSavedSettings(){
    chrome.storage.sync.get(["colorOn"]).then((color) => {
        if(color.colorOn !== undefined){
            colorOn = color.colorOn
            document.getElementById("colorButton").src = colorOn? "../images/colorOn.svg" : "../images/colorOff.svg"
        }else{
            document.getElementById("colorButton").src = "../images/colorOn.svg"
        }
        updateImageColor()
    });

    let result = await chrome.storage.local.get(["refreshBackgroundImageOn"])
    if(result.refreshBackgroundImageOn !== undefined){
        refreshBackgroundImageOn = result.refreshBackgroundImageOn
        document.getElementById("refreshButton").src = refreshBackgroundImageOn? "../images/imageRefreshOn.svg" : "../images/imageRefreshOff.svg"
    }else{
        document.getElementById("refreshButton").src = "../images/imageRefreshOn.svg"
    }
    
    chrome.storage.local.get(["shortcutURL"]).then((result) => {
        if(result.shortcutURL) shortcutURL = JSON.parse(result.shortcutURL)
    })

    chrome.storage.local.get(["shortcutImage"]).then((result) => {
        if(result.shortcutImage){
            let newShortcutImage = JSON.parse(result.shortcutImage)
            newShortcutImage.forEach((element, index) => {
                if(element !== "") shortcutImage[index] = element
            })
        }

        let shortcuts = document.querySelectorAll("div.shortcutImage")
        shortcutImage.forEach((element, index) => {
            shortcuts[index].style.backgroundImage = `url(${element})`
        })
    })
    
    chrome.storage.sync.get(["colorScheme"]).then((color) => { 
        if(color.colorScheme !== undefined){
            updateColorScheme(color.colorScheme, true)
        }else{
            updateColorScheme("colorSchemeViolet", false)   
        }
    });
    
    chrome.storage.sync.get(["searchEngine"]).then((engine) => {
        if(engine.searchEngine !== undefined){
            updateSearchEngine(engine.searchEngine, true)
        }else{
            updateSearchEngine("google", false)
        }
    });

    chrome.storage.sync.get(["userName"]).then((name) => {
        if(name.userName !== undefined){
            userName = name.userName
            updateUserName(true)
        }else{
            updateUserName(false)
        }
    });

    chrome.storage.sync.get(["measureUnit"]).then((unit) => {
        if(unit.measureUnit !== undefined){
            updateMeasureUnit(unit.measureUnit, true)
        }else{
            updateMeasureUnit("Metric", false)
        }
    });

    chrome.storage.sync.get(["language"]).then((language) => {
        if(language.language !== undefined){
            updateLanguage(language.language, true)
        }else{
            updateLanguage("English", false)
        }
    });
}

function toggleSettings(){
    settingsActive = !settingsActive;
    let settings = document.getElementById("settings")
    settings.style.visibility = settingsActive? "visible" : "hidden";
    let shortcutDialog = document.getElementById("shortcutDialog")
    if(settingsActive) shortcutDialog.close()
}



//---SETTINGS_USER_NAME---//////////////////////////////////////////////////////////////////////////////////////////////
let userName = "Fellow Human"
function updateUserName(sync){
    let userNameInput = document.getElementById("userNameInput")
    if(!sync){
        userName = (userNameInput.value !== "")? userNameInput.value : userName
        chrome.storage.sync.set({ "userName": userName }).then(() => {});
    }
    
    userNameInput.value = userName
    userNameInput.placeholder = userName
    updateSearchBarPlaceholder()
}



//---SETTINGS_LANGUAGE---///////////////////////////////////////////////////////////////////////////////////////////////
let selectedLanguage = "English"
let languageCode = "en"
function updateLanguage(language, sync){
    if(language === "English" || language === "Englisch"){
        selectedLanguage = "English"
        languageCode = "en"
    }else{
        selectedLanguage = "German"
        languageCode = "de"
    }
    
    if(!sync){
        chrome.storage.sync.set({ "language": selectedLanguage }).then(() => {});
    }

    let buttons = document.querySelectorAll("#language button")
    buttons.forEach((element, index) => {element.setAttribute("state","inactive")})
    let selectedButton = document.getElementById(`languageButton${selectedLanguage}`)
    selectedButton.setAttribute("state","active")
    
    updateSearchBarPlaceholder()
    updateSettingsLanguage(selectedLanguage)
    updateWeatherInfo()
}

async function updateSettingsLanguage(language){
    let userNameText = document.getElementById("userNameText")
    
    let languageText = document.getElementById("languageText")
    let languageButtonEnglish = document.getElementById(`languageButtonEnglish`)
    let languageButtonGerman = document.getElementById(`languageButtonGerman`)
    
    let measureUnitText = document.getElementById("measureUnitText")
    let measureUnitButtonMetric = document.getElementById("measureUnitMetric")
    let measureUnitButtonImperial = document.getElementById("measureUnitImperial")
    
    let colorSchemeText = document.getElementById("colorSchemeText")
    let colorSchemeButtonBlue = document.getElementById("colorSchemeBlue")
    let colorSchemeButtonViolet = document.getElementById("colorSchemeViolet")
    let colorSchemeButtonGreen = document.getElementById("colorSchemeGreen")
    let colorSchemeButtonRed = document.getElementById("colorSchemeRed")
    
    let searchEngineText = document.getElementById("searchEngineText")
    
    let localization = (await (await fetch("../localization.json")).json())[language]
    
    userNameText.innerText = localization.userNameText
    
    languageText.innerText = localization.languageText
    languageButtonEnglish.innerText = localization.languageButtonEnglish
    languageButtonGerman.innerText = localization.languageButtonGerman
    
    measureUnitText.innerText = localization.measureUnitText
    measureUnitButtonMetric.innerText = localization.measureUnitMetric
    measureUnitButtonImperial.innerText = localization.measureUnitImperial
    
    colorSchemeText.innerText = localization.colorSchemeText
    colorSchemeButtonBlue.innerText = localization.colorSchemeBlue
    colorSchemeButtonViolet.innerText = localization.colorSchemeViolet
    colorSchemeButtonGreen.innerText = localization.colorSchemeGreen
    colorSchemeButtonRed.innerText = localization.colorSchemeRed
    
    searchEngineText.innerText = localization.searchEngineText
}



//---SETTINGS_MEASURE_UNIT---///////////////////////////////////////////////////////////////////////////////////////////
let measureUnit = "Metric"
let temperatureUnit = "°C"
let speedUnit = "m/s"
function updateMeasureUnit(unit, sync){
    if(unit === "Metric" || unit === "Metrisch"){
        measureUnit = "Metric"
        temperatureUnit = "°C"
        speedUnit = "m/s"
    }else{
        measureUnit = "Imperial"
        temperatureUnit = "°F"
        speedUnit = "mph"
    }
    
    if(!sync){
        chrome.storage.sync.set({ "measureUnit": measureUnit }).then(() => {});
    }
    
    let buttons = document.querySelectorAll("#measureUnit button")
    buttons.forEach((element, index) => {element.setAttribute("state","inactive")})
    let selectedButton = document.getElementById(`measureUnit${measureUnit}`)
    selectedButton.setAttribute("state","active")
    
    updateWeatherInfo()
}



//---SETTINGS_COLOR_SCHEME---///////////////////////////////////////////////////////////////////////////////////////////
let currentColor = "Violet"
function updateColorScheme(color, sync){
    if(color === "Blue" || color === "Blau"){
        currentColor = "Blue"
    }else if(color === "Violet" || color === "Lila"){
        currentColor = "Violet"
    }else if(color === "Green" || color === "Grün"){
        currentColor = "Green"
    }else{
        currentColor = "Red"
    }
    
    if(!sync){
        chrome.storage.sync.set({ "colorScheme": currentColor }).then(() => {});
    }
    
    let buttons = document.querySelectorAll("#colorScheme button")
    buttons.forEach((element, index) => {element.setAttribute("state","inactive")})
    let selectedButton = document.getElementById(`colorScheme${currentColor}`)
    selectedButton.setAttribute("state","active")
    
    setColor(currentColor)
}

function setColor(color){
    switch(color){
        case `Blue`: {
            document.body.style.setProperty("--primaryColor","#033D6B")
            document.body.style.setProperty("--secondaryColor","#1b79c4")
            break;
        }
        case `Violet`: {
            document.body.style.setProperty("--primaryColor","#370140")
            document.body.style.setProperty("--secondaryColor","#720484")
            break;
        }
        case `Green`: {
            document.body.style.setProperty("--primaryColor","#345502")
            document.body.style.setProperty("--secondaryColor","#6aaf03")
            break;
        }
        case `Red`: {
            document.body.style.setProperty("--primaryColor","#450113")
            document.body.style.setProperty("--secondaryColor","#b0133e")
            break;
        }
    }
}



//---SETTINGS_SEARCH_ENGINE---//////////////////////////////////////////////////////////////////////////////////////////
function updateSearchEngine(engine, sync){
    if(!sync){
        chrome.storage.sync.set({ "searchEngine": engine }).then(() => {});
    }
    let images = document.querySelectorAll("#searchEngine img")
    images.forEach((element, index) => {element.setAttribute("state","inactive")})
    let selectedEngine = document.getElementById(engine)
    selectedEngine.setAttribute("state","active")
    
    searchEngine = engine;
}