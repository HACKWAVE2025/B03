import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import styled from 'styled-components';

const ReadingExercise: React.FC = () => {
  const [story, setStory] = useState<{ _id: string; title: string; author?: string; story?: string; moral?: string; image?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [recording, setRecording] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [highlightedWordIndex, setHighlightedWordIndex] = useState<number | null>(null);
  const [lineSpacing, setLineSpacing] = useState<number>(1.8); // Default line-height
  const [wordSpacing, setWordSpacing] = useState<number>(0.3); // Default letter-spacing
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const childData = sessionStorage.getItem('childData');
    if (!childData) {
      navigate('/child-login');
      return;
    }
    const parsed = JSON.parse(childData);
    const preferredStory = parsed.preferredStory || null;
    if (!preferredStory) {
      setLoading(false);
      return;
    }
    // fetch story by id
    (async () => {
      try {
        const resp = await fetch(`http://localhost:5000/api/stories/${preferredStory}`);
        const data = await resp.json();
        if (resp.ok && data.success) setStory(data.story || null);
      } catch (err) {
        console.error('Failed to fetch story', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Configure MediaRecorder for compressed audio
      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 32000 // Lower bitrate for smaller file size
      });
      audioChunksRef.current = [];
      mediaRecorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };
      mediaRecorderRef.current.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        const url = URL.createObjectURL(blob);
        setAudioUrl(url);
      };
      // Record in smaller chunks
      mediaRecorderRef.current.start(1000); // Record in 1-second chunks
      setRecording(true);
    } catch (err) {
      console.error('Recording not allowed', err);
      setMessage('⚠️ Please allow microphone access to record your reading!');
      setTimeout(() => setMessage(null), 4000);
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current) return;
    mediaRecorderRef.current.stop();
    setRecording(false);
  };

  const saveRecording = async () => {
    if (!audioChunksRef.current.length) return;
    // Combine chunks and create optimized blob
    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
    
    // Compress audio data before sending
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = (reader.result as string).split(',')[1];
      const childData = JSON.parse(sessionStorage.getItem('childData') || '{}');
      try {
        const response = await fetch('http://localhost:5000/api/save-reading-audio', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            therapistCode: childData.therapistCode,
            username: childData.username,
            sessionId: childData.sessionId,
            storyId: story?._id,
            audioData: base64,
          })
        });
        
        if (!response.ok) {
          console.error('Failed to save recording:', await response.text());
          return;
        }
        
        const result = await response.json();
        if (result.success) {
          // Show success message briefly before navigating to questions
          setMessage('🎉 Amazing! Your recording has been saved!');
          
          // Mark reading game as completed
          try {
            await fetch('http://localhost:5000/api/mark-game-completed', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                therapistCode: childData.therapistCode,
                username: childData.username,
                game: 'reading'
              })
            });
          } catch (err) {
            console.error('Failed to mark reading game as completed:', err);
          }
          
          setTimeout(() => {
          try { sessionStorage.setItem('skipAutoNav', '1'); } catch (e) {}
            navigate(`/questions?storyTitle=${encodeURIComponent(story?.title || '')}`);
          }, 2000);
        } else {
          console.error('Failed to save recording:', result.error);
          setMessage('❌ Oops! Something went wrong. Please try again.');
        }
      } catch (err) {
        console.error('Failed to save recording', err);
      }
    };
    reader.readAsDataURL(blob);
  };

  // Get the background image URL from the story
  // story.image is like "images/lion_rabbit.jpeg", so we use it directly as a public path
  // Check if story exists and has a valid image field
  const backgroundImage = story && story.image && story.image.trim() !== ''
    ? `/${story.image}` 
    : '/images/waves-flowers-bg.jpg';
  
  // Split story text into words for clickable functionality
  const splitIntoWords = (text: string) => {
    // Split by spaces, preserving both words and spaces
    const words: Array<{ word: string; isSpace: boolean; index: number }> = [];
    const tokens = text.split(/(\s+)/);
    let wordIndex = 0;
    
    tokens.forEach(token => {
      const trimmed = token.trim();
      if (trimmed.length === 0) {
        // This is whitespace (spaces, newlines)
        words.push({ word: token, isSpace: true, index: -1 });
      } else {
        // This is a word (may include punctuation)
        words.push({ word: token, isSpace: false, index: wordIndex++ });
      }
    });
    
    return words;
  };

  // Spell out word using text-to-speech
  const spellWord = (word: string) => {
    // Remove punctuation for spelling
    const cleanWord = word.replace(/[.,!?;:'"]/g, '');
    if (!cleanWord) return;

    // Cancel any ongoing speech
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel();
    }

    // Spell out the word letter by letter
    const letters = cleanWord.split('');
    let currentIndex = 0;

    const speakNextLetter = () => {
      if (currentIndex < letters.length) {
        const utterance = new SpeechSynthesisUtterance(letters[currentIndex].toUpperCase());
        utterance.lang = 'en-US';
        utterance.rate = 4.5; // Maximum fast rate for natural human-like spelling
        utterance.volume = 1.0; // Maximum volume for clear hearing
        utterance.onend = () => {
          currentIndex++;
          if (currentIndex < letters.length) {
            // No delay - start immediately for seamless flow
            speakNextLetter();
          } else {
            // After spelling, say the whole word immediately
            const wordUtterance = new SpeechSynthesisUtterance(cleanWord);
            wordUtterance.lang = 'en-US';
            wordUtterance.rate = 1.8;
            wordUtterance.volume = 1.0; // Maximum volume for clear hearing
            window.speechSynthesis.speak(wordUtterance);
          }
        };
        window.speechSynthesis.speak(utterance);
      }
    };

    speakNextLetter();
  };

  // Handle word click
  const handleWordClick = (word: string, index: number) => {
    // Highlight the word
    setHighlightedWordIndex(index);
    // Remove highlight after 2 seconds
    setTimeout(() => setHighlightedWordIndex(null), 2000);
    // Spell out the word
    spellWord(word);
  };

  // Debug: log the story and background image
  if (story) {
    console.log('Story data:', story);
    console.log('Story image field:', story.image);
    console.log('Background image path:', backgroundImage);
  }

  if (loading) {
    return (
      <Container backgroundImage={backgroundImage}>
        <LoadingCard>
          <LoadingSpinner>📚</LoadingSpinner>
          <LoadingText>Loading your story...</LoadingText>
        </LoadingCard>
      </Container>
    );
  }

  if (!story) {
    return (
      <Container backgroundImage={backgroundImage}>
        <Card>
          <EmptyState>
            <EmptyIcon>📖</EmptyIcon>
            <EmptyTitle>No Story Selected</EmptyTitle>
            <EmptyMessage>Please ask your therapist to select a story for you!</EmptyMessage>
            <CancelButton onClick={() => navigate('/child-dashboard')}>← Go Back</CancelButton>
          </EmptyState>
        </Card>
      </Container>
    );
  }

  return (
    <Container backgroundImage={backgroundImage}>
      <Card>
        <CloseButton onClick={() => navigate('/child-dashboard')} title="Go back">
          ×
        </CloseButton>
        
        <Header>
          <Title>📚 {story.title}</Title>
          {story.author && story.author !== 'Unknown' && (
            <Author>by {story.author}</Author>
          )}
        </Header>

        <StorySection>
          <SectionHeader>
            <SectionIcon>📖</SectionIcon>
            <SectionTitle>Your Story</SectionTitle>
          </SectionHeader>
          
          <SpacingControls>
            <ControlLabel>⚙️ Adjust Reading Space</ControlLabel>
            <ControlGroup>
              <ControlItem>
                <ControlTitle>
                  <Icon>📏</Icon>
                  Line Space
                </ControlTitle>
                <SliderContainer>
                  <BarVisualizer>
                    <BarLine style={{ height: `${(lineSpacing - 1) * 15 + 10}px` }} />
                    <BarLine style={{ height: `${(lineSpacing - 1) * 15 + 10}px` }} />
                    <BarLine style={{ height: `${(lineSpacing - 1) * 15 + 10}px` }} />
                  </BarVisualizer>
                  <Slider
                    type="range"
                    min="1.2"
                    max="3.0"
                    step="0.1"
                    value={lineSpacing}
                    onChange={(e) => setLineSpacing(parseFloat(e.target.value))}
                  />
                  <ValueDisplay>{lineSpacing.toFixed(1)}</ValueDisplay>
                </SliderContainer>
              </ControlItem>
              
              <ControlItem>
                <ControlTitle>
                  <Icon>↔️</Icon>
                  Word Space
                </ControlTitle>
                <SliderContainer>
                  <WordBarVisualizer>
                    <BarWord>W</BarWord>
                    <SpaceBar style={{ width: `${(wordSpacing + 0.1) * 20}px` }} />
                    <BarWord>W</BarWord>
                    <SpaceBar style={{ width: `${(wordSpacing + 0.1) * 20}px` }} />
                    <BarWord>W</BarWord>
                  </WordBarVisualizer>
                  <Slider
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.1"
                    value={wordSpacing}
                    onChange={(e) => setWordSpacing(parseFloat(e.target.value))}
                  />
                  <ValueDisplay>{wordSpacing.toFixed(1)}</ValueDisplay>
                </SliderContainer>
              </ControlItem>
            </ControlGroup>
          </SpacingControls>

          <StoryBox>
            <StoryTextContainer lineSpacing={lineSpacing} wordSpacing={wordSpacing}>
              {story.story && splitIntoWords(story.story).map((item, index) => {
                if (item.isSpace) {
                  return <span key={index} style={{ marginRight: `${wordSpacing * 0.3}em` }}>{item.word}</span>;
                }
                const isHighlighted = highlightedWordIndex === item.index;
                return (
                  <ClickableWord
                    key={index}
                    onClick={() => handleWordClick(item.word, item.index)}
                    highlighted={isHighlighted}
                    title="Click to hear this word spelled out"
                    wordSpacing={wordSpacing}
                  >
                    {item.word}
                  </ClickableWord>
                );
              })}
            </StoryTextContainer>
            <WordHint>💡 Tip: Click on any word to hear it spelled out!</WordHint>
          </StoryBox>
        </StorySection>

        <MoralSection>
          <SectionHeader>
            <SectionIcon>✨</SectionIcon>
            <SectionTitle>What We Learn</SectionTitle>
          </SectionHeader>
          <MoralBox>
            <MoralText>{story.moral}</MoralText>
          </MoralBox>
        </MoralSection>

        <RecordingSection>
          <RecordingHeader>🎙️ Ready to Read?</RecordingHeader>
          <RecordingInstructions>
            {recording 
              ? '🔴 Recording... Read the story out loud! When you\'re done, click Stop Recording.' 
              : audioUrl 
                ? 'Great job! Listen to your recording or save it.' 
                : 'Click the button below to start recording yourself reading this story!'}
          </RecordingInstructions>

        <Controls>
            {!recording && !audioUrl && (
              <RecordButton onClick={startRecording} variant="start">
                🎤 Start Recording
              </RecordButton>
            )}
            {recording && (
              <RecordButton onClick={stopRecording} variant="stop" animate>
                ⏹️ Stop Recording
              </RecordButton>
            )}
            {audioUrl && (
              <>
                <AudioPlayer controls src={audioUrl} />
                <RecordButton onClick={saveRecording} variant="save">
                  💾 Save My Recording
                </RecordButton>
              </>
            )}
            {!recording && <CancelButton onClick={() => navigate('/child-dashboard')}>← Go Back</CancelButton>}
        </Controls>
        </RecordingSection>
        
        {message && (
          <MessageBox>
            {message}
          </MessageBox>
        )}
      </Card>
    </Container>
  );
};

