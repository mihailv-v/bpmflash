let playlistName = '';  // Store the playlist name
let songList = [];      // Store the list of songs
let playlistId = '';    // Store the ID of the created playlist (if applicable)
let accessToken = getAccessTokenFromCookie();

if (accessToken) {
  // Use accessToken for API calls
} else {
  // Redirect to index.html when no access token is found
  window.location.href = 'index.html';
}

function handleAccessTokenExpiration() {
  // Show an alert to inform the user to login

  // Redirect to index.html or any other desired page
  window.location.href = "index.html"; // Replace with the actual URL of your main page
  alert("Please login to use the playlist feature.");
}

function getAccessTokenFromCookie() {
  const cookies = document.cookie.split('; ');
  for (const cookie of cookies) {
    const [name, value] = cookie.split('=');
    if (name === 'access_token') {
      return value;
    }
  }
  return null; // Return null if access_token cookie is not found
}

async function main() {
  updateLoadingSpinner(true)
  // Step 1: Get the user's input for playlist name
  playlistName = document.getElementById('playlist-name').value;

  // Step 2: Check if the playlist name is empty
  if (!playlistName && !document.getElementById('existing-playlist-checkbox').checked) {
    // Show an error message to the user
    const playlistNameError = document.getElementById('playlist-name-error');
    playlistNameError.textContent = 'Please enter a name for the playlist.';
    return;
  }

  // Clear the playlist name error message if it was previously displayed
  const playlistNameError = document.getElementById('playlist-name-error');
  playlistNameError.textContent = '';

  // Step 3: Check if both checkboxes are checked, and if so, display an error
  const autoGenerateNameChecked = document.getElementById('auto-generate-name').checked;
  const existingPlaylistChecked = document.getElementById('existing-playlist-checkbox').checked;

  if (autoGenerateNameChecked && existingPlaylistChecked) {
    alert("Both 'Create Name Automatically' and 'Add songs to an existing playlist' cannot be checked simultaneously.");
    return;
  }

  // Step 4: Check if 'Add songs to an existing playlist' is checked
  if (existingPlaylistChecked) {
    // Handle adding songs to an existing playlist
    const playlistId = await getExistingPlaylistId(playlistName);

    if (!playlistId) {
      // The existing playlist was not found, display an error message
      const playlistNameError = document.getElementById('playlist-name-error');
      playlistNameError.textContent = 'The specified existing playlist was not found.';
      return;
    }

    // Add songs to the existing playlist
    await addSongsToExistingPlaylist(playlistId, document.getElementById('song-input').value);
  } else {
    // Step 5: Validate if the playlist name already exists
    console.log('Checking if playlist name exists...');
    const nameExists = await validateIfNameExists(playlistName);

    // Step 6: If the name exists, variate it
    let finalPlaylistName = playlistName;
    if (nameExists && !autoGenerateNameChecked) {
      console.log('Playlist name already exists. Variating it...');
      finalPlaylistName = variateNameIfExists(playlistName);
    }

    // Log the final playlist name
    console.log(`Final Playlist Name: ${finalPlaylistName}`);

    // Step 7: Create the playlist with the final name
    console.log('Creating playlist with the final name...');
    playlistId = await createPlaylistWithName(finalPlaylistName);

    // Log the playlist ID
    console.log(`Created Playlist ID: ${playlistId}`);

    // Step 8: Get the user's input for songs
    const songInput = document.getElementById('song-input').value;

    // Log song input
    console.log(`Song Input: ${songInput}`);

    // Step 9: Validate the song input
    console.log('Validating song input...');
    const validSongs = validateSongInput(songInput);

    // Log valid songs
    console.log('Valid Songs:', validSongs);

    // Step 10: Check if there are valid songs to add
    if (validSongs.length === 0) {
      // Show an error message to the user
      const songInputError = document.getElementById('song-input-error');
      songInputError.textContent = 'Please enter at least one valid song.';
      return;
    }

    // Clear the song input error message if it was previously displayed
    const songInputError = document.getElementById('song-input-error');
    songInputError.textContent = '';

    // Step 11: Check for duplicates and clean up the song list
    console.log('Cleaning up duplicate songs...');
    const cleanedSongs = cleanupDuplicateSongs(validSongs);

    // Log cleaned songs
    console.log('Cleaned Songs:', cleanedSongs);

    // Step 12: Add each song to the playlist
    console.log('Adding songs to the playlist...');
    for (const song of cleanedSongs) {
      loading=true;
      const songId = await tryAddSong(song, playlistId);
      if (songId) {
        songAddedAlterList(songId.songId, song,songId.match);
        // The song was added successfully
        console.log(`Added Song: ${song.artist} - ${song.songName}`);
      } else {
        // The song couldn't be added
        songNotAddedAlterList(song);
        console.log(`Song Not Added: ${song.artist} - ${song.songName}`);
      }
    }

    // Step 13: Update the playlist link button to allow the user to go to the playlist
    console.log('Updating playlist link button...');
    updatePlaylistLinkButton(playlistId);
    updateLoadingSpinner(false)
  }
}

async function addSongsToExistingPlaylist(existingPlaylistId, songInput) {
  // Step 8: Validate the song input
  console.log('Validating song input...');
  const validSongs = validateSongInput(songInput);

  // Log valid songs
  console.log('Valid Songs:', validSongs);

  // Step 9: Check if there are valid songs to add
  if (validSongs.length === 0) {
    // Show an error message to the user
    const songInputError = document.getElementById('song-input-error');
    songInputError.textContent = 'Please enter at least one valid song.';
    return;
  }

  // Clear the song input error message if it was previously displayed
  const songInputError = document.getElementById('song-input-error');
  songInputError.textContent = '';


  // Step 10: Check for duplicates and clean up the song list
  console.log('Cleaning up duplicate songs...');
  const cleanedSongs = cleanupDuplicateSongs(validSongs);

  // Log cleaned songs
  console.log('Cleaned Songs:', cleanedSongs);

  // Step 11: Add each song to the playlist
  console.log('Adding songs to the playlist...');
  for (const song of cleanedSongs) {
    loading = true;
    const songId = await tryAddSong(song, existingPlaylistId);
      if (songId) {
        songAddedAlterList(songId.songId, song,songId.match);
        // The song was added successfully
        console.log(`Added Song: ${song.artist} - ${song.songName}`);
      } else {
        // The song couldn't be added
        songNotAddedAlterList(song);
        console.log(`Song Not Added: ${song.artist} - ${song.songName}`);
      }
  }
  // Step 12: Update the playlist link button to allow the user to go to the playlist
  console.log('Updating playlist link button...');
  updatePlaylistLinkButton(existingPlaylistId);

}


async function getExistingPlaylistId(playlistName) {
  try {
    let offset = 0;
    let allPlaylists = [];

    // Fetch playlists in batches until all playlists are retrieved
    while (true) {
      const response = await fetch(`https://api.spotify.com/v1/me/playlists?limit=50&offset=${offset}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const playlistsBatch = await response.json();
        allPlaylists = allPlaylists.concat(playlistsBatch.items);

        // If there are more playlists, increase the offset and continue fetching
        if (playlistsBatch.items.length < 50) {
          break;
        } else {
          offset += 50;
        }
      } else {
        // Handle errors with the Spotify API
        console.error('Error fetching user playlists:', response.statusText);
        return null;
      }
    }

    // Find the playlist with the specified name
    const existingPlaylist = allPlaylists.find(item => item.name === playlistName);

    // If found, return its ID; otherwise, return null
    return existingPlaylist ? existingPlaylist.id : null;
  } catch (error) {
    // Handle any errors that occur during the API call
    console.error('Error getting existing playlist ID:', error);
    return null;
  }
}


// Call the main function when the "Add Songs" button is clicked
document.getElementById('add-song-button').addEventListener('click', main);

function updateLoadingSpinner(loading) {
  const loadingPlaceholder = document.getElementById('loading-placeholder');

  if (loading) {
    // Show the loading spinner
    loadingPlaceholder.style.display = 'flex';
    loadingPlaceholder.style.justifySelf = 'center';
  } else {
    // Hide the loading spinner
    loadingPlaceholder.style.display = 'none';
  }
}

let oldPlaylistId = null;
function updatePlaylistLinkButton(playlistId) {
  const playlistLinkButton = document.getElementById('playlist-link-button');
  const playlistStationLinkButton = document.getElementById('playlist-station-link-button');
  const playlistLinks = document.getElementById('playlist-links');
  if (playlistId) {
    playlistLinkButton.style.display = 'inline-flex';
    playlistStationLinkButton.style.display = 'inline-flex';
    playlistStationLinkButton.style.display = 'flex';
    playlistLinkButton.addEventListener('click', () => {
      // Open the playlist link in a new browser window
      window.open(`https://open.spotify.com/playlist/${playlistId}`, '_blank');
    });
    playlistStationLinkButton.addEventListener('click', () => {
      // Open the playlist link in a new browser window
      window.open(`https://open.spotify.com/station/playlist/${playlistId}`, '_blank');
    });
    // playlistLinkButton.style.width = '90';
    // playlistStationLinkButton.style.width = '90';
    playlistLinks.style.margin = '10px';
    let el = embedPreview(`https://open.spotify.com/playlist/${playlistId}`);
    el.id = `iframe-container-${playlistId}`; // Assign a unique ID to the iframe container

    if (oldPlaylistId) {
      const iframeContainerOld = document.getElementById(`iframe-container-${oldPlaylistId}`);

      if (iframeContainerOld) {
        // Remove the old iframe container and its content
        while (iframeContainerOld.firstChild) {
          iframeContainerOld.removeChild(iframeContainerOld.firstChild);
        }
        iframeContainerOld.style.display = 'none';
      }
    }

    playlistLinks.appendChild(el);
    oldPlaylistId = playlistId;
  } else {
    // Disable the button if no playlist ID is provided
    playlistStationLinkButton.style.display = 'none';
    playlistLinkButton.style.display = 'none';
    playlistStationLinkButton.style.display = 'none';
  }
  updateLoadingSpinner(false)
}


function validateSongInput(songInput) {
  // Split the input by line breaks or semicolons to get individual songs
  const songs = songInput.split(/\n|;/);

  const validSongs = [];
  for (const song of songs) {
    // Trim and remove leading/trailing spaces from each song
    const trimmedSong = song.trim();

    // Check if the song is in a valid format
    const match = trimmedSong.match(/^(.+?)\s?-\s?(.+)$/);
    if (match) {
      // Extract song name and artist without any special characters
      const artist = match[1].trim().replace(/["'`[\]{}]/g, '');
      const songName = match[2].trim().replace(/["'`[\]{}]/g, '');

      // Add the valid song to the list
      validSongs.push({ artist, songName });
    }
  }

  return validSongs;
}

async function getSongDetails(songId) {
  console.log(" song id in getSongData: "+songId)
  if(songId!=="true" && (`https://api.spotify.com/v1/tracks/${songId}`!==`https://api.spotify.com/v1/tracks/true`)){
  try {
    // Make a GET request to fetch the song details
    const response = await fetch(`https://api.spotify.com/v1/tracks/${songId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}` // Replace with your access token
      }
    });

    if (response.ok) {
      const songDetails = await response.json();
      return songDetails;
    } else {
      // Handle errors with fetching song details
      IsSongDetailsTimeout = true;
      console.error('Error fetching song details:', response.statusText);
      return null;
    }
  } catch (error) {
    // Handle any errors that occur during the API call
    console.error('Error fetching song details:', error);
    
    return null;
  }
  }else{
    console.log(songId+" - name of song id")
    return null;
  }
}

let IsSongDetailsTimeout = false;
// Function to handle when a song is added successfully
async function songAddedAlterList(songId,song,match) {
  let songDetails = null;
  if(!IsSongDetailsTimeout){
  songDetails = match;
      if (songDetails) {
    // Display the song name and artist in the "Added Songs" section
    const addedSongsList = document.getElementById('added-songs-list');
    const listItem = document.createElement('li');
    //get names of all artists in a string
    const artists = songDetails.artists.map(artist => artist.name).join(', ');
    listItem.textContent = `${artists} - ${songDetails.name}`;
    addedSongsList.appendChild(listItem);
  }
  }else{
    // Display the song name and artist in the "Added Songs" section
    const addedSongsList = document.getElementById('added-songs-list');
    const listItem = document.createElement('li');
    listItem.textContent = `;${song.artist} - ${song.songName};`;
    addedSongsList.appendChild(listItem);
  }

}


// Function to handle when a song couldn't be added
function songNotAddedAlterList(song) {
  // Display the not added song in the "Songs Not Found / Not Added" section
  const notAddedSongsList = document.getElementById('not-added-songs-list');
  const listItem = document.createElement('li');
  listItem.textContent = `${song.artist} - ${song.songName}`;
  notAddedSongsList.appendChild(listItem);
}


// function cleanupDuplicateSongs(songList) {
//   const uniqueSongs = [];
//   const encounteredSongs = new Set();

//   for (const song of songList) {
//     const songKey = `${song.artist}-${song.songName}`;

//     if (!encounteredSongs.has(songKey)) {
//       // Add the song to the unique list
//       uniqueSongs.push(song);

//       // Mark this song as encountered
//       encounteredSongs.add(songKey);
//     }
//   }

//   return uniqueSongs;
// }

function cleanupDuplicateSongs(songList) {

  // Convert the Set back to an array
  const uniqueSongsArray = [];

  // Create an array to store encountered songs (including duplicates)
  const allplusduplicates = [];

  // Create a Set to store encountered song keys
  const encounteredSongs = new Set();

  for (const currentSong of songList) {
    const { artist, songName } = currentSong;
    const songKey = `${artist}-${songName}`;

    // Add the current song to the list of all encountered songs
    allplusduplicates.push(currentSong);

    if (!encounteredSongs.has(songKey)) {
      // Add the song to the unique list if it's not already present
      uniqueSongsArray.push(currentSong);

      // Mark this song as encountered
      encounteredSongs.add(songKey);
    }
  }

  // Log the counts and arrays
  console.log('%cOriginal Song List Count:', 'font-size: 18px; color: red;', songList.length);
  console.log('%cUnique Songs Count:', 'font-size: 18px; color: green;', uniqueSongsArray.length);
  console.log('%cAll plus Duplicated Songs Count:', 'font-size: 18px; color: yellow;', allplusduplicates.length)
  console.log('%cDuplicated Songs Count:', 'font-size: 18px; color: blue;', allplusduplicates.length - uniqueSongsArray.length);

  // Return both unique songs and allplusduplicates
  return uniqueSongsArray;
}


function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// function getRandomArbitrary(min, max) {
//   let a = Math.random() * (max - min) + min;
//   console.log(a+" random seconds to wait")
//     return Math.random() * (max - min) + min;
// }
function getRandomArbitrary(min, max,time) {
  let a = Math.random() * (max - min) + min;
  console.log(`${a} random ${time} to wait`)
    return Math.random() * (max - min) + min;
}
// tryAddSongCounter=0;
// async function tryAddSong(song, playlistId) {
//   try {
//     // Define the Spotify API endpoint to add a track to a playlist
//     const apiUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks`;

//     // Create an array of URIs for the tracks to be added
//     const trackUris = [];

//     // Search for the track on Spotify using the song name and artist
//     const searchResponse = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(`track:"${song.songName}" artist:"" ${song.artist}`)}&type=track`, {
//       method: 'GET',
//       headers: {
//         'Authorization': `Bearer ${accessToken}` // Replace with your access token
//       }
//     });
//     let songId;
//     if (searchResponse.ok) {
//       const searchResult = await searchResponse.json();

//       // Check if any tracks were found
//       if (searchResult.tracks.items.length > 0) {
//         // Add the first found track to the playlist
//         trackUris.push(searchResult.tracks.items[0].uri);
//         songId = searchResult.tracks.items[0].id; // Get the song ID
//         console.log(`Added ${song.songName} by ${song.artist} to the playlist`);
//         await wait(getRandomArbitrary(1,5.625,'seconds')* 1000);
//         if(tryAddSongCounter<75){
//           tryAddSongCounter++;
//         }else{
//           console.log("\n⠀"+tryAddSongCounter+" songs added, waiting so api doesn't block requests\n");
//           await wait(getRandomArbitrary(1,16,'minutes')* 60000);
//           tryAddSongCounter=0;
//         }
//       }
//     } else {
//       updateLoadingSpinner(false)

//       // Handle errors with the search API
//       console.error('Error searching for the track:', searchResponse.statusText);
//     }
//     // Check if any track URIs were found
//     if (trackUris.length > 0) {
//       // Make a POST request to add the track to the playlist
//       const response = await fetch(apiUrl, {
//         method: 'POST',
//         headers: {
//           'Authorization': `Bearer ${accessToken}`, // Replace with your access token
//           'Content-Type': 'application/json'
//         },
//         body: JSON.stringify({
//           uris: trackUris
//         })
//       });

//       if (response.ok) {
//         return {response : true, songId : songId};
//       } else {
//         updateLoadingSpinner(false)
//         // Handle errors with adding the track
//         console.error('Error adding the track to the playlist:', response.statusText);
//       }
//     } else {
//       // Handle the case where the track was not found on Spotify
//       updateLoadingSpinner(false)
//       console.error('Track not found on Spotify:', `${song.songName} - ${song.artist}`);
//     }

//     // Song couldn't be added
//     return false;
//   } catch (error) {
//     updateLoadingSpinner(false)

//     // Handle any errors that occur during the API call
//     console.error('Error adding song:', error);
//     return false;
//   }
// }


let tryAddSongCounter = 0;

async function tryAddSong(song, playlistId) {
    try {
        console.log(`Trying to add ${song.songName} by ${song.artist} to the playlist...`);
        const bestMatch = await searchBestMatch(song);

        if (bestMatch) {
            // Add the best match to the playlist
            console.log(`Found a match for ${song.songName} by ${song.artist}.`);
            const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    uris: [bestMatch.trackUri]
                })
            });

            if (response.ok) {
                await wait(getRandomArbitrary(1, 20, 'seconds') * 1000);
                console.log(`Added ${song.songName} by ${song.artist} to the playlist.`);

                if (tryAddSongCounter < 75) {
                    tryAddSongCounter++;
                } else {
                    console.log("\n⠀" + tryAddSongCounter + " songs added, waiting so the API doesn't block requests\n");
                    await wait(getRandomArbitrary(1, 16, 'minutes') * 60000);
                    tryAddSongCounter = 0;
                }
                return { response: true, songId: bestMatch.songId,match: bestMatch };
            } else if (response.status === 401) {
                // Handle Unauthorized response by refreshing the access token and retrying
                console.log('Received a 401 Unauthorized response. Refreshing access token and retrying...');
                await refreshAccessToken();
                return tryAddSong(song, playlistId); // Retry the operation
            } else {
                updateLoadingSpinner(false);
                console.error('Error adding the track to the playlist:', response.statusText);
            }
        } else {
            updateLoadingSpinner(false);
            console.log(`No match found for ${song.songName} by ${song.artist}.`);
            console.error('Track not found on Spotify:', `${song.songName} - ${song.artist}`);
        }

        // Song couldn't be added
        console.error('Song not added:', `${song.songName} - ${song.artist}`);
        return false;
    } catch (error) {
        updateLoadingSpinner(false);
        console.error('Error adding song:', error);
        return false;
    }
}

