import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';
import { useColorScheme } from '@/hooks/useColorScheme';
import { AuthProvider, useAuth, useProtectedRoute } from './context/auth';
import { MusicProvider } from './context/musicContext';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

// Export the auth hook for use throughout the app
export { useAuth } from './context/auth';

function RootLayoutNav() {
  const { isAuthenticated, isLoading } = useAuth();
  
  // Use the protected route hook to handle navigation based on auth state
  useProtectedRoute(isAuthenticated, isLoading);

  if (isLoading) {
    return null; // Or a loading spinner component
  }

  return (
    <Stack screenOptions={{ 
      headerShown: false,
      animation: 'slide_from_right',
    }}>
      {/* Auth Group */}
      <Stack.Screen 
        name="(auth)/welcome"
        options={{ 
          animation: 'fade',
        }}
      />
      <Stack.Screen 
        name="(auth)/login"
        options={{
          presentation: 'card',
        }}
      />
      <Stack.Screen 
        name="(auth)/signup"
        options={{
          presentation: 'card',
        }}
      />

      {/* App Group */}
      <Stack.Screen 
        name="(tabs)" 
        options={{ 
          headerShown: false,
        }} 
      />
      <Stack.Screen name="+not-found" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AuthProvider>
        <MusicProvider>
          <RootLayoutNav />
        </MusicProvider>
      </AuthProvider>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}