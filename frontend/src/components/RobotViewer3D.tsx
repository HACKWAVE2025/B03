import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

// Function to get instruction based on current route
const getInstructionForRoute = (pathname: string): string => {
  console.log('Getting instruction for pathname:', pathname);
  
  // Reading exercise
  if (pathname.includes('/reading-exercise') || pathname.startsWith('/reading-exercise')) {
    console.log('Matched reading exercise');
    return "Read the story out loud and record your voice when you're ready";
  }
  
  // Typing game - check multiple patterns
  if (pathname === '/typing-game' || pathname.includes('/typing-game') || pathname.startsWith('/typing-game')) {
    console.log('Matched typing game');
    return "Type the words you see on screen as quickly and accurately as you can";
  }
  
  // Puzzle/Game page (with theme and level)
  if (pathname.includes('/game/') || pathname.startsWith('/game/')) {
    console.log('Matched puzzle game');
    return "Match the picture pieces to complete the puzzle and learn new words";
  }
  
  // Phonetics game
  if (pathname.includes('/phonetics-game') || pathname.startsWith('/phonetics-game')) {
    console.log('Matched phonetics game');
    return "Listen to the sounds and click on the correct letter that makes that sound";
  }
  
  // Default greeting
  console.log('Using default greeting');
  return "Hi, I'm Lexi";
};

