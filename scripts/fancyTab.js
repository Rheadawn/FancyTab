window.onload = loadWindow

//---LOAD_WINDOW---/////////////////////////////////////////////////////////////////////////////////////////////////////
async function loadWindow(){
    await getConfigFiles()
    await initiateSettings()
    await setSavedSettings(true)
    openDataBase()
    setEventListeners()
    updateClock()
    updateSearchBar()
    await updateWeatherInfo()
    setInterval(function(){updateClock(); updateSearchBar()}, 500) //update clock and searchbar every 0.5 seconds
    setInterval(updateWeatherInfo, 1000*60*10) //update weather info every 10 minutes
}



//---CREDENTIALS---/////////////////////////////////////////////////////////////////////////////////////////////////////
let credentials
let localization
let measureUnits
async function getConfigFiles() {
    credentials = await (await fetch("../config/config.json")).json()
    localization = await (await fetch("../config/localization.json")).json()
    measureUnits = await (await fetch("../config/measureUnit.json")).json()
}



//--EVENT_LISTENERS---//////////////////////////////////////////////////////////////////////////////////////////////////
let colorOn = true
let refreshBackgroundImageOn = true
let currentBackgroundImage
let shortcutURL = ["https://twitch.tv", "https://overleaf.com", "https://youtube.com", "https://github.com", "https://gitlab.com"]
let shortcutImage = ["../images/twitchShortcut.svg", "../images/overleafShortcut.svg", "../images/youtubeShortcut.svg", "../images/githubShortcut.svg", "../images/gitlabShortcut.svg"]
let selectedShortcutIndex

function setEventListeners(){
    //Event Listener for the POWER BUTTON
    document.getElementById("powerButton").addEventListener("click", () => {window.close()})

    //Event Listeners for everything BACKGROUND IMAGE related
    document.getElementById("colorButton").addEventListener("click", () => {
        colorOn = !colorOn
        chrome.storage.sync.set({ "colorOn": colorOn }).then(() => {});
        updateColorOn(colorOn)
    })
    document.getElementById("refreshButton").addEventListener("click", async () => {
        refreshBackgroundImageOn = !refreshBackgroundImageOn
        chrome.storage.local.set({ "refreshBackgroundImageOn": refreshBackgroundImageOn }).then(() => {});
        document.getElementById("refreshButton").src = refreshBackgroundImageOn? "../images/imageRefreshOn.svg" : "../images/imageRefreshOff.svg"
        if (refreshBackgroundImageOn){
            await fetchRandomImage()
            await loadImageFromDB()
            await fetchRandomImage()
        } 
        if (currentBackgroundImage) await saveImageToDB(currentBackgroundImage)
    })
    
    //Event Listeners for everything SEARCH BAR related
    document.getElementById("searchBarButton").addEventListener("click", () => {searchBarOnClick()})
    document.getElementById("searchBarField").addEventListener("keydown", (event) => {if(event.key === "Enter"){searchBarOnClick()}})

    //Event Listeners for everything SETTINGS related
    document.getElementById("settingsIcon").addEventListener("click", () => {toggleSettings()})
    document.getElementById("userNameInput").addEventListener("change", () => {updateUserName(false)})
    let languageButtons = document.querySelectorAll("#language button")
    languageButtons.forEach((element) => {element.addEventListener("click", () => {updateLanguage(element.dataset.language, false)})})
    let unitMeasureButtons = document.querySelectorAll("#measureUnit button")
    unitMeasureButtons.forEach((element) => {element.addEventListener("click", () => {updateMeasureUnit(element.dataset.unit, false)})})
    let colorSchemeButtons = document.querySelectorAll("#colorScheme button")
    colorSchemeButtons.forEach((element) => {element.addEventListener("click", () => {updateColorScheme(element.dataset.color, false)})})
    let searchEngineImages = document.querySelectorAll("#searchEngine img")
    searchEngineImages.forEach((element) => {element.addEventListener("click", () => {updateSearchEngine(element.id, false)})})
    
    //Event Listeners for everything SHORTCUT related
    let shortcuts = document.querySelectorAll("div.shortcutImage")
    shortcuts.forEach((element, index) => {element.addEventListener("click",() => {window.open(shortcutURL[index], window.name)})})
    shortcuts.forEach((element, index) => {element.addEventListener("contextmenu",(event) => {
        event.preventDefault()
        document.getElementById("shortcutImageInput").value = ""
        if(settingsActive) toggleSettings()
        let dialog = document.getElementById("shortcutDialog")
        if(dialog.open && selectedShortcutIndex === index){
            dialog.close()
        }else{
            dialog.show()
        }
        selectedShortcutIndex = index
        document.getElementById("shortcutURLInput").value = shortcutURL[index]
    })})
    document.getElementById("shortcutURLInput").addEventListener("change", (event) => {
        if(event.target.checkValidity()){
            shortcutURL[selectedShortcutIndex] = event.target.value
            chrome.storage.local.set({ "shortcutURL": shortcutURL }).then(() => {});
        }
    })
    document.getElementById("shortcutImageInput").addEventListener("change", async (event) => {
        if(event.target.files[0].type.startsWith("image/")){
            let imageBase64 = await imageToBase64(event.target.files[0])
            shortcutImage[selectedShortcutIndex] = imageBase64
            shortcuts[selectedShortcutIndex].style.backgroundImage = `url(${imageBase64})`
            chrome.storage.local.set({ "shortcutImage": shortcutImage }).then(() => {});
        }
    })
    
    //Event Listener for changes to chrome SYNC STORAGE
    chrome.storage.onChanged.addListener((changes) => {setSavedSettings(false, changes).then()})
}



