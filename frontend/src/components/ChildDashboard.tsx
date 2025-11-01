import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

interface ChildData {
  username: string;
  therapistCode: string;
  assignedThemes?: string[];
  sessionId: string;
  preferredGame?: string | null;
  assignedGames?: string[];
  completedGames?: string[];
  preferredStory?: string | null;
}

const ChildDashboard: React.FC = () => {
  const [childData, setChildData] = useState<ChildData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const storedData = sessionStorage.getItem('childData');
    if (!storedData) {
      navigate('/child-login');
      return;
    }

    try {
      const data = JSON.parse(storedData);
      setChildData(data);

      // Fetch latest preferences from server
      (async () => {
        try {
          const resp = await fetch(
            `http://localhost:5000/api/get-child-preference?therapistCode=${encodeURIComponent(data.therapistCode)}&username=${encodeURIComponent(data.username)}`
          );
          const result = await resp.json();
          if (resp.ok && result.success) {
            const updated = {
              ...data,
              preferredGame: result.preferredGame || null,
              assignedGames: result.assignedGames || [],
              completedGames: result.completedGames || [],
              preferredStory: result.preferredStory || null,
            };
            sessionStorage.setItem('childData', JSON.stringify(updated));
            setChildData(updated);
          }
        } catch (err) {
          console.error('Failed to fetch child preference', err);
        } finally {
          setLoading(false);
        }
      })();
    } catch (err) {
      console.error('Error parsing child data:', err);
      navigate('/child-login');
    }
  }, [navigate]);

  const handlePlayPuzzles = () => {
    if (childData?.assignedThemes?.length) {
      navigate(`/game/${childData.assignedThemes[0]}/1`, {
        state: {
          assignedThemes: childData.assignedThemes,
          username: childData.username,
          therapistCode: childData.therapistCode,
        },
      });
    } else {
      setError('No puzzles have been assigned to you yet. Please ask your therapist to assign some games.');
    }
  };

  const handlePlayTyping = () => {
    navigate('/typing-game');
  };

  const handlePlayReading = () => {
    navigate('/reading-exercise');
  };

  const handlePlayTracing = () => {
    navigate('/letter-tracing');
  };

  const handleLogout = () => {
    sessionStorage.clear();
    navigate('/');
  };

  if (loading) {
    return (
      <Container>
        <LoadingCard>
          <LoadingSpinner>🤖</LoadingSpinner>
          <LoadingText>Loading your dashboard...</LoadingText>
        </LoadingCard>
      </Container>
    );
  }

  if (!childData) {
    return (
      <Container>
        <Card>
          <EmptyState>
            <EmptyIcon>❌</EmptyIcon>
            <EmptyTitle>Error Loading Dashboard</EmptyTitle>
            <EmptyMessage>Please try logging in again.</EmptyMessage>
            <BackButton onClick={() => navigate('/child-login')}>Go to Login</BackButton>
          </EmptyState>
        </Card>
      </Container>
    );
  }

  const availableGames: { id: string; name: string; icon: string; color: string; description: string; handler: () => void }[] = [];

  // Use assignedGames array if available, otherwise fall back to preferredGame for backward compatibility
  const assignedGames = childData.assignedGames && childData.assignedGames.length > 0 
    ? childData.assignedGames 
    : (childData.preferredGame ? [childData.preferredGame] : []);

  // Filter out completed games
  const completedGames = childData.completedGames || [];
  const gamesToShow = assignedGames.filter(game => !completedGames.includes(game));

  // Show all assigned games that haven't been completed
  gamesToShow.forEach((game) => {
    if (game === 'puzzles') {
      if (childData.assignedThemes && childData.assignedThemes.length > 0) {
        availableGames.push({
          id: 'puzzles',
          name: 'Puzzles Game',
          icon: '🧩',
          color: '#667eea',
          description: 'Solve fun puzzles with different themes!',
          handler: handlePlayPuzzles,
        });
      }
    } else if (game === 'typing') {
      availableGames.push({
        id: 'typing',
        name: 'Typing Game',
        icon: '⌨️',
        color: '#f093fb',
        description: 'Practice typing and improve your skills!',
        handler: handlePlayTyping,
      });
    } else if (game === 'reading') {
      availableGames.push({
        id: 'reading',
        name: 'Reading Exercise',
        icon: '📚',
        color: '#4facfe',
        description: 'Read stories and answer questions!',
        handler: handlePlayReading,
      });
    } else if (game === 'tracing') {
      availableGames.push({
        id: 'tracing',
        name: 'Letter Tracing',
        icon: '✏️',
        color: '#43e97b',
        description: 'Trace letters and learn writing!',
        handler: handlePlayTracing,
      });
    }
  });

  return (
    <Container>
      <Card>
        <Header>
          <WelcomeSection>
            <WelcomeTitle>Welcome back, {childData.username}! 👋</WelcomeTitle>
            <WelcomeSubtitle>Choose a game to start playing and learning!</WelcomeSubtitle>
          </WelcomeSection>
          <LogoutButton onClick={handleLogout}>Logout</LogoutButton>
        </Header>

        {error && <ErrorMessage>{error}</ErrorMessage>}

        {availableGames.length === 0 ? (
          <EmptyState>
            <EmptyIcon>🎮</EmptyIcon>
            <EmptyTitle>No Games Available</EmptyTitle>
            <EmptyMessage>
              Your therapist hasn't assigned any games yet. Please check back later!
            </EmptyMessage>
          </EmptyState>
        ) : (
          <>
            <GamesSection>
              <SectionTitle>🎮 Your Games</SectionTitle>
              <GamesGrid>
                {availableGames.map((game) => (
                  <GameCard
                    key={game.id}
                    onClick={game.handler}
                    color={game.color}
                  >
                    <GameIcon>{game.icon}</GameIcon>
                    <GameName>{game.name}</GameName>
                    <GameDescription>{game.description}</GameDescription>
                    <PlayButton>Play Now →</PlayButton>
                  </GameCard>
                ))}
              </GamesGrid>
            </GamesSection>
          </>
        )}
      </Card>
    </Container>
  );
};

