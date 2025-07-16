// src/components/SymptomChecker/SymptomChecker.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useSymptomAnalysis } from '../../components/hooks/useSymptomAnalysis';
import Button from '../../components/common/Button';
import LoadingSpinner from '../../components/common/LoadingSpinner';
import ResultCard from '../../components/common/ResultCard';
import './SymptomChecker.css';
import VoiceRecognition from '../../components/VoiceRecognition/VoiceRecognition';

// Helper to fetch hospitals from Nominatim
async function fetchHospitalsNear(city) {
  const url = `https://nominatim.openstreetmap.org/search.php?q=hospitals+near+${encodeURIComponent(city)}&format=jsonv2`;
  const response = await fetch(url, {
    headers: { 'Accept': 'application/json' }
  });
  if (!response.ok) throw new Error('Failed to fetch hospital data');
  return await response.json();
}

// Helper to geocode a location string to lat/lon using Nominatim
async function geocodeLocation(location) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=jsonv2&limit=1`;
  const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!response.ok) throw new Error('Failed to geocode location');
  const data = await response.json();
  if (!data.length) throw new Error('Location not found');
  return data[0]; // { lat, lon, display_name }
}

// Helper to fetch hospitals near lat/lon using Nominatim
async function fetchHospitalsNearLatLon(lat, lon) {
  // Define a small bounding box around the lat/lon (e.g., ±0.1 degrees)
  const delta = 0.1;
  const left = parseFloat(lon) - delta;
  const top = parseFloat(lat) + delta;
  const right = parseFloat(lon) + delta;
  const bottom = parseFloat(lat) - delta;
  const viewbox = [left, top, right, bottom].join(',');
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&amenity=hospital&limit=5&lat=${lat}&lon=${lon}&addressdetails=1&bounded=1&viewbox=${viewbox}`;
  const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
  if (!response.ok) throw new Error('Failed to fetch hospital data');
  return await response.json();
}

// Helper to calculate distance between two lat/lon points in km (Haversine formula)
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

