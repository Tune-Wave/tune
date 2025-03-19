import React, { useEffect, useState, useCallback, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  ScrollView, 
  Image,
  Alert,
  ActivityIndicator,
  RefreshControl,
  Platform,
  PermissionsAndroid,
  Modal
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import * as MediaLibrary from 'expo-media-library';
import { Audio } from 'expo-av';
import { useIsFocused } from '@react-navigation/native';
import AddPlaylistForm from '../components/AddPlaylistForm';
import { useMusic } from '../context/musicContext';
import { useRouter } from 'expo-router';

// Built-in asset music
const DEFAULT_MUSIC = [
  {
    id: 'asset-1',
    title: 'Jowo',
    artist: 'Davido',
    duration: 218,
    uri: require('../../assets/music/Davido_-_Jowo__Official_Video_(128k).m4a'),
    cover: require('../../assets/images/burnaboy.jpeg'),
    isAssetMusic: true
  },
  {
    id: 'asset-2',
    title: 'You Wanna Bamba',
    artist: 'Goya Menor',
    duration: 187,
    uri: require('../../assets/music/Goya_Menor_&_Nektunez_–_Ameno_Amapiano_Remix_(You_Wanna_Bamba)_[Official_Video](256k).mp3'),
    cover: require('../../assets/images/burnaboy.jpeg'),
    isAssetMusic: true
  },
  {
    id: 'asset-3',
    title: 'Fathermoh ft Odi wa Muranga',
    artist: 'Kwa Bar',
    duration: 242,
    uri: require('../../assets/music/Kwa_Bar_by_Odi_Wa_Muranga_ft._Fathermoh_&_Harry_Craze(256k).mp3'),
    cover: require('../../assets/images/burnaboy.jpeg'),
    isAssetMusic: true
  }
];

export default function LibraryScreen({ navigation }) {
  const [deviceSongs, setDeviceSongs] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [loadingState, setLoadingState] = useState('idle'); // idle, loading, success, error
  const [activeTab, setActiveTab] = useState('songs');
  const [refreshing, setRefreshing] = useState(false);
  const [showAddPlaylist, setShowAddPlaylist] = useState(false);
  const [showingAssetMusic, setShowingAssetMusic] = useState(false);
  const isFocused = useIsFocused();
  const router = useRouter();
  const { setCurrentSong } = useMusic();

  // Timer for fallback to asset music
  const loadingTimerRef = useRef(null);
  const isMountedRef = useRef(true);
  const lastRefreshRef = useRef(Date.now());
  
  // Batch loading settings
  const INITIAL_BATCH_SIZE = 20;
  const BATCH_SIZE = 50;
  // Reduced timeout for faster fallback to built-in music
  const LOADING_TIMEOUT = 5000; 

  // Pagination state
  const [hasMoreSongs, setHasMoreSongs] = useState(true);
  const [loadingMoreSongs, setLoadingMoreSongs] = useState(false);
  const endCursorRef = useRef(null);

  const loadPlaylists = useCallback(async () => {
    try {
      const playlistsString = await AsyncStorage.getItem('playlists');
      if (playlistsString && isMountedRef.current) {
        setPlaylists(JSON.parse(playlistsString));
      }
    } catch (error) {
      console.error('Error loading playlists:', error);
    }
  }, []);

  // Fallback to built-in asset music if device music takes too long
  const loadAssetMusic = useCallback(() => {
    if (isMountedRef.current && deviceSongs.length === 0) {
      console.log('Loading fallback music from assets');
      setDeviceSongs(DEFAULT_MUSIC);
      setShowingAssetMusic(true);
      setLoadingState('success');
    }
  }, [deviceSongs.length]);

  // Load initial songs from device (or cache) and start a fallback timer
  const loadInitialSongs = useCallback(async () => {
    setLoadingState('loading');
    
    // Start fallback timer
    if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    loadingTimerRef.current = setTimeout(() => {
      loadAssetMusic();
    }, LOADING_TIMEOUT);
    
    try {
      // Try to use cached songs if available and fresh (less than 30 minutes old)
      const lastModifiedString = await AsyncStorage.getItem('songsCacheTimestamp');
      const storedSongs = await AsyncStorage.getItem('deviceSongs');
      
      if (storedSongs && lastModifiedString) {
        const lastModified = parseInt(lastModifiedString, 10);
        const now = Date.now();
        if (now - lastModified < 30 * 60 * 1000) {
          const parsedStoredSongs = JSON.parse(storedSongs);
          if (isMountedRef.current) {
            if (loadingTimerRef.current) {
              clearTimeout(loadingTimerRef.current);
              loadingTimerRef.current = null;
            }
            setDeviceSongs(parsedStoredSongs.slice(0, INITIAL_BATCH_SIZE));
            setLoadingState('success');
            setShowingAssetMusic(false);
            // Load the full list shortly after for better UX
            setTimeout(() => {
              if (isMountedRef.current) {
                setDeviceSongs(parsedStoredSongs);
              }
            }, 300);
            // Refresh device songs in the background if last refresh was over 5 minutes ago
            if (now - lastRefreshRef.current > 5 * 60 * 1000) {
              lastRefreshRef.current = now;
              setTimeout(() => refreshDeviceSongs(), 2000);
            }
            return;
          }
        }
      }
      
      // No valid cache? Request permissions and load initial batch from device
      await requestMediaPermissions();
      await loadSongBatch(null, INITIAL_BATCH_SIZE);
      
      if (isMountedRef.current) {
        if (loadingTimerRef.current) {
          clearTimeout(loadingTimerRef.current);
          loadingTimerRef.current = null;
        }
        setLoadingState('success');
        setShowingAssetMusic(false);
      }
    } catch (error) {
      console.error('Error in loadInitialSongs:', error);
      if (isMountedRef.current) {
        setLoadingState('error');
      }
    } finally {
      if (isMountedRef.current) setRefreshing(false);
    }
  }, [loadAssetMusic]);

  // Request necessary permissions (Android and Expo MediaLibrary)
  const requestMediaPermissions = async () => {
    try {
      if (Platform.OS === 'android') {
        const permission = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
          {
            title: 'Music App Storage Permission',
            message: 'Music App needs access to your storage to show your music files',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        if (permission !== PermissionsAndroid.RESULTS.GRANTED) {
          throw new Error('Storage permission denied');
        }
      }
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Media library permission denied');
      }
      return true;
    } catch (error) {
      Alert.alert('Permission Error', 'Unable to access your music files. Please grant storage permissions.');
      throw error;
    }
  };

  // Load a batch of songs using pagination (removed sortBy for faster response)
  const loadSongBatch = async (after, batchSize) => {
    try {
      const media = await MediaLibrary.getAssetsAsync({
        mediaType: MediaLibrary.MediaType.audio,
        first: batchSize,
        after,
      });
      
      const newSongs = media.assets.map(item => ({
        id: item.id,
        title: item.filename.replace(/\.[^/.]+$/, ""),
        artist: 'Unknown Artist',
        duration: item.duration,
        uri: item.uri,
        cover: require('../../assets/images/burnaboy.jpeg'),
        createdAt: item.creationTime,
        isAssetMusic: false
      }));
      
      if (isMountedRef.current) {
        setDeviceSongs(prev => {
          if (showingAssetMusic) {
            setShowingAssetMusic(false);
            return newSongs;
          }
          return [...prev, ...newSongs];
        });
        
        endCursorRef.current = media.endCursor;
        setHasMoreSongs(media.hasNextPage);
        
        // Cache songs if we have reached a certain count
        const shouldCache = deviceSongs.length === 0 || deviceSongs.length + newSongs.length >= 100;
        if (shouldCache) {
          const allSongs = showingAssetMusic ? newSongs : [...deviceSongs, ...newSongs];
          setTimeout(async () => {
            try {
              await AsyncStorage.setItem('deviceSongs', JSON.stringify(allSongs));
              await AsyncStorage.setItem('songsCacheTimestamp', Date.now().toString());
            } catch (cacheError) {
              console.warn('Error caching songs:', cacheError);
            }
          }, 100);
        }
      }
      
      return media.hasNextPage;
    } catch (error) {
      console.error('Error loading song batch:', error);
      throw error;
    }
  };

  // Load more songs when user scrolls near the bottom
  const loadMoreSongs = useCallback(async () => {
    if (!hasMoreSongs || loadingMoreSongs || loadingState === 'loading' || showingAssetMusic) return;
    
    setLoadingMoreSongs(true);
    try {
      await loadSongBatch(endCursorRef.current, BATCH_SIZE);
    } catch (error) {
      console.error('Error loading more songs:', error);
    } finally {
      if (isMountedRef.current) setLoadingMoreSongs(false);
    }
  }, [hasMoreSongs, loadingMoreSongs, loadingState, showingAssetMusic]);

  const handleScroll = ({ nativeEvent }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const paddingToBottom = 20;
    const isCloseToBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom;
    
    if (isCloseToBottom && activeTab === 'songs') {
      loadMoreSongs();
    }
  };

  // Refresh songs from device storage
  const refreshDeviceSongs = async () => {
    try {
      await requestMediaPermissions();
      
      if (isMountedRef.current) {
        if (!showingAssetMusic) setDeviceSongs([]);
        endCursorRef.current = null;
        setHasMoreSongs(true);
      }
      
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
      loadingTimerRef.current = setTimeout(() => {
        loadAssetMusic();
      }, LOADING_TIMEOUT);
      
      await loadSongBatch(null, INITIAL_BATCH_SIZE);
      
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
      
      lastRefreshRef.current = Date.now();
    } catch (error) {
      console.error('Error refreshing device songs:', error);
      Alert.alert('Error', 'Failed to load songs from device');
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    
    if (isFocused) {
      const now = Date.now();
      if (now - lastRefreshRef.current > 2000) { // Prevent excessive reloads
        loadInitialSongs();
        loadPlaylists();
      }
    }
    
    return () => {
      isMountedRef.current = false;
      if (loadingTimerRef.current) clearTimeout(loadingTimerRef.current);
    };
  }, [isFocused, loadInitialSongs, loadPlaylists]);

  const playSong = async (song) => {
    try {
      const sound = new Audio.Sound();
      if (song.isAssetMusic) {
        await sound.loadAsync(song.uri);
      } else {
        await sound.loadAsync({ uri: song.uri });
      }
      
      setCurrentSong({ ...song, sound });
      router.push('/(tabs)/NowPlaying');
    } catch (error) {
      console.error('Error playing song:', error);
      Alert.alert('Error', 'Failed to play the selected song');
    }
  };

  const handleCreatePlaylist = async (newPlaylist) => {
    try {
      const playlistId = Date.now().toString();
      const playlistToSave = {
        id: playlistId,
        name: newPlaylist.name,
        description: newPlaylist.description,
        isPublic: newPlaylist.isPublic,
        coverImage: newPlaylist.coverImage,
        songs: [],
        createdAt: new Date().toISOString(),
      };
      
      const updatedPlaylists = [...playlists, playlistToSave];
      setPlaylists(updatedPlaylists);
      await AsyncStorage.setItem('playlists', JSON.stringify(updatedPlaylists));
      
      setShowAddPlaylist(false);
      Alert.alert('Success', `Playlist "${newPlaylist.name}" created successfully!`);
    } catch (error) {
      console.error('Error creating playlist:', error);
      Alert.alert('Error', 'Failed to create playlist');
    }
  };

  const renderSongs = () => (
    <View style={styles.tabContent}>
      {deviceSongs.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="music-off" size={50} color="#8A2BE2" />
          <Text style={styles.emptyStateText}>No songs found</Text>
          <Text style={styles.emptyStateAction}>
            Add music to your device or pull down to refresh
          </Text>
        </View>
      ) : (
        <>
          {showingAssetMusic && (
            <View style={styles.assetMusicBanner}>
              <Ionicons name="information-circle" size={18} color="#FFF" />
              <Text style={styles.assetMusicText}>
                Showing built-in music. Pull to refresh to check device music.
              </Text>
            </View>
          )}
          {deviceSongs.map(song => (
            <TouchableOpacity 
              key={song.id} 
              style={styles.songCard}
              onPress={() => playSong(song)}
            >
              <Image source={song.cover} style={styles.songCover} />
              <View style={styles.songDetails}>
                <Text style={styles.songTitle} numberOfLines={1}>
                  {song.title}
                </Text>
                <Text style={styles.songArtist} numberOfLines={1}>
                  {song.artist}
                </Text>
                {song.isAssetMusic && (
                  <View style={styles.assetIndicator}>
                    <Text style={styles.assetIndicatorText}>Built-in</Text>
                  </View>
                )}
              </View>
              <TouchableOpacity style={styles.playButton}>
                <Ionicons name="play-circle" size={36} color="#8A2BE2" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </>
      )}
      {loadingMoreSongs && !showingAssetMusic && (
        <View style={styles.paginationLoader}>
          <ActivityIndicator size="small" color="#8A2BE2" />
          <Text style={styles.paginationText}>Loading more songs...</Text>
        </View>
      )}
    </View>
  );

  const renderPlaylists = () => (
    <View style={styles.tabContent}>
      <TouchableOpacity 
        style={styles.createPlaylistButton}
        onPress={() => setShowAddPlaylist(true)}
      >
        <Ionicons name="add-circle" size={24} color="#8A2BE2" />
        <Text style={styles.createPlaylistText}>Create New Playlist</Text>
      </TouchableOpacity>
      
      {playlists.length === 0 ? (
        <View style={styles.emptyState}>
          <FontAwesome5 name="list-ul" size={50} color="#8A2BE2" />
          <Text style={styles.emptyStateText}>No playlists yet</Text>
          <Text style={styles.emptyStateAction}>
            Create a playlist to organize your music
          </Text>
        </View>
      ) : (
        playlists.map(playlist => (
          <TouchableOpacity 
            key={playlist.id} 
            style={styles.playlistCard}
            onPress={() => navigation.navigate('PlaylistDetail', { playlist })}
          >
            <Image 
              source={
                playlist.coverImage 
                  ? { uri: playlist.coverImage } 
                  : require('../../assets/images/burnaboy.jpeg')
              } 
              style={styles.playlistCardCover} 
            />
            <View style={styles.playlistDetails}>
              <Text style={styles.playlistName}>{playlist.name}</Text>
              <Text style={styles.playlistSongs}>
                {playlist.songs?.length || 0} songs
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color="#8A2BE2" />
          </TouchableOpacity>
        ))
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#8A2BE2', '#4B0082']}
        style={styles.header}
      >
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Your Library</Text>
          <TouchableOpacity style={styles.searchButton}>
            <Ionicons name="search" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>
      
      {/* Tab Navigation */}
      <View style={styles.tabBar}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'songs' && styles.activeTab]}
          onPress={() => setActiveTab('songs')}
        >
          <Ionicons name="musical-notes" size={18} color={activeTab === 'songs' ? '#8A2BE2' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'songs' && styles.activeTabText]}>
            Songs
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'playlists' && styles.activeTab]}
          onPress={() => setActiveTab('playlists')}
        >
          <Ionicons name="list" size={18} color={activeTab === 'playlists' ? '#8A2BE2' : '#666'} />
          <Text style={[styles.tabText, activeTab === 'playlists' && styles.activeTabText]}>
            Playlists
          </Text>
        </TouchableOpacity>
      </View>
      
      {/* Content */}
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={400}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={() => {
              setRefreshing(true);
              setShowingAssetMusic(false);
              refreshDeviceSongs();
            }} 
            colors={['#8A2BE2']}
          />
        }
      >
        {loadingState === 'loading' && deviceSongs.length === 0 ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#8A2BE2" />
            <Text style={styles.loadingText}>Loading your music...</Text>
            <Text style={styles.loadingSubText}>
              Will show built-in music if device music takes too long
            </Text>
          </View>
        ) : loadingState === 'error' && deviceSongs.length === 0 ? (
          <View style={styles.errorContainer}>
            <MaterialIcons name="error-outline" size={50} color="#FF6B6B" />
            <Text style={styles.errorText}>Failed to load music</Text>
            <TouchableOpacity 
              style={styles.retryButton}
              onPress={() => loadInitialSongs()}
            >
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.fallbackButton}
              onPress={() => loadAssetMusic()}
            >
              <Text style={styles.fallbackButtonText}>Show Built-in Music</Text>
            </TouchableOpacity>
          </View>
        ) : (
          activeTab === 'songs' ? renderSongs() : renderPlaylists()
        )}
      </ScrollView>

      {/* Add Playlist Modal */}
      <Modal
        visible={showAddPlaylist}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddPlaylist(false)}
      >
        <View style={styles.modalBackground}>
          <AddPlaylistForm 
            onSubmit={handleCreatePlaylist}
            onClose={() => setShowAddPlaylist(false)}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F8F8',
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 15,
    paddingHorizontal: 20,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFF',
  },
  searchButton: {
    padding: 8,
  },
  tabBar: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EFEFEF',
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    marginRight: 20,
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: '#8A2BE2',
  },
  tabText: {
    marginLeft: 5,
    fontSize: 16,
    color: '#666',
  },
  activeTabText: {
    color: '#8A2BE2',
    fontWeight: '600',
  },
  scrollContent: {
    padding: 15,
    paddingBottom: 100, // Space for player control
  },
  loaderContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  errorText: {
    marginTop: 10,
    fontSize: 16,
    color: '#FF6B6B',
    marginBottom: 15,
  },
  retryButton: {
    backgroundColor: '#8A2BE2',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  tabContent: {
    marginTop: 10,
  },
  songCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 10,
    marginBottom: 10,
    padding: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  songCover: {
    width: 50,
    height: 50,
    borderRadius: 6,
  },
  songDetails: {
    flex: 1,
    marginLeft: 15,
  },
  songTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  songArtist: {
    fontSize: 14,
    color: '#666',
  },
  playButton: {
    padding: 5,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 50,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginTop: 15,
    marginBottom: 5,
  },
  emptyStateAction: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 30,
  },
  createPlaylistButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0E6FF',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
  },
  createPlaylistText: {
    marginLeft: 10,
    fontSize: 16,
    fontWeight: '600',
    color: '#8A2BE2',
  },
  playlistCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderRadius: 10,
    marginBottom: 10,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  playlistCardCover: {
    width: 55,
    height: 55,
    borderRadius: 8,
  },
  playlistDetails: {
    flex: 1,
    marginLeft: 15,
  },
  playlistName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  playlistSongs: {
    fontSize: 14,
    color: '#666',
  },
  modalBackground: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  paginationLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  paginationText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
loadingSubText: {
  fontSize: 12,
  color: '#999',
  textAlign: 'center',
  marginTop: 5,
  paddingHorizontal: 20,
},
fallbackButton: {
  backgroundColor: '#F0E6FF',
  paddingHorizontal: 20,
  paddingVertical: 10,
  borderRadius: 20,
  marginTop: 10,
},
fallbackButtonText: {
  color: '#8A2BE2',
  fontWeight: '600',
},
assetMusicBanner: {
  flexDirection: 'row',
  alignItems: 'center',
  backgroundColor: '#8A2BE2',
  padding: 8,
  borderRadius: 6,
  marginBottom: 15,
},
assetMusicText: {
  color: '#FFF',
  fontSize: 13,
  marginLeft: 6,
  flex: 1,
},
assetIndicator: {
  backgroundColor: '#F0E6FF',
  paddingHorizontal: 8,
  paddingVertical: 2,
  borderRadius: 10,
  marginTop: 4,
  alignSelf: 'flex-start',
},
assetIndicatorText: {
  color: '#8A2BE2',
  fontSize: 10,
  fontWeight: '500',
}
});