window.onload = loadWindow

//---LOAD_WINDOW---
function loadWindow(){
    getRandomImage()
    setEventListeners()
    updateClock()
    updateSearchBar()
    getWeatherInfo()
    setSavedSettings()
}

//--EVENT_LISTENERS---
let colorOn = true
function setEventListeners(){
    document.getElementById("powerButton").addEventListener("click", (event) => {window.close()})
    document.getElementById("colorButton").addEventListener("click", (event) => {
        colorOn = !colorOn
        chrome.storage.sync.set({ "colorOn": colorOn }).then(() => {});
        document.getElementById("colorButton").src = colorOn? "../images/colorOn.svg" : "../images/colorOff.svg"
        updateImageColor()
    })
    
    document.getElementById("twitchShortcut").addEventListener("click", (event) => {window.open(`https://twitch.tv`, window.name)})
    document.getElementById("overleafShortcut").addEventListener("click", (event) => {window.open(`https://overleaf.com`, window.name)})
    document.getElementById("youtubeShortcut").addEventListener("click", (event) => {window.open(`https://youtube.com`, window.name)})
    document.getElementById("githubShortcut").addEventListener("click", (event) => {window.open(`https://github.com`, window.name)})
    document.getElementById("gitlabShortcut").addEventListener("click", (event) => {window.open(`https://gitlab.com`, window.name)})
    
    chrome.storage.onChanged.addListener((changes) => {setSavedSettings()})
}

//---CREDENTIALS---
async function getCredentials() {
    let apiCredentialsResponse = await fetch("../config.json")
     return await apiCredentialsResponse.json()
}


//---WALLPAPERS---
async function getRandomImage(){
    let credentials = await getCredentials()
    let imageResponse = await (await fetch(`https://api.unsplash.com/photos/random?client_id=${credentials.imageAPI.accessKey}&orientation=landscape&query=wallpaper,nature,animals`)).json()
    let imageURL = imageResponse.urls.full
    let image = document.getElementById("backgroundImage")
    image.style.backgroundImage = `url("${imageURL}")`
}

function updateImageColor(){
    let image = document.getElementById("backgroundImage")
    if(colorOn){
        image.style.filter = `grayscale(0%)`
    }else{
        image.style.filter = `grayscale(100%)`
    }
}


//---CLOCK_UPDATE---
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


//---WEATHER_INFO---
async function getWeatherInfo(){
    let credentials = await getCredentials()
    let accessKey = credentials.weatherAPI.accessKey
    navigator.geolocation.getCurrentPosition(
        (position) => onWeatherInfoSuccess(position, accessKey),
        (positionError) => onWeatherInfoError(positionError, accessKey)
    )
}

async function onWeatherInfoSuccess(position, accessKey){
    let lat = position.coords.latitude
    let lon = position.coords.longitude
    let weatherInfo = await (await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&units=metric&lang=de&appid=${accessKey}`)).json()
    displayWeatherInfo(weatherInfo)
}

async function onWeatherInfoError(positionError, accessKey){
    let weatherInfo = await (await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=51.8306&lon=7.0443&units=metric&lang=de&appid=${accessKey}`)).json() // On Error default location: Reken
    displayWeatherInfo(weatherInfo)
}

function displayWeatherInfo(weatherInfo){
    //let weatherInfoElement = document.getElementById("weatherInfo")
    //weatherInfoElement.style.display = `block`
    
    setWeatherIcon(weatherInfo.weather[0].id)
    setDayCycleIcon(weatherInfo)

    console.log(weatherInfo)

    let lon = weatherInfo.coord.lon //hover info for city name
    let lat = weatherInfo.coord.lat //hover info for city name
    let tempActual = weatherInfo.main.temp
    let tempFeels = weatherInfo.main.feels_like
    let tempMax = weatherInfo.main.temp_max
    let tempMin = weatherInfo.main.temp_min
    let humidity = weatherInfo.main.humidity
    let cityName = weatherInfo.name
    let weatherDescription = weatherInfo.weather[0].description
    let windSpeed = weatherInfo.wind.speed
    let windDirection = weatherInfo["wind"]["deg"]
    let visibility = weatherInfo.visibility
    let rainInMM = "rain" in weatherInfo ?  weatherInfo["rain"]["1h"] : ""
    let snowInMM = "snow" in weatherInfo ?  weatherInfo["snow"]["1h"] : ""
}

function setWeatherIcon(weatherCode){
    let icon = document.getElementById("weatherIcon")
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

    if(isDayTime){ //daytime
        let dayLength = sunset - sunrise
        percentageOfCycleOver = (currentTime - sunrise) / dayLength
    }else if(isBeforeMidnight){ //nighttime before midnight
        let nightLength = (sunrise + 86400) - sunset
        percentageOfCycleOver = (currentTime - sunset) / nightLength
    }else{ //nighttime after midnight
        let nightLength = sunrise  - (sunset - 86400)
        percentageOfCycleOver = (currentTime - (sunset - 86400)) / nightLength
    }
    let x = percentageOfCycleOver * 150
    let y = Math.sin((180*(1-percentageOfCycleOver)) * Math.PI / 180) * 75

    let dayCycleIcon = document.getElementById("dayCycleIcon")
    dayCycleIcon.src = isDayTime ? "../images/dayCycleIcon.svg" : "../images/nightCycleIcon.svg"
    dayCycleIcon.style.position = "absolute"
    dayCycleIcon.style.left = (innerWidth - 187 + x).toFixed() + "px"
    dayCycleIcon.style.top = (innerHeight - 35 - y).toFixed() + "px"
}


//---SEARCH_BAR---
function updateSearchBar(){
    let searchBarField = document.getElementById("searchBarField")
    let date = new Date();
    let hours = date.getHours()
    
    switch(true){
        case (hours >= 6) && (hours <= 11): return searchBarField.placeholder = "Good Morning, Luca. Ready to search the world?";
        case (hours >= 12) && (hours <= 17): return searchBarField.placeholder = "Good Afternoon, Luca. Ready to search the world?";
        case (hours >= 18) && (hours <= 23): return searchBarField.placeholder = "Good Evening, Luca. Ready to search the world?";
        case (hours >= 0) && (hours <= 6): return searchBarField.placeholder = "Get some sleep, Luca. Tomorrow you can search the world.";
    }
    
    let searchBarPosition = searchBarField.getBoundingClientRect();
    let searchBarIcon = document.getElementById("searchBarIcon")
    searchBarIcon.left = searchBarPosition.right - searchBarIcon.style.width
    searchBarIcon.top = searchBarPosition.top
}

function searchBarOnClick(){
    let searchBarField = document.getElementById("searchBarField")
    let query = searchBarField.value
    window.open(`https://google.com/search?q=${query}`, window.name)
    searchBar.value = ""
function setSavedSettings(){
    chrome.storage.sync.get(["colorOn"]).then((color) => {
        if(color.colorOn !== undefined){
            document.getElementById("colorButton").src = colorOn? "../images/colorOn.svg" : "../images/colorOff.svg"
        }else{
            document.getElementById("colorButton").src = "../images/colorOn.svg"
        }
        updateImageColor()
    });
}
}