const SymptomChecker = () => {
  const { t, i18n } = useTranslation();
  const [userInput, setUserInput] = useState('');
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'bot',
      content: t('symptomChecker.description'),
      timestamp: new Date()
    }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false); // NEW: speech loading state
  const messagesEndRef = useRef(null);
  const { analyzeSymptoms, result, isLoading, error } = useSymptomAnalysis();
  // Track if we are waiting for a location after a severe condition
  const [awaitingLocation, setAwaitingLocation] = useState(false);
  const [isFetchingHospitals, setIsFetchingHospitals] = useState(false);

  const langMap = {
    en: 'en-US', hi: 'hi-IN', es: 'es-ES', fr: 'fr-FR', zh: 'zh-CN', ar: 'ar-SA', ru: 'ru-RU', de: 'de-DE', ja: 'ja-JP', pt: 'pt-PT', it: 'it-IT', bn: 'bn-IN', tr: 'tr-TR', te: 'te-IN', mr: 'mr-IN', ta: 'ta-IN', kn: 'kn-IN', ml: 'ml-IN'
  };

  // Add this helper function for translation
  async function translateText(text, targetLang) {
    if (targetLang === 'en') return text;
    try {
      const res = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`);
      const data = await res.json();
      return data[0].map(item => item[0]).join(' ');
    } catch (e) {
      return text; // fallback to English if translation fails
    }
  }

  // Helper to translate an array of strings with fallback
  async function translateArray(arr, lang) {
    return Promise.all(arr.map(async item => {
      try {
        return await translateText(item, lang);
      } catch {
        return item; // fallback to English if translation fails
      }
    }));
  }

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (result) {
      setMessages(prev => {
        const botMessage = {
          id: prev.length + 1,
          type: 'bot',
          content: t('symptomChecker.analyzing'),
          timestamp: new Date(),
          result: result
        };
        return [...prev, botMessage];
      });
      setIsTyping(false);
    }
  }, [result, t]);

  useEffect(() => {
    if (error) {
      setMessages(prev => {
        const botMessage = {
          id: prev.length + 1,
          type: 'bot',
          content: t('symptomChecker.error'),
          timestamp: new Date(),
          isError: true
        };
        return [...prev, botMessage];
      });
      setIsTyping(false);
    }
  }, [error, t]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!userInput.trim()) return;

    const userMessage = {
      id: messages.length + 1,
      type: 'user',
      content: userInput,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);

    const lowerInput = userInput.toLowerCase();

    // Emergency message logic
    const emergencyKeywords = [
      'wrong medicine',
      'took wrong medicine',
      'taken wrong medicine',
      'overdose',
      'too much medicine',
      'wrong tablet',
      'wrong pill',
      'wrong drug',
      'extra dose',
      'double dose',
      'accidentally took',
      'accidentally eaten',
      'accidentally consumed'
    ];
    const isEmergency = emergencyKeywords.some(keyword => lowerInput.includes(keyword));
    if (isEmergency) {
      setMessages(prev => [
        ...prev,
        {
          id: prev.length + 1,
          type: 'bot',
          content: 'If you are feeling unwell or experiencing severe symptoms like chest pain, difficulty breathing, or confusion, please call emergency services immediately or go to the nearest hospital.',
          timestamp: new Date(),
          isError: true
        }
      ]);
      setIsTyping(false);
      setUserInput('');
      setAwaitingLocation(false);
      return;
    }

    // Severe condition location prompt logic
    const severeKeywords = [
      'severe',
      'severe condition',
      'serious condition',
      'critical condition',
      'emergency',
      'urgent',
      'life threatening',
      'near hospital',
      'need hospital',
      'need ambulance',
      'need help',
      'very sick',
      'dangerous',
      'severely ill'
    ];
    const isSevere = severeKeywords.some(keyword => lowerInput.includes(keyword));
    if (isSevere) {
      setMessages(prev => [
        ...prev,
        {
          id: prev.length + 1,
          type: 'bot',
          content: 'You mentioned a severe condition. Please name your city and area so I can help you find nearby hospitals.',
          timestamp: new Date(),
          isError: false
        }
      ]);
      setIsTyping(false);
      setUserInput('');
      setAwaitingLocation(true);
      return;
    }

    // If awaiting location, treat user input as city/area and reply with Nominatim hospital search
    if (awaitingLocation) {
      setIsFetchingHospitals(true);
      setIsTyping(true);
      setUserInput('');
      try {
        // Step 1: Geocode the user's input
        const geo = await geocodeLocation(userInput.trim());
        const { lat, lon, display_name } = geo;
        // Step 2: Search for hospitals near those coordinates
        const hospitals = await fetchHospitalsNearLatLon(lat, lon);
        // Step 3: Filter and sort by distance
        const userLat = parseFloat(lat);
        const userLon = parseFloat(lon);
        const hospitalsWithDistance = hospitals.map(h => ({
          ...h,
          distance: getDistanceFromLatLonInKm(userLat, userLon, parseFloat(h.lat), parseFloat(h.lon))
        }));
        const nearbyHospitals = hospitalsWithDistance
          .filter(h => h.distance <= 10)
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 5);
        if (nearbyHospitals.length === 0) {
          setMessages(prev => [
            ...prev,
            {
              id: prev.length + 1,
              type: 'bot',
              content: `Sorry, I couldn't find any hospitals within 10 km of ${display_name}.`,
              timestamp: new Date(),
              isError: true
            }
          ]);
        } else {
          const hospitalList = nearbyHospitals.map(h => {
            // Try to split display_name into name and address
            const [name, ...addressParts] = h.display_name.split(',');
            const shortAddress = addressParts.join(',').trim().split(',').slice(0,2).join(',').trim(); // first two address parts
            const hlat = h.lat;
            const hlon = h.lon;
            const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${hlat},${hlon}`;
            return `\n• **${name.trim()}**  \n${shortAddress ? shortAddress + '  ' : ''}\nDistance: ${h.distance.toFixed(2)} km\n[View on Google Maps](${mapsUrl})`;
          }).join('\n\n');
          setMessages(prev => [
            ...prev,
            {
              id: prev.length + 1,
              type: 'bot',
              content: `\nShowing hospitals within 10 km of: **${display_name}**\n\n${hospitalList}`,
              timestamp: new Date(),
              isError: false
            }
          ]);
        }
      } catch (err) {
        setMessages(prev => [
          ...prev,
          {
            id: prev.length + 1,
            type: 'bot',
            content: `Sorry, there was an error finding your location or fetching hospital data. Please try again with a more specific city or area name!`,
            timestamp: new Date(),
            isError: true
          }
        ]);
      } finally {
        setIsTyping(false);
        setIsFetchingHospitals(false);
        setAwaitingLocation(false);
      }
      return;
    }

    setIsTyping(true);
    setUserInput('');

    await analyzeSymptoms(userInput);
  };

  const quickQuestions = [
    { key: 'fever', text: t('symptomChecker.quickQuestions.fever') },
    { key: 'headache', text: t('symptomChecker.quickQuestions.headache') },
    { key: 'cough', text: t('symptomChecker.quickQuestions.cough') },
    { key: 'stomach', text: t('symptomChecker.quickQuestions.stomach') },
    { key: 'fatigue', text: t('symptomChecker.quickQuestions.fatigue') }
  ];

  const handleQuickQuestion = (question) => {
    setUserInput(question);
  };

  const speakDescription = async () => {
    const description = t('symptomChecker.description');
    if ('speechSynthesis' in window) {
      const currentLang = i18n.language || 'en';
      let toSpeak = description;
      if (currentLang !== 'en') {
        toSpeak = await translateText(description, currentLang);
      }
      const utterance = new window.SpeechSynthesisUtterance(toSpeak);
      utterance.lang = langMap[currentLang] || 'en-US';
      window.speechSynthesis.speak(utterance);
    } else {
      alert('Sorry, your browser does not support text-to-speech.');
    }
  };

  const formatResultForSpeech = (result) => {
    if (!result) return '';
    let text = `Symptom: ${result.symptom}. `;
    if (result.causes) text += `Possible causes: ${result.causes.join(', ')}. `;
    if (result.remedies) text += `Recommended remedies: ${result.remedies.join(', ')}. `;
    if (result.medicines) {
      text += 'Suggested medicines: ';
      if (Array.isArray(result.medicines)) {
        text += result.medicines.map(med => {
          if (typeof med === 'string') return med;
          return `${med.name || ''} ${med.dosage || ''}`.trim();
        }).join(', ') + '. ';
      } else {
        text += result.medicines + '. ';
      }
    }
    if (result.severity) text += `Severity: ${result.severity}. `;
    if (result.when_to_see_doctor) text += `When to see a doctor: ${result.when_to_see_doctor}. `;
    return text;
  };

  // Add this function to reset chat
  const handleClearChat = () => {
    setMessages([
      {
        id: 1,
        type: 'bot',
        content: t('symptomChecker.description'),
        timestamp: new Date()
      }
    ]);
  };

  return (
    <div className="symptom-checker">
      <h1>{t('symptomChecker.title')}</h1>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
        <p className="description">{t('symptomChecker.description')}</p>
        <button type="button" onClick={speakDescription} style={{ padding: '0.3em 0.7em' }}>
          🔊
        </button>
      </div>

      <div className="chat-container">
        <div className="chatbot-header">
          <h2>{t('symptomChecker.title')}</h2>
          <button className="clear-chat-btn" onClick={handleClearChat} type="button">
            {t('symptomChecker.clearChat', 'Clear Chat')}
          </button>
        </div>
        <div className="messages">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`message ${message.type}-message ${message.isError ? 'error-message' : ''}`}
            >
              <div className="message-content">
                {message.type === 'bot' && (
                  <div className="bot-avatar">🤖</div>
                )}
                <div className="message-bubble">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
                    <p>{message.content}</p>
                    {message.type === 'bot' && (
                      <button
                        type="button"
                        disabled={isSpeaking}
                        onClick={async () => {
                          if ('speechSynthesis' in window) {
                            setIsSpeaking(true);
                            let speechText = message.content;
                            const currentLang = i18n.language || 'en';
                            try {
                              if (message.result) {
                                const result = message.result;
                                // Translate dynamic content with fallback
                                let symptom = result.symptom;
                                let causes = result.causes;
                                let remedies = result.remedies;
                                if (currentLang !== 'en') {
                                  try { symptom = await translateText(result.symptom, currentLang); } catch {}
                                  try { causes = await translateArray(result.causes, currentLang); } catch {}
                                  try { remedies = await translateArray(result.remedies, currentLang); } catch {}
                                }
                                // Use t() for UI labels
                                speechText = `${t('resultCard.analysisResults')}: ${symptom}. `;
                                if (causes && causes.length) speechText += `${t('resultCard.causes')}: ${causes.join(', ')}. `;
                                if (remedies && remedies.length) speechText += `${t('resultCard.remedies')}: ${remedies.join(', ')}. `;
                              }
                              const utterance = new window.SpeechSynthesisUtterance(speechText);
                              utterance.lang = langMap[currentLang] || 'en-US';
                              utterance.onend = () => setIsSpeaking(false);
                              utterance.onerror = () => setIsSpeaking(false);
                              window.speechSynthesis.speak(utterance);
                            } catch {
                              setIsSpeaking(false);
                            }
                          }
                        }}
                        style={{ padding: '0.2em 0.5em' }}
                        aria-label="Speak response"
                      >
                        {isSpeaking ? <span className="spinner" style={{width: '1em', height: '1em', display: 'inline-block', border: '2px solid #ccc', borderTop: '2px solid #667eea', borderRadius: '50%', animation: 'spin 1s linear infinite'}}></span> : '🔊'}
                      </button>
                    )}
                  </div>
                  {message.result && (
                    <ResultCard result={message.result} />
                  )}
                  <span className="message-time">
                    {message.timestamp.toLocaleTimeString()}
                  </span>
                </div>
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="message bot-message">
              <div className="message-content">
                <div className="bot-avatar">🤖</div>
                <div className="message-bubble typing">
                  <LoadingSpinner size="small" />
                  <span>{t('symptomChecker.analyzing')}</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        <div className="quick-questions">
          <p>{t('symptomChecker.quickQuestions.title')}:</p>
          <div className="quick-buttons">
            {quickQuestions.map((question) => (
              <button
                key={question.key}
                className="quick-question-btn"
                onClick={() => handleQuickQuestion(question.text)}
              >
                {question.text}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="input-form" style={{ display: 'flex', alignItems: 'center', gap: '0.5em' }}>
          <VoiceRecognition onResult={setUserInput} className="voice-btn" />
          <input
            type="text"
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder={t('symptomChecker.placeholder')}
            className="input-field"
            disabled={isLoading}
            style={{ flex: 1 }}
          />
          <Button 
            type="submit" 
            disabled={isLoading || !userInput.trim()}
            className="submit-button"
          >
            {isLoading ? t('symptomChecker.analyzing') : t('symptomChecker.analyze')}
          </Button>
        </form>
      </div>
    </div>
  );
};

export default SymptomChecker;