//---LOCAL_STORAGE---///////////////////////////////////////////////////////////////////////////////////////////////////
let db
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
    
    request.onerror = () => {
        document.getElementById("backgroundImage").style.backgroundImage = `url(../images/defaultBackgroundImage.jpg)`
        if(refreshBackgroundImageOn){
            fetchRandomImage().then()
        }
    }
    
    request.onsuccess = () => {
        if(request.result === undefined) {
            document.getElementById("backgroundImage").style.backgroundImage = `url(../images/defaultBackgroundImage.jpg)`
        }else{
            let imageObjectURL = URL.createObjectURL(request.result)
            image.style.backgroundImage = `url(${imageObjectURL})`
        }
        currentBackgroundImage = request.result
        if(refreshBackgroundImageOn){
            fetchRandomImage().then()
        }
    }
}

function saveImageToDB(blob){
    return new Promise((resolve, reject) => {
        let transaction = db.transaction(["images"], "readwrite");
        let imageStore = transaction.objectStore("images");
        let request = imageStore.put(blob, "image")
        
        request.onsuccess = resolve
        request.onerror = reject
    })
}



//---BACKGROUND_AND_SHORTCUT_IMAGES---//////////////////////////////////////////////////////////////////////////////////
async function fetchRandomImage(){
    let imageResponse = await (await fetch(`https://api.unsplash.com/photos/random?client_id=${credentials.imageAPI.accessKey}&orientation=landscape&query=wallpaper,nature,animals`)).json()
    let imageURL = imageResponse.urls.raw + "&w=1920&h=1080";
    await imageURLToBlobAndSave(imageURL)
    return imageURL
}

async function imageURLToBlobAndSave(src) {
    let response = await fetch(src)
    let blob = await response.blob()
    const reader = new FileReader()
    reader.readAsDataURL(blob)
    await saveImageToDB(blob)
}

function imageToBase64(image){
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result)
        reader.onerror = reject
        reader.readAsDataURL(image);
    })
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
    
    document.getElementById("time").innerText = `${hours}:${minutes}`
    document.getElementById("day").innerText = weekday
    document.getElementById("date").innerText = `${day}.${month}.${year}`
}



//---WEATHER_INFO---////////////////////////////////////////////////////////////////////////////////////////////////////
let lastGeolocation
let lastWeatherUpdateTime
let lastWeatherInfo
let lastWeatherForecast

async function updateWeatherInfo(){
    let accessKey = credentials.weatherAPI.accessKey
    navigator.geolocation.getCurrentPosition(
        (position) => onGeolocationSuccess(position, accessKey),
        (positionError) => onGeolocationError(positionError, accessKey)
    )
}

async function weatherUpdateNecessary(currentLatitude, currentLongitude){
    let updateNecessary = false
    
    let geolocationResult = await chrome.storage.local.get(["lastGeolocation"])
    if(geolocationResult.lastGeolocation !== undefined){
        let lastLocation = geolocationResult.lastGeolocation
        if(lastLocation.latitude.toFixed(2) === currentLatitude.toFixed(2) 
            && lastLocation.longitude.toFixed(2) === currentLongitude.toFixed(2)){
            updateNecessary = true
        }
    }else{
        updateNecessary = true
    }
    
    let updateTimeResult = await chrome.storage.local.get(["lastWeatherUpdateTime"])
    if(updateTimeResult.lastWeatherUpdateTime !== undefined){
        let currentTime = new Date()
        if(currentTime - updateTimeResult.lastWeatherUpdateTime > 600000) updateNecessary = true
    }else{
        updateNecessary = true
    }
    
    if(!updateNecessary) await retrieveLastWeatherData()
    return updateNecessary
}