// // Function to search for the best match of a song
// async function searchBestMatch(song) {
//     const queries = [
//         `track:"${song.songName}" artist:"${song.artist}"`,
//         `"${song.songName}" "${song.artist}"`,
//         `${song.songName} ${song.artist}`
//     ];

//     let bestMatch = null;

//     for (const query of queries) {
//         console.log(`Searching for ${song.songName} by ${song.artist} using query: ${query}`);
//         const searchResponse = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track`, {
//             method: 'GET',
//             headers: {
//                 'Authorization': `Bearer ${accessToken}`
//             }
//         });

//         if (searchResponse.status === 401) {
//             // Handle Unauthorized response by refreshing the access token and retrying
//             console.log('Received a 401 Unauthorized response in search. Refreshing access token and retrying...');
//             await refreshAccessToken();
//             return searchBestMatch(song); // Retry the search
//         }

//         if (searchResponse.ok) {
//             const searchResult = await searchResponse.json();

//             if (searchResult.tracks.items.length > 0) {
//                 // Check if the track name exactly matches the song name
//                 const exactMatch = searchResult.tracks.items.find(track => track.name.toLowerCase() === song.songName.toLowerCase());

//                 if (exactMatch) {
//                     console.log(`Exact match found for ${song.songName} by ${song.artist} using query: ${query}`);
//                     console.log(`Track Name: ${exactMatch.name}`);
//                     console.log(`Artists: ${exactMatch.artists.map(artist => artist.name).join(', ')}`);
//                     return {
//                         trackUri: exactMatch.uri,
//                         songId: exactMatch.id,
//                         query: query
//                     };
//                 }

//                 if (!bestMatch) {
//                     // If no best match has been found yet, use the first result
//                     bestMatch = {
//                         trackUri: searchResult.tracks.items[0].uri,
//                         songId: searchResult.tracks.items[0].id,
//                         query: query
//                     };
//                     console.log(`Partial match found for ${song.songName} by ${song.artist} using query: ${query}`);
//                     console.log(`Track Name: ${searchResult.tracks.items[0].name}`);
//                     console.log(`Artists: ${searchResult.tracks.items[0].artists.map(artist => artist.name).join(', ')}`);
//                 }
//             }
//         }
//     }

//     console.log(`No match found for ${song.songName} by ${song.artist}`);
//     return bestMatch;
// }
async function searchBestMatch(song) {
    const queries = [
        `track:"${song.songName}" artist:"${song.artist}"`,
        `"${song.songName}" "${song.artist}"`,
        `${song.songName} ${song.artist}`
    ];

    let bestMatches = [];

    for (const query of queries) {
        console.log(`Searching for ${song.songName} by ${song.artist} using query: ${query}`);
        const searchResponse = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        if (searchResponse.status === 401) {
            // Handle Unauthorized response by refreshing the access token and retrying
            console.log('Received a 401 Unauthorized response in search. Refreshing access token and retrying...');
            await refreshAccessToken();
            return searchBestMatch(song); // Retry the search
        }
        if (searchResponse.status === 429) {
            // Handle Unauthorized response by refreshing the access token and retrying
            console.log('Received a 429 = pausin for 20-30 mins before trying again');
            await wait(getRandomArbitrary(20, 30, 'minutes') * 60000);
            await refreshAccessToken();
            return searchBestMatch(song); // Retry the search
        }

        if (searchResponse.ok) {
            const searchResult = await searchResponse.json();

            if (searchResult.tracks.items.length > 0) {
                const trackName = song.songName.toLowerCase();
                const artistName = song.artist.toLowerCase();

                let bestMatch = null;
                let bestMatchScore = 0;

                for (const track of searchResult.tracks.items) {
                    const candidateTrackName = track.name.toLowerCase();
                    if (track.name.toLowerCase() === song.songName.toLowerCase()) {
                        // Exact match found, set the flag and return it
                        exactMatchFound = true;
                        bestMatch = track;
                      console.log(`Track Name: ${bestMatch.name}`);
                      console.log(`Artists: ${bestMatch.artists.map(artist => artist.name).join(', ')}`);
                      console.log(`ID and URI:${ bestMatch.id} ${bestMatch.uri}`);
                        return {
                        trackUri: bestMatch.uri,
                        songId: bestMatch.id,
                        query: query,
                        name: bestMatch.name,
                        artists: bestMatch.artists
                        }
                    }
                    // Calculate a score for the match
                    const score = calculateMatchScore(trackName, candidateTrackName);

                    if (score > bestMatchScore) {
                        bestMatch = track;
                        bestMatchScore = score;
                    }
                }

                if (bestMatch) {
                    console.log(`Best match found for ${song.songName} by ${song.artist} using query: ${query}`);
                    console.log(`Track Name: ${bestMatch.name}`);
                    console.log(`Artists: ${bestMatch.artists.map(artist => artist.name).join(', ')}`);
                   console.log(`ID and URI:${ bestMatch.id} ${bestMatch.uri}`);

                  bestMatches.push({
                      trackUri: bestMatch.uri,
                      songId: bestMatch.id,
                      query: query,
                      name: bestMatch.name,
                      artists: bestMatch.artists
                  });

                }
            }
        }
    }
    let trueBestMatch;
    if (bestMatches.length > 0) {
        // Evaluate best matches and select the true best match here
        trueBestMatch = bestMatches[0];
        for (const match of bestMatches) {
            if (matchBest(match, trueBestMatch, song)) {
                trueBestMatch = match;
            }
        }

        console.log(`True best match found for ${song.songName} by ${song.artist}`);
        console.log(`Track Name: ${trueBestMatch.name}`);
        console.log(`Artists: ${trueBestMatch.artists.map(artist => artist.name).join(', ')}`);
        console.log(`${trueBestMatch}`)
        return trueBestMatch;
    }

    console.log(`No match found for ${song.songName} by ${song.artist}`);
    return null;
}

function calculateMatchScore(name, candidate) {
    // Calculate a score for the match based on the provided criteria
    const percentageMatch = calculatePercentageMatch(name, candidate);
    const consecutiveLetters = countConsecutiveLetters(name, candidate);
    const vowelConsonantMatch = matchVowelsConsonants(name, candidate);
    const lengthDifference = Math.abs(name.length - candidate.length);
    const wordMatch = matchWordCount(name, candidate);

    // Assign weights to each criterion
    const percentageWeight = 1;
    const consecutiveWeight = 2;
    const vowelConsonantWeight = 1;
    const lengthWeight = 0.5;
    const wordMatchWeight = 2;

    // Calculate the overall score by combining the scores with weights
    const score = (
        percentageWeight * percentageMatch +
        consecutiveWeight * consecutiveLetters +
        vowelConsonantWeight * vowelConsonantMatch -
        lengthWeight * lengthDifference +
        wordMatchWeight * wordMatch
    );

    return score;
}

function calculatePercentageMatch(name, candidate) {
    // Calculate the percentage of name that exists in the candidate
    const minLength = Math.min(name.length, candidate.length);
    let matchCount = 0;

    for (let i = 0; i < minLength; i++) {
        if (name[i] === candidate[i]) {
            matchCount++;
        } else {
            break;
        }
    }

    return (matchCount / name.length) * 100;
}

function countConsecutiveLetters(name, candidate) {
    // Count the number of consecutive letters in the candidate
    let maxConsecutive = 0;
    let currentConsecutive = 0;

    for (let i = 0; i < name.length; i++) {
        if (name[i] === candidate[i]) {
            currentConsecutive++;
        } else {
            currentConsecutive = 0;
        }

        if (currentConsecutive > maxConsecutive) {
            maxConsecutive = currentConsecutive;
        }
    }

    return maxConsecutive;
}

function matchVowelsConsonants(name, candidate) {
    // Check if vowels and consonants match in the candidate
    const vowels = "aeiou";
    const consonants = "bcdfghjklmnpqrstvwxyz";
    let vowelMatch = 0;
    let consonantMatch = 0;

    for (let i = 0; i < name.length; i++) {
        if (vowels.includes(name[i]) && vowels.includes(candidate[i])) {
            vowelMatch++;
        } else if (consonants.includes(name[i]) && consonants.includes(candidate[i])) {
            consonantMatch++;
        }
    }

    return vowelMatch + consonantMatch;
}

function matchWordCount(name, candidate) {
    // Count how many words match between name and candidate
    const nameWords = name.split(' ');
    const candidateWords = candidate.split('');

    let matchCount = 0;
    for (const word of nameWords) {
        if (candidateWords.includes(word)) {
            matchCount++;
        }
    }

    return matchCount;
}

function matchBest(candidate, currentBest, song) {
    // Determine the true best match based on the calculated scores
    // Return true if candidate is a better match than currentBest
    // Return false if currentBest is still the best match
    return calculateMatchScore(candidate.name, song.songName) > calculateMatchScore(currentBest.name, song.songName);
}




async function validateIfNameExists(playlistName) {
  try {
    // Make a GET request to retrieve the user's playlists
    const response = await fetch("https://api.spotify.com/v1/me/playlists", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    if (response.ok) {
      const playlists = await response.json();

      // Check if a playlist with the given name exists in the user's library
      const existingPlaylist = playlists.items.find(item => item.name === playlistName);

      return !!existingPlaylist;
    } else {
      updateLoadingSpinner(false)

      // Handle errors with the Spotify API
      console.error('Error checking if playlist name exists:', response.statusText);
      return false;
    }
  } catch (error) {
    updateLoadingSpinner(false)

    // Handle any errors that occur during the API call
    console.error('Error checking if playlist name exists:', error);
    return false;
  }
}

function variateNameIfExists(playlistName) {
  const uniqueIdentifier = Date.now(); // Use a timestamp as a unique identifier
  return `${playlistName} (${uniqueIdentifier})`;
}

async function createPlaylistWithName(finalPlaylistName) {
  try {
    // Make a POST request to create a new playlist
    const response = await fetch(`https://api.spotify.com/v1/me/playlists`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name: finalPlaylistName,
        public: false // Set to true if you want the playlist to be public
      })
    });

    if (response.ok) {
      const playlist = await response.json();
      return playlist.id;
    } else {
      updateLoadingSpinner(false)

      // Handle errors with creating the playlist
      console.error('Error creating the playlist:', response.statusText);
      return null;
    }
  } catch (error) {
    updateLoadingSpinner(false)

    // Handle any errors that occur during the API call
    console.error('Error creating the playlist:', error);
    return null;
  }
}

// Function to check if the access token is expired and refresh it if possible
async function checkAndRefreshToken() {
  try {
    const response = await fetch("https://api.spotify.com/v1/me", {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
      },
    });

    if (response.status === 401) {
      // Access token has expired or not provided
      await refreshAccessToken();
    }
  } catch (error) {
    console.error("Error checking/accessing token:", error);
  }
}

