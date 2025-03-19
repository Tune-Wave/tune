import { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useSegments } from 'expo-router';
import { API_URL } from '../api-config/api';

interface User {
  id: string;
  email: string;
  name: string;
  // Add any other user properties
}

interface AuthContextType {
  signIn: (token: string, user: User) => Promise<void>;
  signOut: () => Promise<void>;
  validateToken: (token: string) => Promise<boolean>;
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Custom hook to use auth context
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Hook to handle protected routes
export function useProtectedRoute(isAuthenticated: boolean, isLoading: boolean) {
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inTabsGroup = segments[0] === '(tabs)';

    if (!isAuthenticated && !inAuthGroup) {
      // Redirect to welcome screen if not authenticated
      console.log('Redirecting to welcome (not authenticated)');
      router.replace('/(auth)/welcome');
    } else if (isAuthenticated && inAuthGroup) {
      // Redirect to main app if authenticated
      console.log('Redirecting to home (authenticated)');
      // Use router.navigate instead of replace for more predictable navigation
      router.navigate('/(tabs)/home');
    }
  }, [isAuthenticated, segments, isLoading, router]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  // Check for stored authentication token on mount and validate it
  useEffect(() => {
    async function loadAuthState() {
      try {
        const token = await AsyncStorage.getItem('userToken');
        if (token) {
          const isValid = await validateToken(token);
          if (isValid) {
            const userDataStr = await AsyncStorage.getItem('userData');
            if (userDataStr) {
              const userData = JSON.parse(userDataStr);
              setUser(userData);
              setIsAuthenticated(true);
            }
          } else {
            // Token is invalid, clear storage
            await AsyncStorage.multiRemove(['userToken', 'userData']);
          }
        }
      } catch (error) {
        console.error('Failed to load auth state', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadAuthState();
  }, []);

  const validateToken = async (token: string): Promise<boolean> => {
    try {
      const response = await fetch(`${API_URL}/users/validate`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      return response.ok;
    } catch (error) {
      console.error('Token validation failed', error);
      return false;
    }
  };

  const authContext: AuthContextType = {
    signIn: async (token: string, userData: User) => {
      try {
        await AsyncStorage.setItem('userToken', token);
        await AsyncStorage.setItem('userData', JSON.stringify(userData));
        setUser(userData);
        setIsAuthenticated(true);
        
        // Add a small delay before navigation to ensure state updates
        setTimeout(() => {
          router.navigate('/(tabs)/home');
        }, 100);
      } catch (error) {
        console.error('Error during sign in:', error);
      }
    },
    signOut: async () => {
      try {
        await AsyncStorage.multiRemove(['userToken', 'userData']);
        setUser(null);
        setIsAuthenticated(false);
        router.replace('/(auth)/welcome');
      } catch (error) {
        console.error('Error during sign out:', error);
      }
    },
    validateToken,
    isAuthenticated,
    isLoading,
    user
  };

  return (
    <AuthContext.Provider value={authContext}>
      {children}
    </AuthContext.Provider>
  );
}

// Export AuthProvider as the default export
export default AuthProvider;