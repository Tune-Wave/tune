// services/spotify.tsx
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';
import { SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } from '../api-config/spotify';

// Base URLs
const AUTH_URL = 'https://accounts.spotify.com/api/token';
const API_URL = 'https://api.spotify.com/v1';

// Store your personal access token
const PERSONAL_ACCESS_TOKEN = 'BQCAapQUqA0Zt4I7VlTlINVfRrl2eaWFRciAcqEIX0-IFkoWvVliij37YHtwjtUyNzkZ1ejzIR5dSYTSHeJbHT9CNgxsRoWF0ac0o2kax_u9O5TwHdaNxIpxCKH_LQs1wU2QGGWCM3nBLY57HEogP3pR5u1ha_DWcVVd01DfOQYETiMNHULBL5LV8VRTmTfSAwPlVKgT_uPY31K-SwNSamM80E2Y6GE0sgPX2iRislpPCUT2W1zrqF-krKyyOd7F6ojpTaES4ZbyCL8M5WMvf7XcrsQkFuL4En-IkypmWyVsNuqjqOgzn3yYqpcw';

// Get access token using client credentials flow for non-personalized API calls
const getAccessToken = async () => {
  try {
    // Check if we have a cached token that's not expired
    const tokenData = await AsyncStorage.getItem('spotifyToken');
    
    if (tokenData) {
      const parsedToken = JSON.parse(tokenData);
      const currentTime = Date.now();
      
      // If token is still valid (with 60s buffer), return it
      if (parsedToken.expiresAt > currentTime + 60000) {
        return parsedToken.access_token;
      }
    }
    
    // We need a new token
    const auth = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString('base64');
    
    const response = await fetch(AUTH_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`Failed to get Spotify token: ${data.error}`);
    }
    
    // Calculate expiry time and store token
    const expiresAt = Date.now() + (data.expires_in * 1000);
    const tokenToStore = {
      access_token: data.access_token,
      expiresAt
    };
    
    await AsyncStorage.setItem('spotifyToken', JSON.stringify(tokenToStore));
    return data.access_token;
  } catch (error) {
    console.error('Error getting Spotify access token:', error);
    throw error;
  }
};