checkAndRefreshToken();


// Rest of your existing code...

async function getAllUserPlaylists() {
  try {
    let allPlaylists = [];

    let nextUrl = `https://api.spotify.com/v1/me/playlists?limit=50`;

    while (nextUrl) {
      const response = await fetch(nextUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const playlistsBatch = await response.json();
        allPlaylists = allPlaylists.concat(playlistsBatch.items);
        nextUrl = playlistsBatch.next; // Get the next URL for pagination
      } else {
        console.error('Error fetching user playlists:', response.statusText);
        return null;
      }
    }

    return allPlaylists;
  } catch (error) {
    console.error('Error fetching user playlists:', error);
    return null;
  }
}

// //with duplicate names
// async function listTracksFromPlaylist(playlistName) {
//     try {
//         // Step 1: Get all user playlists
//         const allPlaylists = await getAllUserPlaylists();

//         if (!allPlaylists) {
//             console.error('Failed to fetch user playlists.');
//             return;
//         }

//         // Step 2: Find the playlist by name
//         const targetPlaylist = allPlaylists.find(playlist => playlist.name === playlistName);

//         if (!targetPlaylist) {
//             console.error(`Playlist "${playlistName}" not found.`);
//             return;
//         }

//         // Step 3: Get the tracks of the target playlist
//         const playlistId = targetPlaylist.id;
//         console.log(`Fetching tracks for playlist with ID: ${playlistId}`);

//         const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
//             method: 'GET',
//             headers: {
//                 'Authorization': `Bearer ${accessToken}`,
//             },
//         });

//         if (!response.ok) {
//             console.error('Error fetching playlist tracks:', response.statusText);
//             return;
//         }

//         console.log('Playlist tracks successfully fetched.');

//         const playlistTracks = await response.json();

//         console.log(playlistTracks);

//         // Step 4: Display the tracks
//         const tracksList = document.getElementById('playlist-tracks-list');
//         tracksList.innerHTML = ''; // Clear previous list

//         for (const track of playlistTracks.items) {
//             const trackName = track.track.name;
//             const artistNames = track.track.artists.map(artist => artist.name).join(', ');
//             const listItem = document.createElement('li');
//             listItem.textContent = `${artistNames} - ${trackName}`;
//             tracksList.appendChild(listItem);
//         }
//     } catch (error) {
//         console.error('Error listing tracks from playlist:', error);
//     }
// }

// //w/o duplicate names
// async function listTracksFromPlaylist(playlistName) {
//     try {
//         // Step 1: Get all user playlists
//         const allPlaylists = await getAllUserPlaylists();

//         if (!allPlaylists) {
//             console.error('Failed to fetch user playlists.');
//             return;
//         }

//         // Step 2: Find the playlist by name
//         const targetPlaylist = allPlaylists.find(playlist => playlist.name === playlistName);

//         if (!targetPlaylist) {
//             console.error(`Playlist "${playlistName}" not found.`);
//             return;
//         }

//         // Step 3: Get the tracks of the target playlist
//         const playlistId = targetPlaylist.id;
//         console.log(`Fetching tracks for playlist with ID: ${playlistId}`);

//         const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
//             method: 'GET',
//             headers: {
//                 'Authorization': `Bearer ${accessToken}`,
//             },
//         });

//         if (!response.ok) {
//             console.error('Error fetching playlist tracks:', response.statusText);
//             return;
//         }

//         console.log('Playlist tracks successfully fetched.');

//         const playlistTracks = await response.json();

//         // Step 4: Display the tracks without duplicates
//         const tracksList = document.getElementById('playlist-tracks-list');
//         tracksList.innerHTML = ''; // Clear previous list

//         const encounteredTracks = new Set(); // To track encountered track IDs

//         for (const track of playlistTracks.items) {
//             const trackId = track.track.id;

//             if (!encounteredTracks.has(trackId)) {
//                 const trackName = track.track.name;
//                 const artistNames = track.track.artists.map(artist => artist.name).join(', ');
//                 const listItem = document.createElement('li');
//                 listItem.textContent = `${artistNames} - ${trackName}`;
//                 tracksList.appendChild(listItem);
//                 encounteredTracks.add(trackId); // Add the track to the encountered set
//             }
//         }
//     } catch (error) {
//         console.error('Error listing tracks from playlist:', error);
//     }
// }

////with pagination
/*async function listTracksFromPlaylist(playlistName) {
    try {
        // Step 1: Get all user playlists
        const allPlaylists = await getAllUserPlaylists();

        if (!allPlaylists) {
            console.error('Failed to fetch user playlists.');
            return;
        }

        // Step 2: Find the playlist by name
        const targetPlaylist = allPlaylists.find(playlist => playlist.name === playlistName);

        if (!targetPlaylist) {
            console.error(`Playlist "${playlistName}" not found.`);
            return;
        }

        // Step 3: Get all tracks from the playlist (including pagination)
        const playlistId = targetPlaylist.id;
        const tracksList = document.getElementById('playlist-tracks-list');
        tracksList.innerHTML = ''; // Clear previous list

        let nextUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`;
        let hasNextPage = true;

        while (hasNextPage) {
            const response = await fetch(nextUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (!response.ok) {
                console.error('Error fetching playlist tracks:', response.statusText);
                return;
            }

            const playlistTracks = await response.json();

            for (const track of playlistTracks.items) {
                const trackName = track.track.name;
                const artistNames = track.track.artists.map(artist => artist.name).join(', ');
                const listItem = document.createElement('li');
                listItem.textContent = `${artistNames} - ${trackName}`;
                tracksList.appendChild(listItem);
            }

            // Check if there's a next page of tracks
            hasNextPage = !!playlistTracks.next;

            // If there's a next page, update the nextUrl for the next request
            if (hasNextPage) {
                nextUrl = playlistTracks.next;
            }
        }

        console.log('All tracks from the playlist have been listed.');

    } catch (error) {
        console.error('Error listing tracks from playlist:', error);
    }
}*/

//v4 listTracks
async function listTracksFromPlaylist(playlistName) {
  try {
    // Step 1: Get all user playlists
    const allPlaylists = await getAllUserPlaylists();

    if (!allPlaylists) {
      console.error('Failed to fetch user playlists.');
      return;
    }

    // Step 2: Find the playlist by name
    const targetPlaylist = allPlaylists.find(playlist => playlist.name === playlistName);

    if (!targetPlaylist) {
      console.error(`Playlist "${playlistName}" not found.`);
      return;
    }

    // Step 3: Get all tracks from the playlist (including pagination)
    const playlistId = targetPlaylist.id;
    const tracksList = document.getElementById('playlist-tracks-list');
    tracksList.innerHTML = ''; // Clear previous list

    let offset = 0;
    let hasNextPage = true;

    while (hasNextPage) {
      const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50&offset=${offset}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        console.error('Error fetching playlist tracks:', response.statusText);
        return;
      }

      const playlistTracks = await response.json();

      for (const track of playlistTracks.items) {
        const trackName = track.track.name;
        const artistNames = track.track.artists.map(artist => artist.name).join(', ');
        const listItem = document.createElement('li');
        listItem.textContent = `${artistNames} - ${trackName}`;
        tracksList.appendChild(listItem);
      }

      // Check if there's a next page of tracks
      hasNextPage = playlistTracks.next !== null;

      // If there's a next page, update the offset for the next request
      if (hasNextPage) {
        offset += 50;
      }
    }

    console.log('All tracks from the playlist have been listed.');

  } catch (error) {
    console.error('Error listing tracks from playlist:', error);
  }
}

async function fetchPlaylistData(playlistName) {
  try {
    // Step 1: Get all user playlists
    const allPlaylists = await getAllUserPlaylists();

    if (!allPlaylists) {
      console.error('Failed to fetch user playlists.');
      return;
    }

    // Step 2: Find the playlist by name
    const targetPlaylist = allPlaylists.find(playlist => playlist.name === playlistName);

    if (!targetPlaylist) {
      console.error(`Playlist "${playlistName}" not found.`);
      return;
    }

    // Step 3: Get the playlist ID
    const playlistId = targetPlaylist.id;

    // Step 4: Fetch tracks data for the playlist
    const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error('Error fetching playlist data:', response.statusText);
      return null;
    }

    const playlistData = await response.json();

    // Return the playlist data
    return playlistData;

  } catch (error) {
    console.error('Error fetching playlist data:', error);
    return null;
  }
}

async function getBPMForTrack(trackId) {
  await wait(getRandomArbitrary(1, 2, 'seconds') * 1000); // Cooldown
  try {
    // Fetch audio features for the track
    const response = await fetch(`https://api.spotify.com/v1/audio-features/${trackId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      console.error('Error fetching audio features for track:', response.statusText);
      return null;
    }

    const audioFeaturesData = await response.json();

    // Get and return the tempo (BPM) from the audio features data
    const tempo = audioFeaturesData.tempo;
    return tempo;

  } catch (error) {
    console.error('Error fetching audio features for track:', error);
    return null;
  }
}

async function getAllTracksFromPlaylist(playlistId) {
  try {
    const allTracks = [];

    let offset = 0;
    let hasNextPage = true;

    while (hasNextPage) {
      const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50&offset=${offset}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        console.error('Error fetching playlist tracks:', response.statusText);
        return null;
      }

      const playlistTracks = await response.json();

      // Add the fetched tracks to the array
      allTracks.push(...playlistTracks.items);

      // Check if there's a next page of tracks
      hasNextPage = playlistTracks.next !== null;

      // If there's a next page, update the offset for the next request
      if (hasNextPage) {
        offset += 50;
      }
    }

    // Return all tracks from the playlist
    return allTracks;

  } catch (error) {
    console.error('Error fetching playlist tracks:', error);
    return null;
  }
}




document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('list-tracks-button').addEventListener('click', async () => {
    const playlistNameToList = document.getElementById('playlist-name-to-list').value;
    await listTracksFromPlaylist(playlistNameToList);
  });
});








// Add event listener to the "Transform URL" button
document.getElementById('transform-url-button').addEventListener('click', async function() {
  // Get the playlist name from the input field
  const playlistName = document.getElementById('playlist-name-to-transform').value;

  // Get all user playlists
  const allPlaylists = await getAllUserPlaylists(accessToken);

  if (allPlaylists) {
    // Search for the playlist by name
    const playlist = allPlaylists.find(item => item.name === playlistName);

    if (playlist) {
      const playlistURL = playlist.external_urls.spotify;
      const transformedURL = playlistURL.replace('.com/', '.com/station/');

      // Display transformed link and button
      document.getElementById('transformed-playlist-link').textContent = transformedURL;
      document.getElementById('transformed-link-section').style.display = 'inherit';
    } else {
      alert('Playlist not found in your library. Please check the name and try again.');
    }
  } else {
    alert('An error occurred while fetching playlists.');
  }
});

// Add event listener to the "Go to Transformed Link" button
document.getElementById('go-to-transformed-link-button').addEventListener('click', function() {
  const transformedURL = document.getElementById('transformed-playlist-link').textContent;
  window.open(transformedURL, '_blank');
});

// // Add event listener to the "Transform Direct Link" button
// document.getElementById('transform-direct-link-button').addEventListener('click', function() {
//   const directLink = document.getElementById('direct-playlist-link').value;
//   let tranformedDirectLink;
//   if(directLink.startsWith('https://open.spotify.com/')) {
//    transformedDirectLink = directLink.replace('.com/', '/station/');
//   }else{
//      transformedDirectLink=`Not a a valid Spotify link`;
//   }
//   // Display transformed link and button
//   document.getElementById('transformed-direct-playlist-link').textContent = transformedDirectLink;
//   document.getElementById('transformed-direct-link-section').style.display = 'block';
// });

// // Add event listener to the "Go to Transformed Direct Link" button
// document.getElementById('go-to-transformed-direct-link-button').addEventListener('click', function() {
//   const transformedDirectLink = document.getElementById('transformed-direct-playlist-link').textContent;
//   if(transformedDirectLink.trim().startsWith('https://open.spotify.com/')){
//   window.open(transformedDirectLink, '_blank');
//   }
// });

document.getElementById('transform-direct-link-button').addEventListener('click', function() {
  const directLink = document.getElementById('direct-playlist-link').value;
  let transformedDirectLink;
  if (directLink.startsWith('https://open.spotify.com/')) {
    transformedDirectLink = directLink.replace('.com/', '.com/station/');
  } else {
    transformedDirectLink = `Not a valid Spotify link`;
  }

  // Apply styles to the link div before making it visible
  const transformedLinkContainer = document.getElementById('transformed-direct-playlist-link');
  transformedLinkContainer.style.overscrollBehaviorX = 'contain';
  transformedLinkContainer.style.overflowWrap = 'anywhere';

  transformedLinkContainer.textContent = transformedDirectLink;
  document.getElementById('transformed-direct-link-section').style.display = 'inherit';

  console.log('Transformed link displayed.');
});

document.getElementById('go-to-transformed-direct-link-button').addEventListener('click', function() {
  const transformedDirectLink = document.getElementById('transformed-direct-playlist-link').textContent.trim();
  console.log(transformedDirectLink.startsWith('https://open.spotify.com/'));
  console.log(transformedDirectLink);
  if (transformedDirectLink.trim().startsWith('https://open.spotify.com/')) {
    console.log('Opening transformed link in an iframe...');

    // Apply styles to the button before making it visible
    const transformButton = document.getElementById('go-to-transformed-direct-link-button');
    transformButton.style.display = 'inline-flex';
    transformButton.style.flexDirection = 'column';
    transformButton.style.alignContent = 'flex-start';
    transformButton.style.justifyContent = 'space-evenly';
    transformButton.style.alignItems = 'center';
    transformButton.style.flexWrap = 'wrap';

    //open transf link in new window
    window.open(transformedDirectLink, '_blank');
}
})



// Add event listener to the "Search and Transform URL" button
document.getElementById('search-transform-url-button').addEventListener('click', async function() {
  // Get the playlist name to search
  const searchPlaylistName = document.getElementById('search-playlist-name').value;

  // Use Spotify's Web API to search for playlists by name
  const searchResults = await searchPlaylistsByName(searchPlaylistName);

  if (searchResults && searchResults.length > 0) {
    // Display the first 5 search results
    const searchResultsList = document.getElementById('search-results-list');
    searchResultsList.innerHTML = ''; // Clear previous results

    for (let i = 0; i < Math.min(15, searchResults.length); i++) {
      const result = searchResults[i];

      // Create list item for each search result
      const listItem = document.createElement('li');
      

      // Display the exact name of the playlist
      const playlistNameLabel = document.createElement('p');
      playlistNameLabel.textContent = `Playlist Name: ${result.name} && Playlist URI: ${result.uri}`;
      listItem.appendChild(playlistNameLabel).appendChild(embedPreview(result.external_urls.spotify));

      // Add a button to transform the URL and go to the playlist
      const transformButton = document.createElement('button');
      transformButton.textContent = 'Transform and Go to Playlist';
      transformButton.addEventListener('click', function() {
        const playlistURL = result.external_urls.spotify;
        const transformedURL = playlistURL.replace('/playlist/', '/station/playlist/');
        let el = embedPreview(result.external_urls.spotify);

        // Open the transformed URL in a new window
        window.open(transformedURL, '_blank');
      });

      listItem.appendChild(transformButton);
      searchResultsList.appendChild(listItem);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    // Display search results section
    document.getElementById('search-results-section').style.display = 'inherit';
  } else {
    alert('No playlists found matching the search criteria.');
  }
});


// Function to search for playlists by name using Spotify Web API
async function searchPlaylistsByName(playlistName) {
  try {
    
    const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(playlistName)}&type=playlist`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      return data.playlists.items;
    } else {
      console.error('Error searching for playlists:', response.statusText);
      return null;
    }
  } catch (error) {
    console.error('Error searching for playlists:', error);
    return null;
  }
}