async function retrieveLastWeatherData(){
    let weatherInfoResult = await chrome.storage.local.get(["lastWeatherInfo"])
    if(weatherInfoResult.lastWeatherInfo !== undefined){
        lastWeatherInfo =  weatherInfoResult.lastWeatherInfo
    }
    
    let forecastResult = await chrome.storage.local.get(["lastWeatherForecast"])
    if(forecastResult.lastWeatherForecast !== undefined){
        lastWeatherForecast = forecastResult.lastWeatherForecast
    }
}

async function onGeolocationSuccess(position, accessKey){
    let lat = position.coords.latitude
    let lon = position.coords.longitude
    let languageCode = localization[selectedLanguage].languageCode
    let update = weatherUpdateNecessary(lat, lon)
    let weatherInfo = update? await (await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${measureUnit.toLowerCase()}&lang=${languageCode}&appid=${accessKey}`)).json() : lastWeatherInfo
    await displayWeatherInfo(weatherInfo)
    let forecast = update? await (await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${measureUnit.toLowerCase()}&lang=${languageCode}&appid=${accessKey}`)).json() : lastWeatherForecast
    await displayForecast(forecast)
    if(update){
        chrome.storage.local.set({ "lastGeolocation": {"latitude": position.coords.latitude, "longitude": position.coords.longitude} }).then(() => {});
        chrome.storage.local.set({ "lastWeatherUpdateTime": new Date() }).then(() => {});
        chrome.storage.local.set({ "lastWeatherInfo": weatherInfo }).then(() => {});
        chrome.storage.local.set({ "lastWeatherForecast": forecast }).then(() => {});
    }
}

async function onGeolocationError(positionError, accessKey){ // On Error and if no past data exists: default location Reken
    await retrieveLastWeatherData()
    let notDefined = lastWeatherInfo === undefined || lastWeatherForecast === undefined
    let languageCode = localization[selectedLanguage].languageCode
    
    let weatherInfo = notDefined? await (await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=51.8306&lon=7.0443&units=${measureUnit.toLowerCase()}&lang=${languageCode}&appid=${accessKey}`)).json() : lastWeatherInfo
    let forecast = notDefined? await (await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=51.8306&lon=7.0443&units=${measureUnit.toLowerCase()}&lang=${languageCode}&appid=${accessKey}`)).json() : lastWeatherForecast

    await displayWeatherInfo(weatherInfo)
    await displayForecast(forecast)
}

async function displayWeatherInfo(weatherInfo){
    let icon = document.getElementById("weatherIcon")
    setWeatherIcon(icon, weatherInfo.weather[0].id)
    setDayCycleIcon(weatherInfo)
    
    let tempActual = weatherInfo.main.temp.toFixed(1)
    let tempFeels = weatherInfo.main.feels_like.toFixed(1)
    let tempMax = weatherInfo.main.temp_max.toFixed(1)
    let tempMin = weatherInfo.main.temp_min.toFixed(1)
    let humidity = weatherInfo.main.humidity
    let cityName = weatherInfo.name
    let description = weatherInfo.weather[0].main
    let windSpeed = weatherInfo.wind.speed
    let windDirection = weatherInfo["wind"]["deg"]
    let visibility = weatherInfo.visibility / 1000
    let rainInMM = "rain" in weatherInfo ? weatherInfo["rain"]["1h"].toFixed(0) : ""
    let snowInMM = "snow" in weatherInfo ? weatherInfo["snow"]["1h"].toFixed(0) : ""
    
    document.getElementById("amountOfRain").innerText = (rainInMM !== "")? `${rainInMM}mm` : `${snowInMM}mm`
    document.getElementById("amountOfRain").style.visibility = (rainInMM !== "" || snowInMM !== "")? "visible" : "hidden"
    document.getElementById("weatherDescription").innerText = localization[selectedLanguage].weather[description]
    document.getElementById("weatherLocation").innerText = cityName
    document.getElementById("minTemp").innerText = `MIN ${tempMin}${measureUnits[measureUnit].temperatureUnit}`
    document.getElementById("maxTemp").innerText = `MAX ${tempMax}${measureUnits[measureUnit].temperatureUnit}`
    document.getElementById("actualTemp").innerText = `${tempFeels}${measureUnits[measureUnit].temperatureUnit}`
    document.getElementById("feelsLikeTemp").innerText = `FEELS LIKE ${tempActual}${measureUnits[measureUnit].temperatureUnit}`
    document.getElementById("windDirectionText").innerText = `${windDirection}°`
    document.getElementById("windDirectionIcon").style.transform = `rotate(${windDirection}deg)`
    document.getElementById("windSpeedText").innerText = `${windSpeed} ${measureUnits[measureUnit].speedUnit}`
    document.getElementById("humidityText").innerText = `${humidity}%`
    document.getElementById("visibilityText").innerText = `${visibility} km`
}

