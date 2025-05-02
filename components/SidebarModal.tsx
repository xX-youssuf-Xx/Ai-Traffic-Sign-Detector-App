import React from 'react';
import {
  StyleSheet,
  View,
  Modal,
  TouchableOpacity,
  Dimensions,
  Text,
  ScrollView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';

// Define the navigation parameter list
type RootStackParamList = {
  Login: undefined;
  Camera: undefined;
  Feedback: undefined;
  Emergency: undefined;
  Instructions: undefined;
};

// Create a navigation prop type
type NavigationProp = StackNavigationProp<RootStackParamList>;

interface SidebarModalProps {
  visible: boolean;
  onClose: () => void;
}

const SidebarModal: React.FC<SidebarModalProps> = ({ visible, onClose }) => {
  const navigation = useNavigation<NavigationProp>();

  const handleNavigation = (screenName: keyof RootStackParamList) => {
    // Close the modal
    onClose();
    
    // If navigating to Login, reset the navigation stack
    if (screenName === 'Login') {
      navigation.reset({
        index: 0,
        routes: [{ name: screenName }],
      });
    } else {
      // Otherwise, just navigate to the screen
      navigation.navigate(screenName);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.dismissArea}
          onPress={onClose}
          activeOpacity={1}
        />
        <View style={styles.drawerContainer}>
          <View style={styles.header}>
            <Text style={styles.headerText}>AI Traffic App</Text>
          </View>
          <ScrollView style={styles.menuItems}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleNavigation('Camera')}
            >
              <Text style={styles.menuItemText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleNavigation('Instructions')}
            >
              <Text style={styles.menuItemText}>Instructions</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleNavigation('Feedback')}
            >
              <Text style={styles.menuItemText}>Feedback</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={() => handleNavigation('Emergency')}
            >
              <Text style={styles.menuItemText}>Emergency</Text>
            </TouchableOpacity>
          </ScrollView>
          <TouchableOpacity 
            style={styles.logoutButton} 
            onPress={() => handleNavigation('Login')}
          >
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  dismissArea: {
    flex: 1,
  },
  drawerContainer: {
    width: width * 0.75,
    maxWidth: 300,
    backgroundColor: '#1e1e1e',
    flex: 1,
    shadowColor: '#000',
    shadowOffset: {
      width: -2,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
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

export default SidebarModal; 