// Add event listener to the "Start Removing Duplicates" button
document.getElementById('remove-duplicates-button').addEventListener('click', async function() {
  // Get the playlist name from the input field
  const playlistName = document.getElementById('playlist-name-to-remove-duplicates').value;

  // Get all user playlists
  const allPlaylists = await getAllUserPlaylists(accessToken);

  if (allPlaylists) {
    // Search for the playlist by name
    const playlist = allPlaylists.find(item => item.name.toLowerCase() === playlistName.toLowerCase());

    if (playlist) {
      // Fetch all tracks from the playlist
      const playlistTracks = await getAllTracksFromPlaylist(playlist.id);

      if (playlistTracks) {
        // Find duplicate tracks based on track ID
        const duplicateTracks = findDuplicateTracks(playlistTracks);

        // Display tracks to remove
        const tracksToRemoveList = document.getElementById('tracks-to-remove-list');
        tracksToRemoveList.innerHTML = ''; // Clear previous results

        duplicateTracks.forEach(track => {
          const artists = track.track.artists.map(artist => artist.name).join(', '); // Join multiple artists with a comma
          const trackInfo = `${artists} - ${track.track.name}`;

          const listItem = document.createElement('li');
          listItem.textContent = trackInfo;
          tracksToRemoveList.appendChild(listItem);
        });

        // Remove duplicate tracks
        const removedTracks = await removeDuplicateTracks(accessToken, playlist.id, duplicateTracks);

        // Check if tracks were removed successfully
        if (removedTracks.length > 0) {
          // Display removed duplicate tracks
          const removedTracksList = document.getElementById('removed-duplicate-tracks-list');
          removedTracksList.innerHTML = ''; // Clear previous results

          removedTracks.forEach(track => {
            const artists = track.track.artists.map(artist => artist.name).join(', '); // Join multiple artists with a comma
            const trackInfo = `${artists} - ${track.track.name} \nAdded at: ${new Date(track.added_at).toLocaleString()}`;

            const listItem = document.createElement('li');
            listItem.textContent = trackInfo;
            removedTracksList.appendChild(listItem);
          });

          // Add the removed tracks back
          const addedBackTracks = await addTracksToPlaylist(accessToken, playlist.id, removedTracks);

          // Check if tracks were added back successfully
          if (addedBackTracks) {
            // Display added back tracks
            const addedBackTracksList = document.getElementById('added-back-tracks-list');
            addedBackTracksList.innerHTML = ''; // Clear previous results

            addedBackTracks.forEach(track => {
              const artists = track.track.artists.map(artist => artist.name).join(', '); // Join multiple artists with a comma
              const trackInfo = `${artists} - ${track.track.name}`;

              const listItem = document.createElement('li');
              listItem.textContent = trackInfo;
              addedBackTracksList.appendChild(listItem);
            });
          } else {
            alert('Error adding back removed tracks.');
          }
        } else {
          alert('No duplicate tracks found or an error occurred during removal.');
        }
      } else {
        alert('Error fetching tracks from the playlist.');
      }
    } else {
      alert('Playlist not found in your library. Please check the name and try again.');
    }
  } else {
    alert('An error occurred while fetching playlists.');
  }
});

// Function to find duplicate tracks based on track ID
function findDuplicateTracks(playlistTracks) {
  const trackIds = new Set();
  const duplicateTracks = [];

  playlistTracks.forEach(track => {
    if (track.track.id && !trackIds.has(track.track.id)) {
      trackIds.add(track.track.id);
    } else {
      duplicateTracks.push(track);
    }
  });

  return duplicateTracks;
}

async function addTracksToPlaylist(accessToken, playlistId, tracksToAdd) {
  try {
    // Clean the tracks to remove duplicates with the same URI
    const cleanedTracks = removeDuplicateTracksByUri(tracksToAdd);

    // Extract unique URIs
    const uniqueUris = Array.from(new Set(cleanedTracks.map(track => track.track.uri)));

    const chunkSize = 100; // Maximum number of tracks to add at once
    const addedBackTracks = [];
    const addedUris = new Set();

    for (let i = 0; i < uniqueUris.length; i += chunkSize) {
      const chunkUris = uniqueUris.slice(i, i + chunkSize);

      const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          uris: chunkUris,  // Pass the URIs as a JSON array
        }),
      });

      if (response.ok) {
        // Collect the tracks that were added
        const addedTracks = cleanedTracks.filter(track => chunkUris.includes(track.track.uri));
        addedBackTracks.push(...addedTracks);

        // Add the URIs to the set of added URIs
        chunkUris.forEach(uri => addedUris.add(uri));
      } else {
        console.error('Error adding tracks:', response.statusText);
      }
    }

    return addedBackTracks;
  } catch (error) {
    console.error('Error adding tracks:', error);
    return [];
  }
}


function removeDuplicateTracksByUri(tracks) {
  const seenUris = new Set();
  const uniqueTracks = [];

  for (const track of tracks) {
    const uri = ((track.track.uri)?track.track.uri:track.uri);
    if (!seenUris.has(uri)) {
      seenUris.add(uri);
      uniqueTracks.push(track);
    }
  }

  return uniqueTracks;
}



async function removeDuplicateTracks(accessToken, playlistId, duplicateTracks) {
  try {
    const chunkSize = 100; // Maximum number of tracks to remove at once
    const removedTracks = [];

    for (let i = 0; i < duplicateTracks.length; i += chunkSize) {
      const tracksToRemove = duplicateTracks.slice(i, i + chunkSize);

      // Ensure that the tracksToRemove array contains valid URIs
      const uris = tracksToRemove.map(track => track.track.uri).filter(uri => uri);

      console.log('Tracks to remove:', uris); // Log the URIs being removed

      if (uris.length > 0) {
        // Make the DELETE request
        const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            tracks: uris.map(uri => ({ uri })),
          }),
        });

        if (response.ok) {
          // Collect removed tracks
          removedTracks.push(...tracksToRemove);

          console.log('Successfully removed tracks:', uris); // Log the URIs of successfully removed tracks
        } else {
          console.error('Error removing tracks:', response.statusText);
          // You can add a handler to retry or handle errors here
        }
      }
    }

    console.log('Removed tracks:', removedTracks); // Log the removed tracks before returning
    return removedTracks;
  } catch (error) {
    console.error('Error removing tracks:', error);
    return [];
  }
}







// Function to unshorten a Spotify link
async function unshortenSpotifyLink(shortLink) {
  try {
    const response = await fetch(`/unshorten-new-spotify-link?shortLink=${shortLink}`);

    if (response.status === 200) {
      return response.json(); // Parse the response as JSON
    } else {
      console.error('Error unshortening the link:', response.data.error);
      return null;
    }
  } catch (error) {
    console.error('Error unshortening the link:', error);
    return null;
  }
}


function embedPreview(link) {
  // Create the iframe element
  const iframeElement = document.createElement('iframe');
  const divIframeContainer = document.createElement('div');
  iframeElement.style.borderRadius = '15px';
  iframeElement.src = `${link.replace(".com", ".com/embed")}?utm_source=generator&theme=0`;
  iframeElement.width = '100%';
  iframeElement.maxWidth = '100%';
  iframeElement.display = 'inline-flex';
  iframeElement.height = '200px';
  iframeElement.style.overflowX = 'scroll';
  iframeElement.allowFullscreen = true;
  iframeElement.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
  iframeElement.loading = 'lazy';
  iframeElement.sandbox = "allow-same-origin allow-scripts allow-popups allow-forms";


  divIframeContainer.style.cssText = `
    
    display: inline-flex;
    flex-direction: row;
    flex-wrap: wrap;
    align-content: flex-start;
    justify-content: center;
    align-items: center;
`
  divIframeContainer.appendChild(iframeElement);
  return divIframeContainer;
}

function updateUnshortenedLinkList(linkData) {
  const unshortenedLinkList = document.getElementById('unshortened-link-list');

  // Create a list item for the unshortened link
  const listItem = document.createElement('li');
  listItem.textContent = linkData.unshortenedLink;

  // If there is type and name data, add them to the same li element
  if (linkData.type && linkData.name) {
    const typeAndName = document.createElement('div');
    typeAndName.textContent = `${linkData.type} – ${linkData.name}`;
    listItem.appendChild(typeAndName);
  }


  // Append the iframe to the list item
  listItem.appendChild(embedPreview(linkData.unshortenedLink));

  // Create a button to open the playlist in a new tab
  const goToPlaylistButton = document.createElement('button');
  goToPlaylistButton.textContent = 'Go to Playlist';
  goToPlaylistButton.addEventListener('click', () => {
    window.open(linkData.unshortenedLink);
  });

  // Append the button to the list item
  listItem.appendChild(goToPlaylistButton);

  // Append the list item to the unshortened link list
  unshortenedLinkList.appendChild(listItem);
}








// Add event listener to unshorten button
document.getElementById('unshorten-button').addEventListener('click', async () => {
  const shortLink = document.getElementById('shortened-link').value;
  const linkData = await unshortenSpotifyLink(encodeURIComponent(shortLink));
  if (linkData) {
    updateUnshortenedLinkList(linkData);
  }
});



document.addEventListener("DOMContentLoaded", function() {
    const embedButton = document.getElementById("embed-button");
    const spotifyLinkInput = document.getElementById("spotify-link");
    const embeddedDiv = document.getElementById("embedded-spotify");

    embedButton.addEventListener("click", function() {
        const spotifyLink = spotifyLinkInput.value.trim();
        if (spotifyLink.startsWith('https://open.spotify.com/')) {
            embeddedDiv.appendChild(embedPreview(spotifyLink));
        } else {
            // Handle invalid link
            alert("Invalid Spotify link. Please enter a valid Spotify playlist link.");
        }
    });


})



// Function to refresh the access token
async function refreshAccessToken() {
    try {
        const response = await fetch('/refresh-token', {
            method: 'GET',
            // Add any headers or credentials if needed
        });

        if (response.status === 200) {
            console.log('Access token refreshed successfully');
            accessToken=getCookie("access_token");
            isTokenExpired = false;
            // You can perform any additional actions here
        } else {
            handleAccessTokenExpiration();
            console.error('Error refreshing access token:', response.statusText);
        }
    } catch (error) {
        console.error('Error refreshing access token:', error);
    }
}

// Call the refreshAccessToken function initially
refreshAccessToken();

// Set up an interval to refresh the access token every 30 minutes (30 minutes * 60 seconds * 1000 milliseconds)
const refreshInterval = 15 * 60 * 1000;

setInterval(refreshAccessToken, refreshInterval);

// Function to get a cookie value by name
function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(";").shift();
}
// Function to delete a cookie
function deleteCookie(name) {
  document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  console.log(`cookie ${name} deleted`);
}





// Function to fetch user details (including the ID)
async function getUserDetails() {
    try {
        const response = await fetch('https://api.spotify.com/v1/me', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`, // Use the user's access token
            },
        });

        if (response.ok) {
            const data = await response.json();
            return data.id; // Return the user's ID
        } else {
            throw new Error(`Failed to fetch user details: ${response.status} - ${response.statusText}`);
        }
    } catch (error) {
        console.error('Error fetching user details:', error);
        throw error;
    }
}

// Function to fetch all user playlists with pagination
async function fetchAllUserPlaylists(userId) {
    let playlists = [];
    let limit = 50; // Adjust the limit based on your needs
    let offset = 0;

    while (true) {
        try {
            const response = await fetch(`https://api.spotify.com/v1/me/playlists?limit=${limit}&offset=${offset}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`, // Use the user's access token
                },
            });

            if (response.ok) {
                const data = await response.json();
                playlists = playlists.concat(data.items);
                offset += limit;

                if (!data.next) {
                    break; // No more pages to fetch
                }
            } else {
                throw new Error(`Failed to fetch playlists: ${response.status} - ${response.statusText}`);
            }
        } catch (error) {
            console.error('Error fetching playlists:', error);
            throw error;
        }
    }

    return playlists;
}


// Example usage:
async function fetchOwnedPlaylists() {
    try {
        const userId = await getUserDetails();
        const userPlaylists = await fetchAllUserPlaylists(userId);

        // Filter playlists to display only the ones owned by the current user
        return userPlaylists.filter(playlist => playlist.owner.id === userId);

        // Now you can display the owned playlists and implement the radio buttons and submission logic.
    } catch (error) {
        console.error('Error loading user playlists:', error);
    }
}


// Function to fetch the user's playlists
document.getElementById("fetch-playlists-button").addEventListener("click", async function() {
    try {
        // Make an API request to fetch the user's playlists
        const playlists = await fetchOwnedPlaylists(); // Implement this function

        // Populate the playlist-container with playlists and privacy options
        const playlistContainer = document.getElementById("playlist-container");
        playlistContainer.innerHTML = ""; // Clear existing content

        const publicPlaylistsDiv = document.createElement("div");
        //make h2 name and border
        const publicPlaylistsH2 = document.createElement("h2");
        publicPlaylistsH2.innerHTML = "Public Playlists";
        publicPlaylistsH2.style.border = "1px solid none solid none";
        publicPlaylistsDiv.appendChild(publicPlaylistsH2);
      
        const privatePlaylistsDiv = document.createElement("div");
      
        //make h2 name and border
      
        const privatePlaylistsH2 = document.createElement("h2");
      
        privatePlaylistsH2.innerHTML = "Private Playlists";
      
        privatePlaylistsH2.style.border = "1px solid none solid none";
      
        privatePlaylistsDiv.appendChild(privatePlaylistsH2);


      
        playlists.forEach((playlist) => {
            // Create elements for each playlist and its privacy options
            const playlistDiv = document.createElement("div");
            playlistDiv.innerHTML = `
                <h3>${playlist.name}</h3>
                <input type="radio" id="${playlist.id}-public" name="${playlist.id}" value="public" ${playlist.public ? "checked" : ""}>
                <label for="${playlist.id}-public">Public</label>
                <input type="radio" id="${playlist.id}-private" name="${playlist.id}" value="private" ${!playlist.public ? "checked" : ""}>
                <label for="${playlist.id}-private">Private</label>
            `;

            // Append the playlist to the appropriate section
            if (playlist.public) {
                publicPlaylistsDiv.appendChild(playlistDiv);
            } else {
                privatePlaylistsDiv.appendChild(playlistDiv);
            }
        });

        // Append the sections to the playlist-container
        if (publicPlaylistsDiv.childElementCount > 0) {
            playlistContainer.appendChild(publicPlaylistsDiv);
        }

        if (privatePlaylistsDiv.childElementCount > 0) {
            playlistContainer.appendChild(privatePlaylistsDiv);
        }

        // Show the "Submit" button if at least one playlist is appended
        const submitButton = document.getElementById("submit-privacy-button");
        if (playlists.length > 0) {
            submitButton.style.display = "block";
        } else {
            submitButton.style.display = "none";
        }
    } catch (error) {
        console.error("Error fetching playlists:", error);
    }
});


