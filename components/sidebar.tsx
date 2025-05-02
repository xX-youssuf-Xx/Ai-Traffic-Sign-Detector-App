import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define the navigation parameter list
type RootStackParamList = {
  Login: undefined;
  Camera: undefined;
  Feedback: undefined;
  Emergency: undefined;
};

interface SidebarProps {
  onNavigate: (screen: keyof RootStackParamList) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onNavigate }) => {
  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Logout',
          onPress: async () => {
            try {
              await AsyncStorage.clear();
              // Navigate to login screen
              onNavigate('Login');
            } catch (error) {
              console.error('Error during logout:', error);
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerText}>AI Traffic App</Text>
      </View>
      <ScrollView style={styles.menuItems}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => onNavigate('Camera')}
        >
          <Text style={styles.menuItemText}>Camera</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => onNavigate('Feedback')}
        >
          <Text style={styles.menuItemText}>Feedback</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={() => onNavigate('Emergency')}
        >
          <Text style={styles.menuItemText}>Emergency</Text>
        </TouchableOpacity>
      </ScrollView>
      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
        <Text style={styles.logoutText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e1e',
  },
  header: {
    padding: 16,
    backgroundColor: '#2d2d2d',
    borderBottomWidth: 1,
    borderBottomColor: '#3d3d3d',
  },
  headerText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  menuItems: {
    flex: 1,
    padding: 16,
  },
  menuItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#3d3d3d',
  },
  menuItemText: {
    color: '#fff',
    fontSize: 16,
  },
  logoutButton: {
    margin: 16,
    padding: 12,
    backgroundColor: '#F44336',
    borderRadius: 8,
    alignItems: 'center',
  },
  logoutText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});

export default Sidebar;
