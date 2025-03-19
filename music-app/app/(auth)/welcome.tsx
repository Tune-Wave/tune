import React, { useState, useRef } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View, Text, Pressable, Image, Dimensions, Animated, FlatList } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

// Slide data with images and text
const slides = [
  {
    id: '1',
    image: require('@/assets/images/banner1.jpeg'),
    title: 'Discover New Music',
    description: 'Find the latest tracks and artists tailored to your taste'
  },
  {
    id: '2',
    image: require('@/assets/images/banner3.jpeg'),
    title: 'Create Playlists',
    description: 'Curate your perfect collections for any mood or occasion'
  },
  {
    id: '3',
    image: require('@/assets/images/banner2.jpeg'),
    title: 'Live Concerts',
    description: 'Get notified about upcoming shows from your favorite artists'
  },
  {
    id: '4',
    image: require('@/assets/images/banner4.jpeg'),
    title: 'Offline Listening',
    description: 'Download your music and enjoy it anywhere, anytime'
  }
];

const WelcomeScreen = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const slidesRef = useRef(null);

  // Handle when slides change
  const viewableItemsChanged = useRef(({ viewableItems }) => {
    if (viewableItems[0]) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  // Function to render each slide
  const renderSlide = ({ item }) => {
    return (
      <View style={styles.slideContainer}>
        <Image 
          source={item.image} 
          style={styles.slideImage}
          resizeMode="contain"
        />
        <Text style={styles.slideTitle}>{item.title}</Text>
        <Text style={styles.slideDescription}>{item.description}</Text>
      </View>
    );
  };

  // Function to scroll to the next slide when "Next" is pressed
  const scrollToNext = () => {
    if (currentIndex < slides.length - 1) {
      slidesRef.current.scrollToIndex({ index: currentIndex + 1 });
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#0F0817', '#1A1034', '#2D1155']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Decorative music notes */}
      <View style={styles.musicNote1} />
      <View style={styles.musicNote2} />
      <View style={styles.musicNote3} />

      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Image
            source={require('@/assets/images/adaptive-icon.png')}
            style={styles.logo}
            resizeMode="contain"
          />
          <Text style={styles.appName}>TuneWave</Text>
        </View>

        <Animated.FlatList
          data={slides}
          renderItem={renderSlide}
          horizontal
          showsHorizontalScrollIndicator={false}
          pagingEnabled
          bounces={false}
          keyExtractor={(item) => item.id}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: false }
          )}
          onViewableItemsChanged={viewableItemsChanged}
          viewabilityConfig={viewConfig}
          ref={slidesRef}
          style={styles.slideList}
        />

        {/* Pagination dots */}
        <View style={styles.paginationContainer}>
          {slides.map((_, index) => {
            const inputRange = [
              (index - 1) * width,
              index * width,
              (index + 1) * width
            ];
            
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [10, 20, 10],
              extrapolate: 'clamp'
            });
            
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp'
            });
            
            return (
              <Animated.View
                key={index.toString()}
                style={[
                  styles.dot,
                  { width: dotWidth, opacity }
                ]}
              />
            );
          })}
        </View>

        <View style={styles.buttonsContainer}>
          {currentIndex < slides.length - 1 ? (
            <>
              <Pressable
                style={({ pressed }) => [
                  styles.nextButton,
                  pressed && styles.buttonPressed
                ]}
                onPress={scrollToNext}
              >
                <LinearGradient
                  colors={['#8A2BE2', '#4B0082']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.buttonText}>Next</Text>
                </LinearGradient>
              </Pressable>

              <Link href="/login" asChild>
                <Pressable style={styles.skipButton}>
                  <Text style={styles.skipText}>Skip</Text>
                </Pressable>
              </Link>
            </>
          ) : (
            <>
              <Link href="/(auth)/signup" asChild>
                <Pressable
                  style={({ pressed }) => [
                    styles.getStartedButton,
                    pressed && styles.buttonPressed
                  ]}
                >
                  <LinearGradient
                    colors={['#8A2BE2', '#4B0082']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.buttonGradient}
                  >
                    <Text style={styles.buttonText}>Get Started</Text>
                  </LinearGradient>
                </Pressable>
              </Link>

              <Link href="/(auth)/login" asChild>
                <Pressable style={styles.loginLink}>
                  <Text style={styles.loginText}>
                    Already have an account? <Text style={styles.loginBold}>Log In</Text>
                  </Text>
                </Pressable>
              </Link>
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 20,
    paddingBottom: 10,
  },
  logo: {
    width: 40,
    height: 40,
    marginRight: 10,
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 1,
  },
  slideList: {
    flex: 1,
  },
  slideContainer: {
    width,
    alignItems: 'center',
    padding: 20,
  },
  slideImage: {
    width: width * 0.8,
    height: width * 0.8,
    marginBottom: 20,
  },
  slideTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: 10,
    textAlign: 'center',
  },
  slideDescription: {
    fontSize: 16,
    color: '#d1c4e9',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  dot: {
    height: 10,
    borderRadius: 5,
    backgroundColor: '#ffffff',
    marginHorizontal: 5,
  },
  buttonsContainer: {
    alignItems: 'center',
    paddingBottom: 40,
    paddingHorizontal: 24,
  },
  nextButton: {
    width: '90%',
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#8A2BE2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  getStartedButton: {
    width: '90%',
    borderRadius: 28,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#8A2BE2',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    borderRadius: 28,
  },
  buttonPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  skipButton: {
    padding: 10,
  },
  skipText: {
    color: '#b39ddb',
    fontSize: 16,
    fontWeight: '500',
  },
  loginLink: {
    marginTop: 10,
    padding: 8,
  },
  loginText: {
    fontSize: 16,
    color: '#d1c4e9',
  },
  loginBold: {
    fontWeight: '600',
    color: '#ffffff',
  },
  musicNote1: {
    position: 'absolute',
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(186, 104, 200, 0.2)',
    top: 80,
    left: 20,
  },
  musicNote2: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(156, 39, 176, 0.15)',
    top: 150,
    right: 30,
  },
  musicNote3: {
    position: 'absolute',
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(124, 77, 255, 0.1)',
    bottom: 100,
    left: -20,
  },
});

export default WelcomeScreen;