// Function to submit privacy changes
document.getElementById("submit-privacy-button").addEventListener("click", async function() {
    const playlistContainer = document.getElementById("playlist-container");
    const playlists = playlistContainer.querySelectorAll("div");

    const updates = []; // An array to store update requests

    for (const playlistDiv of playlists) {
        const playlistId = playlistDiv.querySelector("input[type=radio]:checked").name;
        const privacyValue = playlistDiv.querySelector("input[type=radio]:checked").value;

        // Check if privacy status has changed
        const originalPrivacyValue = playlistDiv.querySelector("input[type=radio][value=" + (privacyValue === "public" ? "private" : "public") + "]");
        if (originalPrivacyValue) {
            // Only add the update if there's a change
            updates.push({ id: playlistId, public: privacyValue === 'public' });
        }
    }

    if (updates.length > 0) {
        try {
            // Make API requests to update playlist privacy for each playlist
            for (const update of updates) {
                const response = await updatePlaylistPrivacy(update.id, update.public);
                if (response.ok) {
                    // Handle a successful update, e.g., display a success message
                    console.log(`Playlist ${update.id} privacy updated successfully.`);
                } else {
                    // Handle update failure, e.g., display an error message
                    console.error(`Failed to update privacy for playlist ${update.id}`);
                }
            }
        } catch (error) {
            console.error("Error updating privacy:", error);
        }
    }
});



// Function to update playlist privacy
async function updatePlaylistPrivacy(playlistId, isPublic) {
    try {
        const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                public: isPublic,
            }),
        });

        return response;
    } catch (error) {
        console.error('Error updating playlist privacy:', error);
        throw error;
    }
}




async function performAdvancedDuplicateRemoval(accessToken, playlistName) {
  try {
    // Get all user playlists
    const allPlaylists = await getAllUserPlaylists(accessToken);

    if (allPlaylists) {
      // Search for the playlist by name
      const playlist = allPlaylists.find(item => item.name.toLowerCase() === playlistName.toLowerCase());

      if (playlist) {
        // Fetch all tracks from the playlist
        const playlistTracks = await getAllTracksFromPlaylist(playlist.id);

        if (playlistTracks) {
          // Find duplicate tracks based on track name and artists
          const duplicateTracks = await findDuplicateTracksAdvanced(playlistTracks);

          if (duplicateTracks.length > 0) {
            // Display duplicate tracks to remove
            displayDuplicateTracksToBeRemovedAdvanced(duplicateTracks);

            // Remove duplicate tracks
            const removedTracks = await removeDuplicateTracksAdvanced(accessToken, playlist.id, duplicateTracks);

            if (removedTracks.length > 0) {
              // Display removed duplicate tracks
              displayRemovedDuplicateTracksAdvanced(removedTracks);

              // Add the removed tracks back based on the logic
              const addedBackTracks = await addTracksToPlaylistAdvanced(accessToken, playlist.id, removedTracks);

              if (addedBackTracks.length > 0) {
                // Display added back tracks
                displayAddedBackTracksAdvanced(addedBackTracks);
              } else {
                console.error('Error adding back removed tracks.');
                alert('Error adding back removed tracks.');
              }
            } else {
              console.error('No duplicate tracks found or an error occurred during removal.');
              alert('No duplicate tracks found or an error occurred during removal.');
            }
          } else {
            console.error('No duplicate tracks found in the playlist.');
            alert('No duplicate tracks found in the playlist.');
          }
        } else {
          console.error('Error fetching tracks from the playlist.');
          alert('Error fetching tracks from the playlist.');
        }
      } else {
        console.error('Playlist not found in your library. Please check the name and try again.');
        alert('Playlist not found in your library. Please check the name and try again.');
      }
    } else {
      console.error('An error occurred while fetching playlists.');
      alert('An error occurred while fetching playlists.');
    }
  } catch (error) {
    console.error('Error removing duplicates:', error);
    alert('An error occurred while removing duplicates.');
  }
}

async function findDuplicateTracksAdvanced(playlistTracks) {
  try {
    const duplicateTracks = [];
    const trackMap = new Map(); // Store tracks using their name-artist as the key

    playlistTracks.forEach((track) => {
      // Create a unique identifier for the track using name and artists
      const trackIdentifier = `${track.track.name}-${track.track.artists.map(artist => artist.name).join(', ')}`;

      if (!trackMap.has(trackIdentifier)) {
        // If no track with the same identifier is found, add it to the map
        trackMap.set(trackIdentifier, track);
      } else {
        // If a track with the same identifier exists, compare priority
        const existingTrack = trackMap.get(trackIdentifier);

        if (compareTrackPriority(track, existingTrack) > 0) {
          // Replace the existing track with the new one if it has higher priority
          trackMap.set(trackIdentifier, track);
        }
      }
    });

    // Convert the map values back to an array
    duplicateTracks.push(...trackMap.values());

    return duplicateTracks;
  } catch (error) {
    console.error('Error finding duplicate tracks:', error);
    return [];
  }
}

async function addTracksToPlaylistAdvanced(accessToken, playlistId, removedTracks) {
  try {
    const addedBackTracks = [];

    for (const removedTrack of removedTracks) {
      // Check if an explicit version exists
      const explicitVersion = removedTracks.find(track => track.track.name === removedTrack.track.name && track.track.artists[0].name === removedTrack.track.artists[0].name && getExplicitness(track.track.explicit) === 'explicit');

      if (explicitVersion) {
        // If an explicit version exists, add it back
        const addedBackTrack = await addTrackToPlaylist(accessToken, playlistId, explicitVersion.track.uri);
        addedBackTracks.push(addedBackTrack);
      } else {
        // Check if a clean version exists
        const cleanVersion = removedTracks.find(track => track.track.name === removedTrack.track.name && track.track.artists[0].name === removedTrack.track.artists[0].name && getExplicitness(track.track.explicit) === 'clean');

        if (cleanVersion) {
          // If a clean version exists, add it back
          const addedBackTrack = await addTrackToPlaylist(accessToken, playlistId, cleanVersion.track.uri);
          addedBackTracks.push(addedBackTrack);
        } else {
          // Add the unknown version back if neither explicit nor clean exists
          const unknownVersion = removedTracks.find(track => track.track.name === removedTrack.track.name && track.track.artists[0].name === removedTrack.track.artists[0].name && getExplicitness(track.track.explicit) === 'unknown');
          if (unknownVersion) {
            const addedBackTrack = await addTrackToPlaylist(accessToken, playlistId, unknownVersion.track.uri);
            addedBackTracks.push(addedBackTrack);
          }
        }
      }
    }

    return addedBackTracks;
  } catch (error) {
    console.error('Error adding tracks:', error);
    return [];
  }
}




// Helper function to handle explicitness and prioritize tracks
function compareTrackPriority(track1, track2) {
  const explicitnessOrder = ['explicit', 'clean', 'unknown'];

  if (track1.track.explicit === track2.track.explicit) {
    return explicitnessOrder.indexOf(getExplicitness(track1.track.explicit)) - explicitnessOrder.indexOf(getExplicitness(track2.track.explicit));
  } else {
    return track1.track.explicit ? -1 : 1;
  }
}

function getExplicitness(explicit) {
  if (explicit === true) {
    return 'explicit';
  } else if (explicit === false) {
    return 'clean';
  } else {
    return 'unknown';
  }
}


function displayDuplicateTracksToBeRemovedAdvanced(duplicateTracks) {
  try {
    const tracksToBeRemovedList = document.getElementById('to-be-removed-advanced-duplicate-tracks-list');
    tracksToBeRemovedList.innerHTML = ''; // Clear previous results

    duplicateTracks.forEach((track) => {
      const artists = track.track.artists.map((artist) => artist.name).join(', ');
      const trackInfo = `${artists} - ${track.track.name} (Explicit: ${getExplicitness(track.track.explicit)}) - Track ID: ${track.track.id}`;

      const listItem = document.createElement('li');
      listItem.textContent = trackInfo;
      tracksToBeRemovedList.appendChild(listItem);
    });
  } catch (error) {
    console.error('Error displaying duplicate tracks to be removed:', error);
  }
}


function displayRemovedDuplicateTracksAdvanced(removedTracks) {
  try {
    const removedTracksList = document.getElementById('removed-advanced-duplicate-tracks-list');
    removedTracksList.innerHTML = ''; // Clear previous results

    removedTracks.forEach((track) => {
      const artists = track.track.artists.map((artist) => artist.name).join(', ');
      const trackInfo = `${artists} - ${track.track.name} (Explicit: ${getExplicitness(track.track.explicit)}) - Track ID: ${track.track.id}`;

      const listItem = document.createElement('li');
      listItem.textContent = trackInfo;
      removedTracksList.appendChild(listItem);
    });
  } catch (error) {
    console.error('Error displaying removed duplicate tracks:', error);
  }
}


function displayAddedBackTracksAdvanced(addedBackTracks) {
  try {
    const addedBackTracksList = document.getElementById('added-back-advanced-tracks-list');
    addedBackTracksList.innerHTML = ''; // Clear previous results

    addedBackTracks.forEach((track) => {
      const artists = track.track.artists.map((artist) => artist.name).join(', ');
      const trackInfo = `${artists} - ${track.track.name} (Explicit: ${getExplicitness(track.track.explicit)}) - Track ID: ${track.track.id}`;

      const listItem = document.createElement('li');
      listItem.textContent = trackInfo;
      addedBackTracksList.appendChild(listItem);
    });
  } catch (error) {
    console.error('Error displaying added back tracks:', error);
  }
}



// Wait for the document to fully load
document.addEventListener('DOMContentLoaded', function () {
  // Find the "Start Advanced Removal" button by its id
  const advancedRemoveButton = document.getElementById('advanced-remove-duplicates-button');

  // Add a click event listener to the button
  advancedRemoveButton.addEventListener('click', async function () {
    // Retrieve the access token and playlist name from your HTML form or any other source
    const playlistName = document.getElementById('playlist-name-to-advanced-remove').value;

    // Call the function to perform advanced duplicate removal
    await performAdvancedDuplicateRemoval(accessToken, playlistName);
  });
});











// Function to fetch user's playlists with pagination
async function fetchAllUserPlaylists() {
    let playlists = [];
    let url = 'https://api.spotify.com/v1/me/playlists';
let countChunks=0
    try {
        while (url) {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                playlists = playlists.concat(data.items);
              const cooldownTime = Math.random() * (1.875 - 0.87) + 0.87;
              await new Promise(resolve => setTimeout(resolve, cooldownTime * 1000)); // Convert to milliseconds
              console.log('Done with chunk:', url, "next page: ", data.next);
              let chunkNow = document.getElementById("playlist-chunks-bpm-gen").innerHTML=`Getting user's playlists to place the new songs in: Part ${++countChunks} - ${50*countChunks}`
                url = data.next;
            } else {
                throw new Error(`Failed to fetch playlists: ${response.status} - ${response.statusText}`);
            }
        }
        let chunkNow = document.getElementById("playlist-chunks-bpm-gen").innerHTML=``
        return playlists;
    } catch (error) {
        console.error('Error fetching playlists:', error);
        throw error;
    }
}

// Function to fetch tracks from a playlist with pagination
async function getTracksFromPlaylist(playlistId) {
    let tracks = [];
    let url = `https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50`;

    try {
        while (url) {
            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                tracks = tracks.concat(data.items.map(item => item.track.id));
                url = data.next;
            } else {
                throw new Error(`Failed to fetch tracks from playlist: ${response.status} - ${response.statusText}`);
            }
        }
        showSuccessMessage(`${tracks.length} track(s) gotten from  currently selected playlist`);
        return tracks;
    } catch (error) {
        console.error('Error fetching tracks from playlist:', error);
        throw error;
    }
}

// Function to like/save tracks to the library
async function saveTracksToLibrary(trackIds) {
    const chunkSize = 50; // Maximum track IDs per request

    try {
        for (let i = 0; i < trackIds.length; i += chunkSize) {
            const chunk = trackIds.slice(i, i + chunkSize);

            const response = await fetch('https://api.spotify.com/v1/me/tracks', {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(chunk),
            });

            if (response.ok) {
              showSuccessMessage(`${chunk.length} track(s) added to the library.`);
              showSuccessMessage(`All ${trackIds.length} track(s) added to the library.`);
                console.log('Tracks added to the library.');
            } else {
                throw new Error(`Failed to save tracks to the library: ${response.status} - ${response.statusText}`);
            }
        }
      showSuccessMessage(`All ${trackIds.length} track(s) added to the library.`);
    } catch (error) {
        console.error('Error saving tracks to the library:', error);
        throw error;
    }
}

// Function to dislike/remove tracks from the library
async function removeTracksFromLibrary(trackIds) {
    const chunkSize = 50; // Maximum track IDs per request

    try {
        for (let i = 0; i < trackIds.length; i += chunkSize) {
            const chunk = trackIds.slice(i, i + chunkSize);

            const response = await fetch('https://api.spotify.com/v1/me/tracks', {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(chunk),
            });

            if (response.ok) {
                showSuccessMessage(`${chunk.length} track(s) removed from the library.`);
                console.log('Tracks removed from the library.');
            } else {
                throw new Error(`Failed to remove tracks from the library: ${response.status} - ${response.statusText}`);
            }
        }
      showSuccessMessage(`All ${trackIds.length} track(s) removed from the library.`);
    } catch (error) {
        console.error('Error removing tracks from the library:', error);
        throw error;
    }
}

