import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet,
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  Image,
  ActivityIndicator,
  Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import spotify from '../spotify_service/spotify';
import { useMusic } from '../context/musicContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function SearchScreen() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recentSearches, setRecentSearches] = useState([]);
  const { setCurrentSong } = useMusic();

  // Load recent searches on component mount
  useEffect(() => {
    loadRecentSearches();
  }, []);

  const loadRecentSearches = async () => {
    try {
      const savedSearches = await AsyncStorage.getItem('recentSearches');
      if (savedSearches) {
        setRecentSearches(JSON.parse(savedSearches));
      }
    } catch (error) {
      console.error('Error loading recent searches:', error);
    }
  };

  const saveRecentSearches = async (searches) => {
    try {
      await AsyncStorage.setItem('recentSearches', JSON.stringify(searches));
    } catch (error) {
      console.error('Error saving recent searches:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    try {
      // Use the correct service method
      const results = await spotify.searchTracks(searchQuery);
      setSearchResults(results);
      
      // Add to recent searches
      if (!recentSearches.includes(searchQuery)) {
        const updatedSearches = [searchQuery, ...recentSearches].slice(0, 5);
        setRecentSearches(updatedSearches);
        saveRecentSearches(updatedSearches);
      }
    } catch (error) {
      console.error('Error searching tracks:', error);
      Alert.alert(
        "Search Error",
        "Unable to search tracks at this time. Please try again later."
      );
    } finally {
      setIsLoading(false);
    }
  };

  const playSong = (song) => {
    // Check if the song has a valid preview URL before attempting to play
    if (!song.previewUrl) {
      Alert.alert(
        "Preview Unavailable",
        "Sorry, a preview is not available for this track.",
        [{ text: "OK" }]
      );
      return;
    }
    
    setCurrentSong(song);
    addToRecentSongs(song);
    router.push('/NowPlaying'); // Make sure this route exists
  };

  const addToRecentSongs = async (song) => {
    try {
      const recentSongsString = await AsyncStorage.getItem('recentSongs');
      const recentSongs = recentSongsString ? JSON.parse(recentSongsString) : [];
      
      // Check if song already exists in recent songs
      const songExists = recentSongs.some(item => item.id === song.id);
      
      if (!songExists) {
        // Add to beginning and limit to 10 songs
        const updatedSongs = [song, ...recentSongs].slice(0, 10);
        await AsyncStorage.setItem('recentSongs', JSON.stringify(updatedSongs));
      }
    } catch (error) {
      console.error('Error updating recent songs:', error);
    }
  };

  const renderSearchItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.resultItem}
      onPress={() => playSong(item)}
      disabled={!item.previewUrl}
    >
      <Image 
        source={item.cover ? { uri: item.cover } : require('../../assets/images/burnaboy.jpeg')} 
        style={styles.resultCover} 
      />
      <View style={styles.resultDetails}>
        <Text style={styles.resultTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.resultArtist} numberOfLines={1}>{item.artist}</Text>
        {!item.previewUrl && (
          <Text style={styles.previewUnavailable}>Preview unavailable</Text>
        )}
      </View>
      <TouchableOpacity 
        style={styles.playButton}
        onPress={() => playSong(item)}
        disabled={!item.previewUrl}
      >
        <Ionicons 
          name={item.previewUrl ? "play-circle" : "play-circle-outline"} 
          size={36} 
          color={item.previewUrl ? "#8A2BE2" : "#CCCCCC"} 
        />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#8A2BE2', '#4B0082']}
        style={styles.header}
      >
        <View style={styles.searchContainer}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <TextInput
            style={styles.searchInput}
            placeholder="Search songs, artists, albums..."
            placeholderTextColor="#CCC"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          <TouchableOpacity onPress={handleSearch}>
            <Ionicons name="search" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8A2BE2" />
          <Text style={styles.loadingText}>Searching...</Text>
        </View>
      ) : searchResults.length > 0 ? (
        <FlatList
          data={searchResults}
          renderItem={renderSearchItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.resultsList}
        />
      ) : (
        <View style={styles.emptyContainer}>
          {recentSearches.length > 0 ? (
            <>
              <Text style={styles.recentTitle}>Recent Searches</Text>
              {recentSearches.map((search, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.recentItem}
                  onPress={() => {
                    setSearchQuery(search);
                    handleSearch();
                  }}
                >
                  <Ionicons name="time-outline" size={20} color="#666" />
                  <Text style={styles.recentText}>{search}</Text>
                </TouchableOpacity>
              ))}
            </>
          ) : (
            <View style={styles.emptyState}>
              <Ionicons name="search" size={60} color="#8A2BE2" opacity={0.5} />
              <Text style={styles.emptyStateText}>
                Search for your favorite songs, artists, or albums
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF',
  },
  header: {
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  searchInput: {
    flex: 1,
    height: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    paddingHorizontal: 16,
    marginHorizontal: 8,
    color: '#FFF',
  },
  resultsList: {
    padding: 16,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  resultCover: {
    width: 50,
    height: 50,
    borderRadius: 4,
  },
  resultDetails: {
    flex: 1,
    marginHorizontal: 12,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  resultArtist: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  previewUnavailable: {
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 2,
  },
  playButton: {
    padding: 6,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#8A2BE2',
  },
  emptyContainer: {
    flex: 1,
    padding: 24,
  },
  recentTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  recentText: {
    fontSize: 16,
    color: '#666',
    marginLeft: 12,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyStateText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  }
});