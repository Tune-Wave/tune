import React, { createContext, useContext, useState, useEffect } from 'react';
import { Audio } from 'expo-av';
import { Alert } from 'react-native';

// Create the context
const MusicContext = createContext(null);

// Provider component
export function MusicProvider({ children }) {
  const [currentSong, setCurrentSong] = useState(null);
  const [sound, setSound] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);

  // Load audio when currentSong changes
  useEffect(() => {
    const loadAudio = async () => {
      // Unload previous sound if exists
      if (sound) {
        await sound.unloadAsync();
        setSound(null);
      }

      // If no song is selected or no preview URL, return
      if (!currentSong || !currentSong.previewUrl) {
        return;
      }

      try {
        console.log('Loading audio:', currentSong.previewUrl);
        const { sound: newSound } = await Audio.Sound.createAsync(
          { uri: currentSong.previewUrl },
          { shouldPlay: true },
          onPlaybackStatusUpdate
        );
        
        setSound(newSound);
        setIsPlaying(true);
      } catch (error) {
        console.error('Error loading audio:', error);
        Alert.alert(
          "Playback Error",
          "There was a problem playing this track. Please try another song."
        );
      }
    };

    loadAudio();

    // Cleanup function to unload audio when component unmounts
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [currentSong]);

  // Handle playback status updates
  const onPlaybackStatusUpdate = (status) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis);
      setDuration(status.durationMillis);
      setIsPlaying(status.isPlaying);
      
      // Handle playback completion
      if (status.didJustFinish) {
        setIsPlaying(false);
      }
    }
  };

  // Play/pause toggle
  const togglePlayback = async () => {
    if (!sound) return;
    
    if (isPlaying) {
      await sound.pauseAsync();
    } else {
      await sound.playAsync();
    }
  };

  // Seek to position
  const seekTo = async (millis) => {
    if (!sound) return;
    await sound.setPositionAsync(millis);
  };

  return (
    <MusicContext.Provider 
      value={{ 
        currentSong, 
        setCurrentSong,
        isPlaying,
        togglePlayback,
        position,
        duration,
        seekTo
      }}
    >
      {children}
    </MusicContext.Provider>
  );
}

// Custom hook for accessing the music context
export function useMusic() {
  const context = useContext(MusicContext);
  if (context === null) {
    throw new Error('useMusic must be used within a MusicProvider');
  }
  return context;
}