import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  Platform,
  Linking,
  ActivityIndicator,
  KeyboardAvoidingView,
  PermissionsAndroid,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Geolocation, { GeoPosition, GeoError } from 'react-native-geolocation-service';
import Navbar from '../components/navbar';

const EmergencyScreen: React.FC = () => {
  const [phoneNumber, setPhoneNumber] = useState<string>('');
  const [isSaved, setIsSaved] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState<boolean>(false);
  
  // Load saved phone number from storage
  useEffect(() => {
    const loadPhoneNumber = async () => {
      try {
        const savedNumber = await AsyncStorage.getItem('emergency_contact');
        if (savedNumber) {
          setPhoneNumber(savedNumber);
          setIsSaved(true);
        }
      } catch (error) {
        console.error('Error loading phone number:', error);
      }
    };
    
    loadPhoneNumber();
  }, []);

  const savePhoneNumber = async () => {
    // Basic validation
    if (!phoneNumber.trim()) {
      Alert.alert('Error', 'Please enter a phone number');
      return;
    }

    // Remove any non-numeric characters
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    
    if (cleanNumber.length < 10) {
      Alert.alert('Error', 'Please enter a valid phone number');
      return;
    }

    setIsLoading(true);

    try {
      await AsyncStorage.setItem('emergency_contact', cleanNumber);
      setIsSaved(true);
      Alert.alert('Success', 'Emergency contact saved successfully');
    } catch (error) {
      console.error('Error saving phone number:', error);
      Alert.alert('Error', 'Failed to save contact. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const requestLocationPermission = async () => {
    console.log('[EmergencyScreen] Requesting location permission...');
    if (Platform.OS === 'ios') {
      console.log('[EmergencyScreen] iOS platform, permission assumed or handled by system.');
      return true;
    }
    
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: "Location Permission",
          message: "This app needs access to your location to send emergency alerts.",
          buttonNeutral: "Ask Me Later",
          buttonNegative: "Cancel",
          buttonPositive: "OK"
        }
      );
      const result = granted === PermissionsAndroid.RESULTS.GRANTED;
      console.log(`[EmergencyScreen] Location permission granted: ${result}`);
      return result;
    } catch (err) {
      console.error('[EmergencyScreen] Error requesting location permission:', err);
      return false;
    }
  };

  const getCurrentLocation = async () => {
    console.log('[EmergencyScreen] Attempting to get current location...');
    const hasPermission = await requestLocationPermission();
    
    if (!hasPermission) {
      Alert.alert('Error', 'Location permission not granted');
      console.log('[EmergencyScreen] Location permission denied.');
      return;
    }
    
    console.log('[EmergencyScreen] Permission granted. Getting location...');
    setIsGettingLocation(true);
    
    try {
      Geolocation.getCurrentPosition(
        (position: GeoPosition) => {
          console.log('[EmergencyScreen] Location successfully retrieved:', position);
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setIsGettingLocation(false);
        },
        (error: GeoError) => {
          console.error('[EmergencyScreen] Geolocation.getCurrentPosition Error:', error.code, error.message);
          Alert.alert('Error', `Unable to get location. Code: ${error.code}, Message: ${error.message}`);
          setIsGettingLocation(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
      );
    } catch (error) {
      console.error('[EmergencyScreen] Unexpected error calling Geolocation.getCurrentPosition:', error);
      Alert.alert('Error', 'An unexpected error occurred while getting location.');
      setIsGettingLocation(false);
    }
  };

  const sendWhatsAppMessage = async () => {
    if (!isSaved) {
      Alert.alert('Error', 'Please save a phone number first');
      return;
    }
  
    if (!location) {
      Alert.alert('Error', 'Please get your current location first');
      return;
    }
  
    // Prepare the message with Google Maps link
    const mapsLink = `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
    const message = `Come check on me. My location: ${mapsLink}`;
    
    try {
      // Format the number - strip all non-numeric characters
      const cleanNumber = phoneNumber.replace(/\D/g, '');
      
      // Make sure we have a valid phone number
      if (cleanNumber.length < 7) {
        Alert.alert('Error', 'Please enter a valid phone number');
        return;
      }
      
      console.log('[EmergencyScreen] Using phone number:', cleanNumber);
      
      // Create the WhatsApp web API URL format
      const whatsappUrl = `https://api.whatsapp.com/send?phone=${cleanNumber}&text=${encodeURIComponent(message)}`;
      
      console.log('[EmergencyScreen] Opening WhatsApp with URL:', whatsappUrl);
      await Linking.openURL(whatsappUrl);
    } catch (error) {
      console.error('[EmergencyScreen] Error opening WhatsApp:', error);
      Alert.alert(
        'Error',
        'An unexpected error occurred. Please check your phone number format and try again.',
        [{ text: 'OK', style: 'cancel' }]
      );
    }
  };

  const sendSMSMessage = async () => {
    if (!isSaved) {
      Alert.alert('Error', 'Please save a phone number first');
      return;
    }
  
    if (!location) {
      Alert.alert('Error', 'Please get your current location first');
      return;
    }
  
    // Prepare the message with Google Maps link
    const mapsLink = `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
    const message = `Come check on me. My location: ${mapsLink}`;
    
    try {
      // Format the number - strip all non-numeric characters
      const cleanNumber = phoneNumber.replace(/\D/g, '');
      
      // Make sure we have a valid phone number
      if (cleanNumber.length < 7) {
        Alert.alert('Error', 'Please enter a valid phone number');
        return;
      }
      
      console.log('[EmergencyScreen] Using phone number:', cleanNumber);
      
      // Create the SMS URL format
      const smsUrl = `sms:${cleanNumber}?body=${encodeURIComponent(message)}`;
      
      console.log('[EmergencyScreen] Opening SMS with URL:', smsUrl);
      await Linking.openURL(smsUrl);
    } catch (error) {
      console.error('[EmergencyScreen] Error opening SMS:', error);
      Alert.alert(
        'Error',
        'An unexpected error occurred. Please check your phone number format and try again.',
        [{ text: 'OK', style: 'cancel' }]
      );
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Navbar title="Emergency" />
      
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.contentContainer}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Emergency Contact</Text>
          <Text style={styles.description}>
            Add a contact who will receive your emergency message with your location via WhatsApp or SMS.
          </Text>
          
          <View style={styles.inputContainer}>
            <Text style={styles.label}>Phone Number (with country code)</Text>
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="e.g. +1234567890"
              placeholderTextColor="#666"
              keyboardType="phone-pad"
            />
          </View>
          
          <TouchableOpacity
            style={styles.saveButton}
            onPress={savePhoneNumber}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Save Contact</Text>
            )}
          </TouchableOpacity>
          
          {isSaved && (
            <View style={styles.savedContactContainer}>
              <Text style={styles.savedContactLabel}>Saved Contact:</Text>
              <Text style={styles.savedContactNumber}>{phoneNumber}</Text>
            </View>
          )}
        </View>
        
        <View style={styles.card}>
          <Text style={styles.title}>Send Emergency Alert</Text>
          
          <TouchableOpacity
            style={styles.locationButton}
            onPress={getCurrentLocation}
            disabled={isGettingLocation}
          >
            {isGettingLocation ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Get Current Location</Text>
            )}
          </TouchableOpacity>
          
          {location && (
            <View style={styles.locationContainer}>
              <Text style={styles.locationLabel}>Your Location:</Text>
              <Text style={styles.locationCoords}>
                Latitude: {location.latitude.toFixed(6)}
              </Text>
              <Text style={styles.locationCoords}>
                Longitude: {location.longitude.toFixed(6)}
              </Text>
            </View>
          )}
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.whatsappButton,
                (!isSaved || !location) && styles.disabledButton,
              ]}
              onPress={sendWhatsAppMessage}
              disabled={!isSaved || !location}
            >
              <Text style={styles.buttonText}>Send via WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.smsButton,
                (!isSaved || !location) && styles.disabledButton,
              ]}
              onPress={sendSMSMessage}
              disabled={!isSaved || !location}
            >
              <Text style={styles.buttonText}>Send via SMS</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e1e',
  },
  contentContainer: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: '#2d2d2d',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#3d3d3d',
    color: '#fff',
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  saveButton: {
    backgroundColor: '#4CAF50',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  locationButton: {
    backgroundColor: '#2196F3',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonContainer: {
    gap: 12,
  },
  whatsappButton: {
    backgroundColor: '#25D366',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  smsButton: {
    backgroundColor: '#2196F3',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#555',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  savedContactContainer: {
    backgroundColor: '#3d3d3d',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  savedContactLabel: {
    fontSize: 12,
    color: '#aaa',
    marginBottom: 4,
  },
  savedContactNumber: {
    fontSize: 16,
    color: '#fff',
    fontWeight: 'bold',
  },
  locationContainer: {
    backgroundColor: '#3d3d3d',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  locationLabel: {
    fontSize: 12,
    color: '#aaa',
    marginBottom: 4,
  },
  locationCoords: {
    fontSize: 14,
    color: '#fff',
  },
});

export default EmergencyScreen;
