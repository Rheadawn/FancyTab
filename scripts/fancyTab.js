window.onload = loadWindow

//---LOAD_WINDOW---/////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * The **loadWindow()** function calls all functions that are necesarry to set up a new tab.
 */
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

/**
 * The **getConfigFiles()** function fetches all needed JSON files from the config folder.
 * 
 * @async All files get fetched synchronously, using await
 */
async function getConfigFiles() {
    credentials = await (await fetch("../config/config.json")).json() //contains all necessary API keys
    localization = await (await fetch("../config/localization.json")).json() //contains translations for html elements in English and German
    measureUnits = await (await fetch("../config/measureUnit.json")).json() //contains strings for different units of the metric and imperial system
}



//--EVENT_LISTENERS---//////////////////////////////////////////////////////////////////////////////////////////////////
let colorOn = true
let refreshBackgroundImageOn = true
let currentBackgroundImage //stores current background image
let shortcutURL = ["https://twitch.tv", "https://overleaf.com", "https://youtube.com", "https://github.com", "https://gitlab.com"] //default shortcut URLs
let shortcutImage = ["../images/twitchShortcut.svg", "../images/overleafShortcut.svg", "../images/youtubeShortcut.svg", "../images/githubShortcut.svg", "../images/gitlabShortcut.svg"] //default shortcut images
let selectedShortcutIndex //index of the last clicked shortcut

/**
 * The **setEventListeners()** functions sets event listeners for the chrome storage and all html elements the user can interact with:
 * - **powerButton**: closes the current tab
 * - **colorButton**: displays the background image either in color or black and white depending on the value of {@link colorOn}
 * - **refreshButton**: determines if the background image should be refreshed when opening a new tab depending on the value of {@link refreshBackgroundImageOn}
 * - **searchBarField**: opens a new tab, processing the users query on the currently chosen search engine
 * - **settingsIcon**: opens the settingsMenu where the user can choose the preferred language, measurement system, color scheme and search engine
 * - **shortcut**: opens a new tab displaying the linked website
 * - **shortcutDialog**: lets the user set a website and an image for each shortcut (opens on right-clicking the shortcut)
 */
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
    
    //Event Listener for changes to the CHROME STORAGE
    chrome.storage.onChanged.addListener((changes) => {setSavedSettings(false, changes).then()})
}



//---LOCAL_STORAGE---///////////////////////////////////////////////////////////////////////////////////////////////////

/** Stores the local indexed database */
let db

/**
 * The **openDataBase()** function opens the indexed DB that is used temporarily store the background image.
 */
function openDataBase(){
    let request = indexedDB.open("localStorage")
    
    //First time opening database: creating needed schema to store images and set default background image
    request.onupgradeneeded = (event) => {
        let newDb = event.target.result
        newDb.createObjectStore("images")

        let image = document.getElementById("backgroundImage")
        image.style.backgroundImage = `url(../images/defaultBackgroundImage.jpg)`
    };
    
    //On success: saving database in variable and loading a new background image from the database
    request.onsuccess = (event) => {
        db = event.target.result
        loadImageFromDB()
    };
}

/** The **loadImageFromDB()** function opens a new transaction to load the stored background image */
function loadImageFromDB(){
    let transaction = db.transaction(["images"], "readwrite");
    let imageStore = transaction.objectStore("images");
    let request = imageStore.get("image")
    let image = document.getElementById("backgroundImage")
    
    //On error: setting default background image and fetching new background image if necessary
    request.onerror = () => {
        document.getElementById("backgroundImage").style.backgroundImage = `url(../images/defaultBackgroundImage.jpg)`
        if(refreshBackgroundImageOn){
            fetchRandomImage().then()
        }
    }
    
    //On success: setting loaded image as background (default image if result is undefined) and fetching new background image if necessary
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

/**
 * The **saveImageToDB** function synchronously overwrites the background image stored in the database with the given image.
 * 
 * @param blob Image in the form of a blob
 */
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
/**
 * The **fetchRandomImage()** function fetches the URL of a new random image from [unsplash](https://unsplash.com/developers) and
 * calls another function to [save it in the databse]{@link imageURLToBlobAndSave}.
 * 
 * @return {string} URL of the fetched image
 */
async function fetchRandomImage(){
    let imageResponse = await (await fetch(`https://api.unsplash.com/photos/random?client_id=${credentials.imageAPI.accessKey}&orientation=landscape&query=wallpaper,nature,animals`)).json()
    let imageURL = imageResponse.urls.raw + "&w=1920&h=1080"; //get raw image to set size to exactly 1920x1080
    await imageURLToBlobAndSave(imageURL)
    return imageURL
}

/**
 * The **imageURLToBlobAndSave()** function fetches the image of the given {@link src}, converts it into a blob
 * and converts said blob into a DataURL before calling a function to [save it to the database]{@link saveImageToDB}.
 * 
 * @param src URL of an image
 */
async function imageURLToBlobAndSave(src) {
    let response = await fetch(src)
    let blob = await response.blob()
    const reader = new FileReader()
    reader.readAsDataURL(blob)
    await saveImageToDB(blob)
}

/**
 * The **imageToBase64()** function converts the given {@link image} to a DataURL in base64
 * 
 * @param image to be converted to base64
 * @return {Promise<string>} DataURL in base64 
 */
function imageToBase64(image){
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target.result)
        reader.onerror = reject
        reader.readAsDataURL(image);
    })
}



