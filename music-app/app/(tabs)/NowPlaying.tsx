import React, { useEffect, useState, useRef } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  Image, 
  Alert,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { Audio } from 'expo-av';
import { useMusic } from '../context/musicContext';
import { useRouter } from 'expo-router';

export default function NowPlayingScreen() {
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [hasCheckedSong, setHasCheckedSong] = useState(false);
  
  // Keep track of component mounted state
  const isMounted = useRef(true);
  
  // Get the music context and router
  const { currentSong, setCurrentSong } = useMusic();
  const router = useRouter();

  // First check if we have a song, before trying to do anything else
  useEffect(() => {
    if (!currentSong) {
      Alert.alert('No Song', 'No song is currently selected.', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } else {
      setHasCheckedSong(true);
    }
  }, [currentSong, router]);

  useEffect(() => {
    // Initialize audio settings
    const setupAudio = async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          staysActiveInBackground: true,
          interruptionModeIOS: Audio.INTERRUPTION_MODE_IOS_DUCK_OTHERS,
          playsInSilentModeIOS: true,
          shouldDuckAndroid: true,
          interruptionModeAndroid: Audio.INTERRUPTION_MODE_ANDROID_DUCK_OTHERS,
          playThroughEarpieceAndroid: false,
        });
      } catch (error) {
        console.error('Failed to set audio mode:', error);
      }
    };
    
    setupAudio();
    
    // Set cleanup function
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Only proceed with loading audio if we confirmed we have a song
  useEffect(() => {
    if (hasCheckedSong && currentSong) {
      loadAudio();
    }

    // Cleanup when component unmounts
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [hasCheckedSong, currentSong]);

  useEffect(() => {
    // Update position every second when playing
    let interval;
    if (isPlaying) {
      interval = setInterval(async () => {
        if (sound && isMounted.current) {
          try {
            const status = await sound.getStatusAsync();
            if (status.isLoaded) {
              setPosition(status.positionMillis);
              if (status.didJustFinish) {
                setIsPlaying(false);
                setPosition(0);
                await sound.setPositionAsync(0);
              }
            }
          } catch (error) {
            console.error('Error getting sound status:', error);
          }
        }
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isPlaying, sound]);

  const loadAudio = async () => {
    if (sound) {
      await sound.unloadAsync();
    }

    setIsLoading(true);
    try {
      // Check if song.sound is already available from context
      if (currentSong.sound) {
        setSound(currentSong.sound);
        const status = await currentSong.sound.getStatusAsync();
        if (status.isLoaded && isMounted.current) {
          setDuration(status.durationMillis || 0);
          setPosition(status.positionMillis || 0);
          
          // Start playing and update state
          await currentSong.sound.playAsync();
          setIsPlaying(true);
        }
      } else {
        // Otherwise create a new sound object
        const { sound: newSound } = await Audio.Sound.createAsync(
          currentSong.isAssetMusic ? currentSong.uri : { uri: currentSong.uri },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        
        if (isMounted.current) {
          setSound(newSound);
          
          // Update the currentSong in context with the sound object
          if (setCurrentSong) {
            setCurrentSong({ ...currentSong, sound: newSound });
          }
          setIsPlaying(true);
        } else {
          // Clean up if component unmounted during async operation
          newSound.unloadAsync();
        }
      }
    } catch (error) {
      console.error('Error loading audio:', error);
      if (isMounted.current) {
        Alert.alert('Error', 'Could not play this song');
      }
    } finally {
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  };

  const onPlaybackStatusUpdate = (status) => {
    if (!isMounted.current) return;
    
    if (status.isLoaded) {
      setDuration(status.durationMillis || 0);
      setPosition(status.positionMillis || 0);
      setIsPlaying(status.isPlaying);
    } else if (status.error) {
      console.error('Playback status error:', status.error);
    }
  };

  const togglePlayback = async () => {
    if (!sound) return;
    
    try {
      if (isPlaying) {
        console.log('Pausing audio...');
        await sound.pauseAsync();
        if (isMounted.current) {
          setIsPlaying(false);
        }
      } else {
        console.log('Playing audio...');
        await sound.playAsync();
        if (isMounted.current) {
          setIsPlaying(true);
        }
      }
    } catch (error) {
      console.error('Error toggling playback:', error);
      if (isMounted.current) {
        Alert.alert('Playback Error', 'Failed to toggle playback state');
      }
    }
  };

  const skipForward = async () => {
    if (!sound) return;
    
    try {
      // Skip forward 10 seconds
      const newPosition = Math.min(position + 10000, duration);
      await sound.setPositionAsync(newPosition);
      if (isMounted.current) {
        setPosition(newPosition);
      }
    } catch (error) {
      console.error('Error skipping forward:', error);
      if (isMounted.current) {
        Alert.alert('Feature', 'Skip to next song feature coming soon!');
      }
    }
  };

  const skipBackward = async () => {
    if (!sound) return;
    
    try {
      // Skip backward 10 seconds
      const newPosition = Math.max(position - 10000, 0);
      await sound.setPositionAsync(newPosition);
      if (isMounted.current) {
        setPosition(newPosition);
      }
    } catch (error) {
      console.error('Error skipping backward:', error);
      if (isMounted.current) {
        Alert.alert('Feature', 'Skip to previous song feature coming soon!');
      }
    }
  };

  const handleSliderChange = async (value) => {
    if (!sound) return;
    
    try {
      await sound.setPositionAsync(value);
      if (isMounted.current) {
        setPosition(value);
      }
    } catch (error) {
      console.error('Error setting position:', error);
    }
  };

  const formatTime = (milliseconds) => {
    if (!milliseconds) return '00:00';
    
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const isPlayingOrPaused = sound !== null && !isLoading;

  // If we don't have a song and haven't checked yet, render a loading screen
  if (!hasCheckedSong) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8A2BE2" />
        <Text style={styles.loadingText}>Loading...</Text>
      </SafeAreaView>
    );
  }

  // If we don't have a song but have checked, the alert will handle navigation
  if (!currentSong) {
    return null;
  }

  return (
    <View style={styles.nowPlayingContainer}>
      <LinearGradient
        colors={['#8A2BE2', '#4B0082']}
        style={styles.nowPlayingHeader}
      >
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="chevron-down" size={28} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.nowPlayingHeaderTitle}>Now Playing</Text>
        <TouchableOpacity>
          <Ionicons name="ellipsis-vertical" size={24} color="#FFF" />
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.albumArtContainer}>
        {currentSong?.cover ? (
          <Image 
            source={currentSong.cover} 
            style={styles.albumArt}
            defaultSource={require('../../assets/images/burnaboy.jpeg')} 
          />
        ) : (
          <Image 
            source={require('../../assets/images/burnaboy.jpeg')} 
            style={styles.albumArt} 
          />
        )}
      </View>

      <View style={styles.songInfoContainer}>
        <Text style={styles.nowPlayingSongTitle}>{currentSong?.title || 'Unknown Song'}</Text>
        <Text style={styles.nowPlayingSongArtist}>{currentSong?.artist || 'Unknown Artist'}</Text>
      </View>

      <View style={styles.progressContainer}>
        <Slider
          style={styles.progressBar}
          minimumValue={0}
          maximumValue={duration > 0 ? duration : 1}
          value={position}
          onSlidingComplete={handleSliderChange}
          minimumTrackTintColor="#8A2BE2"
          maximumTrackTintColor="#D1C4E9"
          thumbTintColor="#8A2BE2"
          disabled={!isPlayingOrPaused}
        />
        <View style={styles.timeContainer}>
          <Text style={styles.timeText}>{formatTime(position)}</Text>
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>
      </View>

      <View style={styles.controlsContainer}>
        <TouchableOpacity 
          style={styles.controlButton} 
          onPress={skipBackward}
          disabled={!isPlayingOrPaused}
        >
          <Ionicons 
            name="play-skip-back" 
            size={36} 
            color={isPlayingOrPaused ? "#333" : "#AAA"} 
          />
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[
            styles.playPauseButton,
            !isPlayingOrPaused && { backgroundColor: '#A78BC9' }
          ]} 
          onPress={togglePlayback}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator size="large" color="#FFF" />
          ) : (
            <Ionicons name={isPlaying ? "pause" : "play"} size={48} color="#FFF" />
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={styles.controlButton} 
          onPress={skipForward}
          disabled={!isPlayingOrPaused}
        >
          <Ionicons 
            name="play-skip-forward" 
            size={36} 
            color={isPlayingOrPaused ? "#333" : "#AAA"} 
          />
        </TouchableOpacity>
      </View>

      <View style={styles.additionalControlsContainer}>
        <TouchableOpacity style={styles.additionalControlButton}>
          <Ionicons name="repeat" size={24} color="#666" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.additionalControlButton}>
          <Ionicons name="shuffle" size={24} color="#666" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.additionalControlButton}>
          <Ionicons name="heart-outline" size={24} color="#666" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.additionalControlButton}>
          <Ionicons name="list" size={24} color="#666" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

// StyleSheet needs to be included for the component to work
const styles = StyleSheet.create({
  nowPlayingContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  nowPlayingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 16,
  },
  nowPlayingHeaderTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  albumArtContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    marginBottom: 24,
    height: 300,
  },
  albumArt: {
    width: 300,
    height: 300,
    borderRadius: 10,
  },
  songInfoContainer: {
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 20,
  },
  nowPlayingSongTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  nowPlayingSongArtist: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
  progressContainer: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  progressBar: {
    width: '100%',
    height: 40,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -8,
  },
  timeText: {
    color: '#666',
    fontSize: 12,
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  controlButton: {
    padding: 16,
  },
  playPauseButton: {
    backgroundColor: '#8A2BE2',
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 32,
  },
  additionalControlsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    paddingHorizontal: 32,
  },
  additionalControlButton: {
    padding: 16,
  },
});