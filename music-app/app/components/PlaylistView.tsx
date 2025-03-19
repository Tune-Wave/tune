import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  StatusBar,
  Share,
  ActivityIndicator
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import spotify from '../spotify_service/spotify';
import { useMusic } from '../context/musicContext';

const PlaylistView = ({ playlist, onClose }) => {
  // Get music context
  const { setCurrentSong } = useMusic();
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [playlistData, setPlaylistData] = useState(playlist);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchPlaylistDetails = async () => {
      // Only fetch if this is a Spotify playlist ID (not a local one that starts with 'local_')
      // and doesn't have songs loaded already
      if (
        playlist.id && 
        !playlist.id.toString().startsWith('local_') && 
        (!playlist.songs || playlist.songs.length === 0)
      ) {
        setIsLoading(true);
        setError(null);
        try {
          const details = await spotify.getPlaylistDetails(playlist.id);
          setPlaylistData(details);
        } catch (error) {
          console.error('Error fetching playlist details:', error);
          setError('Failed to load playlist songs. Please try again later.');
        } finally {
          setIsLoading(false);
        }
      }
    };

    fetchPlaylistDetails();
  }, [playlist]);

  // Get songs from the playlist or use empty array if none
  const songs = playlistData.songs && playlistData.songs.length > 0 
    ? playlistData.songs 
    : [];

  const handlePlayAll = () => {
    if (songs.length > 0) {
      setIsPlaying(!isPlaying);
      setCurrentSong(songs[0]);
      
      // Save the first song to recent songs history
      spotify.saveToRecentSongs(songs[0]).catch(err => 
        console.error("Error saving to recent songs:", err)
      );
    }
  };

  const handlePlaySong = (song) => {
    setCurrentSong(song);
    setIsPlaying(true);
    
    // Save this song to recent songs history
    spotify.saveToRecentSongs(song).catch(err => 
      console.error("Error saving to recent songs:", err)
    );
  };

  const handleShare = async () => {
    try {
      if (playlistData.id && !playlistData.id.toString().startsWith('local_')) {
        // Generate proper Spotify URL for sharing
        const shareUrl = `https://open.spotify.com/playlist/${playlistData.id}`;
        
        await Share.share({
          message: `Check out "${playlistData.name}" playlist on Spotify!`,
          url: shareUrl
        });
      } else {
        // For local playlists or when no ID is available
        await Share.share({
          message: `Check out my playlist "${playlistData.name}" with ${songs.length} songs!`
        });
      }
    } catch (error) {
      console.error('Error sharing playlist:', error);
    }
  };

  const renderSongItem = ({ item, index }) => (
    <TouchableOpacity 
      style={styles.songItem}
      onPress={() => handlePlaySong(item)}
    >
      <Text style={styles.songNumber}>{index + 1}</Text>
      <Image 
        source={item.cover ? { uri: item.cover } : require('../../assets/images/postmalone.jpeg')} 
        style={styles.songCover} 
      />
      <View style={styles.songInfo}>
        <Text style={styles.songTitle}>{item.title}</Text>
        <Text style={styles.songArtist}>{item.artist}</Text>
      </View>
      <Text style={styles.songDuration}>{item.duration}</Text>
      <TouchableOpacity style={styles.moreButton}>
        <Ionicons name="ellipsis-vertical" size={20} color="#666" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  // Determine playlist cover image - use coverImage, cover, or fallback
  const playlistCover = playlistData.coverImage || playlistData.cover
    ? { uri: playlistData.coverImage || playlistData.cover }
    : require('../../assets/images/burnaboy.jpeg');

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header with playlist cover and info */}
      <LinearGradient
        colors={['#8A2BE2', '#4B0082', '#000000']}
        style={styles.header}
      >
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Ionicons name="chevron-down" size={28} color="#FFF" />
          </TouchableOpacity>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
              <Ionicons name="share-outline" size={24} color="#FFF" />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="ellipsis-horizontal" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>
        
        <View style={styles.playlistInfo}>
          <Image 
            source={playlistCover} 
            style={styles.playlistCover} 
          />
          <Text style={styles.playlistName}>{playlistData.name}</Text>
          {playlistData.description && (
            <Text style={styles.playlistDescription}>{playlistData.description}</Text>
          )}
          <View style={styles.playlistMeta}>
            <Text style={styles.playlistMetaText}>
              {songs.length} {songs.length === 1 ? 'song' : 'songs'}
            </Text>
            {playlistData.createdAt && (
              <Text style={styles.playlistMetaText}>
                • Created {new Date(playlistData.createdAt).toLocaleDateString()}
              </Text>
            )}
            {playlistData.owner && (
              <Text style={styles.playlistMetaText}>
                • By {playlistData.owner}
              </Text>
            )}
          </View>
        </View>

        <View style={styles.playlistActions}>
          <TouchableOpacity 
            style={styles.shuffleButton}
            disabled={songs.length === 0}
          >
            <Ionicons name="shuffle" size={20} color="#8A2BE2" />
            <Text style={styles.shuffleText}>Shuffle</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.playButton, isPlaying && styles.pauseButton]}
            onPress={handlePlayAll}
            disabled={songs.length === 0}
          >
            <Ionicons 
              name={isPlaying ? "pause" : "play"} 
              size={20} 
              color="#FFF" 
            />
            <Text style={styles.playText}>
              {isPlaying ? 'Pause' : 'Play All'}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Loading Indicator */}
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8A2BE2" />
          <Text style={styles.loadingText}>Loading songs...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle-outline" size={40} color="#8A2BE2" />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity 
            onPress={() => {
              setIsLoading(true);
              setError(null);
              spotify.getPlaylistDetails(playlist.id)
                .then(details => {
                  setPlaylistData(details);
                  setIsLoading(false);
                })
                .catch(err => {
                  console.error('Error retrying playlist details:', err);
                  setError('Failed to load playlist songs. Please try again later.');
                  setIsLoading(false);
                });
            }}
            style={styles.retryButton}
          >
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Songs List */
        <FlatList
          data={songs}
          renderItem={renderSongItem}
          keyExtractor={item => item.id}
          style={styles.songsList}
          contentContainerStyle={styles.songsListContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <FontAwesome5 name="music" size={40} color="#8A2BE2" />
              <Text style={styles.emptyStateText}>No songs yet</Text>
              <Text style={styles.emptyStateSubText}>
                {playlistData.isPublic === false ? 'Add songs to start listening' : 'This playlist is empty'}
              </Text>
            </View>
          }
        />
      )}
      
      {/* Add button for user's own playlists */}
      {playlistData.id && playlistData.id.toString().startsWith('local_') && (
        <TouchableOpacity style={styles.addButton}>
          <Ionicons name="add" size={28} color="#FFF" />
        </TouchableOpacity>
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
    alignItems: 'center'
  },
  loadingText: {
    color: '#FFF',
    marginTop: 12,
    fontSize: 16
  },
  header: {
    paddingTop: 40,
    paddingBottom: 20,
    paddingHorizontal: 20
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20
  },
  backButton: {
    padding: 5
  },
  headerActions: {
    flexDirection: 'row'
  },
  actionButton: {
    marginLeft: 15,
    padding: 5
  },
  playlistInfo: {
    alignItems: 'center',
    marginBottom: 24
  },
  playlistCover: {
    width: 160,
    height: 160,
    borderRadius: 8,
    marginBottom: 16
  },
  playlistName: {
    color: '#FFF',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center'
  },
  playlistDescription: {
    color: '#DDD',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 20
  },
  playlistMeta: {
    flexDirection: 'row',
    marginTop: 8,
    flexWrap: 'wrap',
    justifyContent: 'center'
  },
  playlistMetaText: {
    color: '#BBB',
    fontSize: 14,
    marginRight: 5
  },
  playlistActions: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16
  },
  shuffleButton: {
    backgroundColor: '#FFF',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10
  },
  shuffleText: {
    color: '#121212',
    fontWeight: '600',
    marginLeft: 5
  },
  playButton: {
    backgroundColor: '#8A2BE2',
    borderRadius: 20,
    paddingVertical: 10,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center'
  },
  pauseButton: {
    backgroundColor: '#FF4500'
  },
  playText: {
    color: '#FFF',
    fontWeight: '600',
    marginLeft: 5
  },
  songsList: {
    flex: 1
  },
  songsListContent: {
    paddingHorizontal: 20,
    paddingBottom: 80
  },
  songItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255,255,255,0.1)'
  },
  songNumber: {
    width: 30,
    color: '#999',
    fontSize: 14,
    textAlign: 'center'
  },
  songCover: {
    width: 50,
    height: 50,
    borderRadius: 4
  },
  songInfo: {
    flex: 1,
    marginLeft: 12
  },
  songTitle: {
    color: '#FFF',
    fontSize: 16
  },
  songArtist: {
    color: '#BBB',
    fontSize: 14,
    marginTop: 2
  },
  songDuration: {
    color: '#999',
    fontSize: 14,
    marginRight: 10
  },
  moreButton: {
    padding: 5
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center'
  },
  emptyStateText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16
  },
  emptyStateSubText: {
    color: '#BBB',
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center'
  },
  addButton: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    backgroundColor: '#8A2BE2',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 4
  }
});

export default PlaylistView;