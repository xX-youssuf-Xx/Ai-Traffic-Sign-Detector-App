import React, { useState, useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import LoginScreen from './screens/loginScreen';
import CameraScreen from './screens/cameraScreen';
import FeedbackScreen from './screens/feedbackScreen';
import EmergencyScreen from './screens/emergencyScreen';
import InstructionsScreen from './screens/instructionsScreen';

// Define types for the stack navigator
type RootStackParamList = {
  Login: undefined;
  Camera: undefined;
  Feedback: undefined;
  Emergency: undefined;
  Instructions: undefined;
};

// Create stack navigator
const Stack = createStackNavigator<RootStackParamList>();

// Root navigator with authentication flow
const App: React.FC = () => {
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);

  // Check if user is logged in
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const userData = await AsyncStorage.getItem('user_data');
        setIsAuthenticated(!!userData);
      } catch (error) {
        console.error('Error checking auth status:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator 
            screenOptions={{ 
              headerShown: false
            }}
            initialRouteName={isAuthenticated ? "Camera" : "Login"}
          >
            {/* Use a single navigator structure instead of conditional screens */}
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Camera" component={CameraScreen} />
            <Stack.Screen name="Feedback" component={FeedbackScreen} />
            <Stack.Screen name="Emergency" component={EmergencyScreen} />
            <Stack.Screen name="Instructions" component={InstructionsScreen} />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
  },
});

export default App;