//---CLOCK_UPDATE---////////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * The **updateClock()** function updates the html elements time, day and date according to the current time.
 */
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
/** Stores the last observed geolocation */
let lastGeolocation
/** Stores the time marker of the last time the weather API was used to update all weather infos */
let lastWeatherUpdateTime
/** Stores a JSON with the latest current weather info */
let lastWeatherInfo
/** Stores a JSON with the latest 5-day forecast */
let lastWeatherForecast

/**
 * The **updateWeatherInfo()** function trys to get the current geolocation of the user and calls a function,
 * either [with the users position]{@link onGeolocationSuccess} or [with an error message]{@link onGeolocationError}.
 * 
 * @async The location is determined asynchronously
 */
async function updateWeatherInfo(){
    let accessKey = credentials.weatherAPI.accessKey
    navigator.geolocation.getCurrentPosition(
        (position) => onGeolocationSuccess(position, accessKey),
        (positionError) => onGeolocationError(positionError, accessKey)
    )
}

/**
 * The **weatherUpdateNecessary()** function determines if an update of the weather data is necesarry.
 * Updates are necessary if the user changed geolocation or if the last update was more than 10 minutes ago.
 * 
 * @param currentLatitude of the user
 * @param currentLongitude of the user
 * @returns {boolean} true if update is necessary
 * @async all access to the chrome storage occurs synchronously, using await
 */
async function weatherUpdateNecessary(currentLatitude, currentLongitude){
    let updateNecessary = false
    
    //check if user has changed geolocation
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
    
    //check if last update was more than 10 minutes ago
    let updateTimeResult = await chrome.storage.local.get(["lastWeatherUpdateTime"])
    if(updateTimeResult.lastWeatherUpdateTime !== undefined){
        let currentTime = new Date()
        if(currentTime - updateTimeResult.lastWeatherUpdateTime > 600000) updateNecessary = true
    }else{
        updateNecessary = true
    }
    
    //retrieve weather data from storage if update is not necessary
    if(!updateNecessary) await retrieveLastWeatherData()
    return updateNecessary
}

/**
 * The **retrieveLastWeatherData()** function retrieves the last current weather data and 5-day forecast
 * from the local chrome storage
 * 
 * @async all access to the chrome storage occurs synchronously, using swait
 */
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

/**
 * The **onGeolocationSuccess()** function fetches the current weather data and the 5-day forecast from
 * the [openWeatherAPI](https://openweathermap.org/api), calls a function to display the 
 * [current weather data]{@link displayWeatherInfo} and the [5-day forecast]{@link displayForecast} and 
 * stores the data in the local chrome storage.
 * 
 * @param position of the user
 * @param accessKey for the weather API
 * @async all data gets fetched synchronously
 */
async function onGeolocationSuccess(position, accessKey){
    let lat = position.coords.latitude
    let lon = position.coords.longitude
    let languageCode = localization[selectedLanguage].languageCode
    let update = weatherUpdateNecessary(lat, lon)
    //fetch current weather data
    let weatherInfo = update? await (await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=${measureUnit.toLowerCase()}&lang=${languageCode}&appid=${accessKey}`)).json() : lastWeatherInfo
    await displayWeatherInfo(weatherInfo)
    //fetch 5-day forecast
    let forecast = update? await (await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=${measureUnit.toLowerCase()}&lang=${languageCode}&appid=${accessKey}`)).json() : lastWeatherForecast
    await displayForecast(forecast)
    //store weather data, geolocation and time stamp in chrome storage
    if(update){
        chrome.storage.local.set({ "lastGeolocation": {"latitude": position.coords.latitude, "longitude": position.coords.longitude} }).then(() => {});
        chrome.storage.local.set({ "lastWeatherUpdateTime": new Date() }).then(() => {});
        chrome.storage.local.set({ "lastWeatherInfo": weatherInfo }).then(() => {});
        chrome.storage.local.set({ "lastWeatherForecast": forecast }).then(() => {});
    }
}