// Function to search for a playlist based on user input
async function searchForPlaylist(searchOption, searchTerm, resultBox) {
  try {
      if (searchOption === 'name') {
          // Search by playlist name in user's library
          const userPlaylists = await fetchAllUserPlaylists();
          const matchingPlaylist = userPlaylists.find((playlist) => playlist.name === searchTerm);
          return matchingPlaylist ? matchingPlaylist.id : null;
      } else if (searchOption === 'global') {
          // Search by playlist name using global search
          const searchResults = await searchPlaylists(searchTerm);
          if (searchResults.length > 0) {
              const searchResultsList = document.getElementById(resultBox); // Use the ID directly
              searchResultsList.innerHTML = ''; // Clear any previous search results

              searchResults.forEach((playlist, index) => {
                  // Create an embed preview for each playlist with a radio button
                  const playlistEmbed = embedPreview(`https://open.spotify.com/playlist/${playlist.id}`);
                  const playlistLi = document.createElement('li');
                  playlistLi.innerHTML = `
                      <input type="radio" id="search-result-${index}-${resultBox}" name="search-result-${resultBox}" value="${playlist.id}">
                      <label for="search-result-${index}-${resultBox}">${playlist.name}</label>
                  `;
                  playlistLi.appendChild(playlistEmbed);
                  searchResultsList.appendChild(playlistLi);
              });

              // Implement selection logic after a delay
              let playlistSelected = null;
              while (!playlistSelected) {
                  await wait(getRandomArbitrary(0.2, 2.625, 'seconds') * 1000);
                  const selectedPlaylistRadioButton = document.querySelector(`input[name="search-result-${resultBox}"]:checked`);
                  if (selectedPlaylistRadioButton) {
                      playlistSelected = selectedPlaylistRadioButton.value;
                      searchResultsList.innerHTML = ''; // Clear any previous search results
                      break;
                  } else {
                      console.log('No playlist selected yet');
                  }
              }
              return playlistSelected;
          } else {
              console.log('No matching playlist found in global search.');
              return null; // No matching playlist found
          }
      } else if (searchOption === 'id') {
          // Directly use the provided playlist ID
          return searchTerm;
      } else if (searchOption === 'link') {
          // Parse the playlist ID from the Spotify playlist link
          const playlistId = extractPlaylistIdFromLink(searchTerm);
          return playlistId;
      }
  } catch (error) {
      console.error('Error searching for the playlist:', error);
      throw error;
  }
}


// Event listener for the search playlist button
document.getElementById('search-playlist-button').addEventListener('click', async function () {
  const searchOptions = document.getElementById('search-options');
  const selectedSearchOption = searchOptions.value;
  const searchInput = document.getElementById('search-input');
  const searchTerm = searchInput.value;

  try {
      const playlistId = await searchForPlaylist(selectedSearchOption, searchTerm, "search-results-like-dislike");
      if (playlistId) {
          console.log('Playlist ID found:', playlistId);
          document.getElementById('selected-playlist').textContent = `Selected Playlist ID: ${playlistId}`;
          // Enable the buttons for fetching tracks, liking, and removing tracks
          document.getElementById('fetch-tracks-button').disabled = false;
          document.getElementById('like-tracks-button').disabled = false;
          document.getElementById('remove-tracks-button').disabled = false;
      } else {
          console.log('No matching playlist found.');
          document.getElementById('selected-playlist').textContent = 'No playlist selected.';
          // Disable the buttons since no playlist was found
          document.getElementById('fetch-tracks-button').disabled = true;
          document.getElementById('like-tracks-button').disabled = true;
          document.getElementById('remove-tracks-button').disabled = true;
      }
  } catch (error) {
      console.error('Error searching for the playlist:', error);
  }
});


// Event listener for the fetch tracks button
document.getElementById('fetch-tracks-button').addEventListener('click', async function () {
    const playlistId = document.getElementById('selected-playlist')
  .textContent
  .split(':')
  .pop()
  .trim();
    try {
        const trackIds = await getTracksFromPlaylist(playlistId);
        // Display or work with the fetched track IDs here
        console.log('Fetched track IDs:', trackIds);
    } catch (error) {
        console.error('Error fetching tracks:', error);
    }
});

// Event listener for the like tracks button
document.getElementById('like-tracks-button').addEventListener('click', async function () {
    const playlistId = document.getElementById('selected-playlist')
  .textContent
  .split(':')
  .pop()
  .trim();
    try {
        const trackIds = await getTracksFromPlaylist(playlistId);
        await saveTracksToLibrary(trackIds);
    } catch (error) {
        console.error('Error liking tracks:', error);
    }
});

// Event listener for the remove tracks button
document.getElementById('remove-tracks-button').addEventListener('click', async function () {
    const playlistId = document.getElementById('selected-playlist')
  .textContent
  .split(':')
  .pop()
  .trim();    
  try {
        const trackIds = await getTracksFromPlaylist(playlistId);
        await removeTracksFromLibrary(trackIds);
    } catch (error) {
        console.error('Error removing tracks:', error);
    }
});

// Function to search for playlists based on a search term
async function searchPlaylists(searchTerm) {
    try {
        const response = await fetch(`https://api.spotify.com/v1/search?q=${encodeURIComponent(searchTerm)}&type=playlist`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (response.ok) {
            const data = await response.json();
            return data.playlists.items;
        } else {
            throw new Error(`Failed to search for playlists: ${response.status} - ${response.statusText}`);
        }
    } catch (error) {
        console.error('Error searching for playlists:', error);
        throw error;
    }
}

// Function to extract the playlist ID from a Spotify playlist link
function extractPlaylistIdFromLink(link) {
    const regex = /playlist\/(\w+)/;
    const match = link.match(regex);
    if (match && match[1]) {
        return match[1];
    }
    return null;
}

// Function to create or update a success message div
function showSuccessMessage(message) {
    let successDiv = document.getElementById('selected-playlist-message');

    // Update the message
    successDiv.textContent += "\n"+message;
}





// Add event listener to tempoOption dropdown to show/hide options and clear fields
document.getElementById('tempoOption').addEventListener('change', function() {
    const tempoOption = this.value;
    const tempoOptionsDiv = document.getElementById('tempoOptions');
    const keyOptionsDiv = document.getElementById('keyOptions');

    switch (tempoOption) {
        case "default":
            tempoOptionsDiv.style.display = 'none';
            keyOptionsDiv.style.display = 'none';
            break;
        case "customBPM":
            tempoOptionsDiv.style.display = 'grid';
            keyOptionsDiv.style.display = 'none';
            break;
        case "customKey":
            tempoOptionsDiv.style.display = 'none';
            keyOptionsDiv.style.display = 'grid';
            break;
        case "customCombined":
            tempoOptionsDiv.style.display = 'grid';
            keyOptionsDiv.style.display = 'grid';
            break;
        // No need for a "default" case that sets display to 'none'
    }

    // Clear all input fields when switching options
    document.getElementById('minTempo').value = "";
    document.getElementById('maxTempo').value = "";
    document.getElementById('targetTempo').value = "";
    document.getElementById('minKey').value = "";
    document.getElementById('maxKey').value = "";
    document.getElementById('targetKey').value = "";
});

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

document.getElementById('getGenresButton').addEventListener('click', async function () {
    const genreOptionsDiv = document.getElementById('genreOptions');
    genreOptionsDiv.innerHTML = '';

    // Fetch available genre seeds from Spotify API
    const availableGenres = await getAvailableGenres();

    const checkboxContainer = document.createElement('div');
    checkboxContainer.style = `
        max-height: 210px; /* Adjust the max height as needed */
        overflow-y: auto;
    `;

    const maxSelectedGenres = 4; // Set the maximum number of selected genres
    let selectedCount = 0;

    availableGenres.forEach(genre => {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = genre;
        checkbox.value = genre;
        checkbox.style = `
          margin: 5px;
          display: inline-flex;
          position: relative;
        `;

        const label = document.createElement('label');
        label.htmlFor = genre;
        label.appendChild(document.createTextNode(genre));

        checkbox.addEventListener('change', function () {
            if (this.checked) {
                selectedCount++;
                if (selectedCount > maxSelectedGenres) {
                    this.checked = false; // Uncheck the checkbox if the limit is reached
                    selectedCount--; // Decrement the count
                }
            } else {
                selectedCount--;
            }
        });

        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(label);
    });

    genreOptionsDiv.appendChild(checkboxContainer);

    // Add event listener to fetch selected genres
    document.getElementById('getSelectedGenresButton').addEventListener('click', function () {
        const selectedGenres = getSelectedGenres();
        console.log('Selected Genres:', selectedGenres);
        // Add logic to use the selectedGenres as needed in your main function
    });
});

function getSelectedGenres() {
    const checkboxes = document.querySelectorAll('#genreOptions input[type="checkbox"]:checked');
    const selectedGenres = Array.from(checkboxes).map(checkbox => checkbox.value);
    const selectedGenresString = encodeURIComponent(selectedGenres.join(','));
    return selectedGenresString;
}




async function getAvailableGenres() {
    try {
        const response = await fetch('https://api.spotify.com/v1/recommendations/available-genre-seeds', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (response.ok) {
            const data = await response.json();
            return data.genres || [];
        } else {
            console.error('Error fetching available genres:', response.status);
            return [];
        }
    } catch (error) {
        console.error('An error occurred while fetching available genres:', error);
        return [];
    }
}


// Add event listener for dynamic options
document.getElementById('tempoOption').addEventListener('change', function () {
  const tempoOptions = document.getElementById('tempoOptions');
  const keyOptions = document.getElementById('keyOptions');
  const value = this.value;

  // Toggle options visibility
  tempoOptions.style.display = value === 'customBPM' || value === 'customCombined' ? 'block' : 'none';
  keyOptions.style.display = value === 'customKey' || value === 'customCombined' ? 'block' : 'none';
});

// Add an event listener to the "Generate Playlist" button
document.getElementById('generateButton').addEventListener('click', async function () {
  const loopCount = parseInt(document.getElementById('loopCount').value, 10);
  const songsPerRecommendation = parseInt(document.getElementById('songsPerRecommendation').value, 10);
  const tempoOption = document.getElementById('tempoOption').value;
  const minTempo = document.getElementById('minTempo').value || 0;
  const maxTempo = document.getElementById('maxTempo').value || 666;
  const targetTempo = document.getElementById('targetTempo').value || "";
  const minKey = document.getElementById('minKey').value || 0;
  const maxKey = document.getElementById('maxKey').value || 11;
  const targetKey = document.getElementById('targetKey').value || "";
  let playlistName = document.getElementById('recs-playlist-name').value;
  const searchOption = document.getElementById('search-option-recs').value;

  try {
      const playlistId = await searchForPlaylist(searchOption, playlistName, "search-results-for-recs-gen");
      if (!playlistId) {
          console.log(`Playlist "${playlistName}" not found`);
          return;
      }

      const playlistInfo = await getPlaylistInfo(playlistId);
      const confirmed = await confirmPlaylist(playlistInfo,"recs");
      if (!confirmed) {
          console.log(`Playlist "${playlistName}" confirmation cancelled`);
          return;
      }
      playlistName= playlistInfo.name;
      const tracks = await getAllTracksFromPlaylist(playlistId);
      if (!tracks || tracks.length === 0) {
          console.log(`No tracks found in playlist "${playlistName}"`);
          return;
      }

      console.log('Generating recommendations for playlist:', playlistName);
      console.log('Loop count:', loopCount);
      console.log('Songs per recommendation:', songsPerRecommendation);

      const selectedGenres = getSelectedGenres();
      const runs = [];
      let playlistPart = 1;
      const resultsDiv = document.getElementById('results');
      resultsDiv.innerHTML = ''; // Clear the resultsDiv

      for (let i = 0; i < loopCount; i++) {
          let currentTracks = i === 0 ? tracks : runs[i - 1].recommendations;
          shuffleArray(currentTracks);

          const recommendations = await getRecommendations(
              currentTracks,
              songsPerRecommendation,
              tempoOption,
              minTempo,
              maxTempo,
              targetTempo,
              minKey,
              maxKey,
              targetKey,
              selectedGenres
          );

          console.log(`Recommendations for loop ${i + 1}:`, recommendations);
          await wait(getRandomArbitrary(1, 30, 'seconds') * 1000);
          runs.push({ recommendations });
      }

      // Combine all recommendations
      const uniqueRecommendations = new Set();
      for (const run of runs) {
          run.recommendations.forEach(track => uniqueRecommendations.add(track));
      }

      const recommendationArray = Array.from(uniqueRecommendations);
      if (recommendationArray.length > 0) {
          const chunkSize = 11000;
          const recommendationChunks = [];
          for (let j = 0; j < recommendationArray.length; j += chunkSize) {
              recommendationChunks.push(recommendationArray.slice(j, j + chunkSize));
          }

          for (const chunk of recommendationChunks) {
              let playlistNameNew = `Recs of "${playlistInfo.name}" loop:${loopCount}`;
              if (playlistPart > 1) {
                  playlistNameNew += ` Part ${playlistPart}`;
              }

              const now = new Date();
              const formattedDate = now.toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  hour12: false,
              });

              playlistNameNew += ` ${formattedDate}`;

              const newPlaylistId = await createPlaylistWithName(playlistNameNew.slice(0, 199));
              console.log('New playlist ID:', newPlaylistId);

              await addTracksToPlaylistRecommendation(accessToken, newPlaylistId, chunk);

              resultsDiv.innerHTML += `
                  <h3>Generated Recommendations (Part ${playlistPart}): ${chunk.length} tracks:</h3>
                  <ul>
                      ${chunk.map(track => `<li>${track.name} - ${track.artists[0].name}</li>`).join('')}
                  </ul>
                  <p>New Playlist Link (Part ${playlistPart}): <a href="https://open.spotify.com/playlist/${newPlaylistId}/" TARGET="_blank">${playlistNameNew}</a></p>
                  <br>
              `;
              playlistPart++;
          }
      }
  } catch (error) {
      console.error('Error generating recommendations:', error);
  }
});



function getAdditionalRecommendationRequirements(tempoOption,minTempo,maxTempo,targetTempo,minKey,maxKey,targetKey) {
    let addInfo = "";

    if (tempoOption === "customBPM" || tempoOption === "customCombined") {
        let tempoString = "";

        if (minTempo) {
            tempoString += ` Min Tempo: ${minTempo} BPM`;
        }

        if (maxTempo) {
            tempoString += ` Max Tempo: ${maxTempo} BPM`;
        }

        if (targetTempo) {
            tempoString += ` Target Tempo: ${targetTempo} BPM`;
        }

        if (tempoString) {
            addInfo += `${tempoString}`;
        }
    }

    if (tempoOption === "customKey" || tempoOption === "customCombined") {
        let keyString = "";

        if (minKey) {
            keyString += ` Min Key: ${minKey}`;
        }

        if (maxKey) {
            keyString += ` Max Key: ${maxKey}`;
        }

        if (targetKey) {
            keyString += ` Target Key: ${targetKey}`;
        }

        if (keyString) {
            addInfo += `${keyString}`;
        }

    
}
  return addInfo ? addInfo : "";
}



// Reuse the existing function to get an existing playlist ID
async function getPlaylistTracks(playlistName) {
    const allPlaylists = await getAllUserPlaylists(); // Reuse the function to get all user playlists

    // Search for the playlist by name
    const playlist = allPlaylists.find(item => item.name.toLowerCase() === playlistName.toLowerCase());

    if (playlist) {
        const playlistId = playlist.id;

        // Reuse the function to get all tracks from a playlist
        const tracks = await getAllTracksFromPlaylist(playlistId);
        console.log('Got tracks from the playlist:', playlistName,"\n", tracks);
        console.log('Number of tracks:', tracks.length);

        return tracks;
    }
    return []; // Return an empty array if the playlist is not found
}


