import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

const TOTAL_WORDS = 10; // Total words to practice

const TypingGame: React.FC = () => {
  const [currentWord, setCurrentWord] = useState('');
  const [input, setInput] = useState('');
  const [results, setResults] = useState<Array<{ word: string; input: string; correct: boolean }>>([]);
  const [wordCount, setWordCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const [childData, setChildData] = useState<{ username: string; therapistCode: string; sessionId: string } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isGeneratingWord, setIsGeneratingWord] = useState(false);
  const [analysis, setAnalysis] = useState<{
    problematicLetters: string[];
    confusionPatterns: Array<{ confuses: string; with: string }>;
  } | null>(null);
  const [savingOnClose, setSavingOnClose] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem('childData');
    if (!stored) {
      navigate('/child-login');
      return;
    }
    try {
      const parsed = JSON.parse(stored);
      setChildData(parsed);

      // Check if child's preferred game is typing
      const pref = sessionStorage.getItem(`selectedGame_${parsed.username}`) || sessionStorage.getItem('selectedGame');
      if (pref === 'puzzles') {
        navigate('/child-dashboard');
        return;
      }

      // Generate first word
      generateInitialWord(parsed);
    } catch (err) {
      navigate('/child-login');
    }
  }, [navigate]);

  const generateInitialWord = async (data: { username: string; therapistCode: string; sessionId: string }) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('http://localhost:5000/api/typing/generate-initial-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: data.sessionId,
          username: data.username,
          therapistCode: data.therapistCode
        })
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        setCurrentWord(result.word);
        setLoading(false);
      } else {
        throw new Error(result.error || 'Failed to generate word');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
      setLoading(false);
    }
  };

  const generateNextWord = async () => {
    if (!childData) return;
    
    setIsGeneratingWord(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:5000/api/typing/generate-next-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: childData.sessionId,
          username: childData.username,
          therapistCode: childData.therapistCode,
          typingHistory: results
        })
      });

      const result = await response.json();
      
      if (response.ok && result.success) {
        setCurrentWord(result.word);
        setIsGeneratingWord(false);
      } else {
        throw new Error(result.error || 'Failed to generate word');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
      setIsGeneratingWord(false);
      // Fallback to a simple word if AI fails
      const fallbackWords = ['cat', 'dog', 'sun', 'tree', 'book'];
      setCurrentWord(fallbackWords[Math.floor(Math.random() * fallbackWords.length)]);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!currentWord || input.trim() === '') return;

    const correct = input.trim().toLowerCase() === currentWord.toLowerCase();
    const entry = { word: currentWord, input: input.trim(), correct };
    
    const newResults = [...results, entry];
    setResults(newResults);
    setInput('');
    setWordCount(wordCount + 1);

    // Show feedback
    if (correct) {
      setMessage('🎉 Excellent! Great job! 🎉');
    } else {
      setMessage(`💪 Keep trying! The word was: ${currentWord}`);
    }

    // Clear feedback after 1.5 seconds
    setTimeout(() => setMessage(null), 1500);

    // Check if we've reached the total word count
    if (wordCount + 1 >= TOTAL_WORDS) {
      // Save all results and finish
      await saveResults(newResults);
    } else {
      // Generate next word after a brief delay
      setTimeout(() => {
        generateNextWord();
      }, 1600);
    }
  };

  const saveResults = async (finalResults: Array<{ word: string; input: string; correct: boolean }>) => {
    if (!childData) return;
    
    setLoading(true);
    try {
      const payload = {
        therapistCode: childData.therapistCode,
        username: childData.username,
        sessionId: childData.sessionId,
        results: finalResults
      };
      
      const resp = await fetch('http://localhost:5000/api/save-typing-results', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      
      const data = await resp.json();
      
      if (resp.ok) {
        setMessage('🎉 Typing game completed! Results saved.');
        
        // Store AI analysis for display
        if (data.autoAnalysis) {
          setAnalysis(data.autoAnalysis);
          console.log('AI Analysis:', data.autoAnalysis);
        }
        
        // Mark typing game as completed
        try {
          await fetch('http://localhost:5000/api/mark-game-completed', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              therapistCode: childData.therapistCode,
              username: childData.username,
              game: 'typing'
            })
          });
        } catch (err) {
          console.error('Failed to mark game as completed:', err);
        }
        
        setTimeout(() => {
          navigate('/child-dashboard');
        }, 2000);
      } else {
        setMessage(data.error || 'Failed to save results');
        setLoading(false);
      }
    } catch (err: any) {
      setMessage('Network error while saving results');
      setLoading(false);
    }
  };

  if (!childData) return <Container>Loading...</Container>;

  if (loading && wordCount === 0) {
    return (
      <Container>
        <Card>
          <LoadingSpinner>🔄</LoadingSpinner>
          <LoadingText>Preparing your first word...</LoadingText>
        </Card>
      </Container>
    );
  }

  return (
    <Container>
      <Card>
        <CloseButton
          title="Exit and save"
          aria-label="Exit and save"
          onClick={async () => {
            // If there are results, save them, otherwise just go home
            if (savingOnClose) return;
            setSavingOnClose(true);
            try {
              if (results && results.length > 0 && childData) {
                await fetch('http://localhost:5000/api/save-typing-results', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    therapistCode: childData.therapistCode,
                    username: childData.username,
                    sessionId: childData.sessionId,
                    results
                  })
                });
              }
            } catch (err) {
              console.error('Failed to save on close', err);
            } finally {
              setSavingOnClose(false);
              navigate('/child-dashboard');
            }
          }}
        >
          ×
        </CloseButton>
        <Header>
          <Title>⌨️ Typing Challenge!</Title>
        </Header>

        {error && <ErrorMessage>⚠️ {error}</ErrorMessage>}

        <ProgressSection>
          <ProgressLabel>Your Progress</ProgressLabel>
          <ProgressBar>
            <ProgressFill progress={(wordCount / TOTAL_WORDS) * 100} />
            <ProgressNumber>{wordCount}/{TOTAL_WORDS}</ProgressNumber>
          </ProgressBar>
        </ProgressSection>

        {isGeneratingWord ? (
          <WordBox>
            <LoadingSpinner>🔄</LoadingSpinner>
            <SmallLoadingText>Loading next word...</SmallLoadingText>
          </WordBox>
        ) : (
          <>
            <WordDisplaySection>
              <WordLabel>📝 Word to Type:</WordLabel>
              <WordBox>{currentWord}</WordBox>
            </WordDisplaySection>
            <Form onSubmit={handleSubmit}>
              <InputSection>
                <InputLabel>✏️ Type Here:</InputLabel>
                <TextInput
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Start typing..."
                  autoFocus
                  disabled={loading || isGeneratingWord}
                  correct={input.trim().toLowerCase() === currentWord.toLowerCase() && input.trim() !== ''}
                />
                {input.trim() !== '' && (
                  <InputHint>
                    {input.trim().toLowerCase() === currentWord.toLowerCase() 
                      ? '✓ Perfect! Click the button to submit!' 
                      : input.trim().length === currentWord.length 
                        ? 'Check your spelling!' 
                        : `Keep going! ${currentWord.length - input.trim().length} letter${currentWord.length - input.trim().length !== 1 ? 's' : ''} left`}
                  </InputHint>
                )}
              </InputSection>
              <SubmitButton 
                type="submit" 
                disabled={loading || isGeneratingWord || input.trim() === ''}
              >
                🚀 Try It!
              </SubmitButton>
            </Form>
          </>
        )}

        {message && (
          <FeedbackMessage correct={message.includes('🎉')}>
            {message}
          </FeedbackMessage>
        )}

        {results.length > 0 && (
          <ResultsSection>
            <ResultsTitle>⭐ Your Amazing Results:</ResultsTitle>
            
            {analysis?.problematicLetters && analysis.problematicLetters.length > 0 && (
              <ProblemLetters>
                Most affected letters: {analysis.problematicLetters.join(', ')}
              </ProblemLetters>
            )}

            <ResultsList>
              {results.slice(-5).reverse().map((r, idx) => (
                <ResultItem key={idx} correct={r.correct}>
                  <span>{r.correct ? '✓' : '✗'}</span>
                  <span>{r.word}</span>
                  <span className="typed">→ {r.input}</span>
                </ResultItem>
              ))}
            </ResultsList>
          </ResultsSection>
        )}
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
  background: linear-gradient(135deg, #fff8f0 0%, #ffeaa7 30%, #ffe5cc 70%, #fff8f0 100%);
  padding: 20px;
  position: relative;
  overflow: hidden;
`;

const Card = styled.div`
  background: #fffef9;
  padding: 28px 24px;
  border-radius: 20px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08), 
              0 2px 8px rgba(0, 0, 0, 0.04);
  width: 100%;
  max-width: 600px;
  text-align: center;
  position: relative;
  border: 2px solid rgba(255, 228, 181, 0.5);