async function displayForecast(forecast){
    let forecastIcons = document.querySelectorAll("#forecastDays span")
    forecastIcons.forEach((element, index) => {
        console.log(forecast.list[index].weather[0].id)
        setWeatherIcon(element, forecast.list[index].weather[0].id)
    })
    
    let dayArray = localization[selectedLanguage].daysOfTheWeek
    let currentDayIndex = (new Date()).getDay()
    let forecastDays = document.querySelectorAll("#forecastDays p.forecastDayName")
    forecastDays.forEach((element, index) => {
        element.innerText = dayArray[(index + currentDayIndex + 1) % 7]
    })
    
    let forecastDescriptions = document.querySelectorAll("#forecastDays p.forecastDayDescription")
    forecastDescriptions.forEach((element, index) => {
        let description = forecast.list[index].weather[0].main
        element.innerText = localization[selectedLanguage].weather[description]
    })
    
    document.getElementById("forecastText").innerText = localization[selectedLanguage].forecastText
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

    let dayCycleText = document.getElementById("dayCycleText")
    let percentageOfCycleOver

    if(isDayTime){ //daytime
        let dayLength = sunset - sunrise
        percentageOfCycleOver = (currentTime - sunrise) / dayLength
        dayCycleText.innerText = localization[selectedLanguage].dayCycleText
    }else if(isBeforeMidnight){ //nighttime before midnight
        let nightLength = (sunrise + 86400) - sunset
        percentageOfCycleOver = (currentTime - sunset) / nightLength
        dayCycleText.innerText = localization[selectedLanguage].nightCycleText
    }else{ //nighttime after midnight
        let nightLength = sunrise  - (sunset - 86400)
        percentageOfCycleOver = (currentTime - (sunset - 86400)) / nightLength
        dayCycleText.innerText = localization[selectedLanguage].nightCycleText
    }
    
    let x = percentageOfCycleOver * 150
    let y = 75 * Math.sin(Math.acos((x - 75) / 75))

    let dayCycleIcon = document.getElementById("dayCycleIcon")
    dayCycleIcon.src = isDayTime ? "../images/dayCycleIcon.svg" : "../images/nightCycleIcon.svg"
    dayCycleIcon.style.position = "absolute"
    dayCycleIcon.style.left =  x + "px"
    dayCycleIcon.style.bottom = y + "px"
}



//---SEARCH_BAR---
let searchEngine = "google"
function updateSearchBar(){
    updateSearchBarPlaceholder()
    
    let searchBarPosition = document.getElementById("searchBarField").getBoundingClientRect();
    let searchBarIcon = document.getElementById("searchBarIcon")
    searchBarIcon.left = searchBarPosition.right - searchBarIcon.style.width
    searchBarIcon.top = searchBarPosition.top
}

