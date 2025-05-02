import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Platform,
  Alert,
  Dimensions,
  NativeModules,
} from 'react-native';
import { Camera, useCameraDevices, useCameraFormat } from 'react-native-vision-camera';
import Modal from 'react-native-modal';
import Navbar from '../components/navbar';
import SoundPlayer from 'react-native-sound-player';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Define types for our detection objects
interface Detection {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  class: string;
  confidence: number;
  distance_cm?: number;
}

interface ServerResponse {
  detections: Detection[];
  error?: string;
}

// Map traffic light colors to sound file names (for Android these should be in res/raw folder)
const SOUND_FILES = {
  red: 'stop',
  yellow: 'wait',
  green: 'go',
};

// We need to match the server's coordinate system
// Based on the detection coordinates in the logs, the server seems to be processing
// higher resolution images (possibly 1920x1080 or similar)
const SERVER_IMAGE_WIDTH = 1920;  // Increase based on detection coords in logs
const SERVER_IMAGE_HEIGHT = 1080; // Adjust based on probable aspect ratio
const DETECTION_CONFIDENCE_THRESHOLD = 0.6; // Minimum confidence to consider a detection valid

const CameraScreen: React.FC = () => {
  // --- State and Refs ---
  const [serverIP, setServerIP] = useState<string>('192.168.1.103');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean>(false);
  const [cameraViewDims, setCameraViewDims] = useState({ width: 0, height: 0 });
  const [photoResolution, setPhotoResolution] = useState({ width: 0, height: 0 });
  const [showIPModal, setShowIPModal] = useState<boolean>(true);
  const [lastPlayedSound, setLastPlayedSound] = useState<string | null>(null);
  const [lastSoundTime, setLastSoundTime] = useState<number>(0);

  const cameraRef = useRef<Camera | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  
  // --- Hooks ---
  const devices = useCameraDevices();
  const device = devices.find(device => device.position === 'back');
  
  // Note: useCameraFormat MUST be called unconditionally, but might receive undefined device initially.
  // Handle potential null device inside the format usage if necessary, or ensure device is ready before using format.
  const format = useCameraFormat(device, [
    { photoResolution: { width: SERVER_IMAGE_WIDTH, height: SERVER_IMAGE_HEIGHT } }
  ]);

  // Load saved IP address when component mounts
  useEffect(() => {
    const loadSavedIP = async () => {
      try {
        const savedIP = await AsyncStorage.getItem('last_server_ip');
        if (savedIP) {
          setServerIP(savedIP);
        }
      } catch (error) {
        console.error('Error loading saved IP:', error);
      }
    };
    
    loadSavedIP();
  }, []);

  // Save IP address when it changes
  const saveIPAddress = async (ip: string) => {
    try {
      await AsyncStorage.setItem('last_server_ip', ip);
    } catch (error) {
      console.error('Error saving IP address:', error);
    }
  };

  // Update serverIP state and save it
  const handleIPChange = (ip: string) => {
    setServerIP(ip);
    saveIPAddress(ip);
  };

  // Request camera permissions
  useEffect(() => {
    (async () => {
      const cameraPermission = await Camera.requestCameraPermission();
      setHasCameraPermission(cameraPermission === 'granted');
    })();
  }, []);

  // Set up continuous frame capture using recursive setTimeout
  useEffect(() => {
    let frameTimeoutId: NodeJS.Timeout | null = null;
    let isActive = true;

    const frameLoop = () => {
      if (!isActive || !isConnected || !device || !hasCameraPermission) return; // Added device/permission check

      captureFrame().finally(() => {
        if (isActive) {
          frameTimeoutId = setTimeout(frameLoop, 200); // Increased from 100ms to 200ms
        }
      });
    };

    if (isConnected && device && hasCameraPermission) { // Ensure device/permission ready
      frameTimeoutId = setTimeout(frameLoop, 500);
    }

    return () => {
      isActive = false;
      if (frameTimeoutId) {
        clearTimeout(frameTimeoutId);
      }
    };
  }, [isConnected, device, hasCameraPermission]); // Add device/permission dependencies

  // Clean up WebSocket connection when component unmounts
  useEffect(() => {
    return () => {
      console.log("Camera screen unmounting. Cleaning up WebSocket.");
      if (websocketRef.current) {
        const ws = websocketRef.current;
        websocketRef.current = null;
        ws.close();
      }
    };
  }, []);

  // Basic WebSocket Message Handler
  useEffect(() => {
    const ws = websocketRef.current;
    if (!ws) return;

    const messageHandler = (event: any) => { 
      try {
        const data: ServerResponse = JSON.parse(event.data);
        
        if (data.detections) {
          // Check if detections changed from previous state
          if (JSON.stringify(data.detections) !== JSON.stringify(detections)) {
            console.log(`Change detected: Found ${data.detections.length} objects`);
          }
          
          // Update detections state with the new results
          setDetections(data.detections);
          
          // Play sound based on detection (only if there are detections)
          if (data.detections.length > 0) {
            const sortedDetections = [...data.detections].sort((a, b) => 
              (b.confidence || 0) - (a.confidence || 0)
            );
            
            // Get the highest confidence detection
            const topDetection = sortedDetections[0];
            
            // Only play sound if confidence is high enough and not played recently
            const currentTime = Date.now();
            const timeSinceLastSound = currentTime - lastSoundTime;
            const lightColor = topDetection.class.toLowerCase();
            
            if (topDetection.confidence > DETECTION_CONFIDENCE_THRESHOLD && 
                lightColor !== lastPlayedSound && 
                timeSinceLastSound > 2000) { // Only play sound every 2 seconds at most
              
              if (lightColor in SOUND_FILES) {
                playSound(lightColor);
                setLastPlayedSound(lightColor);
                setLastSoundTime(currentTime);
              }
            }
          }
        } else if (data.error) {
          console.error('Server error received:', data.error);
        }
        setIsProcessing(false);
      } catch (error) {
        console.error('Error parsing WebSocket message or processing data:', error);
        setIsProcessing(false);
      }
    };

    ws.onmessage = messageHandler;

    return () => {
      if (ws) {
        ws.onmessage = null; 
      }
    };
  }, [websocketRef.current, lastPlayedSound, lastSoundTime]);

  // --- Functions (connectWebSocket, disconnectWebSocket, captureFrame, etc.) ---
  // Connect to WebSocket server
  const connectWebSocket = (): void => {
    try {
      const webSocketUrl = `ws://${serverIP}:8765`;
      console.log(`Connecting to WebSocket at ${webSocketUrl}`);

      websocketRef.current = new WebSocket(webSocketUrl);

      websocketRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        setShowIPModal(false);
        Alert.alert('Success', 'Connected to server successfully');
      };

      websocketRef.current.onmessage = (event) => {
        try {
          const data: ServerResponse = JSON.parse(event.data);

          if (data.detections) {
            // Update detections state with the new results
            setDetections(data.detections);
          } else if (data.error) {
            console.error('Server error received:', data.error);
          }

          setIsProcessing(false);
        } catch (error) {
          console.error('Error parsing WebSocket message or processing data:', error);
          setIsProcessing(false);
        }
      };
 
      websocketRef.current.onerror = (event) => {
        const errorInfo = {
          type: event.type,
          message: event.message || "Unknown error",
          readyState: websocketRef.current?.readyState,
          serverIP: serverIP,
          url: `ws://${serverIP}:8765`
        };
        
        console.error('WebSocket error:', errorInfo);
        setIsConnected(false);
        Alert.alert('Connection Error', `WebSocket error: ${JSON.stringify(errorInfo, null, 2)}`);
      };


      websocketRef.current.onclose = (event) => {
        console.log('WebSocket disconnected. Code:', event.code, 'Reason:', event.reason);
        setIsConnected(false);
        setDetections([]);

        if (websocketRef.current) {
          console.log('Attempting to reconnect in 30 seconds...');
          setTimeout(() => {
            if (websocketRef.current?.readyState === WebSocket.CLOSED) {
              connectWebSocket();
            } else {
              console.log('Reconnect attempt skipped: WebSocket state is not CLOSED.');
            }
          }, 30000); // Increased from 5000 to 30000 (30 seconds)
        } else {
          console.log('Manual disconnect, not attempting to reconnect.');
        }
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      Alert.alert('Connection Error', 'Failed to create WebSocket connection. Check IP address format.');
    }
  };

  // Disconnect from WebSocket server
  const disconnectWebSocket = (): void => {
    if (websocketRef.current) {
      const ws = websocketRef.current;
      websocketRef.current = null;
      ws.close();
      setIsConnected(false);
      setDetections([]);
      setShowIPModal(true);
      Alert.alert('Disconnected', 'Successfully disconnected from server.');
    }
  };

  // Capture a frame and send it to the server
  const captureFrame = async (): Promise<void> => {
    if (cameraRef.current && isConnected) { 
      setIsProcessing(true); 
      try {
        const photo = await cameraRef.current.takePhoto({
          flash: 'off',
          enableShutterSound: false,
        });

        setPhotoResolution({ width: photo.width || 0, height: photo.height || 0 });

        const response = await fetch(`file://${photo.path}`);
        const blob = await response.blob();
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            if (typeof reader.result === 'string') {
              const base64String = reader.result.includes('base64,')
                ? reader.result.split('base64,')[1]
                : reader.result;
              resolve(base64String);
            } else {
              reject(new Error('FileReader result is not a string'));
            }
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        if (websocketRef.current?.readyState === WebSocket.OPEN) {
          websocketRef.current.send(JSON.stringify({
            image: base64,
            image_width: photo.width,
            image_height: photo.height,
          }));
        } else {
          console.log('WebSocket not ready to send frame');
          setIsProcessing(false);
        }
      } catch (error) {
        console.error('Error capturing frame:', error);
        setIsProcessing(false);
      }
    }
  };

  // Handler for the camera view layout to get its dimensions
  const handleCameraLayout = (event: any) => {
    const { width, height } = event.nativeEvent.layout;
    console.log(`Camera view layout dimensions: ${width}x${height}`);
    setCameraViewDims({ width, height });
  };

  // Get the color for the bounding box based on traffic light color
  const getBoxColor = (className: string): string => {
    switch (className.toLowerCase()) {
      case 'green':
        return '#00FF00';
      case 'red':
        return '#FF0000';
      case 'yellow':
        return '#FFFF00';
      default:
        return '#FFFFFF';
    }
  };

  // Improved coordinate mapping logic
  const mapDetectionToView = (detection: Detection) => {
    const { width: viewWidth, height: viewHeight } = cameraViewDims;
    if (viewWidth <= 0 || viewHeight <= 0) return null;

    // Use the actual photo resolution if available, otherwise the server image dimensions
    const actualWidth = photoResolution.width || SERVER_IMAGE_WIDTH;
    const actualHeight = photoResolution.height || SERVER_IMAGE_HEIGHT;
    
    // Calculate the scale factors for width and height
    const scaleX = viewWidth / actualWidth;
    const scaleY = viewHeight / actualHeight;
    
    // Map the detection coordinates to the view
    return {
      left: detection.x1 * scaleX,
      top: detection.y1 * scaleY,
      width: (detection.x2 - detection.x1) * scaleX,
      height: (detection.y2 - detection.y1) * scaleY,
    };
  };

  // Play sound for detected traffic light color
  const playSound = async (color: string) => {
    try {
      if (!(color in SOUND_FILES)) {
        console.warn(`No sound file for color: ${color}`);
        return;
      }
      
      console.log(`Sound should play now: ${color} traffic light detected`);
      
      try {
        // Get the sound file name for this color (do this outside the try/catch to avoid overhead)
        const soundFile = SOUND_FILES[color as keyof typeof SOUND_FILES];
        
        // Play the sound file without stopping first (more efficient)
        SoundPlayer.playSoundFile(soundFile, 'mp3');
        console.log(`Playing sound for ${color} light`);
      } catch (error) {
        console.error('Error playing sound:', error);
      }
    } catch (error) {
      console.error('Error in playSound function:', error);
    }
  };

  // --- Conditional Rendering (AFTER all hooks) ---
  if (!device) {
    return (
      <SafeAreaView style={styles.container}>
        <Navbar title="Camera" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Camera not available on this device.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!hasCameraPermission) {
    return (
      <SafeAreaView style={styles.container}>
        <Navbar title="Camera" />
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Camera permission not granted.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // --- Main Render Output ---
  return (
    <SafeAreaView style={styles.container}>
      <Navbar title="Camera" />
      
      {/* IP Input Modal */}
      <Modal
        isVisible={showIPModal}
        backdropOpacity={0.6}
        animationIn="fadeIn"
        animationOut="fadeOut"
        backdropTransitionOutTiming={0}
        style={styles.modal}
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Server Connection</Text>
          <Text style={styles.modalSubtitle}>Enter the server IP address to connect</Text>
          
          <View style={styles.modalInputContainer}>
            <Text style={styles.modalLabel}>Server IP</Text>
            <TextInput
              style={styles.modalInput}
              value={serverIP}
              onChangeText={handleIPChange}
              placeholder="e.g. 192.168.1.100"
              placeholderTextColor="#666"
              keyboardType="numeric"
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          
          <TouchableOpacity
            style={styles.connectButton}
            onPress={connectWebSocket}
          >
            <Text style={styles.connectButtonText}>Connect</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Camera Container */}
      <View style={styles.cameraContainer} onLayout={handleCameraLayout}>
        {/* Camera Component */}
        <Camera
          ref={cameraRef}
          style={styles.camera}
          device={device}
          isActive={true}
          photo={true}
          format={format}
          resizeMode="cover"
        />

        {/* Debug info overlay */}
        <View style={styles.debugInfo}>
          <Text style={styles.debugText}>
            Camera: {cameraViewDims.width}x{cameraViewDims.height}
          </Text>
          <Text style={styles.debugText}>
            Photo: {photoResolution.width}x{photoResolution.height}
          </Text>
        </View>

        {/* Overlay for Detections */}
        <View style={styles.overlay} pointerEvents="none">
          {detections.map((detection, index) => {
            const coords = mapDetectionToView(detection);
            
            if (!coords || coords.width <= 0 || coords.height <= 0) return null;
            
            return (
              <View
                key={index}
                style={[
                  styles.detectionBox,
                  {
                    borderColor: getBoxColor(detection.class),
                    left: coords.left,
                    top: coords.top,
                    width: coords.width,
                    height: coords.height,
                  },
                ]}
              >
                <Text style={styles.detectionText}>
                  {detection.class.toUpperCase()} ({Math.round(detection.confidence * 100)}%)
                </Text>
                {detection.distance_cm !== undefined && detection.distance_cm !== -1 && (
                  <Text style={styles.distanceText}>
                    {detection.distance_cm.toFixed(1)} cm
                  </Text>
                )}
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.statusText}>
          Status: {!isConnected ? 'Disconnected' : isProcessing ? 'Processing...' : 'Ready'}
        </Text>
        <Text style={styles.detectionCountText}>
          Detections: {detections.length}
        </Text>
        {isConnected && (
          <TouchableOpacity
            style={styles.disconnectButton}
            onPress={disconnectWebSocket}
          >
            <Text style={styles.disconnectButtonText}>Disconnect</Text>
          </TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e1e',
  },
  modal: {
    margin: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#2d2d2d',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
      },
      android: {
        elevation: 5,
      },
    }),
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 20,
    textAlign: 'center',
  },
  modalInputContainer: {
    marginBottom: 20,
  },
  modalLabel: {
    fontSize: 14,
    color: '#fff',
    marginBottom: 8,
  },
  modalInput: {
    backgroundColor: '#3d3d3d',
    color: '#fff',
    height: 50,
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  connectButton: {
    backgroundColor: '#4CAF50',
    height: 50,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
    backgroundColor: 'black',
    overflow: 'hidden',
  },
  camera: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 5,
  },
  detectionBox: {
    position: 'absolute',
    borderWidth: 3,
    borderStyle: 'solid',
    backgroundColor: 'transparent',
    zIndex: 6,
  },
  detectionText: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
    padding: 4,
    position: 'absolute',
    top: -24,
    left: 0,
    zIndex: 7,
  },
  distanceText: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
    padding: 4,
    position: 'absolute',
    bottom: -24,
    left: 0,
    zIndex: 7,
  },
  debugInfo: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 8,
    borderRadius: 4,
    zIndex: 8,
  },
  debugText: {
    color: 'white',
    fontSize: 10,
  },
  footer: {
    padding: 16,
    backgroundColor: '#2d2d2d',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  statusText: {
    color: '#fff',
    fontSize: 14,
  },
  detectionCountText: {
    color: '#fff',
    fontSize: 14,
  },
  disconnectButton: {
    backgroundColor: '#F44336',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
  },
  disconnectButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
  },
  errorText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginHorizontal: 20,
  },
});

export default CameraScreen;
