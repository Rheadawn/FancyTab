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