`;

const Header = styled.div`
  margin-bottom: 24px;
`;

const Title = styled.h2`
  margin: 0 0 8px 0;
  font-size: 24px;
  color: #2c3e50;
  font-weight: 700;
  letter-spacing: 0.3px;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const Subtitle = styled.p`
  color: #34495e;
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const ProgressSection = styled.div`
  margin-bottom: 24px;
`;

const ProgressLabel = styled.div`
  font-size: 14px;
  color: #2c3e50;
  font-weight: 600;
  margin-bottom: 8px;
  text-align: left;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const ProgressBar = styled.div`
  width: 100%;
  height: 20px;
  background: #f5f5f5;
  border-radius: 12px;
  overflow: hidden;
  position: relative;
  border: 1px solid #e0e0e0;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.05);
`;

const ProgressFill = styled.div<{ progress: number }>`
  height: 100%;
  background: linear-gradient(90deg, #ffd54f 0%, #ffb74d 100%);
  width: ${props => props.progress}%;
  transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
`;

const ProgressNumber = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 12px;
  font-weight: 700;
  color: #2c3e50;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
  z-index: 2;
`;

const WordDisplaySection = styled.div`
  margin: 24px 0;
`;

const WordLabel = styled.div`
  font-size: 14px;
  color: #34495e;
  font-weight: 600;
  margin-bottom: 10px;
  text-align: center;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const WordBox = styled.div`
  font-size: 32px;
  font-weight: 700;
  padding: 24px 20px;
  margin: 0;
  background: #fffef9;
  color: #1a237e;
  border-radius: 12px;
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
  letter-spacing: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08),
              inset 0 1px 2px rgba(0, 0, 0, 0.05);
  border: 2px solid #ffd54f;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 16px;
  justify-content: center;
  align-items: center;
  margin-bottom: 24px;
`;

