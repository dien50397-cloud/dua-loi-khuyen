import React, { useState, useCallback, useEffect, useRef } from 'react';
import Header from './components/Header';
import InputArea from './components/InputArea';
import ResponseDisplay from './components/ResponseDisplay';
import LoadingSpinner from './components/LoadingSpinner';
import { getStudyAdvice } from './services/geminiService';
import type { AdviceResponse } from './types';
import { FloralVine } from './components/decorations';
import ColorPicker from './components/ThemeSwitcher';
import SuggestionPrompts from './components/SuggestionPrompts';

// **********************************************
// * ĐẢM BẢO KHÔNG CÓ IMPORT RESULTS TABLE TẠI ĐÂY *
// **********************************************

// Fix: Add missing SpeechRecognition types for browsers that support it to resolve TypeScript errors.
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
}
interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}
interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  lang: string;
  interimResults: boolean;
  onresult: (event: SpeechRecognitionEvent) => void;
  onstart: () => void;
  onend: () => void;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  start(): void;
  stop(): void;
}
type SpeechRecognitionConstructor = new () => SpeechRecognition;

declare global {
  interface Window {
    SpeechRecognition: SpeechRecognitionConstructor;
    webkitSpeechRecognition: SpeechRecognitionConstructor;
  }
}

const hexToRgba = (hex: string, alpha: number): string => {
    const validHex = /^#([A-Fa-f0-9]{3}){1,2}$/.test(hex);
    if (!validHex) {
        return `rgba(96, 165, 250, ${alpha})`; // fallback to a default blue
    }

    let c = hex.substring(1).split('');
    if (c.length === 3) {
        c = [c[0], c[0], c[1], c[1], c[2], c[2]];
    }
    const hexValue = '0x' + c.join('');
    const r = (parseInt(hexValue) >> 16) & 255;
    const g = (parseInt(hexValue) >> 8) & 255;
    const b = parseInt(hexValue) & 255;

    return `rgba(${r},${g},${b},${alpha})`;
};

// Fix: Renamed variable to avoid conflict with the SpeechRecognition interface type.
const SpeechRecognitionApi = window.SpeechRecognition || window.webkitSpeechRecognition;

const App: React.FC = () => {
  const [userInput, setUserInput] = useState<string>('');
  const [advice, setAdvice] = useState<AdviceResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [accentColor, setAccentColor] = useState<string>('#60a5fa');
  
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);


  useEffect(() => {
    const savedColor = localStorage.getItem('study-advisor-color');
    if (savedColor) {
      setAccentColor(savedColor);
    }

    if (SpeechRecognitionApi) {
      const recognition = new SpeechRecognitionApi();
      recognition.continuous = true;
      recognition.lang = 'vi-VN';
      recognition.interimResults = true;
      
      recognition.onresult = (event) => {
        let final_transcript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            final_transcript += event.results[i][0].transcript;
          }
        }
        setUserInput(prev => prev + final_transcript);
      };

      recognition.onstart = () => setIsListening(true);
      recognition.onend = () => setIsListening(false);
      recognition.onerror = (event) => {
        console.error('Speech recognition error', event.error);
        setIsListening(false);
      };
      
      recognitionRef.current = recognition;
    }

    // Cleanup speech synthesis on unmount
    return () => {
      window.speechSynthesis.cancel();
    }
  }, []);

  const handleColorChange = (color: string) => {
    setAccentColor(color);
    localStorage.setItem('study-advisor-color', color);
  };

  const handleSubmit = useCallback(async (query?: string) => {
    const currentQuery = query || userInput;
    if (!currentQuery.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setAdvice(null);
    window.speechSynthesis.cancel();
    setIsSpeaking(false);

    if (!query) {
      setUserInput(currentQuery);
    }


    try {
      const result = await getStudyAdvice(currentQuery);
      setAdvice(result);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Đã có lỗi không xác định xảy ra.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [userInput, isLoading]);

  const handleSuggestionSelect = (prompt: string) => {
      setUserInput(prompt);
      handleSubmit(prompt);
  };

  const handleStartListening = () => {
    if (recognitionRef.current && !isListening) {
      setUserInput(''); // Clear input before starting
      recognitionRef.current.start();
    }
  };

  const handleStopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  const handlePlaySpeech = (text: string) => {
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'vi-VN';
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (e) => {
      console.error("Speech synthesis error", e);
      setIsSpeaking(false);
    };
    
    utteranceRef.current = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const handleStopSpeech = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const backgroundStyle = {
    background: `linear-gradient(to bottom right, ${hexToRgba(accentColor, 0.15)}, #f8fafc)`,
  };

  const textColor = 'text-slate-800';
  const subtleTextColor = 'text-slate-600';
  const footerTextColor = 'text-slate-500';

  return (
    <div style={backgroundStyle} className={`relative min-h-screen font-sans overflow-hidden transition-colors duration-500 ${textColor}`}>
      <FloralVine 
        className="absolute top-0 left-0" 
        startColor={accentColor}
        endColor="#818cf8"
        gradientId="top-left-vine"
      />
      <FloralVine 
        className="absolute bottom-0 right-0 transform rotate-180" 
        startColor={accentColor}
        endColor="#818cf8"
        gradientId="bottom-right-vine"
      />

      <main className="container mx-auto px-4 py-8 relative z-10">
        <Header />
        <InputArea 
          userInput={userInput}
          setUserInput={setUserInput}
          onSubmit={() => handleSubmit()}
          isLoading={isLoading}
          isListening={isListening}
          onStartListening={handleStartListening}
          onStopListening={handleStopListening}
        />
        
        <div className="mt-8">
          {isLoading && <LoadingSpinner />}
          {error && (
            <div className="max-w-2xl mx-auto p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg text-center">
              <strong>Lỗi:</strong> {error}
            </div>
          )}
          {advice && (
            <ResponseDisplay 
              advice={advice}
              isSpeaking={isSpeaking}
              onPlaySpeech={handlePlaySpeech}
              onStopSpeech={handleStopSpeech}
            />
          )}

          {!isLoading && !error && !advice && (
            <>
             <div className={`text-center mt-16 max-w-2xl mx-auto ${subtleTextColor}`}>
                <h2 className={`text-2xl font-semibold mb-4 ${textColor}`}>Chào bạn, tôi có thể giúp gì?</h2>
                <p>
                  Hãy cho tôi biết những thách thức bạn đang đối mặt trong học tập, thi cử, hay bất cứ điều gì khiến bạn áp lực.
                  Tôi sẽ lắng nghe và đưa ra những gợi ý để giúp bạn vượt qua.
                </p>
             </div>
             <SuggestionPrompts onSelect={handleSuggestionSelect} />
            </>
          )}
        </div>
      </main>
      <footer className="relative z-10 text-center py-4 text-sm bg-transparent">
          <div className="flex flex-col items-center gap-4">
            <ColorPicker color={accentColor} onColorChange={handleColorChange} />
            <p className={footerTextColor}>Được cung cấp bởi Gemini API</p>
          </div>
      </footer>
    </div>
  );
};

export default App;