// API request helper with option to use personal token
const fetchWebApi = async (endpoint: string, method: string = 'GET', body: any = null, usePersonalToken: boolean = false) => {
  try {
    // Use personal token for personalized endpoints or client credentials for public endpoints
    const token = usePersonalToken ? PERSONAL_ACCESS_TOKEN : await getAccessToken();
    
    const options: RequestInit = {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    };
    
    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }
    
    const response = await fetch(`${API_URL}${endpoint}`, options);
    
    // Check if the response is OK before trying to parse JSON
    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = 'Unknown error';
      
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorData.error_description || errorData.error || 'Unknown error';
      } catch (e) {
        errorMessage = errorText || 'Unknown error';
      }
      
      throw new Error(`Spotify API error: ${errorMessage}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error(`Error in Spotify API request to ${endpoint}:`, error);
    throw error;
  }
};

// Get featured playlists
export const getFeaturedPlaylists = async (limit = 4) => {
  // Make sure to specify country and timestamp parameters
  const timestamp = new Date().toISOString();
  const data = await fetchWebApi(`/browse/featured-playlists?limit=${limit}&country=US&timestamp=${encodeURIComponent(timestamp)}`, 'GET');
  
  return data.playlists.items.map((item: any) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    songs: item.tracks?.total || 0,
    cover: item.images[0]?.url,
    owner: item.owner.display_name,
    isPublic: item.public !== false
  }));
};

// Get playlist details including tracks
export const getPlaylistDetails = async (playlistId: string) => {
  const data = await fetchWebApi(`/playlists/${playlistId}?market=US`, 'GET');
  
  const tracks = data.tracks.items.map((item: any) => ({
    id: item.track?.id || 'unknown',
    title: item.track?.name || 'Unknown Track',
    artist: item.track?.artists?.map((artist: any) => artist.name).join(', ') || 'Unknown Artist',
    duration: item.track?.duration_ms ? msToMinSec(item.track.duration_ms) : '0:00',
    cover: item.track?.album?.images[0]?.url || '',
    uri: item.track?.uri || '',
    previewUrl: item.track?.preview_url || null
  }));
  
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    coverImage: data.images[0]?.url,
    songs: tracks,
    owner: data.owner.display_name,
    isPublic: data.public !== false,
    createdAt: data.followers ? new Date().toISOString() : undefined
  };
};

// Get user's top tracks (personalized)
export const getPersonalTopTracks = async (limit = 5, timeRange = 'long_term') => {
  const data = await fetchWebApi(`/me/top/tracks?time_range=${timeRange}&limit=${limit}`, 'GET', null, true);
  
  return data.items.map((item: any) => ({
    id: item.id,
    title: item.name,
    artist: item.artists.map((artist: any) => artist.name).join(', '),
    duration: msToMinSec(item.duration_ms),
    cover: item.album.images[0]?.url,
    uri: item.uri,
    previewUrl: item.preview_url
  }));
};

// Get user's personalized playlists
export const getPersonalPlaylists = async (limit = 10) => {
  const data = await fetchWebApi(`/me/playlists?limit=${limit}`, 'GET', null, true);
  
  return data.items.map((item: any) => ({
    id: item.id,
    name: item.name,
    description: item.description,
    songs: item.tracks?.total || 0,
    cover: item.images[0]?.url,
    owner: item.owner.display_name,
    isPublic: item.public !== false
  }));
};

// Create a new playlist with tracks
export const createPlaylist = async (name: string, description: string, trackUris: string[]) => {
  try {
    // Get user profile first
    const userProfile = await fetchWebApi('/me', 'GET', null, true);
    const userId = userProfile.id;
    
    // Create the playlist
    const playlist = await fetchWebApi(
      `/users/${userId}/playlists`, 
      'POST', 
      {
        name,
        description,
        public: false
      },
      true
    );
    
    // Add tracks to the playlist
    if (trackUris.length > 0) {
      await fetchWebApi(
        `/playlists/${playlist.id}/tracks`,
        'POST',
        { uris: trackUris },
        true
      );
    }
    
    return {
      id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      externalUrl: playlist.external_urls?.spotify
    };
  } catch (error) {
    console.error('Error creating playlist:', error);
    throw error;
  }
};

// Get new releases (instead of top artists since that requires user authorization)
export const getTopArtists = async (limit = 10) => {
  const data = await fetchWebApi(`/browse/new-releases?limit=${limit}&country=US`, 'GET');
  
  // Extract unique artists from new releases
  const artistsMap = new Map();
  
  data.albums.items.forEach((album: any) => {
    const artist = album.artists[0];
    if (artist && !artistsMap.has(artist.id)) {
      artistsMap.set(artist.id, {
        id: artist.id,
        name: artist.name,
        genre: album.genres?.[0] || 'Unknown',
        image: album.images[0]?.url
      });
    }
  });
  
  return Array.from(artistsMap.values()).slice(0, limit);
};

// Get user's personalized top artists
export const getPersonalTopArtists = async (limit = 5, timeRange = 'long_term') => {
  const data = await fetchWebApi(`/me/top/artists?time_range=${timeRange}&limit=${limit}`, 'GET', null, true);
  
  return data.items.map((item: any) => ({
    id: item.id,
    name: item.name,
    genres: item.genres || [],
    popularity: item.popularity,
    image: item.images[0]?.url
  }));
};

// Get recommendations based on user's top tracks and artists
export const getPersonalRecommendations = async (limit = 10) => {
  // Get user's top tracks and artists
  const topTracks = await getPersonalTopTracks(3);
  const topArtists = await getPersonalTopArtists(2);
  
  const seedTracks = topTracks.map(track => track.id).slice(0, 2);
  const seedArtists = topArtists.map(artist => artist.id).slice(0, 3);
  
  // Get recommendations
  const data = await fetchWebApi(
    `/recommendations?limit=${limit}&seed_tracks=${seedTracks.join(',')}&seed_artists=${seedArtists.join(',')}`,
    'GET',
    null,
    true
  );
  
  return data.tracks.map((item: any) => ({
    id: item.id,
    title: item.name,
    artist: item.artists.map((artist: any) => artist.name).join(', '),
    duration: msToMinSec(item.duration_ms),
    cover: item.album.images[0]?.url,
    uri: item.uri,
    previewUrl: item.preview_url
  }));
};

// Search for tracks
export const searchTracks = async (query: string, limit = 20) => {
  if (!query || query.trim().length === 0) {
    return [];
  }
  
  const data = await fetchWebApi(`/search?q=${encodeURIComponent(query)}&type=track&limit=${limit}&market=US`, 'GET');
  
  return data.tracks.items.map((item: any) => ({
    id: item.id,
    title: item.name,
    artist: item.artists.map((artist: any) => artist.name).join(', '),
    duration: msToMinSec(item.duration_ms),
    cover: item.album.images[0]?.url,
    uri: item.uri,
    previewUrl: item.preview_url
  }));
};

// Get recently played tracks from API (personalized)
export const getRecentlyPlayedTracks = async (limit = 20) => {
  const data = await fetchWebApi(`/me/player/recently-played?limit=${limit}`, 'GET', null, true);
  
  return data.items.map((item: any) => ({
    id: item.track.id,
    title: item.track.name,
    artist: item.track.artists.map((artist: any) => artist.name).join(', '),
    duration: msToMinSec(item.track.duration_ms),
    cover: item.track.album.images[0]?.url,
    uri: item.track.uri,
    previewUrl: item.track.preview_url,
    playedAt: item.played_at
  }));
};

// Get recently played tracks from local storage (fallback)
export const getRecentSongs = async () => {
  try {
    const recentSongsString = await AsyncStorage.getItem('recentSongs');
    return recentSongsString ? JSON.parse(recentSongsString) : [];
  } catch (error) {
    console.error('Error getting recent songs:', error);
    return [];
  }
};

// Save track to recent songs
export const saveToRecentSongs = async (song: any) => {
  try {
    const recentSongs = await getRecentSongs();
    
    // Remove the song if it already exists
    const filteredSongs = recentSongs.filter((s: any) => s.id !== song.id);
    
    // Add the song to the beginning
    const updatedSongs = [song, ...filteredSongs].slice(0, 20);
    
    await AsyncStorage.setItem('recentSongs', JSON.stringify(updatedSongs));
    
    return updatedSongs;
  } catch (error) {
    console.error('Error saving to recent songs:', error);
    throw error;
  }
};

// Helper to format milliseconds to MM:SS
const msToMinSec = (ms: number): string => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

export default {
  getFeaturedPlaylists,
  getPlaylistDetails,
  getTopArtists,
  searchTracks,
  getRecentSongs
};