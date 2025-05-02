import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  SafeAreaView,
  ScrollView,
  Platform,
} from 'react-native';
import Navbar from '../components/navbar';

const InstructionsScreen: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <Navbar title="Instructions" />

      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>How to Use the App</Text>
          <Text style={styles.subtitle}>
            Learn how to make the most of our AI Traffic Detection App
          </Text>
        </View>

        <View style={styles.sectionContainer}>
          {/* Camera Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📸 Camera Features</Text>
            <View style={styles.pointContainer}>
              <Text style={styles.pointText}>
                • Point your camera at traffic situations to get real-time AI analysis
              </Text>
              <Text style={styles.pointText}>
                • Hold steady for best results and ensure good lighting conditions
              </Text>
              <Text style={styles.pointText}>
                • View instant traffic alerts and warnings on your screen
              </Text>
            </View>
          </View>

          {/* Emergency Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🚨 Emergency Services</Text>
            <View style={styles.pointContainer}>
              <Text style={styles.pointText}>
                • Quickly report traffic incidents with one-tap emergency button
              </Text>
              <Text style={styles.pointText}>
                • Share your location and incident details with emergency services
              </Text>
              <Text style={styles.pointText}>
                • Receive real-time updates about emergency response status
              </Text>
            </View>
          </View>

          {/* Feedback Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>💬 Feedback System</Text>
            <View style={styles.pointContainer}>
              <Text style={styles.pointText}>
                • Share your experience and suggestions through the feedback form
              </Text>
              <Text style={styles.pointText}>
                • Help us improve the app by reporting any issues you encounter
              </Text>
              <Text style={styles.pointText}>
                • Get updates about new features and improvements
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e1e',
  },
  scrollContainer: {
    flexGrow: 1,
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#aaa',
  },
  sectionContainer: {
    gap: 20,
  },
  section: {
    backgroundColor: '#2d2d2d',
    borderRadius: 10,
    padding: 16,
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  pointContainer: {
    gap: 8,
  },
  pointText: {
    fontSize: 16,
    color: '#fff',
    lineHeight: 24,
  },
});

export default InstructionsScreen; 