import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

interface ChildData {
  username: string;
  therapistCode: string;
  sessionId: string;
}

const LETTERS = ['A', 'B', 'C', 'D'];

const LetterTracing: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentLetter, setCurrentLetter] = useState<string>('A');
  const [childData, setChildData] = useState<ChildData | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [traceCount, setTraceCount] = useState(0);
  const navigate = useNavigate();

  const initializeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate responsive canvas size based on window
    const maxWidth = Math.min(window.innerWidth * 0.85, 700);
    const maxHeight = Math.min(window.innerHeight * 0.5, 600);
    const canvasSize = Math.min(maxWidth, maxHeight, 500);
    
    // Set canvas size (internal resolution)
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    
    // Set CSS size (display size) - important for proper scaling
    canvas.style.width = `${canvasSize}px`;
    canvas.style.height = `${canvasSize}px`;

    // Clear canvas and set white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate font size based on canvas size (60% of canvas size)
    const fontSize = Math.floor(canvasSize * 0.6);

    // Draw letter outline (light gray fill) - ensures letter is visible
    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#E0E0E0';
    // Draw fill first to ensure letter shape is visible
    ctx.fillText(currentLetter, canvas.width / 2, canvas.height / 2);

    // Draw letter outline stroke (darker gray for tracing guide)
    ctx.strokeStyle = '#888888';
    ctx.lineWidth = Math.max(2, Math.floor(canvasSize / 200));
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // Draw stroke on top for the outline
    ctx.strokeText(currentLetter, canvas.width / 2, canvas.height / 2);
  }, [currentLetter]);

  useEffect(() => {
    const stored = sessionStorage.getItem('childData');
    if (!stored) {
      navigate('/child-login');
      return;
    }
    try {
      const parsed = JSON.parse(stored);
      setChildData(parsed);
    } catch (err) {
      navigate('/child-login');
    }
  }, [navigate]);

  useEffect(() => {
    // Initialize canvas when component mounts and when letter changes
    if (childData && currentLetter) {
      // Small delay to ensure canvas is rendered
      const timer = setTimeout(() => {
        initializeCanvas();
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [currentLetter, childData, initializeCanvas]);

  useEffect(() => {
    // Handle window resize to reinitialize canvas
    const handleResize = () => {
      if (childData && currentLetter) {
        initializeCanvas();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [childData, currentLetter, initializeCanvas]);

  const getCanvasCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getCanvasCoordinates(e);

    ctx.strokeStyle = '#000';
    // Make brush size responsive to canvas size
    const brushSize = Math.max(8, Math.floor(canvas.width / 50));
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    initializeCanvas();
  };

  const handleSave = async () => {
    if (!childData) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    setLoading(true);
    setMessage(null);

    try {
      // Check if user has actually traced something by checking if canvas has any black pixels
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setMessage('Failed to get canvas context');
        setLoading(false);
        return;
      }

      // Get image data to check if there's actual drawing (darker than the gray outline)
      const imageData_check = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let hasDrawing = false;
      // Count dark pixels that indicate user's black tracing (darker than gray outline #888)
      let darkPixelCount = 0;
      for (let i = 0; i < imageData_check.data.length; i += 4) {
        const r = imageData_check.data[i];
        const g = imageData_check.data[i + 1];
        const b = imageData_check.data[i + 2];
        // Check if pixel is darker than gray outline (user's black tracing = RGB < 100)
        if (r < 100 && g < 100 && b < 100) {
          darkPixelCount++;
        }
      }
      // User needs to have drawn at least some dark pixels (more than just noise/outline)
      hasDrawing = darkPixelCount > 500; // Threshold: at least 500 dark pixels

      if (!hasDrawing) {
        setMessage('Please trace over the letter outline before saving');
        setLoading(false);
        return;
      }

      // Create a temporary canvas to ensure white background and proper image quality
      // Use the same size as the original canvas
      const canvasSize = canvas.width;
      const tempCanvas = document.createElement('canvas');
      tempCanvas.width = canvasSize;
      tempCanvas.height = canvasSize;
      const tempCtx = tempCanvas.getContext('2d');
      
      if (!tempCtx) {
        setMessage('Failed to create image');
        setLoading(false);
        return;
      }

      // Fill with white background first
      tempCtx.fillStyle = '#FFFFFF';
      tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
      
      // Draw the original canvas content (which includes the gray outline and black tracing)
      tempCtx.drawImage(canvas, 0, 0);
      
      // Convert to base64 image with maximum quality
      const imageData = tempCanvas.toDataURL('image/png', 1.0);

      // Send to backend to save tracing image
      const response = await fetch('http://localhost:5000/api/tracing/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          therapistCode: childData.therapistCode,
          username: childData.username,
          sessionId: childData.sessionId,
          letter: currentLetter,
          imageData: imageData,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setTraceCount(traceCount + 1);
        setMessage(`✓ ${currentLetter} traced! Good job!`);
        
        // Move to next letter after 1.5 seconds
        setTimeout(() => {
          const currentIndex = LETTERS.indexOf(currentLetter);
          if (currentIndex < LETTERS.length - 1) {
            setCurrentLetter(LETTERS[currentIndex + 1]);
          } else {
            setMessage('🎉 All letters completed! Great work!');
            // Mark tracing game as completed
            (async () => {
              try {
                await fetch('http://localhost:5000/api/mark-game-completed', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    therapistCode: childData.therapistCode,
                    username: childData.username,
                    game: 'tracing'
                  })
                });
              } catch (err) {
                console.error('Failed to mark tracing game as completed:', err);
              }
            })();
            setTimeout(() => {
              navigate('/child-dashboard');
            }, 2000);
          }
        }, 1500);
      } else {
        setMessage(result.error || 'Failed to save tracing');
      }
    } catch (err: any) {
      setMessage('Network error while saving');
      console.error('Error saving tracing:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!childData) return <Container>Loading...</Container>;

  const currentIndex = LETTERS.indexOf(currentLetter);
  const progress = ((currentIndex + 1) / LETTERS.length) * 100;

  return (
    <Container>
      <Card>
        <CloseButton
          onClick={() => navigate('/child-dashboard')}
          title="Exit"
        >
          ×
        </CloseButton>
        <Header>
          <Title>✏️ Letter Tracing</Title>
          <Subtitle>Trace the letter {currentLetter} carefully</Subtitle>
        </Header>

        <ProgressBar>
          <ProgressFill progress={progress} />
        </ProgressBar>
        <ProgressText>
          Letter {currentIndex + 1} of {LETTERS.length} - {currentLetter}
        </ProgressText>

        <CanvasContainer>
          <Canvas
            ref={canvasRef}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
        </CanvasContainer>


        {message && (
          <FeedbackMessage correct={message.includes('✓') || message.includes('🎉')}>
            {message}
          </FeedbackMessage>
        )}

        <ButtonContainer>
          <ClearButton onClick={handleClear} disabled={loading}>
            Clear
          </ClearButton>
          <SaveButton onClick={handleSave} disabled={loading}>
            {loading ? 'Saving...' : 'Save & Continue'}
          </SaveButton>
        </ButtonContainer>

        <InfoBox>
          💡 Trace the letter carefully following the outline. Your therapist will review your tracing.
        </InfoBox>
      </Card>
    </Container>
  );
};

// Styled Components
const Container = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
`;

const Card = styled.div`
  background: white;
  padding: 32px;
  border-radius: 16px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 100%;
  max-width: 600px;
  text-align: center;
  position: relative;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 12px;
  right: 12px;
  background: #ff6b6b;
  color: white;
  border: none;
  width: 40px;
  height: 40px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 18px rgba(0,0,0,0.12);
  transition: transform 0.12s ease, box-shadow 0.12s ease;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 26px rgba(0,0,0,0.14);
  }
`;

const Header = styled.div`
  margin-bottom: 24px;
`;

const Title = styled.h2`
  margin: 0 0 8px 0;
  font-size: 28px;
  color: #333;
`;

const Subtitle = styled.p`
  color: #666;
  margin: 0;
  font-size: 16px;
  font-weight: 600;
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 8px;
  background: #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
`;

const ProgressFill = styled.div<{ progress: number }>`
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  width: ${props => props.progress}%;
  transition: width 0.3s ease;
`;

const ProgressText = styled.div`
  color: #666;
  font-size: 14px;
  margin-bottom: 20px;
  font-weight: 600;
`;

const CanvasContainer = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 20px 0;
  padding: 20px;
  background: #f9f9f9;
  border-radius: 12px;
  border: 2px solid #e0e0e0;
  width: 100%;
  min-height: 400px;
`;

const Canvas = styled.canvas`
  border: 2px solid #ddd;
  border-radius: 8px;
  cursor: crosshair;
  background: white;
  touch-action: none;
  max-width: 100%;
  height: auto;
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 20px;
`;

const ClearButton = styled.button`
  padding: 14px 24px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, opacity 0.2s;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const SaveButton = styled.button`
  padding: 14px 24px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, opacity 0.2s;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const FeedbackMessage = styled.div<{ correct: boolean }>`
  padding: 12px 20px;
  margin: 16px 0;
  border-radius: 8px;
  font-weight: 600;
  background: ${props => props.correct ? '#d4edda' : '#f8d7da'};
  color: ${props => props.correct ? '#155724' : '#721c24'};
  animation: slideIn 0.3s ease;

  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const InfoBox = styled.div`
  background: #e7f3ff;
  color: #004085;
  padding: 12px;
  border-radius: 8px;
  font-size: 13px;
  margin-top: 20px;
  line-height: 1.5;
`;

export default LetterTracing;

