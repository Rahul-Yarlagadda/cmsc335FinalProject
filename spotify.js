process.stdin.setEncoding("utf8");
const path = require("path");
const express = require("express");
const app = express();
const fs = require("fs");
const portNumber = 5001;
const bodyParser = require("body-parser");
const spotifyWebAPI = require("spotify-web-api-node");
require("dotenv").config({ path: path.resolve(__dirname, 'credentialsDontPost/.env') }) 
app.use(express.static(path.join(__dirname, '/')));




const uri = `mongodb+srv://${process.env.MONGO_DB_USERNAME}:${process.env.MONGO_DB_PASSWORD}@cluster0.cs4w3.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

 /* Our database and collection */
 const databaseAndCollection = {db: process.env.MONGO_DB_NAME, collection: process.env.MONGO_COLLECTOIN};

/****** DO NOT MODIFY FROM THIS POINT ONE ******/
const { MongoClient, ServerApiVersion } = require('mongodb');
const { time, table } = require("console");

const client = new MongoClient(uri, {serverApi: ServerApiVersion.v1 });




console.log(`Web server started and running at http://localhost:${portNumber}`);
process.stdout.write("Type stop to shutdown the server: ");
process.stdin.on('readable', () => {  /* on equivalent to addEventListener */
	const dataInput = process.stdin.read();
	if (dataInput !== null) {
		const command = dataInput.trim();
        if (command === "stop") {
			console.log("Shutting down the server");
            process.exit(0);  /* exiting */
        } else {
			/* After invalid command, we cannot type anything else */
			console.log(`Invalid command: ${command}`);
            process.stdout.write("Type stop to shutdown the server: ");
            process.stdin.resume();
		}
    }
});


const spotifyApi = new spotifyWebAPI({
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET
  });

async function getAccessToken() {
    try {
        const data = await spotifyApi.clientCredentialsGrant();
        const accessToken = data.body['access_token'];
        const expiresIn = data.body['expires_in'];
    
        // Set the access token for subsequent API calls
        spotifyApi.setAccessToken(accessToken);
    
      } catch (error) {
        console.error('Error fetching access token:', error.message);
        res.status(500).send('Error fetching access token');
      }
}


class currentSong{
    #data;

    constructor (user, song){
        this.#data = [user, song];
    }

    get getData(){
        return this.#data;
    }

    set setData (newData){
        this.#data = newData;
    }
}

const currsong = new currentSong("", "");

app.use(express.static('images'));



app.set("views", path.resolve(__dirname, "templates"));

app.set("view engine", "ejs");

app.get("/", (request, response) => { 
    response.render("index");
});


app.get("/create", (request, response) => { 
    response.render("create");
});

app.use(bodyParser.urlencoded({extended:false}));

app.post("/accountCreated", (request, response) => {
    let {name, genre, artist} =  request.body;

    let details = {name: name, genre: genre, artist: artist,  songs: []};
    async function main() {
       
        try {
            await client.connect();
           
            /* Inserting one movie */
            await client.db(databaseAndCollection.db).collection(databaseAndCollection.collection).insertOne(details);

        } catch (e) {
            console.error(e);
        } finally {
            await client.close();
        }
    }

    let library = 0;
    main().catch(console.error);

    response.render("accountCreated", {name, genre, artist, library});
});

app.get("/addSongs", (request, response) => { 
    response.render("addSongs", {message: ""});
});
app.post('/addSongs', async (req, res) => {
    // const query = req.query.query; // Get the search query from URL parameters
    let message;
    let {name, song} = req.body;
    if (!name || !song) {
        message = `<Strong style="color:red;">Please fill in all feilds!</Strong >`;
    }else {
        
        try {
            await main(); 
            
        } catch (error) {
            console.error(error);
        }
    }
    
    async function main(){
        let filter  = {name: req.body.name};
        await client.connect();
        try {
            let result = await client.db(databaseAndCollection.db)
                        .collection(databaseAndCollection.collection)
                        .findOne(filter);

            if (result) {
                await getAccessToken();
                // Search for the track
                const data = await spotifyApi.searchTracks(song, { limit: 1 });
                const tracks = data.body.tracks.items;
            
                if (tracks.length === 0) {
                    return res.status(404).send('No tracks found.');
                }

                currsong.setData = [req.body.name, tracks[0].name];
            
                let name = `<h3 style="color:green;">We found a song.</h3><Strong> ${tracks[0].name} </Strong>`;
                let artist = `<p>${tracks[0].artists[0].name}</p>`;
                let album = `<p>${tracks[0].album.name}</p>`;
                let url = `<p>${tracks[0].external_urls.spotify}</p>`;
                let imageUrl = `<img src="${tracks[0].album.images[1].url}" alt="Track Image"> <br> `;
                let submit = `<Strong> Was this the song you were looking for?</Strong> <br> <Button onclick ="no()" >No</Button> <Button onclick ="yes()">Yes! Add song.</Button>`;
            
                message = name+artist+album+url+imageUrl+submit;
            } else {
                message = `<Strong style="color:red;">Incorrect Username</Strong >`;
                
            }
        } catch (e) {
            console.error(e);
        }
    }
    res.render("addSongs", { message });
  });

  app.get("/songAdded", async (req, res) => { 
    let message;

    try {
        await main(); 
         
    } catch (error) {
        console.error(error);
    }

    async function main(){
        await client.connect();
        try {
            const query = {name: currsong.getData[0]};
            const update = { $addToSet: { songs: currsong.getData[1] } };
            const test = await client.db(databaseAndCollection.db)
            .collection(databaseAndCollection.collection).updateOne(query, update);
            console.log(test);
            if (test.modifiedCount === 1){
                message = `<h1>Song was added to your library succesfully!</h1>`;
            }else{
                message = `<h1>Song was already added to your library ;)</h1>`;
            }
        } catch (e) {
            console.error(e);
        }
    }

    res.render("songAdded", { message });
});