let ranSeeds;
// Simulated function to get recommendations for tracks
async function getRecommendations(seedTracks, songsPerRecommendation,tempoOption,minTempo,maxTempo,targetTempo,minKey,maxKey,targetKey,selectedGenres) {
    const recommendations = [];
  
  
    for (const seedTrack of removeDuplicateTracksFromGenerated(seedTracks)) {
      await wait(getRandomArbitrary(20,35,'seconds')* 1000);
      ranSeeds++;
      while (true) {
        if(ranSeeds%66===0){
        await wait(getRandomArbitrary(100,200,'seconds')* 1000);
        }
        break
      }
      let trackUri;
      if (seedTrack.track && seedTrack.track.id) {
          trackUri = seedTrack.track.id;
      } else if (seedTrack.id) {
          trackUri = seedTrack.id;
      } else {
          // Handle any other cases or provide a default
          console.error('Unknown data format for seed track:', seedTrack);
          continue; // Skip this track
      }



  let apiUrl;
  const baseParams = `limit=${songsPerRecommendation}${selectedGenres.trim() ? `&seed_genres=${selectedGenres}` : ''}&seed_tracks=${trackUri}`;

  switch (tempoOption) {
      case "default":
          apiUrl = `https://api.spotify.com/v1/recommendations?${baseParams}`;
          break;
      case "customBPM":
          apiUrl = `https://api.spotify.com/v1/recommendations?${baseParams}${minTempo !== undefined && minTempo.trim() !== '' ? `&min_tempo=${minTempo}` : ''}${maxTempo !== undefined && maxTempo.trim() !== '' ? `&max_tempo=${maxTempo}` : ''}${targetTempo !== undefined && targetTempo.trim() !== '' ? `&target_tempo=${targetTempo}` : ''}`;
          break;
      case "customKey":
          apiUrl = `https://api.spotify.com/v1/recommendations?${baseParams}${minKey !== undefined && minKey.trim() !== '' ? `&min_key=${minKey}` : ''}${maxKey !== undefined && maxKey.trim() !== '' ? `&max_key=${maxKey}` : ''}${targetKey !== undefined && targetKey.trim() !== '' ? `&target_key=${targetKey}` : ''}`;
          break;
      case "customCombined":
          apiUrl = `https://api.spotify.com/v1/recommendations?${baseParams}${minTempo !== undefined && minTempo.trim() !== '' ? `&min_tempo=${minTempo}` : ''}${maxTempo !== undefined && maxTempo.trim() !== '' ? `&max_tempo=${maxTempo}` : ''}${targetTempo !== undefined && targetTempo.trim() !== '' ? `&target_tempo=${targetTempo}` : ''}${minKey !== undefined && minKey.trim() !== '' ? `&min_key=${minKey}` : ''}${maxKey !== undefined && maxKey.trim() !== '' ? `&max_key=${maxKey}` : ''}${targetKey !== undefined && targetKey.trim() !== '' ? `&target_key=${targetKey}` : ''}`;
          break;
  }



      
        try {
            console.log('Getting recommendations for seed track:', ((seedTrack.track) ? seedTrack.track.name : seedTrack.name), "\n", ((seedTrack.track) ? seedTrack.track.id : seedTrack.id));
              const seedTracker = document.getElementById('fromSeed');
              seedTracker.innerHTML += `
              <ul>
                  
                      <li>${((seedTrack.track) ? seedTrack.track.name : seedTrack.name)} - ${(seedTrack.track?seedTrack.track:seedTrack).artists.map(artist => artist.name).join(', ')};
                      </li>
                  
              </ul>
              `;
            apiUrl += `&max_instrumentalness=0.295`;
            console.log(`With api url: \n${apiUrl}`);

            // Make an API request to get recommendations
            let response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });
          let refreshTries = 0;
          while (response.status === 401){
            await checkAndRefreshToken();
            response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });
            refreshTries++;
            if (response.status === 401 && refreshTries>=4){
              throw new Error('Failed to refresh access token after 3 tries');
              break;
            }
          }
            if (response.ok) {
                const data = await response.json();
                recommendations.push(...data.tracks);
                shuffleArray(recommendations);
              let fetchedRecommendations = data.tracks
              console.log('Got recommendations:', data.tracks);
              
              console.log(fetchedRecommendations.map(track => `${track.artists.map(artist => artist.name).join(', ')} - ${track.name};`).join(''))
              const gotRecsTracker = document.getElementById('gotRecs');

              gotRecsTracker.innerHTML += `
              <ul>
                  ${fetchedRecommendations.map(track => `
                      <li>${track.artists.map(artist => artist.name).join(', ')} - ${track.name};
                      </li>
                  `).join('')}
              </ul>
              `;
              
            } else {
                console.log('Error fetching recommendations for seed track:', ((seedTrack.track) ? seedTrack.track.name : seedTrack.name));
                console.log(`returning ${recommendations.length} tracks prematurely: ${recommendations}`);
              shuffleArray(recommendations)
              return removeDuplicateTracksFromGenerated(recommendations)
            }
        } catch (error) {
            console.log('An error occurred while fetching recommendations:', error);
            console.log(`returning ${recommendations.length} tracks prematurely: ${recommendations}`);
          shuffleArray(recommendations)
          return removeDuplicateTracksFromGenerated(recommendations)
        }
    }
    console.log(`returning ${recommendations.length} tracks AFTER SUCCESSFUL LOOP: ${recommendations}`);
    shuffleArray(recommendations)
    return removeDuplicateTracksFromGenerated(recommendations);
}

async function addTracksToPlaylistRecommendation(accessToken, playlistId, tracks) {
    const chunkSize = 100;
    const uniqueTracks = removeDuplicateTracksFromGenerated(tracks);

    for (let i = 0; i < uniqueTracks.length; i += chunkSize) {
        const trackChunk = uniqueTracks.slice(i, i + chunkSize);
        const uris = trackChunk.map((track) => track.uri);

        const apiUrl = `https://api.spotify.com/v1/playlists/${playlistId}/tracks`;
        const requestBody = JSON.stringify({ uris });

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json',
                },
                body: requestBody,
            });

            if (!response.ok) {
                console.error('Error adding tracks:', response.status);
            }
        } catch (error) {
            console.error('Error adding tracks:', error);
        }
    }
}

function removeDuplicateTracksFromGenerated(tracks) {
    const uniqueTracks = new Set();
    return tracks.filter((track) => {
      let uri;

      if (track.uri) {
          uri = track.uri;
      } else if (track.track && track.track.uri) {
          uri = track.track.uri;
      } else {
          uri = undefined; // or any default value you prefer
      }
        if (uri) {
            if (!uniqueTracks.has(uri)) {
                uniqueTracks.add(uri);
                return true;
            }
        }
        return false;
    });
}

// Function to save data to cache
function saveDataToCache() {
    const cacheKey = 'myAppData';
    const dataToCache = {};

    // Get all input fields on the page
    const inputFields = document.querySelectorAll('input, select');
    inputFields.forEach(input => {
        // Check if the input has an ID, and if so, save its value to the cache
        if (input.id) {
            dataToCache[input.id] = input.value;
        }
    });

    caches.open('myCache').then(cache => {
        cache.put(cacheKey, new Response(JSON.stringify(dataToCache)));
    });
}

// Function to load data from cache
function loadDataFromCache() {
    const cacheKey = 'myAppData';

    caches.open('myCache').then(cache => {
        cache.match(cacheKey).then(response => {
            if (response) {
                response.json().then(data => {
                    // Set the values in your input fields and option fields
                    Object.keys(data).forEach(key => {
                        const element = document.getElementById(key);
                        if (element) {
                            element.value = data[key];
                        }
                    });
                });
            }
        });
    });
}








document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('generate-bpm-playlist').addEventListener('click', async () => {
      const playlistName = document.getElementById('bpm-playlist-name').value;
      const searchOption = document.getElementById('search-option-bpm').value;
      const playlistId = await searchForPlaylist(searchOption, playlistName, "search-results-for-bpm-sort");

      if (playlistId) {
          const playlistInfo = await getPlaylistInfo(playlistId);
          const confirmed = await confirmPlaylist(playlistInfo,"bpm");

          if (confirmed) {
              const tracks = await getAllTracksFromPlaylist(playlistId);

              if (tracks && tracks.length > 0) {
                  await generateBPMPlaylists(tracks, playlistInfo.name);
              } else {
                  addToBPMGenerationLog(`No tracks found in playlist "${playlistName}"`);
              }
          } else {
              addToBPMGenerationLog(`Playlist "${playlistName}" confirmation cancelled`);
          }
      } else {
          addToBPMGenerationLog(`Playlist "${playlistName}" not found`);
      }
  });
});


async function getAllTracksFromPlaylist(playlistId) {
    try {
        const allTracks = [];

        let offset = 0;
        let hasNextPage = true;

        while (hasNextPage) {
            const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?limit=50&offset=${offset}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                },
            });

            if (!response.ok) {
                throw new Error(`Error fetching playlist tracks: ${response.status} - ${response.statusText}`);
            }

            const playlistTracks = await response.json();

            // Add the fetched tracks to the array
            allTracks.push(...playlistTracks.items);

            // Check if there's a next page of tracks
            hasNextPage = playlistTracks.next !== null;

            // If there's a next page, update the offset for the next request
            if (hasNextPage) {
                offset += 50;
            }

            await wait(getRandomArbitrary(0.777, 1.77, 'seconds') * 1000); // Cooldown
        }

        return allTracks;

    } catch (error) {
        console.error('Error fetching playlist tracks:', error);
        throw error;
    }
}

let allUserPlaylists = [];
let failedTrackAttempts = [];



async function generateBPMPlaylists(tracks, prevPlaylistName) {
    for (const track of tracks) {
        const trackName = track.track.name;
        const artistNames = track.track.artists.map(artist => artist.name).join(', ');
        const trackId = track.track.id;
        const bpm = await getBPMForTrack(trackId);

        if (bpm) {
            const roundedBPM = thresholdRound(bpm,0.495);
            const playlistName = `${roundedBPM} BPM`;

            let playlist = await getAllUserPlaylistsWithCooldown(playlistName);

            if (!playlist) {
                playlist = await createBPMPlaylist(playlistName);
            }else{
                  for (const playlist1 of playlist) {
                    if (playlist1.name === playlistName) {
                        playlist = playlist1;
                    }
                }
            }

            const success = await addTrackToPlaylist(trackId, playlist.id);
            if (success) {
              addToBPMGenerationLog(`${(tracks.indexOf(track) + 1) + " of " + tracks.length +" \n <br> "+"tracks done from "+" \n <br> "+ prevPlaylistName + ", track id: " + trackId}`)
                addToBPMGenerationLog(`Song "${trackName} - ${artistNames}" - ${bpm} BPM added to playlist "${playlistName}"`);
            } else {
              addToBPMGenerationLog((tracks.indexOf(track) + 1) + " of " + tracks.length +" <br> tracks NOT done for " + prevPlaylistName + ", track id: " + trackId)
                // addToBPMGenerationLog(`Failed to add song "${trackName} - ${artistNames}" - ${bpm} BPM to playlist "${playlistName}"`);
              addToBPMGenerationLog(`Failed to add song "${trackName} - ${artistNames}" - ${bpm} BPM to playlist "${playlistName}"`, trackId, playlist.id);

              
            }

            await wait(getRandomArbitrary(20, 40, 'seconds') * 1000); // Cooldown
        }else{
                        addToBPMGenerationLog(`Failed to fetch BPM for song "${trackName} - ${artistNames}"`);
        }
    }
}


// // Function to fetch user's playlists from Spotify V1
// async function getAllUserPlaylistsWithCooldown(playlistName) {
//   try {
//     let allPlaylists = [];

//     let nextUrl = `https://api.spotify.com/v1/me/playlists?limit=40`;

//     while (nextUrl) {
//       const response = await fetch(nextUrl, {
//         method: 'GET',
//         headers: {
//           'Authorization': `Bearer ${accessToken}`,
//         },
//       });

//       if (response.ok) {
//         const playlistsBatch = await response.json();
//         // Check if the playlist already exists
//         for (const playlist of playlistsBatch.items) {
//             if (playlist.name === playlistName) {
//               console.log(`returning ${playlist.name} playlist ${playlist}`);
//                 return [playlist]; // Playlist found, return all playlists
//             }
//         }
//         allPlaylists = allPlaylists.concat(playlistsBatch.items);
//         // Generate random cooldown time between 0.5 and 2 seconds
//         const cooldownTime = Math.random() * (1.875 - 0.87) + 0.87;
//         await new Promise(resolve => setTimeout(resolve, cooldownTime * 1000)); // Convert to milliseconds
//         console.log('Done with chunk:', nextUrl, "next page: ", playlistsBatch.next);
//         nextUrl = playlistsBatch.next; // Get the next URL for pagination
//       } else {
//         console.error('Error fetching user playlists:', response.statusText, "next page of fail: ", nextUrl);
//         return null;
//       }
//     }

//     return allPlaylists;
//   } catch (error) {
//     console.error('Error fetching user playlists:', error);
//     return null;
//   }
// }

// let allUserPlaylists = [];

// // Function to fetch user's playlists from Spotify v2
// async function getAllUserPlaylistsWithCooldown(playlistName) {
//   try {
//     if (allUserPlaylists.length === 0) {
//       // If the playlists are not fetched, fetch them and save them locally
//       const fetchedPlaylists = await fetchAllUserPlaylists();
//       if (fetchedPlaylists) {
//         allUserPlaylists = fetchedPlaylists;
//       } else {
//         console.error('Failed to fetch user playlists.');
//         return null;
//       }
//     }

//     // Check if the playlist already exists
//     const existingPlaylist = allUserPlaylists.find(playlist => playlist.name === playlistName);
//     if (existingPlaylist) {
//       console.log(`Playlist "${playlistName}" found in local cache.`);
//       return [existingPlaylist];
//     } else {
//       // Playlist not found, fetch all playlists to get the new one
//       console.log(`Playlist "${playlistName}" not found in local cache. Fetching all playlists.`);
//       const allPlaylists = await fetchAllUserPlaylists();
//       if (allPlaylists) {
//         const newPlaylist = allPlaylists.find(playlist => playlist.name === playlistName);
//         if (newPlaylist) {
//           // Save the new playlist to the local variable
//           allUserPlaylists.push(newPlaylist);
//           return [newPlaylist];
//         } else {
//           console.error(`Playlist "${playlistName}" not found.`);
//           return null;
//         }
//       } else {
//         console.error('Failed to fetch user playlists.');
//         return null;
//       }
//     }
//   } catch (error) {
//     console.error('Error fetching user playlists:', error);
//     return null;
//   }
// }