const InputSection = styled.div`
  width: 100%;
  max-width: 450px;
`;

const InputLabel = styled.div`
  font-size: 14px;
  color: #34495e;
  font-weight: 600;
  margin-bottom: 8px;
  text-align: left;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const TextInput = styled.input<{ correct?: boolean }>`
  padding: 14px 18px;
  border: 2px solid ${props => props.correct ? '#4caf50' : '#d0d0d0'};
  border-radius: 10px;
  width: 100%;
  font-size: 18px;
  font-weight: 500;
  text-align: center;
  color: #1a237e;
  letter-spacing: 2px;
  transition: all 0.3s ease;
  background: #ffffff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05),
              inset 0 1px 2px rgba(0, 0, 0, 0.03);
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;

  &:focus {
    outline: none;
    border-color: ${props => props.correct ? '#4caf50' : '#3498db'};
    box-shadow: 0 4px 8px rgba(52, 152, 219, 0.2),
                inset 0 1px 2px rgba(0, 0, 0, 0.03),
                0 0 0 3px ${props => props.correct ? 'rgba(76, 175, 80, 0.1)' : 'rgba(52, 152, 219, 0.1)'};
  }

  &:disabled {
    background: #f5f5f5;
    cursor: not-allowed;
    opacity: 0.6;
  }
  
  &::placeholder {
    color: #95a5a6;
    font-weight: 400;
    letter-spacing: 1px;
  }
`;

const InputHint = styled.div`
  margin-top: 6px;
  font-size: 12px;
  color: #7f8c8d;
  text-align: center;
  font-weight: 500;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
  min-height: 18px;
