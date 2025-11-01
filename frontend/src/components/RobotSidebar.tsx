import { lazy, Suspense, Component, ErrorInfo, ReactNode } from 'react';
import { styled } from 'styled-components';

// Error Boundary Component
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('RobotSidebar Error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

// Lazy load the 3D viewer to prevent blocking initial render
const RobotViewer3D = lazy(() => import('./RobotViewer3D'));

// Loading fallback
const LoadingFallback = () => (
  <LoadingContainer>
    <LoadingSpinner />
    <LoadingText>Loading Robot...</LoadingText>
  </LoadingContainer>
);

const RobotSidebar: React.FC = () => {
  return (
    <ErrorBoundary>
      <RobotContainer>
        <RobotViewer>
          <Suspense fallback={<LoadingFallback />}>
            <RobotViewer3D />
          </Suspense>
        </RobotViewer>
      </RobotContainer>
    </ErrorBoundary>
  );
};

const LoadingContainer = styled.div`
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: transparent;
`;

const LoadingSpinner = styled.div`
  width: 40px;
  height: 40px;
  border: 4px solid rgba(58, 134, 255, 0.2);
  border-top-color: #3a86ff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 12px;

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  @media (max-width: 768px) {
    width: 30px;
    height: 30px;
    border-width: 3px;
    margin-bottom: 8px;
  }

  @media (max-width: 480px) {
    width: 24px;
    height: 24px;
    border-width: 2px;
    margin-bottom: 6px;
  }
`;

const LoadingText = styled.div`
  color: #3a86ff;
  font-size: 11px;
  font-weight: 500;
  
  @media (max-width: 480px) {
    font-size: 9px;
  }
`;

const RobotContainer = styled.div`
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 240px;
  height: 240px;
  z-index: 999;
  pointer-events: none;
  
  @media (max-width: 768px) {
    width: 180px;
    height: 180px;
    bottom: 15px;
    right: 15px;
  }
  
  @media (max-width: 480px) {
    width: 140px;
    height: 140px;
    bottom: 10px;
    right: 10px;
  }
`;

const RobotViewer = styled.div`
  width: 100%;
  height: 100%;
  background: transparent;
  pointer-events: all;
  touch-action: none;
`;

export default RobotSidebar;