/**
 * The **onGeolocationError()** function fetches the current weather data and the 5-day forecast for Reken from
 * the [openWeatherAPI](https://openweathermap.org/api), calls a function to display the
 * [current weather data]{@link displayWeatherInfo} and the [5-day forecast]{@link displayForecast} and
 * stores the data in the local chrome storage.
 *
 * @param positionError describing the error that occured
 * @param accessKey for the weather API
 * @async all data gets fetched synchronously
 */
async function onGeolocationError(positionError, accessKey){ // On Error and if no past data exists: default location Reken
    await retrieveLastWeatherData()
    let notDefined = lastWeatherInfo === undefined || lastWeatherForecast === undefined
    let languageCode = localization[selectedLanguage].languageCode
    
    let weatherInfo = notDefined? await (await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=51.8306&lon=7.0443&units=${measureUnit.toLowerCase()}&lang=${languageCode}&appid=${accessKey}`)).json() : lastWeatherInfo
    let forecast = notDefined? await (await fetch(`https://api.openweathermap.org/data/2.5/forecast?lat=51.8306&lon=7.0443&units=${measureUnit.toLowerCase()}&lang=${languageCode}&appid=${accessKey}`)).json() : lastWeatherForecast

    await displayWeatherInfo(weatherInfo)
    await displayForecast(forecast)
}

/**
 * The **displayWeatherInfo()** function extracts all necessary weather data from the [weatherInfo JSON]{@link weatherInfo}
 * and sets icons and texts of the respective html elements accordingly.
 * 
 * @param weatherInfo JSON containing all weather data
 */
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

/**
 * The **displayForecast()** function extracts all necessary weather data from the [5-day-forecast JSON]{@link forecast}
 * and sets icons and texts of the respective html elements accordingly.
 *
 * @param forecast JSON containing all weather data
 */
async function displayForecast(forecast){
    //set weather icons
    let forecastIcons = document.querySelectorAll("#forecastDays span")
    forecastIcons.forEach((element, index) => {
        console.log(forecast.list[index].weather[0].id)
        setWeatherIcon(element, forecast.list[index].weather[0].id)
    })
    
    //set names of days
    let dayArray = localization[selectedLanguage].daysOfTheWeek
    let currentDayIndex = (new Date()).getDay()
    let forecastDays = document.querySelectorAll("#forecastDays p.forecastDayName")
    forecastDays.forEach((element, index) => {
        element.innerText = dayArray[(index + currentDayIndex + 1) % 7]
    })
    
    //set weather descriptions
    let forecastDescriptions = document.querySelectorAll("#forecastDays p.forecastDayDescription")
    forecastDescriptions.forEach((element, index) => {
        let description = forecast.list[index].weather[0].main
        element.innerText = localization[selectedLanguage].weather[description]
    })
    
    document.getElementById("forecastText").innerText = localization[selectedLanguage].forecastText
}

/**
 * The **setWeatherIcon()** function sets the correct [materials icon]{@link icon} depending on the given {@link weatherCode}. 
 * 
 * @param icon that display the current weather
 * @param weatherCode from the weather API
 */
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

/**
 * The **setDayCycleIcon()** function sets the correct icon (sun or moon) on the correct position
 * on the dayCycleArch, depending on the current time of day.
 * 
 * @param weatherInfo is used to determine time of day, sunrise and sunset
 */
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
/** Stores the currently used search engine */
let searchEngine = "google"

/**
 * The **updateSearchBar()** function calls a function to [update the searchbar placeholder text]{@link updateSearchBarPlaceholder}
 * and updates the position of the search bar icon.
 */
function updateSearchBar(){
    updateSearchBarPlaceholder()
    
    //update position of the searchbar icon
    let searchBarPosition = document.getElementById("searchBarField").getBoundingClientRect();
    let searchBarIcon = document.getElementById("searchBarIcon")
    searchBarIcon.left = searchBarPosition.right - searchBarIcon.style.width
    searchBarIcon.top = searchBarPosition.top
}

/**
 * The **updateSearchBarPlaceholder()** function updates the text of the search bar placeholder depending on the time of day.
 */
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

/**
 * The **searchBarOnClick()** function opens a new tab, processing the users query on the currently chosen search engine
 */
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
let syncSettingsKeys = ["colorOn", "colorScheme", "searchEngine", "userName", "measureUnit", "language"] //all keys of the sync chrome storage
let localSettingsKeys = ["refreshBackgroundImageOn"] //all key of the local chrome storage
/**
 * The **initiateSettings()** function sets the value of all not yet stored keys in the sync and local chrome storage to undefined
 * and also stores the default shortcut images and URLs if yet not stored.
 * 
 * @async all access to the chrome storage occurs synchronously
 */
async function initiateSettings(){
    //set values of not yet stored keys of sync storage to undefined
    for(let i=0; i < syncSettingsKeys.length; i++){
        let key = syncSettingsKeys[i]
        let result = await chrome.storage.sync.get([key])
        if(!result) await chrome.storage.sync.set({key: undefined})
    }
    //set values of not yet stored keys of local storage to undefined
    for(let i=0; i < localSettingsKeys.length; i++){
        let key = localSettingsKeys[i]
        let result = await chrome.storage.local.get([key])
        if(!result) await chrome.storage.local.set({key: undefined})
    }

    //store default shortcut images if not yet stored
    let shortcutImageResult = await chrome.storage.local.get(["shortcutImage"])
    if(Object.keys(shortcutImageResult).length === 0) await chrome.storage.local.set({"shortcutImage": shortcutImage})

    //store default shortcut URLs if not yet stored
    let shortcutURLResult = await chrome.storage.local.get(["shortcutURL"])
    if(Object.keys(shortcutURLResult).length === 0) await chrome.storage.local.set({"shortcutURL": shortcutURL})
}

/**
 * The **toggleSettings()** function opens or closes the settings menu and closes the shortcut dialog if the settings menu is open.
 */
function toggleSettings(){
    settingsActive = !settingsActive
    document.getElementById("settings").style.visibility = settingsActive? "visible" : "hidden"
    if(settingsActive) document.getElementById("shortcutDialog").close()
}

/**
 * The **setSavedSettings()** function initially sets and updates the user settings as wells as weather data and background image.
 * 
 * @param onload true if function was called right after loading
 * @param changes contains keys of all settings that changed
 * @async all access to the chrome storage occurs synchronously
 */
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
            case "refreshBackgroundImageOn": return (value !== undefined)? updateRefreshBackgroundImageOn(value) : updateRefreshBackgroundImageOn(true)
            case "shortcutImage": return updateShortcutImage(value)
            case "shortcutURL": return updateShortcutURL(value)
            case "lastWeatherInfo": return updateWeatherInfo()
            case "lastWeatherForecast": return updateWeatherInfo()
        }
    })
}

