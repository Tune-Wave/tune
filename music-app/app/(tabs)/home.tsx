import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Image, 
  Alert,
  Modal,
  Platform,
  ActivityIndicator
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';

import AddPlaylistForm from '../components/AddPlaylistForm';
import PlaylistView from '../components/PlaylistView';
import spotify from '../spotify_service/spotify';
import { useMusic } from '../context/musicContext';

// Safe image source utility function
const safeImageSource = (source, fallbackImage) => {
  // If source is falsy, return fallback
  if (!source) return fallbackImage;
  
  // If source is a string, return as uri
  if (typeof source === 'string') return { uri: source };
  
  // If source is a number (required image), return directly
  if (typeof source === 'number') return source;
  
  // For any other type, return fallback
  return fallbackImage;
};

export default function HomeScreen() {
  const { currentSong, setCurrentSong } = useMusic();
  const defaultImage = require('../../assets/images/burnaboy.jpeg');
  
  const [userData, setUserData] = useState(null);
  const [recentSongs, setRecentSongs] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPlaylistView, setShowPlaylistView] = useState(false);
  const [currentPlaylist, setCurrentPlaylist] = useState(null);
  const [featuredPlaylists, setFeaturedPlaylists] = useState([]);
  const [topArtists, setTopArtists] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sectionErrors, setSectionErrors] = useState({
    featuredPlaylists: false,
    topArtists: false,
    recentSongs: false,
    playlists: false
  });

  // Load user data and local storage items
  const loadLocalData = async () => {
    try {
      // Load user data from local storage
      const userDataString = await AsyncStorage.getItem('userData');
      if (userDataString) {
        setUserData(JSON.parse(userDataString));
      }
      
      // Load recent songs from local storage
      const recentSongsData = await spotify.getRecentSongs();
      // Ensure all image URIs are strings
      const sanitizedRecentSongs = recentSongsData.map(song => ({
        ...song,
        cover: typeof song.cover === 'string' ? song.cover : null
      }));
      setRecentSongs(sanitizedRecentSongs);
      
      // Load user playlists from local storage
      const playlistsString = await AsyncStorage.getItem('playlists');
      if (playlistsString) {
        const parsedPlaylists = JSON.parse(playlistsString);
        // Ensure all coverImage URIs are strings
        const sanitizedPlaylists = parsedPlaylists.map(playlist => ({
          ...playlist,
          coverImage: typeof playlist.coverImage === 'string' ? playlist.coverImage : null
        }));
        setPlaylists(sanitizedPlaylists);
      }
    } catch (error) {
      console.error('Error loading local data:', error);
      setSectionErrors(prev => ({
        ...prev,
        recentSongs: true,
        playlists: true
      }));
    }
  };

  // Load featured playlists separately
  const loadFeaturedPlaylists = async () => {
    try {
      const featuredPlaylistsData = await spotify.getFeaturedPlaylists(4);
      // Ensure all cover URIs are strings
      const sanitizedFeaturedPlaylists = featuredPlaylistsData.map(playlist => ({
        ...playlist,
        cover: typeof playlist.cover === 'string' ? playlist.cover : null
      }));
      setFeaturedPlaylists(sanitizedFeaturedPlaylists);
      setSectionErrors(prev => ({...prev, featuredPlaylists: false}));
    } catch (error) {
      console.error('Error loading featured playlists:', error);
      setSectionErrors(prev => ({...prev, featuredPlaylists: true}));
      setFeaturedPlaylists([]);
    }
  };

  // Load top artists separately
  const loadTopArtists = async () => {
    try {
      const topArtistsData = await spotify.getTopArtists(4);
      // Ensure all image URIs are strings
      const sanitizedTopArtists = topArtistsData.map(artist => ({
        ...artist,
        image: typeof artist.image === 'string' ? artist.image : null
      }));
      setTopArtists(sanitizedTopArtists);
      setSectionErrors(prev => ({...prev, topArtists: false}));
    } catch (error) {
      console.error('Error loading top artists:', error);
      setSectionErrors(prev => ({...prev, topArtists: true}));
      setTopArtists([]);
    }
  };

  // Initialize function that loads all data but doesn't stop if one section fails
  const initialize = async () => {
    setIsLoading(true);
    
    // Load local data first
    await loadLocalData();
    
    // Load API data in parallel
    await Promise.allSettled([
      loadFeaturedPlaylists(),
      loadTopArtists()
    ]);
    
    setIsLoading(false);
  };

  // Retry loading for a specific section
  const retrySection = async (section) => {
    if (section === 'featuredPlaylists') {
      await loadFeaturedPlaylists();
    } else if (section === 'topArtists') {
      await loadTopArtists();
    }
  };

  useEffect(() => {
    initialize();
  }, []);

  const addPlaylist = async (playlistData) => {
    try {
      const newPlaylist = {
        id: Date.now().toString(),
        name: playlistData.name,
        description: playlistData.description,
        isPublic: playlistData.isPublic,
        songs: [],
        createdAt: new Date().toISOString(),
        coverImage: playlistData.coverImage || 'https://placehold.co/400x400/8A2BE2/FFF?text=Playlist'
      };

      const updatedPlaylists = [...playlists, newPlaylist];
      setPlaylists(updatedPlaylists);
      await AsyncStorage.setItem('playlists', JSON.stringify(updatedPlaylists));
      Alert.alert('Success', 'Playlist has been created');
    } catch (error) {
      console.error('Error adding playlist:', error);
      Alert.alert('Error', 'Failed to create playlist');
    }
  };

  const viewPlaylist = async (playlist) => {
    try {
      setIsLoading(true);
      
      // If it's a Spotify playlist, fetch full details including tracks
      if (playlist.id && !playlist.id.toString().startsWith('local_')) {
        try {
          const fullPlaylistDetails = await spotify.getPlaylistDetails(playlist.id);
          // Ensure all cover URIs are strings
          const sanitizedTracks = fullPlaylistDetails.tracks?.map(track => ({
            ...track,
            cover: typeof track.cover === 'string' ? track.cover : null
          })) || [];
          
          setCurrentPlaylist({
            ...fullPlaylistDetails,
            tracks: sanitizedTracks,
            coverImage: typeof fullPlaylistDetails.coverImage === 'string' ? 
              fullPlaylistDetails.coverImage : null
          });
        } catch (error) {
          console.error('Error fetching Spotify playlist:', error);
          // If API call fails, still show what we have
          setCurrentPlaylist({
            ...playlist,
            coverImage: typeof playlist.coverImage === 'string' ? 
              playlist.coverImage : null
          });
          Alert.alert('Warning', 'Limited playlist details available. Some features may not work.');
        }
      } else {
        // It's a local playlist
        setCurrentPlaylist({
          ...playlist,
          coverImage: typeof playlist.coverImage === 'string' ? 
            playlist.coverImage : null
        });
      }
      
      setShowPlaylistView(true);
    } catch (error) {
      console.error('Error preparing playlist view:', error);
      Alert.alert('Error', 'Failed to load playlist details');
    } finally {
      setIsLoading(false);
    }
  };

  const playSong = async (song) => {
    try {
      // Set the current song to play using the context function
      const sanitizedSong = {
        ...song,
        cover: typeof song.cover === 'string' ? song.cover : null
      };
      
      setCurrentSong(sanitizedSong);
      
      // Navigate to the now playing screen using router
      router.navigate('NowPlaying');
      
      // Add to recent songs
      const updatedRecentSongs = [sanitizedSong, ...recentSongs.filter(s => s.id !== song.id)].slice(0, 10);
      setRecentSongs(updatedRecentSongs);
      await AsyncStorage.setItem('recentSongs', JSON.stringify(updatedRecentSongs));
    } catch (error) {
      console.error('Error playing song:', error);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8A2BE2" />
        <Text style={styles.loadingText}>Loading your music...</Text>
      </View>
    );
  }

  const renderSectionHeader = (title, section) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {sectionErrors[section] && (
        <TouchableOpacity onPress={() => retrySection(section)} style={styles.retrySmallButton}>
          <Ionicons name="refresh" size={18} color="#8A2BE2" />
          <Text style={styles.retrySmallText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <LinearGradient
        colors={['#8A2BE2', '#4B0082']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <View>
            <Text style={styles.greeting}>Good evening,</Text>
            <Text style={styles.userName}>{userData?.fullName || 'Music Lover'}!</Text>
          </View>
          <TouchableOpacity 
            style={styles.searchButton}
            onPress={() => router.push('Search')}
          >
            <Ionicons name="search" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Featured Section */}
        <View style={styles.section}>
          {renderSectionHeader('Featured Playlists', 'featuredPlaylists')}
          {sectionErrors.featuredPlaylists ? (
            <View style={styles.errorInline}>
              <Text style={styles.errorInlineText}>Failed to load featured playlists</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScrollContent}>
              {featuredPlaylists.map(playlist => (
                <TouchableOpacity 
                  key={playlist.id} 
                  style={styles.featuredItem}
                  onPress={() => viewPlaylist(playlist)}
                >
                  <Image 
                    source={safeImageSource(playlist.cover, defaultImage)} 
                    style={styles.featuredCover} 
                  />
                  <Text style={styles.featuredTitle}>{playlist.name}</Text>
                  <Text style={styles.featuredSubtitle}>{playlist.songs} songs</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Top Artists Section */}
        <View style={styles.section}>
          {renderSectionHeader('Top Artists', 'topArtists')}
          {sectionErrors.topArtists ? (
            <View style={styles.errorInline}>
              <Text style={styles.errorInlineText}>Failed to load top artists</Text>
            </View>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScrollContent}>
              {topArtists.map(artist => (
                <TouchableOpacity 
                  key={artist.id} 
                  style={styles.artistItem}
                >
                  <Image 
                    source={safeImageSource(artist.image, defaultImage)} 
                    style={styles.artistImage} 
                  />
                  <Text style={styles.artistName}>{artist.name}</Text>
                  <Text style={styles.artistGenre}>{artist.genre}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Recently Played Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recently Played</Text>
          {recentSongs.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No recently played songs</Text>
              <Text style={styles.emptyStateAction}>Start listening to see your history</Text>
            </View>
          ) : (
            recentSongs.slice(0, 5).map(song => (
              <TouchableOpacity 
                key={song.id} 
                style={styles.songCard}
                onPress={() => playSong(song)}
              >
                <Image 
                  source={safeImageSource(song.cover, defaultImage)} 
                  style={styles.songCover} 
                />
                <View style={styles.songDetails}>
                  <Text style={styles.songTitle}>{song.title}</Text>
                  <Text style={styles.songArtist}>{song.artist}</Text>
                </View>
                <TouchableOpacity style={styles.playButton}>
                  <Ionicons name="play-circle" size={36} color="#8A2BE2" />
                </TouchableOpacity>
              </TouchableOpacity>
            ))
          )}
        </View>

       {/* Your Playlists Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Your Playlists</Text>
            <TouchableOpacity onPress={() => setShowAddForm(true)}>
              <Ionicons name="add-circle" size={24} color="#8A2BE2" />
            </TouchableOpacity>
          </View>
          
          {playlists.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No playlists yet</Text>
              <Text style={styles.emptyStateAction}>Create a playlist to get started</Text>
            </View>
          ) : (
            playlists.map(playlist => (
              <TouchableOpacity 
                key={playlist.id} 
                style={styles.playlistCard}
                onPress={() => viewPlaylist(playlist)}
              >
                <Image 
                  source={safeImageSource(playlist.coverImage, defaultImage)} 
                  style={styles.playlistCover} 
                />
                <View style={styles.playlistDetails}>
                  <Text style={styles.playlistTitle}>{playlist.name}</Text>
                  <Text style={styles.playlistSubtitle}>{playlist.songs?.length || 0} songs</Text>
                </View>
                <Ionicons name="chevron-forward" size={24} color="#8A2BE2" />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Add Playlist Modal */}
      <Modal
        visible={showAddForm}
        animationType="slide"
        transparent={true}
      >
        <View style={styles.modalContainer}>
          <AddPlaylistForm
            onSubmit={(playlistData) => {
              addPlaylist(playlistData);
              setShowAddForm(false);
            }}
            onClose={() => setShowAddForm(false)}
          />
        </View>
      </Modal>

      {/* Playlist View Modal */}
      {currentPlaylist && (
        <Modal
          visible={showPlaylistView}
          animationType="slide"
          onRequestClose={() => setShowPlaylistView(false)}
        >
          <PlaylistView 
            playlist={currentPlaylist}
            onClose={() => {
              setShowPlaylistView(false);
              setCurrentPlaylist(null);
            }}
            onPlay={playSong}
          />
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#121212'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212'
  },
  loadingText: {
    color: '#FFF',
    marginTop: 12,
    fontSize: 16
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
    padding: 20
  },
  errorText: {
    color: '#FFF',
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 20
  },
  retryButton: {
    backgroundColor: '#8A2BE2',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 20
  },
  retryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600'
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 20,
    paddingHorizontal: 20
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  greeting: {
    color: '#FFF',
    fontSize: 16,
    opacity: 0.8
  },
  userName: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 4
  },
  searchButton: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 10,
    borderRadius: 20
  },
  scrollContent: {
    paddingBottom: 60
  },
  section: {
    padding: 20
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12
  },
  sectionTitle: {
    color: '#FFF',
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12
  },
  horizontalScrollContent: {
    paddingRight: 20
  },
  featuredItem: {
    width: 160,
    marginRight: 12
  },
  featuredCover: {
    width: 160,
    height: 160,
    borderRadius: 8
  },
  featuredTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8
  },
  featuredSubtitle: {
    color: '#BBBBBB',
    fontSize: 14,
    marginTop: 4
  },
  artistItem: {
    width: 120,
    marginRight: 12,
    alignItems: 'center'
  },
  artistImage: {
    width: 120,
    height: 120,
    borderRadius: 60
  },
  artistName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center'
  },
  artistGenre: {
    color: '#BBBBBB',
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center'
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12
  },
  emptyStateText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center'
  },
  emptyStateAction: {
    color: '#BBBBBB',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center'
  },
  songCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    marginBottom: 10,
    padding: 10
  },
  songCover: {
    width: 50,
    height: 50,
    borderRadius: 4
  },
  songDetails: {
    flex: 1,
    marginLeft: 12
  },
  songTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600'
  },
  songArtist: {
    color: '#BBBBBB',
    fontSize: 14,
    marginTop: 4
  },
  playButton: {
    padding: 5
  },
  playlistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    marginBottom: 10,
    padding: 10
  },
  playlistCover: {
    width: 60,
    height: 60,
    borderRadius: 4
  },
  playlistDetails: {
    flex: 1,
    marginLeft: 12
  },
  playlistTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600'
  },
  playlistSubtitle: {
    color: '#BBBBBB',
    fontSize: 14,
    marginTop: 4
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end'
  }
});