const Container = styled.div<{ backgroundImage?: string }>`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 20px;
  background-image: ${props => props.backgroundImage ? `url("${props.backgroundImage}")` : "url('/images/waves-flowers-bg.jpg')"};
  background-position: center center;
  background-repeat: no-repeat;
  background-attachment: fixed;
  background-size: cover;
  position: relative;
  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(255, 255, 255, 0.3);
    z-index: 0;
  }
`;

const Card = styled.div`
  width: 100%;
  max-width: 800px;
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 250, 250, 0.98) 100%);
  padding: 32px;
  border-radius: 24px;
  box-shadow: 0 25px 70px rgba(0, 0, 0, 0.2),
              0 10px 30px rgba(0, 0, 0, 0.1),
              inset 0 1px 0 rgba(255, 255, 255, 0.9);
  position: relative;
  z-index: 1;
  border: 3px solid rgba(255, 182, 193, 0.4);
  backdrop-filter: blur(20px);
`;

const LoadingCard = styled.div`
  background: linear-gradient(145deg, rgba(255, 255, 255, 0.98) 0%, rgba(255, 250, 250, 0.98) 100%);
  padding: 60px 40px;
  border-radius: 32px;
  box-shadow: 0 25px 70px rgba(0, 0, 0, 0.2);
  text-align: center;
  border: 4px solid rgba(255, 182, 193, 0.4);
`;