function updateSearchBarPlaceholder(){
    let searchBarField = document.getElementById("searchBarField")
    let hours = new Date().getHours()
    
    let text = localization[selectedLanguage].searchbarPlaceholder
    switch(true){
        case (hours >= 6) && (hours <= 11): return searchBarField.placeholder = text.morning.replace("#userName", userName)
        case (hours >= 12) && (hours <= 17): return searchBarField.placeholder = text.afternoon.replace("#userName", userName)
        case (hours >= 18) && (hours <= 23): return searchBarField.placeholder = text.evening.replace("#userName", userName)
        case (hours >= 0) && (hours <= 6): return searchBarField.placeholder = text.sleep.replace("#userName", userName)
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
let settingsActive = false
let syncSettingsKeys = ["colorOn", "colorScheme", "searchEngine", "userName", "measureUnit", "language"]
let localSettingsKeys = ["refreshBackgroundImageOn"]
async function initiateSettings(){
    for(let i=0; i < syncSettingsKeys.length; i++){
        let key = syncSettingsKeys[i]
        let result = await chrome.storage.sync.get([key])
        if(!result) await chrome.storage.sync.set({key: undefined})
    }
    for(let i=0; i < localSettingsKeys.length; i++){
        let key = localSettingsKeys[i]
        let result = await chrome.storage.local.get([key])
        if(!result) await chrome.storage.local.set({key: undefined})
    }

    let shortcutImageResult = await chrome.storage.local.get(["shortcutImage"])
    if(Object.keys(shortcutImageResult).length === 0) await chrome.storage.local.set({"shortcutImage": shortcutImage})
    
    let shortcutURLResult = await chrome.storage.local.get(["shortcutURL"])
    if(Object.keys(shortcutURLResult).length === 0) await chrome.storage.local.set({"shortcutURL": shortcutURL})
}

function toggleSettings(){
    settingsActive = !settingsActive
    document.getElementById("settings").style.visibility = settingsActive? "visible" : "hidden"
    if(settingsActive) document.getElementById("shortcutDialog").close()
}

async function setSavedSettings(onload, changes){
    let settings = changes? objectMap(changes, element => element.newValue) : await chrome.storage.sync.get()
    Object.keys(settings).forEach(key => {
        let value = settings[key]
        switch(key){
            case "colorOn": return (value !== undefined)? updateColorOn(value) : updateColorOn(true)
            case "colorScheme": return value? updateColorScheme(value, true) : updateColorScheme("colorSchemeViolet", false)
            case "searchEngine": return value?  updateSearchEngine(value, true) : updateSearchEngine("google", false)
            case "userName": return value? updateUserNameValue(value) : updateUserName(true)
            case "measureUnit": return value? updateMeasureUnit(value, true, onload) : updateMeasureUnit("Metric", false, onload)
            case "language": return value? updateLanguage(value, true, onload) : updateLanguage("English", false, onload)
        }
    })
    
    let localSettings = changes? objectMap(changes, element => element.newValue) : await chrome.storage.local.get()
    Object.keys(localSettings).forEach(key => {
        let value = localSettings[key]
        console.log(key, value)
        switch(key){
            case "refreshBackgroundImageOn": return updateRefreshBackgroundImageOn(value)
            case "shortcutImage": return updateShortcutImage(value)
            case "shortcutURL": return updateShortcutURL(value)
            case "lastWeatherInfo": return updateWeatherInfo()
            case "lastWeatherForecast": return updateWeatherInfo()
        }
    })
}

function objectMap(object, fn){
    return Object.fromEntries(
        Object.entries(object).map(
            ([k,v], i) => [k, fn(v,k,i)]
        )
    )
}

function updateColorOn(colorOnValue){
    colorOn = colorOnValue

    document.getElementById("colorButton").src = colorOn? "../images/colorOn.svg" : "../images/colorOff.svg"
    document.getElementById("backgroundImage").style.filter = colorOn? `grayscale(0%)` : `grayscale(100%)`
}

function updateUserNameValue(userNameValue){
    userName = userNameValue
    updateUserName(true)
}

function updateRefreshBackgroundImageOn(backgroundImageOnValue){
    if(backgroundImageOnValue !== undefined){
        refreshBackgroundImageOn = backgroundImageOnValue
        document.getElementById("refreshButton").src = refreshBackgroundImageOn? "../images/imageRefreshOn.svg" : "../images/imageRefreshOff.svg"
    }else{
        document.getElementById("refreshButton").src = "../images/imageRefreshOn.svg"
    }
}

function updateShortcutImage(shortcutImageValue){
    shortcutImage = shortcutImageValue

    let shortcuts = document.querySelectorAll("div.shortcutImage")
    shortcutImage.forEach((element, index) => {
        shortcuts[index].style.backgroundImage = `url(${element})`
    })
}

function updateShortcutURL(shortcutURLValue){
    shortcutURL = shortcutURLValue
    document.getElementById("shortcutURLInput").value = shortcutURL[selectedShortcutIndex]
}



//---SETTINGS_BUTTONS---////////////////////////////////////////////////////////////////////////////////////////////////
function toggleButtons(buttonsToDeactivate, buttonToActivate){
    let buttons = document.querySelectorAll(buttonsToDeactivate)
    buttons.forEach((element) => {element.dataset.state = "inactive"})
    let selectedButton = document.getElementById(buttonToActivate)
    selectedButton.dataset.state = "active"
}



//---SETTINGS_USER_NAME---//////////////////////////////////////////////////////////////////////////////////////////////
let userName = "Friend"
function updateUserName(sync){
    let userNameInput = document.getElementById("userNameInput")
    if(!sync){
        userName = (userNameInput.value !== "" && userNameInput.checkValidity())? userNameInput.value : userName
        chrome.storage.sync.set({ "userName": userName }).then(() => {});
    }
    
    userNameInput.value = userName
    userNameInput.placeholder = userName
    updateSearchBarPlaceholder()
}



//---SETTINGS_LANGUAGE---///////////////////////////////////////////////////////////////////////////////////////////////
let selectedLanguage = "English"
function updateLanguage(language, sync, onload){
    selectedLanguage = language
    
    let defaultUserNames = Object.keys(localization).map(key => localization[key].defaultUserName)
    if(defaultUserNames.includes(userName)){
        userName = localization[selectedLanguage].defaultUserName
        document.getElementById("userNameInput").value = localization[selectedLanguage].defaultUserName
        updateUserName(sync)
    }
    
    if(!sync){
        chrome.storage.sync.set({ "language": selectedLanguage }).then(() => {});
    }
    
    toggleButtons("#language button", `languageButton${selectedLanguage}`)
    updateSearchBarPlaceholder()
    updateSettingsLanguage(selectedLanguage).then()
    if(!onload) updateWeatherInfo().then()
}

async function updateSettingsLanguage(language){
    let settings = localization[language]
    
    document.getElementById("userNameText").innerText = settings.userNameText
    
    document.getElementById("languageText").innerText = settings.languageText
    document.getElementById(`languageButtonEnglish`).innerText = settings.languageButtonEnglish
    document.getElementById(`languageButtonGerman`).innerText = settings.languageButtonGerman
    
    document.getElementById("measureUnitText").innerText = settings.measureUnitText
    document.getElementById("measureUnitMetric").innerText = settings.measureUnitMetric
    document.getElementById("measureUnitImperial").innerText = settings.measureUnitImperial
    
    document.getElementById("colorSchemeText").innerText = settings.colorSchemeText
    document.getElementById("colorSchemeBlue").innerText = settings.colorSchemeBlue
    document.getElementById("colorSchemeViolet").innerText = settings.colorSchemeViolet
    document.getElementById("colorSchemeGreen").innerText = settings.colorSchemeGreen
    document.getElementById("colorSchemeRed").innerText = settings.colorSchemeRed
    
    document.getElementById("searchEngineText").innerText = settings.searchEngineText
}



//---SETTINGS_MEASURE_UNIT---///////////////////////////////////////////////////////////////////////////////////////////
let measureUnit = "Metric"
function updateMeasureUnit(unit, sync, onload){
    measureUnit = unit
    
    if(!sync) chrome.storage.sync.set({ "measureUnit": measureUnit }).then(() => {})
    
    toggleButtons("#measureUnit button", `measureUnit${measureUnit}`)
    if(!onload) updateWeatherInfo().then()
}



//---SETTINGS_COLOR_SCHEME---///////////////////////////////////////////////////////////////////////////////////////////
function updateColorScheme(color, sync){
    if(!sync) chrome.storage.sync.set({ "colorScheme": color }).then(() => {})
    
    toggleButtons("#colorScheme button", `colorScheme${color}`)
    setColor(color)
}

function setColor(color){
    switch(color){
        case `Blue`: {
            document.body.style.setProperty("--primaryColor","#033D6B")
            return document.body.style.setProperty("--secondaryColor","#1b79c4")
        }
        case `Violet`: {
            document.body.style.setProperty("--primaryColor","#370140")
            return document.body.style.setProperty("--secondaryColor","#720484")
        }
        case `Green`: {
            document.body.style.setProperty("--primaryColor","#345502")
            return document.body.style.setProperty("--secondaryColor","#6aaf03")
        }
        case `Red`: {
            document.body.style.setProperty("--primaryColor","#450113")
            return document.body.style.setProperty("--secondaryColor","#b0133e")
        }
    }
}



//---SETTINGS_SEARCH_ENGINE---//////////////////////////////////////////////////////////////////////////////////////////
function updateSearchEngine(engine, sync){
    if(!sync) chrome.storage.sync.set({ "searchEngine": engine }).then(() => {})

    searchEngine = engine
    toggleButtons("#searchEngine img", searchEngine)
}