app.get("/lookup", (request, response) => { 
    response.render("lookup", {message: ""});
});

app.get("/change", (request, response) => { 
    response.render("change", {message: ""});
});

app.post('/lookup', async (req, res) => {
    let message;
    let {artist} = req.body;
    if (!artist) {
        message = `<Strong style="color:red;">Please type something to search!</Strong >`;
    }else {
        try {
            await main(); 
            
        } catch (error) {
            console.error(error);
        }
    }
    
    async function main(){
        try {
            await getAccessToken();
                // Search for the track
                const data = await spotifyApi.searchArtists(artist, { limit: 1 });
                const artists = data.body.artists.items;
            
                if (!artists||artists.length === 0) {
                    return res.status(404).send('No artists found.');
                }
                

                const artistData = artists[0];

                const image = artistData.images?.length > 0 ? artistData.images[1].url : '/images/noPhoto.png';

                message = `<h2 style="color:green;">We found an artist!!!</h2>`;
                message += `<img src="${image}" alt="No Image Available"> <br> `;
                message += `<strong>Artist name: ${artistData.name}</strong>`;
                message += `<p>Artist genres: ${artistData.genres.join(', ') || 'N/A'}</p>`;
                message += `<p>Popularity: ${artistData.popularity}</p>`;
                message += `<p>Follower count: ${artistData.followers.total}</p>`;
                message += `<p>Spotify link: <a href="${artistData.external_urls.spotify}" target="_blank">${artistData.external_urls.spotify}</a></p>`;

        } catch (e) {
            console.error(e);
        }
    }
    res.render("lookup", { message });
  });

app.get("/change", (request, response) => { 
    response.render("change", {message: ""});
});

app.post('/change', async (req, res) => {
    let message;
    let {name, artist} = req.body;
    if (!name || !artist) {
        message = `<Strong style="color:red;">Please fill in all feilds!</Strong >`;
    }else {
        
        try {
            await main(); 
            
        } catch (error) {
            console.error(error);
        }
    }
    
    async function main(){
        let filter  = {name: req.body.name};
        await client.connect();
        try {
            let result = await client.db(databaseAndCollection.db)
                        .collection(databaseAndCollection.collection)
                        .findOne(filter);

            if (result) {
                const query = {name: name};
                const update = { $set: { artist: artist} };
                const test = await client.db(databaseAndCollection.db)
                .collection(databaseAndCollection.collection).updateOne(query, update);
                message = `<Strong style="color:green;"> Your favorite artist is chagned to ${artist}.</Strong >`;
            } else {
                message = `<Strong style="color:red;">could not update</Strong >`;
                
            }
        } catch (e) {
            console.error(e);
        }
    }
    res.render("change", { message });
  });

app.get("/portal", (request, response) => { 
    response.render("portal", {message: ""});
});

app.post('/profile', async (req, res) => {
    let {name} = req.body;
    let file = "portal";
    let variables;
    try {
        await main(); 
        
    } catch (error) {
        console.error(error);
    }
    async function main(){
        
        let filter  = {name: name};
        await client.connect();
        try {
            let result = await client.db(databaseAndCollection.db)
                        .collection(databaseAndCollection.collection)
                        .findOne(filter);
            if (result) {
                file = "profile";
                variables = {
                    name: result.name,
                    genre: result.genre,
                    artist: result.artist,
                    library: result.songs.length
                }
            } else {
                
                variables = {
                    message: `<Strong style="color:red;">Could not find the profile!</Strong>`
                }
                

            }
        } catch (e) {
            console.error(e);
        }
    }
    res.render(file,variables);
  });


app.listen(portNumber);