const LoadingSpinner = styled.div`
  font-size: 64px;
  animation: bounce 1.5s ease-in-out infinite;
  
  @keyframes bounce {
    0%, 100% { transform: translateY(0) scale(1); }
    50% { transform: translateY(-20px) scale(1.1); }
  }
`;

const LoadingText = styled.p`
  color: #ff6b9d;
  margin-top: 20px;
  font-size: 18px;
  font-weight: 600;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 20px;
  right: 20px;
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
  z-index: 10;

  &:hover { 
    transform: translateY(-3px) rotate(90deg) scale(1.1); 
    box-shadow: 0 10px 26px rgba(255, 107, 157, 0.6);
  }
`;

const Header = styled.div`
  text-align: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 3px dashed #ffb3d1;
`;

const Title = styled.h1`
  font-size: 28px;
  font-weight: 700;
  color: #ff6b9d;
  margin: 0 0 8px 0;
  text-shadow: 2px 2px 4px rgba(255, 107, 157, 0.2);
  letter-spacing: 0.5px;
  line-height: 1.3;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const Author = styled.p`
  font-size: 16px;
  color: #ff8fab;
  margin: 0;
  font-weight: 600;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const StorySection = styled.div`
  margin: 24px 0;
`;

const MoralSection = styled.div`
  margin: 24px 0;
`;

const SectionHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
`;

const SectionIcon = styled.span`
  font-size: 32px;
`;

const SectionTitle = styled.h3`
  font-size: 20px;
  font-weight: 700;
  color: #ff6b9d;
  margin: 0;
  text-shadow: 1px 1px 2px rgba(255, 107, 157, 0.2);
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const StoryBox = styled.div`
  max-height: 400px;
  overflow-y: auto;
  background: linear-gradient(145deg, #fff5f8, #ffffff);
  padding: 20px;
  border-radius: 16px;
  margin: 12px 0;
  border: 3px solid #ffb3d1;
  box-shadow: 0 8px 20px rgba(255, 107, 157, 0.15),
              inset 0 2px 4px rgba(255, 255, 255, 0.9);
  
  /* Custom scrollbar */
  &::-webkit-scrollbar {
    width: 12px;
  }
  
  &::-webkit-scrollbar-track {
    background: #ffe4e1;
    border-radius: 10px;
  }
  
  &::-webkit-scrollbar-thumb {
    background: linear-gradient(135deg, #ff9a9e, #fecfef);
    border-radius: 10px;
    border: 2px solid #ffe4e1;
  }
`;

const StoryTextContainer = styled.div<{ lineSpacing: number; wordSpacing: number }>`
  font-size: 18px;
  line-height: ${props => props.lineSpacing};
  color: #333;
  margin: 0;
  font-weight: 400;
  letter-spacing: ${props => props.wordSpacing}px;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
  display: inline;
`;

const ClickableWord = styled.span<{ highlighted: boolean; wordSpacing: number }>`
  cursor: pointer;
  padding: 2px 1px;
  margin: 0 ${props => props.wordSpacing * 0.15}em;
  border-radius: 4px;
  transition: all 0.2s ease;
  background: ${props => props.highlighted 
    ? 'linear-gradient(135deg, #fff59d, #ffd54f)' 
    : 'transparent'};
  color: ${props => props.highlighted ? '#e65100' : '#333'};
  font-weight: ${props => props.highlighted ? '700' : '400'};
  display: inline-block;
  position: relative;
  
  &:hover {
    background: ${props => props.highlighted 
      ? 'linear-gradient(135deg, #fff59d, #ffd54f)' 
      : 'rgba(255, 245, 157, 0.4)'};
    transform: ${props => props.highlighted ? 'scale(1.05)' : 'scale(1.02)'};
  }
  
  &:active {
    transform: scale(0.98);
  }
`;