const RobotViewer3D = () => {
  const location = useLocation();
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const modelRef = useRef<THREE.Group | null>(null);
  const mixerRef = useRef<THREE.AnimationMixer | null>(null);
  const clockRef = useRef<THREE.Clock>(new THREE.Clock());
  const isDraggingRef = useRef(false);
  const previousMousePositionRef = useRef({ x: 0, y: 0 });
  const locationRef = useRef(location.pathname);
  
  // Update location ref when route changes
  useEffect(() => {
    locationRef.current = location.pathname;
    console.log('Route changed to:', location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create scene
    const scene = new THREE.Scene();
    scene.background = null;
    sceneRef.current = scene;

    // Create camera
    const camera = new THREE.PerspectiveCamera(
      50,
      containerRef.current.clientWidth / containerRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(3, 2, 4);
    camera.lookAt(0, 0, 0);
    cameraRef.current = camera;

    // Create renderer
    const renderer = new THREE.WebGLRenderer({ 
      antialias: true, 
      alpha: true,
      powerPreference: "high-performance"
    });
    renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Add lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 5, 5);
    scene.add(directionalLight);

    const pointLight = new THREE.PointLight(0xffffff, 0.4);
    pointLight.position.set(-5, 3, -5);
    scene.add(pointLight);

    // Load GLB model with animations
    const loader = new GLTFLoader();
    loader.load(
      '/robot_playground.glb',
      (gltf) => {
        const model = gltf.scene;
        model.position.set(0, -1, 0);
        model.scale.set(1, 1, 1);
        scene.add(model);
        modelRef.current = model;

        // Center the model
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        model.position.sub(center);

        // Set up animations
        if (gltf.animations && gltf.animations.length > 0) {
          const mixer = new THREE.AnimationMixer(model);
          mixerRef.current = mixer;

          // Play all animations
          gltf.animations.forEach((clip) => {
            const action = mixer.clipAction(clip);
            action.play();
          });
        }
      },
      (progress) => {
        console.log('Loading progress:', progress);
      },
      (error) => {
        console.error('Error loading model:', error);
      }
    );

    // Mouse/touch controls
    const handleMouseDown = (event: MouseEvent | TouchEvent) => {
      isDraggingRef.current = true;
      const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
      const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
      previousMousePositionRef.current = {
        x: clientX,
        y: clientY
      };
    };

    const handleMouseMove = (event: MouseEvent | TouchEvent) => {
      if (!isDraggingRef.current || !modelRef.current) return;

      const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
      const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;

      const deltaX = clientX - previousMousePositionRef.current.x;
      const deltaY = clientY - previousMousePositionRef.current.y;

      // Mark as moved if there's significant movement
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        hasMoved = true;
      }

      modelRef.current.rotation.y += deltaX * 0.01;
      modelRef.current.rotation.x += deltaY * 0.01;

      previousMousePositionRef.current = { x: clientX, y: clientY };
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
    };

    // Handle click to speak
    let clickStartTime = 0;
    let clickStartPosition = { x: 0, y: 0 };
    let hasMoved = false;
    
    const handleClick = (event: MouseEvent | TouchEvent) => {
      const currentTime = Date.now();
      const clientX = 'touches' in event ? event.touches[0]?.clientX || event.clientX : event.clientX;
      const clientY = 'touches' in event ? event.touches[0]?.clientY || event.clientY : event.clientY;
      
      // Check if this was a click (not a drag)
      const timeDiff = currentTime - clickStartTime;
      const xDiff = Math.abs(clientX - clickStartPosition.x);
      const yDiff = Math.abs(clientY - clickStartPosition.y);
      
      // Only trigger if it's a quick click/tap (less than 300ms and moved less than 10px)
      if (!hasMoved && timeDiff < 300 && xDiff < 10 && yDiff < 10) {
        const currentPath = locationRef.current;
        const instruction = getInstructionForRoute(currentPath);
        console.log('Click detected at route:', currentPath);
        console.log('Speaking instruction:', instruction);
        speakText(instruction);
      }
    };

    const speakText = (text: string) => {
      console.log('Attempting to speak:', text);
      
      if ('speechSynthesis' in window) {
        // Stop any ongoing speech
        window.speechSynthesis.cancel();
        
        // Wait a bit for cancel to complete
        setTimeout(() => {
          const utterance = new SpeechSynthesisUtterance(text);
          
          // Cute and sweet voice settings for children - lower pitch for warm, gentle tone
          utterance.rate = 1.0;   // Normal speed (clear and understandable)
          utterance.pitch = 0.9;  // Lower pitch for warm, gentle, cute voice
          utterance.volume = 1.0; // Full volume
          
          // Error handling
          utterance.onerror = (event) => {
            console.error('Speech synthesis error:', event);
            alert(text); // Fallback to alert
          };
          
          utterance.onend = () => {
            console.log('Speech ended');
          };
          
          utterance.onstart = () => {
            console.log('Speech started');
          };
          
          // Try to find the best child-friendly female voice
          const voices = window.speechSynthesis.getVoices();
          console.log('Available voices:', voices.length);
          
          if (voices.length > 0) {
            // Priority order: Google voices (best for kids), then other friendly female voices
            const preferredVoices = [
              // Google voices (best quality for children)
              voices.find(v => v.name.includes('Google') && (v.name.includes('US English') || v.name.includes('Female'))),
              voices.find(v => v.name.toLowerCase().includes('google') && v.name.toLowerCase().includes('female')),
              voices.find(v => v.name.includes('Google US English')),
              
              // Windows friendly voices
              voices.find(v => v.name.includes('Zira')), // Windows 10+ friendly female
              voices.find(v => v.name.includes('Aria')), // Azure-like voice
              
              // Other sweet female voices
              voices.find(v => v.name.toLowerCase().includes('female') && !v.name.toLowerCase().includes('male')),
              voices.find(v => v.name.includes('Samantha')), // macOS friendly voice
              voices.find(v => v.name.includes('Karen')),   // Australian accent, friendly
              voices.find(v => v.name.includes('Hazel')),   // British accent, warm
              voices.find(v => v.name.includes('Cora')),    // Sometimes available
              
              // Any female voice as last resort
              voices.find(v => v.name.toLowerCase().includes('zira') || 
                            v.name.toLowerCase().includes('samantha') ||
                            v.name.toLowerCase().includes('female'))
            ].filter(Boolean); // Remove undefined values
            
            if (preferredVoices.length > 0) {
              utterance.voice = preferredVoices[0];
              console.log('Using sweet voice:', preferredVoices[0].name);
            } else {
              // Fallback: try to find any non-male voice
              const anyFemaleVoice = voices.find(v => 
                !v.name.toLowerCase().includes('male') && 
                !v.name.toLowerCase().includes('david') &&
                !v.name.toLowerCase().includes('mark')
              );
              if (anyFemaleVoice) {
                utterance.voice = anyFemaleVoice;
                console.log('Using available female voice:', anyFemaleVoice.name);
              } else {
                console.log('Using default voice');
              }
            }
          }
          
          try {
            window.speechSynthesis.speak(utterance);
            console.log('Speech command sent with cute voice settings');
          } catch (error) {
            console.error('Error speaking:', error);
            alert(text); // Fallback
          }
        }, 100);
      } else {
        console.error('Speech synthesis not supported');
        alert(text);
      }
    };

    // Load voices when available - improved for better voice selection
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        const voices = window.speechSynthesis.getVoices();
        console.log('Voices loaded:', voices.length);
        // Log available female voices for debugging
        const femaleVoices = voices.filter(v => 
          v.name.toLowerCase().includes('female') || 
          v.name.toLowerCase().includes('zira') ||
          v.name.toLowerCase().includes('samantha') ||
          v.name.toLowerCase().includes('google')
        );
        if (femaleVoices.length > 0) {
          console.log('Available friendly voices:', femaleVoices.map(v => v.name));
        }
      };
      
      // Load voices immediately
      loadVoices();
      
      // Also load when voices become available (async)
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
      
      // Try loading voices again after a short delay (some browsers load async)
      setTimeout(loadVoices, 500);
      setTimeout(loadVoices, 1000);
    }

    const canvas = renderer.domElement;
    
    // Track click start for drag detection
    const handleInteractionStart = (event: MouseEvent | TouchEvent) => {
      isDraggingRef.current = true;
      hasMoved = false;
      clickStartTime = Date.now();
      const clientX = 'touches' in event ? event.touches[0]?.clientX || event.clientX : event.clientX;
      const clientY = 'touches' in event ? event.touches[0]?.clientY || event.clientY : event.clientY;
      clickStartPosition = { x: clientX, y: clientY };
      previousMousePositionRef.current = { x: clientX, y: clientY };
      console.log('Interaction started at:', clientX, clientY);
    };

    // Store handlers for cleanup
    const mouseUpHandler = (e: MouseEvent) => {
      handleMouseUp();
      handleClick(e);
    };
    const touchEndHandler = (e: TouchEvent) => {
      handleMouseUp();
      handleClick(e);
    };

    canvas.addEventListener('mousedown', handleInteractionStart);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', mouseUpHandler);
    canvas.addEventListener('mouseleave', handleMouseUp);
    canvas.addEventListener('touchstart', handleInteractionStart, { passive: false });
    canvas.addEventListener('touchmove', handleMouseMove, { passive: false });
    canvas.addEventListener('touchend', touchEndHandler);
    canvas.addEventListener('touchcancel', handleMouseUp);

    // Animation loop
    let animationId: number;
    const clock = clockRef.current;
    const animate = () => {
      animationId = requestAnimationFrame(animate);
      
      // Update animations if mixer exists
      if (mixerRef.current) {
        const delta = clock.getDelta();
        mixerRef.current.update(delta);
      }
      
      if (renderer && scene && camera) {
        renderer.render(scene, camera);
      }
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (!containerRef.current || !camera || !renderer) return;
      camera.aspect = containerRef.current.clientWidth / containerRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(containerRef.current.clientWidth, containerRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId);
      }
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousedown', handleInteractionStart);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseup', mouseUpHandler);
      canvas.removeEventListener('mouseleave', handleMouseUp);
      canvas.removeEventListener('touchstart', handleInteractionStart);
      canvas.removeEventListener('touchmove', handleMouseMove);
      canvas.removeEventListener('touchend', touchEndHandler);
      canvas.removeEventListener('touchcancel', handleMouseUp);
      
      // Stop any ongoing speech
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }

      if (mixerRef.current) {
        mixerRef.current.stopAllActions();
        mixerRef.current.uncacheRoot(mixerRef.current.getRoot());
      }
      if (renderer) {
        renderer.dispose();
      }
      if (containerRef.current && renderer.domElement && containerRef.current.contains(renderer.domElement)) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '100%', touchAction: 'none' }} />;
};

export default RobotViewer3D;