const Container = styled.div`
  min-height: 100vh;
  padding: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
`;

const Card = styled.div`
  background: white;
  border-radius: 24px;
  padding: 40px;
  max-width: 1000px;
  width: 100%;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
`;

const LoadingCard = styled.div`
  background: white;
  border-radius: 24px;
  padding: 60px 40px;
  text-align: center;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
`;

const LoadingSpinner = styled.div`
  font-size: 64px;
  margin-bottom: 20px;
  animation: bounce 2s ease-in-out infinite;
  
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-20px); }
  }
`;

const LoadingText = styled.div`
  font-size: 18px;
  color: #666;
  font-weight: 600;
`;

const Header = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 32px;
  padding-bottom: 24px;
  border-bottom: 2px dashed #e0e0e0;
  
  @media (max-width: 768px) {
    flex-direction: column;
    gap: 16px;
  }
`;

const WelcomeSection = styled.div`
  flex: 1;
`;

const WelcomeTitle = styled.h1`
  font-size: 32px;
  font-weight: 700;
  color: #333;
  margin: 0 0 8px 0;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const WelcomeSubtitle = styled.p`
  font-size: 16px;
  color: #666;
  margin: 0;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const LogoutButton = styled.button`
  padding: 10px 20px;
  background: #ff4444;
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    background: #cc0000;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(255, 68, 68, 0.4);
  }
`;

const ErrorMessage = styled.div`
  background: #fff3cd;
  border: 2px solid #ffc107;
  color: #856404;
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 24px;
  text-align: center;
  font-weight: 600;
`;

const GamesSection = styled.div`
  margin-bottom: 32px;
`;

const SectionTitle = styled.h2`
  font-size: 24px;
  font-weight: 700;
  color: #333;
  margin: 0 0 20px 0;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const GamesGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 24px;
  
  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const GameCard = styled.div<{ color: string }>`
  background: white;
  border: 3px solid ${props => props.color};
  border-radius: 16px;
  padding: 24px;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  
  &:hover {
    transform: translateY(-8px);
    box-shadow: 0 8px 24px ${props => props.color}40;
    border-color: ${props => props.color};
  }
`;

const GameIcon = styled.div`
  font-size: 48px;
  text-align: center;
  margin-bottom: 12px;
`;

const GameName = styled.h3`
  font-size: 20px;
  font-weight: 700;
  color: #333;
  margin: 0 0 8px 0;
  text-align: center;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const GameDescription = styled.p`
  font-size: 14px;
  color: #666;
  margin: 0 0 16px 0;
  text-align: center;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const PlayButton = styled.div`
  text-align: center;
  padding: 10px 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-radius: 8px;
  font-weight: 600;
  font-size: 14px;
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 60px 20px;
`;

const EmptyIcon = styled.div`
  font-size: 80px;
  margin-bottom: 24px;
`;

const EmptyTitle = styled.h2`
  font-size: 24px;
  color: #666;
  margin: 0 0 12px 0;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const EmptyMessage = styled.p`
  font-size: 16px;
  color: #999;
  margin: 0 0 24px 0;
  line-height: 1.6;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const BackButton = styled.button`
  padding: 12px 24px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  
  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
  }
`;

export default ChildDashboard;