const WordHint = styled.div`
  margin-top: 12px;
  padding: 8px 12px;
  background: #e8f5e9;
  border-radius: 8px;
  font-size: 13px;
  color: #2e7d32;
  font-weight: 600;
  text-align: center;
  border: 1px solid #81c784;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const MoralBox = styled.div`
  background: linear-gradient(135deg, #e3f2fd, #bbdefb);
  padding: 20px;
  border-radius: 16px;
  margin: 12px 0;
  border: 3px solid #64b5f6;
  box-shadow: 0 8px 20px rgba(33, 150, 243, 0.2),
              inset 0 2px 4px rgba(255, 255, 255, 0.9);
`;

const MoralText = styled.p`
  font-size: 18px;
  line-height: 1.6;
  color: #1565c0;
  margin: 0;
  font-weight: 600;
  text-align: center;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const RecordingSection = styled.div`
  margin-top: 28px;
  padding-top: 24px;
  border-top: 3px dashed #ffb3d1;
`;

const RecordingHeader = styled.h3`
  font-size: 22px;
  font-weight: 700;
  color: #ff6b9d;
  text-align: center;
  margin: 0 0 12px 0;
  text-shadow: 2px 2px 4px rgba(255, 107, 157, 0.2);
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const RecordingInstructions = styled.p`
  font-size: 16px;
  color: #666;
  text-align: center;
  margin: 0 0 20px 0;
  font-weight: 600;
  line-height: 1.6;
  background: linear-gradient(135deg, #fff3e0, #ffe0b2);
  padding: 16px;
  border-radius: 12px;
  border: 2px solid #ffcc02;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const Controls = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
  margin-top: 24px;
`;

const RecordButton = styled.button<{ variant: 'start' | 'stop' | 'save'; animate?: boolean }>`
  padding: 16px 32px;
  background: ${props => 
    props.variant === 'start' ? 'linear-gradient(135deg, #4caf50, #45a049)' :
    props.variant === 'stop' ? 'linear-gradient(135deg, #f44336, #d32f2f)' :
    'linear-gradient(135deg, #2196f3, #1976d2)'};
  color: white;
  border: none;
  border-radius: 16px;
  font-size: 18px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
  box-shadow: 0 8px 25px ${props => 
    props.variant === 'start' ? 'rgba(76, 175, 80, 0.4)' :
    props.variant === 'stop' ? 'rgba(244, 67, 54, 0.4)' :
    'rgba(33, 150, 243, 0.4)'},
              0 4px 10px rgba(0, 0, 0, 0.1);
  text-transform: uppercase;
  letter-spacing: 1px;
  min-width: 220px;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
  animation: ${props => props.animate ? 'pulse 1.5s ease-in-out infinite' : 'none'};
  
  @keyframes pulse {
    0%, 100% { 
      transform: scale(1);
      box-shadow: 0 8px 25px rgba(244, 67, 54, 0.4),
                  0 4px 10px rgba(0, 0, 0, 0.1);
    }
    50% { 
      transform: scale(1.05);
      box-shadow: 0 12px 35px rgba(244, 67, 54, 0.6),
                  0 6px 15px rgba(0, 0, 0, 0.15);
    }
  }

  &:hover:not(:disabled) {
    transform: translateY(-4px) scale(1.05);
    box-shadow: 0 12px 35px ${props => 
      props.variant === 'start' ? 'rgba(76, 175, 80, 0.6)' :
      props.variant === 'stop' ? 'rgba(244, 67, 54, 0.6)' :
      'rgba(33, 150, 243, 0.6)'},
                0 6px 15px rgba(0, 0, 0, 0.15);
  }

  &:active:not(:disabled) {
    transform: translateY(-2px) scale(1.02);
  }

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }
`;

const AudioPlayer = styled.audio`
  width: 100%;
  max-width: 400px;
  margin-bottom: 16px;
  border-radius: 12px;
  
  &::-webkit-media-controls-panel {
    background-color: #e3f2fd;
    border-radius: 12px;
  }
`;

const CancelButton = styled.button`
  background: linear-gradient(135deg, #9e9e9e, #757575);
  color: white;
  padding: 12px 24px;
  border-radius: 16px;
  border: none;
  cursor: pointer;
  font-size: 16px;
  font-weight: 600;
  transition: all 0.3s ease;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
  min-width: 160px;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;

  &:hover {
    transform: translateY(-2px) scale(1.05);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.3);
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px 20px;
`;

const EmptyIcon = styled.div`
  font-size: 80px;
  margin-bottom: 24px;
  animation: bounce 2s ease-in-out infinite;
  
  @keyframes bounce {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-15px); }
  }