// Function to fetch user's playlists from Spotify
async function getAllUserPlaylistsWithCooldown(playlistName) {
  try {
    if (allUserPlaylists.length === 0) {
      // If the playlists are not fetched, fetch them and save them locally
      const fetchedPlaylists = await fetchAllUserPlaylists();
      if (fetchedPlaylists) {
        allUserPlaylists = fetchedPlaylists;
      } else {
        console.error('Failed to fetch user playlists.');
        return null;
      }
    }

    // Check if the playlist already exists
    const existingPlaylist = allUserPlaylists.find(playlist => playlist.name === playlistName);
    if (existingPlaylist) {
      console.log(`Playlist "${playlistName}" found in local cache.`);
      return [existingPlaylist];
    } else {
      // Playlist not found, fetch all playlists to get the new one
      console.log(`Playlist "${playlistName}" not found in local cache. Fetching all playlists.`);
      const allPlaylists = await fetchAllUserPlaylists();
      if (allPlaylists) {
        const newPlaylist = allPlaylists.find(playlist => playlist.name === playlistName);
        if (newPlaylist) {
          // Save the new playlist to the local variable
          allUserPlaylists.push(newPlaylist);
          return [newPlaylist];
        } else {
          console.log(`Playlist "${playlistName}" not found.`);
          return null;
        }
      } else {
        console.error('Failed to fetch user playlists.');
        return null;
      }
    }
  } catch (error) {
    console.error('Error fetching user playlists:', error);
    return null;
  }
}

async function createBPMPlaylist(playlistName) {
    try {
        // Get user ID
        const userId = await getUserDetails();

        // Create a new playlist
        const response = await fetch(`https://api.spotify.com/v1/users/${userId}/playlists`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: playlistName,
                description: 'Playlist created by BPM Flash - @mihailv_ar | @mihailv_photos',
                public: true,
            }),
        });

        if (!response.ok) {
          addToBPMGenerationLog(`Playlist "${playlistName}" NOT created`);
            throw new Error(`Error creating playlist: ${response.status} - ${response.statusText}`);
        }else{
          addToBPMGenerationLog(`Playlist "${playlistName}" created`);
        }
        const data = await response.json();

        allUserPlaylists = allUserPlaylists.concat(data)
        return data;
    } catch (error) {
      addToBPMGenerationLog(`Playlist "${playlistName}" NOT created`);
        console.error('Error creating playlist:', error);
        throw error;
    }
}

async function addTrackToPlaylist(trackId, playlistId) {
    try {
        const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/tracks?uris=spotify%3Atrack%3A${trackId}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            throw new Error(`Error adding track to playlist: ${response.status} - ${response.statusText}`);
        }

        return true;
    } catch (error) {
        console.error('Error adding track to playlist:', error);
        failedTrackAttempts.push(trackId);
        return false;
    }
}

function addToBPMGenerationLog(message, trackId, playlistId) {
  const log = document.getElementById('bpm-generation-log');
  const li = document.createElement('li');
  li.innerHTML = message; // Use innerHTML to allow HTML tags like <br>
  if (trackId && playlistId && message.includes('Failed')) {
      const retryButton = document.createElement('button');
      retryButton.textContent = 'Retry';
      retryButton.addEventListener('click', () => retryFailedTrack(trackId, playlistId));
      li.appendChild(retryButton);
  }
  log.appendChild(li);
}



async function retryFailedTrack(trackId, playlistId) {
    const index = failedTrackAttempts.indexOf(trackId);
    if (index !== -1) {
        failedTrackAttempts.splice(index, 1);
        const success = await addTrackToPlaylist(trackId, playlistId);
        if (success) {
            addToBPMGenerationLog(`Retry: Song "${trackId}" added to playlist.`);
        } else {
            addToBPMGenerationLog(`Retry failed: Song "${trackId}" couldn't be added to playlist.`);
        }
    }
}

async function getPlaylistInfo(playlistId) {
    try {
        const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch playlist info: ${response.status} - ${response.statusText}`);
        }

        const playlistData = await response.json();
        return {
            name: playlistData.name,
            creator: playlistData.owner.display_name,
            id: playlistData.id,
            url: playlistData.external_urls.spotify
        };
    } catch (error) {
        console.error("Error fetching playlist info:", error);
        throw error;
    }
}


    async function confirmPlaylist(playlistInfo,where) {
        return new Promise((resolve, reject) => {
            const confirmDiv = document.createElement('div');
            confirmDiv.innerHTML = `
                <p>Is this the correct playlist?</p>
                <p>Name: ${playlistInfo.name}</p>
                <p>Creator: ${playlistInfo.creator}</p>
                <p>ID: ${playlistInfo.id}</p>
                <p><a href="${playlistInfo.url}" target="_blank">Link to Playlist</a></p>
                <button id="confirm-playlist-${where}">Confirm</button>
                <button id="confirm-playlist-container-${where}">Cancel</button>
            `;

            document.getElementById(`confirm-playlist-container-${where}`).innerHTML = ''; // Clear previous confirm message
            document.getElementById(`confirm-playlist-container-${where}`).appendChild(confirmDiv);

            document.getElementById(`confirm-playlist-${where}`).addEventListener('click', () => {
                confirmDiv.remove();
                resolve(true);
            });

            document.getElementById(`confirm-playlist-container-${where}`).addEventListener('click', () => {
                confirmDiv.remove();
                resolve(false);
            });
        });
    }




function iterativeRounding(num) {
  let tempNum = Math.round(num * 100) / 100; // Round to two decimal places
  tempNum = Math.round(tempNum * 10) / 10;   // Round to one decimal place
  tempNum = Math.round(tempNum * 10) / 10;   // Round to one decimal place
  tempNum = Math.round(tempNum);            // Round to nearest whole number
  return tempNum;
}
function thresholdRound(number, threshold) {
  // Extract the digits after the decimal point
  let decimalPart = number - Math.floor(number);
  
  // Check if the decimal part is greater than or equal to the threshold
  if (decimalPart >= threshold) {
    // If so, round up
    return Math.ceil(number);
  } else {
    // If not, round down
    return Math.floor(number);
  }
}










// Function to fetch user playlists from Spotify
async function fetchAllUserPlaylistsMapped() {
    try {
        const response = await fetch('https://api.spotify.com/v1/me/playlists?limit=50', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + accessToken
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to fetch user playlists');
        }

        const data = await response.json();
        return data.items.map(item => ({
            id: item.id,
            name: item.name,
            description: item.description,
            link: item.external_urls.spotify,
            image: item.images.length > 0 ? item.images[0].url : 'https://via.placeholder.com/150',
            isPublic: item.public
        }));
    } catch (error) {
        console.error('Error fetching user playlists:', error);
        return null;
    }
}

// Function to delete a playlist
async function deletePlaylist(playlistId) {
    try {
        const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}/followers`, {
            method: 'DELETE',
            headers: {
                'Authorization': 'Bearer ' + accessToken,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error('Failed to delete playlist');
        }

        console.log(`Playlist with ID ${playlistId} deleted successfully`);
    } catch (error) {
        console.error('Error deleting playlist:', error);
    }
}

// Function to set a playlist to public
async function setPlaylistPublic(playlistId) {
    try {
        const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
            method: 'PUT',
            headers: {
                'Authorization': 'Bearer ' + accessToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                public: true
            })
        });

        if (!response.ok) {
            throw new Error('Failed to set playlist to public');
        }

        console.log(`Playlist with ID ${playlistId} set to public successfully`);
    } catch (error) {
        console.error('Error setting playlist to public:', error);
    }
}

// Function to set a playlist to private
async function setPlaylistPrivate(playlistId) {
    try {
        const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
            method: 'PUT',
            headers: {
                'Authorization': 'Bearer ' + accessToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                public: false
            })
        });

        if (!response.ok) {
            throw new Error('Failed to set playlist to private');
        }

        console.log(`Playlist with ID ${playlistId} set to private successfully`);
    } catch (error) {
        console.error('Error setting playlist to private:', error);
    }
}

// Function to change playlist description
async function changePlaylistDescription(playlistId, newDescription) {
    try {
        const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
            method: 'PUT',
            headers: {
                'Authorization': 'Bearer ' + accessToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                description: newDescription
            })
        });

        if (!response.ok) {
            throw new Error('Failed to change playlist description');
        }

        console.log(`Playlist description for ID ${playlistId} changed successfully`);
    } catch (error) {
        console.error('Error changing playlist description:', error);
    }
}

// Function to change playlist name
async function changePlaylistName(playlistId, newName) {
    try {
        const response = await fetch(`https://api.spotify.com/v1/playlists/${playlistId}`, {
            method: 'PUT',
            headers: {
                'Authorization': 'Bearer ' + accessToken,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: newName
            })
        });

        if (!response.ok) {
            throw new Error('Failed to change playlist name');
        }

        console.log(`Playlist name for ID ${playlistId} changed successfully`);
    } catch (error) {
        console.error('Error changing playlist name:', error);
    }
}


// Function to display user playlists
async function displayUserPlaylists() {
    try {
        const userPlaylists = await fetchAllUserPlaylistsMapped();
        if (userPlaylists) {
            const playlistContainer = document.getElementById('playlist-container');
            playlistContainer.innerHTML = '';
            userPlaylists.forEach(playlist => {
                const playlistCard = createPlaylistCard(playlist);
                playlistContainer.appendChild(playlistCard);
            });
        } else {
            console.error('Failed to fetch user playlists.');
        }
    } catch (error) {
        console.error('Error displaying user playlists:', error);
    }
}

// // Function to create a playlist card
// function createPlaylistCard(playlist) {
//     const card = document.createElement('div');
//     card.classList.add('playlist-card');
//     card.innerHTML = `
//         <img src="${playlist.image}" alt="Playlist Image">
//         <p>Name: ${playlist.name}</p>
//         <p>ID: ${playlist.id}</p>
//         <p>Link: <a href="${playlist.link}" target="_blank">Open Playlist</a></p>
//         <label for="description-${playlist.id}">Change Description:</label>
//         <input type="text" id="description-${playlist.id}" placeholder="New Description">
//         <label for="name-${playlist.id}">Change Name:</label>
//         <input type="text" id="name-${playlist.id}" placeholder="New Name">
//         <button class="status" id="delete-${playlist.id}">Delete</button>
//         <button class="status" id="public-${playlist.id}">Set Public</button>
//         <button class="status" id="private-${playlist.id}">Set Private</button>
//         <button class="status" id="change-description-${playlist.id}">Change Description</button>
//         <button class="status" id="change-name-${playlist.id}">Change Name</button>
//     `;
//     return card;
// }

// Function to create a playlist card
function createPlaylistCard(playlist) {
    const card = document.createElement('article');
    card.classList.add('playlist-card');

    card.innerHTML = `
        <div class="article-wrapper">
            <figure>
                <img src="${playlist.image}" alt="Playlist Image">
            </figure>
            <div class="article-body">
                <h2>${playlist.name}</h2>
                <p>ID: ${playlist.id}</p>
                <p>Link: <a href="${playlist.link}" target="_blank">Open Playlist</a></p>
                <p>Description: ${playlist.description}</p>
                <label for="description-${playlist.id}">Change Description:</label>
                <input class="playlist-card-input" type="text" id="description-${playlist.id}" placeholder="New Description">
                <button class="status playlist-card-input" id="change-description-${playlist.id}">Change Description</button>
                <label for="name-${playlist.id}">Change Name:</label>
                <input class="playlist-card-input" type="text" id="name-${playlist.id}" placeholder="New Name">
                <button class="status playlist-card-input" id="change-name-${playlist.id}">Change Name</button>
                <div class="playlist-card-buttons">
                    <button class="status" id="delete-${playlist.id}">Delete</button>
                    <div>
                        <button class="status" id="public-${playlist.id}">Set Public</button>
                        <button class="status" id="private-${playlist.id}">Set Private</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    return card;
}


// Event listener for managing playlists
document.getElementById('manage-playlists-button').addEventListener('click', async () => {
    // Display playlist management section
    document.getElementById('playlist-management-section').style.display = 'block';
    // Display user playlists
    await displayUserPlaylists();
});

// Event listener for done with playlist management button
document.getElementById('done-managing-playlists').addEventListener('click', () => {
    // Hide playlist management section
    document.getElementById('playlist-management-section').style.display = 'none';
});

// Event listener for managing playlists
document.getElementById('manage-playlists-button').addEventListener('click', async () => {
    // Display playlist management section
    document.getElementById('playlist-management-section').style.display = 'block';
    // Display user playlists
    await displayUserPlaylists();

    // Add event listeners for each playlist card
    document.getElementById('playlist-container').addEventListener('click', async (event) => {
        const target = event.target.closest('.status');
        if (!target) return;

        const id = target.id.split('-')[1];
        const action = target.dataset.action;

        // Change button text to indicate processing
        target.innerHTML = '⏳';

        switch (action) {
            case 'delete':
                try {
                    // Delete playlist
                    await deletePlaylist(id);
                    // Change button text to indicate successful deletion
                    target.innerHTML = '✅ Deleted';
                } catch (error) {
                    console.error('Error deleting playlist:', error);
                    // Change button text to indicate failure
                    target.innerHTML = '❌ Delete Failed';
                }
                break;

            case 'public':
                try {
                    // Set playlist to public
                    await setPlaylistPublic(id);
                    // Change button text to indicate successful change
                    target.innerHTML = '✅ Set Public';
                } catch (error) {
                    console.error('Error setting playlist to public:', error);
                    // Change button text to indicate failure
                    target.innerHTML = '❌ Set Public Failed';
                }
                break;

            case 'private':
                try {
                    // Set playlist to private
                    await setPlaylistPrivate(id);
                    // Change button text to indicate successful change
                    target.innerHTML = '✅ Set Private';
                } catch (error) {
                    console.error('Error setting playlist to private:', error);
                    // Change button text to indicate failure
                    target.innerHTML = '❌ Set Private Failed';
                }
                break;

            case 'change-description':
                try {
                    // Get new description
                    const newDescription = document.getElementById(`description-${id}`).value;
                    // Change playlist description
                    await changePlaylistDescription(id, newDescription);
                    // Change button text to indicate successful change
                    target.innerHTML = '✅ Description Changed';
                } catch (error) {
                    console.error('Error changing playlist description:', error);
                    // Change button text to indicate failure
                    target.innerHTML = '❌ Description Change Failed';
                }
                break;

            case 'change-name':
                try {
                    // Get new name
                    const newName = document.getElementById(`name-${id}`).value;
                    // Change playlist name
                    await changePlaylistName(id, newName);
                    // Change button text to indicate successful change
                    target.innerHTML = '✅ Name Changed';
                } catch (error) {
                    console.error('Error changing playlist name:', error);
                    // Change button text to indicate failure
                    target.innerHTML = '❌ Name Change Failed';
                }
                break;
        }

        // Change button text back to normal after a delay
        setTimeout(() => {
            target.innerHTML = 'Done with Playlist Management';
        }, 3000);
    });
});








































// Attach event listeners to all input fields
const inputFields = document.querySelectorAll('input, select');
inputFields.forEach(input => {
    input.addEventListener('change', saveDataToCache);
});

// Load data from cache on page load
loadDataFromCache();