`;

const SubmitButton = styled.button`
  padding: 12px 32px;
  background: #27ae60;
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 2px 6px rgba(39, 174, 96, 0.3);
  letter-spacing: 0.5px;
  min-width: 140px;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;

  &:hover:not(:disabled) {
    transform: translateY(-4px) scale(1.05);
    box-shadow: 0 12px 35px rgba(255, 107, 157, 0.6),
                0 6px 15px rgba(0, 0, 0, 0.15);
  }

  &:active:not(:disabled) {
    transform: translateY(-2px) scale(1.02);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const FeedbackMessage = styled.div<{ correct: boolean }>`
  padding: 12px 18px;
  margin: 14px 0;
  border-radius: 10px;
  font-weight: 600;
  font-size: 15px;
  background: ${props => props.correct 
    ? '#d4edda' 
    : '#fff3cd'};
  color: ${props => props.correct ? '#155724' : '#856404'};
  border: 2px solid ${props => props.correct ? '#28a745' : '#ffc107'};
  animation: bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;

  @keyframes bounceIn {
    0% {
      opacity: 0;
      transform: scale(0.3) translateY(-50px);
    }
    50% {
      opacity: 1;
      transform: scale(1.1) translateY(0);
    }
    70% {
      transform: scale(0.95);
    }
    100% {
      transform: scale(1);
    }
  }
`;

const LoadingSpinner = styled.div`
  font-size: 64px;
  animation: spin 1s linear infinite;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

const LoadingText = styled.p`
  color: #34495e;
  margin-top: 16px;
  font-size: 15px;
  font-weight: 600;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const SmallLoadingText = styled.p`
  color: #1a237e;
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const ErrorMessage = styled.div`
  background: #fff3cd;
  color: #856404;
  padding: 12px;
  border-radius: 10px;
  margin-bottom: 14px;
  font-size: 14px;
  font-weight: 600;
  border: 2px solid #ffc107;
  box-shadow: 0 2px 6px rgba(255, 193, 7, 0.2);
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const ResultsSection = styled.div`
  margin-top: 24px;
  padding-top: 18px;
  border-top: 2px dashed #ddd;
`;

const ResultsTitle = styled.h3`
  font-size: 16px;
  color: #2c3e50;
  margin: 0 0 12px 0;
  font-weight: 600;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const ProblemLetters = styled.div`
  font-size: 14px;
  color: #c0392b;
  margin-bottom: 10px;
  font-weight: 600;
  background: #ffebee;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid #ef5350;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const ResultsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const ResultItem = styled.div<{ correct: boolean }>`
  display: flex;
  gap: 12px;
  padding: 10px 14px;
  background: ${props => props.correct 
    ? '#e8f5e9' 
    : '#fff3e0'};
  border-radius: 8px;
  font-size: 14px;
  text-align: left;
  border: 1px solid ${props => props.correct ? '#4caf50' : '#ff9800'};
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  margin-bottom: 8px;
  font-weight: 500;
  transition: transform 0.2s;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;

  &:hover {
    transform: translateX(2px);
  }

  span:first-child {
    font-weight: 700;
    font-size: 16px;
    color: ${props => props.correct ? '#2e7d32' : '#e65100'};
  }

  span:nth-child(2) {
    font-weight: 600;
    min-width: 80px;
    color: #2c3e50;
    font-size: 15px;
  }

  .typed {
    color: #7f8c8d;
    font-style: italic;
    font-size: 14px;
  }
`;

const InfoBox = styled.div`
  background: #e3f2fd;
  color: #1a237e;
  padding: 12px;
  border-radius: 10px;
  font-size: 13px;
  margin-top: 20px;
  line-height: 1.5;
  font-weight: 500;
  border: 1px solid #64b5f6;
  box-shadow: 0 2px 4px rgba(33, 150, 243, 0.1);
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 16px;
  right: 16px;
  background: linear-gradient(135deg, #ff6b6b, #ee5a6f);
  color: white;
  border: none;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  cursor: pointer;
  font-size: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 18px rgba(255, 107, 157, 0.4);
  transition: all 0.3s ease;
  font-weight: 900;
  border: 3px solid rgba(255, 255, 255, 0.5);

  &:hover { 
    transform: translateY(-3px) rotate(90deg) scale(1.1); 
    box-shadow: 0 10px 26px rgba(255, 107, 157, 0.6);
  }
  
  &:active {
    transform: translateY(-1px) rotate(90deg) scale(1.05);
  }
`;

export default TypingGame;