`;

const EmptyTitle = styled.h2`
  font-size: 24px;
  font-weight: 700;
  color: #ff6b9d;
  margin: 0 0 12px 0;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const EmptyMessage = styled.p`
  font-size: 16px;
  color: #666;
  margin: 0 0 24px 0;
  line-height: 1.6;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const MessageBox = styled.div`
  margin-top: 20px;
  padding: 16px 24px;
  border-radius: 16px;
  font-weight: 700;
  font-size: 16px;
  background: linear-gradient(135deg, #d4edda, #c3e6cb);
  color: #155724;
  border: 3px solid #28a745;
  animation: bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55);
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
  text-align: center;
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

const SpacingControls = styled.div`
  background: #fef9f3;
  padding: 12px;
  border-radius: 10px;
  margin-bottom: 16px;
  border: 1px solid #ffe8d1;
  box-shadow: 0 1px 3px rgba(255, 232, 209, 0.3);
`;

const ControlLabel = styled.div`
  font-size: 16px;
  font-weight: 700;
  color: #8b7fa8;
  margin-bottom: 16px;
  text-align: center;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const ControlGroup = styled.div`
  display: flex;
  gap: 24px;
  justify-content: space-around;
  flex-wrap: wrap;

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 20px;
  }
`;

const ControlItem = styled.div`
  flex: 1;
  min-width: 200px;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const ControlTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: #9a8fb8;
  margin-bottom: 12px;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const Icon = styled.span`
  font-size: 20px;
`;

const SliderContainer = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
`;

const BarVisualizer = styled.div`
  display: flex;
  align-items: flex-end;
  justify-content: center;
  gap: 6px;
  height: 40px;
  width: 100%;
  background: #f0f8ff;
  border-radius: 6px;
  padding: 6px;
  border: 1px solid #d4e8ff;
`;

const BarLine = styled.div`
  width: 12px;
  background: #b8d4f0;
  border-radius: 3px 3px 0 0;
  min-height: 8px;
  transition: height 0.2s ease;
  box-shadow: 0 1px 2px rgba(184, 212, 240, 0.3);
`;

const WordBarVisualizer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0;
  height: 32px;
  width: 100%;
  background: #fff0f5;
  border-radius: 6px;
  padding: 6px;
  border: 1px solid #ffd4e8;
`;

const BarWord = styled.div`
  height: 24px;
  width: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffb3d9;
  border-radius: 4px;
  color: white;
  font-weight: 600;
  font-size: 14px;
  flex-shrink: 0;
  box-shadow: 0 1px 2px rgba(255, 179, 217, 0.3);
`;

const SpaceBar = styled.div`
  height: 6px;
  background: #ffb3d9;
  border-radius: 3px;
  min-width: 4px;
  transition: width 0.2s ease;
  box-shadow: 0 1px 2px rgba(255, 179, 217, 0.3);
  margin: 0 2px;
`;

const Slider = styled.input`
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: #e8d4ff;
  outline: none;
  -webkit-appearance: none;
  appearance: none;
  
  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #c4a8e8;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(196, 168, 232, 0.3);
    border: 2px solid white;
    transition: all 0.2s ease;
  }
  
  &::-webkit-slider-thumb:hover {
    background: #b896d9;
    transform: scale(1.1);
  }
  
  &::-moz-range-thumb {
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: #c4a8e8;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(196, 168, 232, 0.3);
    border: 2px solid white;
    transition: all 0.2s ease;
  }
  
  &::-moz-range-thumb:hover {
    background: #b896d9;
    transform: scale(1.1);
  }
`;

const ValueDisplay = styled.div`
  font-size: 16px;
  font-weight: 600;
  color: #8b7fa8;
  padding: 4px 12px;
  background: white;
  border-radius: 16px;
  border: 1px solid #e8d4ff;
  min-width: 50px;
  text-align: center;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
  box-shadow: 0 1px 3px rgba(232, 212, 255, 0.3);
`;

export default ReadingExercise;