/**
 * Creates a new JSON object where the keys are kept but the values are calculated by a function that takes key, value and index as parameters.
 * 
 * @param object - The JSON object that contains the keys to iterate over
 * @param fn - The function to calculate the new value for each key
 * 
 * @returns {Object} A new JSON object with the transformed values
 */
function objectMap(object, fn){
    return Object.fromEntries(
        Object.entries(object).map(
            ([k,v], i) => [k, fn(v,k,i)]
        )
    )
}

/**
 * The **updateColorOn()** function updates the value of {@link colorOn} and changes the icon and background image accordingly.
 * 
 * @param colorOnValue true if the background image is colorful
 */
function updateColorOn(colorOnValue){
    colorOn = colorOnValue

    document.getElementById("colorButton").src = colorOn? "../images/colorOn.svg" : "../images/colorOff.svg"
    document.getElementById("backgroundImage").style.filter = colorOn? `grayscale(0%)` : `grayscale(100%)`
}

/**
 * The **updateUserNameValue()** function updates the {@link userName} and calls a function to [ update the necessary html elements]{@link updateUserName}
 * 
 * @param userNameValue is the new value of userName
 */
function updateUserNameValue(userNameValue){
    userName = userNameValue
    updateUserName(true)
}

/**
 * The **updateRefreshBackgroundImageOn()** function updates the value of {@link refreshBackgroundImageOn} and changes the icon accordingly.
 * 
 * @param backgroundImageOnValue true if the background image will be refreshed in a new tab
 */
function updateRefreshBackgroundImageOn(backgroundImageOnValue){
    refreshBackgroundImageOn = backgroundImageOnValue
    document.getElementById("refreshButton").src = refreshBackgroundImageOn? "../images/imageRefreshOn.svg" : "../images/imageRefreshOff.svg"
}

/**
 * The **updateShortcutImage()** function updates the value of the [shortcut images]{@link shortcutImage} and refreshes the html elements accordingly.
 * 
 * @param shortcutImageValue contains the URLs for all shortcut images
 */
