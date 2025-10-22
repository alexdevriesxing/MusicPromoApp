import React, {useEffect, useState} from 'react';
import {StatusBar, useColorScheme} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {ThemeProvider} from './src/theme/ThemeContext';
import {AuthProvider, useAuth} from './src/context/AuthContext';
import {NotificationProvider} from './src/context/NotificationContext';
import {NetworkProvider} from './src/context/NetworkContext';
import {SplashScreen} from './src/screens/SplashScreen';
import {AuthNavigator} from './src/navigation/AuthNavigator';
import {MainNavigator} from './src/navigation/MainNavigator';
import {navigationRef} from './src/navigation/navigationUtils';
import {LoadingIndicator} from './src/components/common/LoadingIndicator';
import {ErrorBoundary} from './src/components/common/ErrorBoundary';
import {initializeApp} from './src/utils/init';

const Stack = createNativeStackNavigator();

const AppContent = () => {
  const {isLoading, isAuthenticated} = useAuth();
  const [isAppReady, setIsAppReady] = useState(false);
  const isDarkMode = useColorScheme() === 'dark';

  useEffect(() => {
    const init = async () => {
      try {
        await initializeApp();
      } catch (error) {
        console.error('Initialization error:', error);
      } finally {
        setIsAppReady(true);
      }
    };

    init();
  }, []);

  if (!isAppReady || isLoading) {
    return <SplashScreen />;
  }

  return (
    <GestureHandlerRootView style={{flex: 1}}>
      <StatusBar
        barStyle={isDarkMode ? 'light-content' : 'dark-content'}
        backgroundColor="transparent"
        translucent
      />
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator screenOptions={{headerShown: false}}>
          {isAuthenticated ? (
            <Stack.Screen name="Main" component={MainNavigator} />
          ) : (
            <Stack.Screen name="Auth" component={AuthNavigator} />
          )}
        </Stack.Navigator>
      </NavigationContainer>
      <LoadingIndicator />
    </GestureHandlerRootView>
  );
};

const App = () => {
  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <AuthProvider>
            <NotificationProvider>
              <NetworkProvider>
                <AppContent />
              </NetworkProvider>
            </NotificationProvider>
          </AuthProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
};

export default App;
