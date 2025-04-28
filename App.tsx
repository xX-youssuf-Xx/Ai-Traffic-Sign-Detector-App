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
} from 'react-native';
import { Camera, useCameraDevices, CameraPermissionStatus, useCameraFormat } from 'react-native-vision-camera';

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

// We need to match the server's coordinate system
// Based on the detection coordinates in the logs, the server seems to be processing
// higher resolution images (possibly 1920x1080 or similar)
const SERVER_IMAGE_WIDTH = 1920;  // Increase based on detection coords in logs
const SERVER_IMAGE_HEIGHT = 1080; // Adjust based on probable aspect ratio

const App: React.FC = () => {
  const [serverIP, setServerIP] = useState<string>('192.168.1.103');
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean>(false);
  const [cameraViewDims, setCameraViewDims] = useState({ width: 0, height: 0 });
  const [photoResolution, setPhotoResolution] = useState({ width: 0, height: 0 });

  const cameraRef = useRef<Camera | null>(null);
  const websocketRef = useRef<WebSocket | null>(null);
  const devices = useCameraDevices();
  const device = devices.find(device => device.position === 'back');
  
  // Add format using useCameraFormat hook
  const format = useCameraFormat(device, [
    { photoResolution: { width: SERVER_IMAGE_WIDTH, height: SERVER_IMAGE_HEIGHT } }
  ]);

  // Request camera permissions
  useEffect(() => {
    (async () => {
      const cameraPermission = await Camera.requestCameraPermission();
      setHasCameraPermission(cameraPermission === 'granted');
    })();
  }, []);

  // Connect to WebSocket server
  const connectWebSocket = (): void => {
    try {
      const webSocketUrl = `ws://${serverIP}:8765`;
      console.log(`Connecting to WebSocket at ${webSocketUrl}`);

      websocketRef.current = new WebSocket(webSocketUrl);

      websocketRef.current.onopen = () => {
        console.log('WebSocket connected');
        setIsConnected(true);
        Alert.alert('Success', 'Connected to server successfully');
      };

      websocketRef.current.onmessage = (event) => {
        console.log('WebSocket message received.');
        console.log('Raw message data:', event.data);

        try {
          const data: ServerResponse = JSON.parse(event.data);
          console.log('Parsed message data:', data);

          if (data.detections) {
            console.log('Received detections array.');
            console.log('Number of detections:', data.detections.length);
            if (data.detections.length > 0) {
              console.log('First detection:', data.detections[0]);
            }

            // Update detections state with the new results
            setDetections(data.detections);
          } else if (data.error) {
            console.error('Server error received:', data.error);
          } else {
            console.warn('Received message without detections or error key:', data);
          }

          setIsProcessing(false);
        } catch (error) {
          console.error('Error parsing WebSocket message or processing data:', error);
          setIsProcessing(false);
        }
      };
 
      websocketRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setIsConnected(false);
        Alert.alert('Connection Error', 'WebSocket error occurred. See console for details.');
      };

      websocketRef.current.onclose = (event) => {
        console.log('WebSocket disconnected. Code:', event.code, 'Reason:', event.reason);
        setIsConnected(false);
        setDetections([]);

        if (websocketRef.current) {
          console.log('Attempting to reconnect in 5 seconds...');
          setTimeout(() => {
            if (websocketRef.current?.readyState === WebSocket.CLOSED) {
              connectWebSocket();
            } else {
              console.log('Reconnect attempt skipped: WebSocket state is not CLOSED.');
            }
          }, 5000);
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
      Alert.alert('Disconnected', 'Successfully disconnected from server.');
    }
  };

  // Capture a frame and send it to the server
  const captureFrame = async (): Promise<void> => {
    if (cameraRef.current && !isProcessing && isConnected) {
      setIsProcessing(true);
      try {
        // Take photo with specified options
        const photo = await cameraRef.current.takePhoto({
          flash: 'off',
          enableShutterSound: false,
        });

        // Log the photo dimensions to help debug coordinate mapping
        console.log(`Photo dimensions: ${photo.width}x${photo.height}`);
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
            // Optionally send image dimensions if the server needs them
            image_width: photo.width,
            image_height: photo.height,
          }));
        } else {
          setIsProcessing(false);
          console.log('WebSocket not ready to send frame');
        }
      } catch (error) {
        console.error('Error capturing frame:', error);
        setIsProcessing(false);
      }
    }
  };

  // Set up continuous frame capture
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isConnected && !isProcessing) {
      interval = setInterval(() => {
        captureFrame();
      }, 300);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isConnected, isProcessing]);

  // Clean up WebSocket connection when component unmounts
  useEffect(() => {
    return () => {
      console.log("App component unmounting. Cleaning up WebSocket.");
      if (websocketRef.current) {
        const ws = websocketRef.current;
        websocketRef.current = null;
        ws.close();
      }
    };
  }, []);

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

  // Render loading or permission status
  if (!device) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Camera not available on this device.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!hasCameraPermission) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Camera permission not granted.</Text>
        </View>
      </SafeAreaView>
    );
  }

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TextInput
          style={styles.input}
          value={serverIP}
          onChangeText={setServerIP}
          placeholder="Server IP Address"
          keyboardType="numeric"
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isConnected}
        />
        <TouchableOpacity
          style={[styles.button, isConnected ? styles.disconnectButton : styles.connectButton]}
          onPress={isConnected ? disconnectWebSocket : connectWebSocket}
          disabled={isProcessing}
        >
          <Text style={styles.buttonText}>
            {isConnected ? 'Disconnect' : 'Connect'}
          </Text>
        </TouchableOpacity>
      </View>

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
        {isProcessing && (
          <Text style={styles.processingIndicator}>Sending...</Text>
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
  header: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#2d2d2d',
    alignItems: 'center',
    zIndex: 10,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  input: {
    flex: 1,
    height: 40,
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    borderRadius: 8,
    marginRight: 8,
    color: '#000',
  },
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  connectButton: {
    backgroundColor: '#4CAF50',
  },
  disconnectButton: {
    backgroundColor: '#F44336',
  },
  buttonText: {
    color: '#fff',
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
  processingIndicator: {
    color: '#FFFF00',
    fontSize: 14,
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

export default App;