function updateShortcutImage(shortcutImageValue){
    shortcutImage = shortcutImageValue

    let shortcuts = document.querySelectorAll("div.shortcutImage")
    shortcutImage.forEach((element, index) => {
        shortcuts[index].style.backgroundImage = `url(${element})`
    })
}

/**
 * The **updateShortcutURL()** function updates the [shortcut URLs]{@link shortcutURL} and updates the value of the currently opened shortcutURL input.
 * 
 * @param shortcutURLValue contains the URLs of all shortcuts
 */
function updateShortcutURL(shortcutURLValue){
    shortcutURL = shortcutURLValue
    document.getElementById("shortcutURLInput").value = shortcutURL[selectedShortcutIndex]
}



//---SETTINGS_BUTTONS---////////////////////////////////////////////////////////////////////////////////////////////////
/**
 * The **toggleButtons()** function sets all {@link buttonsToDeactivate} inactive and the {@link buttonToActivate} to active
 * 
 * @param buttonsToDeactivate contains all buttons that need to be deactivated
 * @param buttonToActivate contains the button that needs to be activated
 */
function toggleButtons(buttonsToDeactivate, buttonToActivate){
    let buttons = document.querySelectorAll(buttonsToDeactivate)
    buttons.forEach((element) => {element.dataset.state = "inactive"})
    let selectedButton = document.getElementById(buttonToActivate)
    selectedButton.dataset.state = "active"
}



//---SETTINGS_USER_NAME---//////////////////////////////////////////////////////////////////////////////////////////////
/** Stores the value of the current user name */
let userName = "Friend"

/**
 * The **updateUserName()** function updates all needed html elements with the current user name and, if necessary, 
 * stores the updated user name in the sync chrome storage. Afterwards a function to [update the searchbar placeholder]{@link updateSearchBarPlaceholder} is called.
 * 
 * @param sync is true if the new user name was fetched from the sync chrome storage
 */
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
/** Stores the value of the selected language */
let selectedLanguage = "English"

/**
 * The **updateLanguage()** function changes, if necessary, the default user name according to the selected language, 
 * stores the selected language in the sync chrome storage and calls several functions that update the language where necessary.
 * 
 * @param language selected by the user
 * @param sync is true if the selected {@link language}  was fetched from the sync chrome storage
 * @param onload is true if the function was called right after loading the window
 */
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

/**
 * The **updateSettingsLanguage()** function updates the text in the settings menu according to the selected language.
 * 
 * @param language selected by the user
 */
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
/** Stores the value of the selected measurement unit */
let measureUnit = "Metric"

/**
 * The **updateMeasureUnit()** function updates the value of {@link measureUnit}, if necessary, stores the new value
 * in the sync chrome storage and calls functions to [toggle the affected buttons]{@link toggleButtons} and [update the weather]{@link updateWeatherInfo}.
 * 
 * @param unit selected by the user
 * @param sync is true if the selected {@link unit}  was fetched from the sync chrome storage
 * @param onload is true if the function was called right after loading the window
 */
function updateMeasureUnit(unit, sync, onload){
    measureUnit = unit
    
    if(!sync) chrome.storage.sync.set({ "measureUnit": measureUnit }).then(() => {})
    
    toggleButtons("#measureUnit button", `measureUnit${measureUnit}`)
    if(!onload) updateWeatherInfo().then()
}



//---SETTINGS_COLOR_SCHEME---///////////////////////////////////////////////////////////////////////////////////////////
/**
 * The **updateColorScheme()** function, if necessary, stores the new {@link color} value to the sync chrome storage
 * and calls functions to [toggle the affected buttons]{@link toggleButtons} and [update the color]{@link setColor}.
 * 
 * @param color selected by the user
 * @param sync is true if the selected {@link color} was fetched from the sync chrome storage
 */
function updateColorScheme(color, sync){
    if(!sync) chrome.storage.sync.set({ "colorScheme": color }).then(() => {})
    
    toggleButtons("#colorScheme button", `colorScheme${color}`)
    setColor(color)
}

/**
 * The **setColor()** function sets the html properties primaryColor and secondaryColor according to the selcted {@link color}.
 * 
 * @param color selected by the user
 */
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
/**
 * The **updateSearchEngine()** function, if necessary, stores the new {@link engine} value to the sync chrome storage
 * and calls a function to [toggle the affected buttons]{@link toggleButtons}.
 * 
 * @param engine selected by the user
 * @param sync is true if the selected {@link engine} was fetched from the sync chrome storage
 */
function updateSearchEngine(engine, sync){
    if(!sync) chrome.storage.sync.set({ "searchEngine": engine }).then(() => {})

    searchEngine = engine
    toggleButtons("#searchEngine img", searchEngine)
}