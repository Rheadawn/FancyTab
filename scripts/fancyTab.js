window.onload = getRandomImage
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
    let image = document.getElementById("image")
    image.style.backgroundImage = `url("${imageURL}")`
    image.style.filter = `grayscale(100%)`
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
    let weatherInfoElement = document.getElementById("weatherInfo")
    weatherInfo.style.display = `block`
    
    setWeatherIcon(weatherInfo.weather[0].id)

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
    let rainInMm = weatherInfo["rain"]["1h"]
    let snowInMm = weatherInfo["snow"]["1h"]

    console.log(weatherInfo)
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