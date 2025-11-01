import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import styled from 'styled-components';

interface Question {
  question: string;
  options: string[];
  correctAnswer: number;
}

const Questions: React.FC = () => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: number }>({});
  const [answeredQuestions, setAnsweredQuestions] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [storyTitle, setStoryTitle] = useState<string>('');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const childData = sessionStorage.getItem('childData');
    if (!childData) {
      navigate('/child-login');
      return;
    }

    const title = searchParams.get('storyTitle') || '';
    setStoryTitle(title);

    if (!title) {
      setLoading(false);
      return;
    }

    // Fetch questions for this story
    (async () => {
      try {
        const resp = await fetch(`http://localhost:5000/api/questions/${encodeURIComponent(title)}`);
        const data = await resp.json();
        if (resp.ok && data.success) {
          setQuestions(data.questions || []);
        } else {
          console.error('Failed to fetch questions:', data.error);
        }
      } catch (err) {
        console.error('Failed to fetch questions', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate, searchParams]);

  const handleAnswerSelect = (questionIndex: number, answerIndex: number) => {
    // Allow changing answers, but mark question as answered for feedback
    setSelectedAnswers({ ...selectedAnswers, [questionIndex]: answerIndex });
    setAnsweredQuestions(new Set([...answeredQuestions, questionIndex]));
  };

  const handleBack = () => {
    navigate('/child-dashboard');
  };

  if (loading) {
    return (
      <Container>
        <LoadingCard>
          <LoadingSpinner>📝</LoadingSpinner>
          <LoadingText>Loading questions...</LoadingText>
        </LoadingCard>
      </Container>
    );
  }

  if (questions.length === 0) {
    return (
      <Container>
        <Card>
          <EmptyState>
            <EmptyIcon>❓</EmptyIcon>
            <EmptyTitle>No Questions Found</EmptyTitle>
            <EmptyMessage>Questions for this story are not available yet.</EmptyMessage>
            <BackButton onClick={handleBack}>← Go Back</BackButton>
          </EmptyState>
        </Card>
      </Container>
    );
  }

  return (
    <Container>
      <Card>
        <Header>
          <Title>📚 Questions About Your Story</Title>
          {storyTitle && <StoryTitle>{storyTitle}</StoryTitle>}
        </Header>

        <QuestionsContainer>
          {questions.map((q, questionIndex) => {
            const hasAnswered = answeredQuestions.has(questionIndex);
            const isCorrect = hasAnswered && selectedAnswers[questionIndex] === q.correctAnswer;

            return (
              <QuestionCard key={questionIndex}>
                <QuestionNumber>Question {questionIndex + 1} of {questions.length}</QuestionNumber>
                <QuestionText>{q.question}</QuestionText>
                
                <OptionsContainer>
                  {q.options.map((option, optionIndex) => {
                    const isSelected = selectedAnswers[questionIndex] === optionIndex;
                    const isCorrectAnswer = optionIndex === q.correctAnswer;
                    let circleContent = '';
                    
                    if (hasAnswered) {
                      if (isCorrectAnswer) {
                        circleContent = '✓';
                      } else if (isSelected && !isCorrectAnswer) {
                        circleContent = '✗';
                      }
                    } else if (isSelected) {
                      circleContent = '●';
                    }

                    return (
                      <OptionButton
                        key={optionIndex}
                        onClick={() => handleAnswerSelect(questionIndex, optionIndex)}
                        disabled={hasAnswered}
                        isSelected={isSelected}
                        isCorrect={hasAnswered && isCorrectAnswer}
                        isWrong={hasAnswered && isSelected && !isCorrectAnswer}
                      >
                        <OptionCircle 
                          selected={isSelected || (hasAnswered && isCorrectAnswer)}
                          isCorrect={hasAnswered && isCorrectAnswer}
                          isWrong={hasAnswered && isSelected && !isCorrectAnswer}
                        >
                          {circleContent}
                        </OptionCircle>
                        <OptionText>{option}</OptionText>
                      </OptionButton>
                    );
                  })}
                </OptionsContainer>

                {hasAnswered && (
                  <ResultMessage correct={isCorrect}>
                    {isCorrect 
                      ? '🎉 Correct! Great job!' 
                      : `❌ Wrong! The correct answer is: "${q.options[q.correctAnswer]}"`}
                  </ResultMessage>
                )}
              </QuestionCard>
            );
          })}
        </QuestionsContainer>

        {Object.keys(selectedAnswers).length === questions.length && (
          <BackButton onClick={handleBack} style={{ width: '100%', marginTop: '24px' }}>
            ← Go Back Home
          </BackButton>
        )}
      </Card>
    </Container>
  );
};

const Container = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 20px;
  background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
`;

const Card = styled.div`
  background: white;
  border-radius: 20px;
  padding: 32px;
  max-width: 800px;
  width: 100%;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
`;

const LoadingCard = styled.div`
  background: white;
  border-radius: 20px;
  padding: 60px;
  text-align: center;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
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
  text-align: center;
  margin-bottom: 32px;
  padding-bottom: 20px;
  border-bottom: 3px dashed #e0e0e0;
`;

const Title = styled.h1`
  font-size: 32px;
  font-weight: 700;
  color: #5c6bc0;
  margin: 0 0 12px 0;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const StoryTitle = styled.div`
  font-size: 18px;
  color: #7e8cc1;
  font-weight: 600;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const QuestionsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 24px;
  margin-bottom: 32px;
`;

const QuestionCard = styled.div`
  background: #f9f9f9;
  border-radius: 16px;
  padding: 24px;
  border: 2px solid #e8eaf6;
`;

const QuestionNumber = styled.div`
  font-size: 14px;
  color: #7e57c2;
  font-weight: 600;
  margin-bottom: 12px;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const QuestionText = styled.div`
  font-size: 18px;
  color: #333;
  font-weight: 600;
  margin-bottom: 20px;
  line-height: 1.6;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const OptionsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const OptionButton = styled.button<{ isSelected?: boolean; isCorrect?: boolean; isWrong?: boolean }>`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: ${props => {
    if (props.isCorrect) return '#c8e6c9';
    if (props.isWrong) return '#ffcdd2';
    if (props.isSelected) return '#e3f2fd';
    return 'white';
  }};
  border: 2px solid ${props => {
    if (props.isCorrect) return '#4caf50';
    if (props.isWrong) return '#f44336';
    if (props.isSelected) return '#2196f3';
    return '#e0e0e0';
  }};
  border-radius: 12px;
  cursor: ${props => props.disabled ? 'not-allowed' : 'pointer'};
  font-size: 16px;
  text-align: left;
  transition: all 0.2s ease;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
  width: 100%;
  color: ${props => {
    if (props.isCorrect) return '#2e7d32';
    if (props.isWrong) return '#c62828';
    if (props.isSelected) return '#1565c0';
    return '#333';
  }};
  font-weight: ${props => props.isSelected || props.isCorrect ? '600' : '400'};
  
  &:hover:not(:disabled) {
    transform: translateX(4px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    border-color: ${props => props.isSelected ? '#1976d2' : '#2196f3'};
  }
  
  &:disabled {
    opacity: ${props => props.isCorrect || props.isWrong ? '1' : '0.6'};
    cursor: ${props => props.isCorrect || props.isWrong ? 'default' : 'not-allowed'};
  }
`;

const OptionCircle = styled.div<{ selected: boolean; isCorrect?: boolean; isWrong?: boolean }>`
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid ${props => {
    if (props.isCorrect) return '#4caf50';
    if (props.isWrong) return '#f44336';
    if (props.selected) return '#2196f3';
    return '#ccc';
  }};
  background: ${props => {
    if (props.isCorrect) return '#4caf50';
    if (props.isWrong) return '#f44336';
    if (props.selected) return '#2196f3';
    return 'white';
  }};
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  flex-shrink: 0;
  font-size: 16px;
`;

const OptionText = styled.span`
  flex: 1;
  line-height: 1.5;
`;

const ResultMessage = styled.div<{ correct: boolean }>`
  margin-top: 12px;
  padding: 10px;
  background: ${props => props.correct ? '#e8f5e9' : '#fff3e0'};
  border-radius: 8px;
  color: ${props => props.correct ? '#2e7d32' : '#e65100'};
  font-weight: 600;
  font-size: 14px;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

const BackButton = styled.button`
  padding: 12px 24px;
  background: white;
  color: #5c6bc0;
  border: 2px solid #5c6bc0;
  border-radius: 12px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
  
  &:hover {
    background: #5c6bc0;
    color: white;
    transform: translateY(-2px);
  }
`;

const EmptyState = styled.div`
  text-align: center;
  padding: 40px 20px;
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
  font-family: 'OpenDyslexic', 'Lexend', 'Comic Neue', 'Comic Sans MS', cursive, sans-serif;
`;

export default Questions;

