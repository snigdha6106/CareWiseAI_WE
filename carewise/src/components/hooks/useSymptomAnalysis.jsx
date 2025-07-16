import { useState } from 'react';
import { fetchMedicineLabel } from '../services/api';

// Mock knowledge base for symptom analysis
const knowledgeBase = {
    fever: {
    causes: ['Viral infection', 'Bacterial infection', 'Inflammation', 'Heat exhaustion', 'Autoimmune disorders'],
    remedies: ['Rest', 'Stay hydrated', 'Take fever-reducing medication', 'Cool compress'],
    medicines: [
      'Acetaminophen (Tylenol) - 500-1000mg every 4-6 hours (max 4000mg/day)',
      'Ibuprofen (Advil, Motrin) - 200-400mg every 4-6 hours (max 1200mg/day)',
      'Aspirin - 325-650mg every 4 hours (max 4000mg/day, not for children)'
    ],
    severity: 'Mild to Moderate',
    when_to_see_doctor: 'If fever >103°F (39.4°C), lasts more than 3 days, or is accompanied by rash'
  },
  headache: {
    causes: ['Stress', 'Dehydration', 'Eye strain', 'Sinus pressure', 'Migraine', 'Tension'],
    remedies: ['Rest in quiet, dark room', 'Stay hydrated', 'Apply cold compress', 'Massage'],
    medicines: [
      { name: 'Acetaminophen', dosage: '500-1000mg every 4-6 hours' },
      { name: 'Ibuprofen', dosage: '200-400mg every 4-6 hours' },
      { name: 'Aspirin', dosage: '325-650mg every 4 hours' },
      { name: 'Naproxen (Aleve)', dosage: '220mg every 8-12 hours' }
    ],
    severity: 'Mild',
    when_to_see_doctor: 'If sudden/severe pain, after head injury, with fever/stiff neck'
  },
  cough: {
    causes: ['Common cold', 'Allergies', 'Bronchitis', 'Post-nasal drip', 'Asthma', 'GERD'],
    remedies: ['Stay hydrated', 'Use honey', 'Steam inhalation', 'Elevate head while sleeping'],
    medicines: [
      { name: 'Dextromethorphan (Robitussin DM)', type: 'Cough suppressant', dosage: '10-20mg every 4-8 hours' },
      { name: 'Guaifenesin (Mucinex)', type: 'Expectorant', dosage: '200-400mg every 4 hours' },
      { name: 'Diphenhydramine (Benadryl)', type: 'Antihistamine', dosage: '25-50mg every 4-6 hours' }
    ],
    severity: 'Mild to Moderate',
    when_to_see_doctor: 'If lasts >3 weeks, produces blood, or with difficulty breathing'
  },
  stomach_pain: {
    causes: ['Indigestion', 'Food poisoning', 'Gastritis', 'Appendicitis', 'GERD', 'IBS'],
    remedies: ['BRAT diet (bananas, rice, applesauce, toast)', 'Avoid dairy/fatty foods', 'Stay hydrated', 'Heat pad'],
    medicines: [
      { name: 'Antacids (Tums, Rolaids)', dosage: '2-4 tablets as needed' },
      { name: 'Pepto-Bismol', dosage: '30mL or 2 tablets every 30-60 minutes' },
      { name: 'Loperamide (Imodium)', type: 'Anti-diarrheal', dosage: '4mg initially, then 2mg after each loose stool' }
    ],
    severity: 'Moderate',
    when_to_see_doctor: 'If severe pain, lasts >48 hours, vomiting blood, or black stools'
  },
  fatigue: {
    causes: ['Lack of sleep', 'Stress', 'Poor nutrition', 'Anemia', 'Thyroid issues', 'Depression'],
    remedies: ['Regular sleep schedule', 'Balanced diet', 'Moderate exercise', 'Stress management'],
    medicines: [
      { name: 'Vitamin B complex', dosage: '1 tablet daily' },
      { name: 'Iron supplements (if deficient)', dosage: '325mg ferrous sulfate 1-3x daily' },
      { name: 'Caffeine (moderate)', dosage: '200-400mg daily' }
    ],
    severity: 'Mild to Moderate',
    when_to_see_doctor: 'If persists >2 weeks despite lifestyle changes or with other symptoms'
  },
  sore_throat: {
    causes: ['Viral infection', 'Strep throat', 'Allergies', 'Dry air', 'GERD'],
    remedies: ['Warm salt water gargle', 'Stay hydrated', 'Humidifier', 'Throat lozenges'],
    medicines: [
      { name: 'Acetaminophen/Ibuprofen', dosage: 'Standard doses for pain' },
      { name: 'Chloraseptic spray', dosage: '2 sprays every 2 hours' },
      { name: 'Zinc lozenges', dosage: '1 lozenge every 2-3 hours' }
    ],
    severity: 'Mild',
    when_to_see_doctor: 'If lasts >1 week, difficulty breathing/swallowing, or white patches'
  },
  rash: {
    causes: ['Allergic reaction', 'Contact dermatitis', 'Eczema', 'Viral infection', 'Fungal infection'],
    remedies: ['Cool compress', 'Oatmeal bath', 'Avoid scratching', 'Moisturize'],
    medicines: [
      { name: 'Hydrocortisone cream 1%', dosage: 'Apply thin layer 2-3x daily' },
      { name: 'Diphenhydramine (Benadryl)', dosage: '25-50mg every 4-6 hours' },
      { name: 'Antifungal cream (for fungal rashes)', dosage: 'Apply 2x daily for 2 weeks' }
    ],
    severity: 'Mild to Moderate',
    when_to_see_doctor: 'If covers large area, with fever, or spreads quickly'
  },
  nausea: {
    causes: [
      'Stomach infection (viral gastroenteritis)',
      'Food poisoning or spoiled food.',
      'Motion sickness (travel-related).',
      'Overeating or indigestion.',
      'Migraine headaches.',
      'Pregnancy (morning sickness).',
      'Medication side effects.',
      'Stress or anxiety.',
      'Heatstroke or dehydration.',
      'Serious causes: appendicitis, intestinal blockage, kidney failure (if vomiting is persistent and severe).'
    ],
    medicines: [
      { name: 'Ondansetron (Zofran)', note: 'Common anti-nausea prescription.' },
      { name: 'Domperidone (Domstal)', note: 'Helps with nausea and digestion.' },
      { name: 'Doxylamine + Pyridoxine', note: 'Safe in pregnancy-related nausea.' },
      { name: 'ORS (Oral Rehydration Solution)', note: 'Essential if there\'s dehydration.' }
    ],
    remedies: [
      'Rest in a cool, quiet environment.',
      'Sip clear fluids slowly (ORS, water, coconut water, clear soup).',
      'Avoid solid food until vomiting stops.',
      'When ready, try bland foods: toast, rice, banana, apple.',
      'Avoid spicy, oily, or dairy-based foods for a while.',
      'Ginger tea or sucking ginger candy may reduce nausea.'
    ],
    severity: 'Mild to Severe',
    when_to_see_doctor: 'If vomiting is persistent, severe, with blood, or accompanied by dehydration, confusion, or severe abdominal pain.'
  },
  vomiting: {
    causes: [
      'Stomach infection (viral gastroenteritis)',
      'Food poisoning or spoiled food.',
      'Motion sickness (travel-related).',
      'Overeating or indigestion.',
      'Migraine headaches.',
      'Pregnancy (morning sickness).',
      'Medication side effects.',
      'Stress or anxiety.',
      'Heatstroke or dehydration.',
      'Serious causes: appendicitis, intestinal blockage, kidney failure (if vomiting is persistent and severe).'
    ],
    medicines: [
      { name: 'Ondansetron (Zofran)', note: 'Common anti-nausea prescription.' },
      { name: 'Domperidone (Domstal)', note: 'Helps with nausea and digestion.' },
      { name: 'Doxylamine + Pyridoxine', note: 'Safe in pregnancy-related nausea.' },
      { name: 'ORS (Oral Rehydration Solution)', note: 'Essential if there\'s dehydration.' }
    ],
    remedies: [
      'Rest in a cool, quiet environment.',
      'Sip clear fluids slowly (ORS, water, coconut water, clear soup).',
      'Avoid solid food until vomiting stops.',
      'When ready, try bland foods: toast, rice, banana, apple.',
      'Avoid spicy, oily, or dairy-based foods for a while.',
      'Ginger tea or sucking ginger candy may reduce nausea.'
    ],
    severity: 'Mild to Severe',
    when_to_see_doctor: 'If vomiting is persistent, severe, with blood, or accompanied by dehydration, confusion, or severe abdominal pain.'
  },
  motion_sickness: {
    causes: [
      'Travel-related movement',
      'Visual-vestibular conflict',
      'Inner ear sensitivity',
      'Anxiety or anticipation'
    ],
    remedies: [
      'Ginger capsules or tea',
      'Peppermint oil (aromatherapy)',
      'Acupressure wristbands (Sea-Bands)'
    ],
    medicines: [
      {
        name: 'Dimenhydrinate',
        brand: 'Dramamine',
        description: 'Helps prevent and treat nausea, dizziness, and vomiting. Can cause drowsiness. Suitable for short-term use.'
      },
      {
        name: 'Meclizine',
        brand: 'Bonine, Antivert',
        description: 'Longer-lasting than dimenhydrinate. Causes less drowsiness in some people. Often used for cruise or air travel.'
      },
      {
        name: 'Cinnarizine',
        brand: 'Stugeron',
        description: 'Used for motion sickness and vertigo. Commonly prescribed in Asia and Europe.'
      },
      {
        name: 'Scopolamine patch',
        brand: 'Prescription',
        description: 'Worn behind the ear, effective for long trips (cruise, flight). Not for children. May cause dry mouth, drowsiness.'
      }
    ],
    severity: 'Mild to Moderate',
    when_to_see_doctor: 'If symptoms persist despite medication, are severe, or are accompanied by dehydration.'
  },
  back_pain: {
    causes: [
      'Muscle strain or overuse (heavy lifting, poor posture)',
      'Herniated disc or sciatica (nerve pain down the leg)',
      'Arthritis (especially in older adults)',
      'Osteoporosis (weak bones, fractures)',
      'Kidney issues (if pain is deep, one-sided, with fever or blood in urine)',
      'Stress and tension'
    ],
    remedies: [
      'Rest briefly (1–2 days), but avoid long bed rest',
      'Gentle stretching and walking',
      'Use a warm compress or heating pad (for muscle tension)',
      'Use an ice pack (for recent injury or swelling)',
      'Maintain good posture when sitting or standing',
      'Gentle back-strengthening exercises (as symptoms improve)',
      'Consider seeing a physiotherapist for tailored exercises'
    ],
    medicines: [
      { name: 'Paracetamol (acetaminophen)', type: 'Pain reliever', note: 'Always follow package directions and consult a doctor if unsure.' },
      { name: 'Ibuprofen (Advil, Brufen)', type: 'NSAID', warning: 'Avoid NSAIDs if you have ulcers, kidney disease, or certain other conditions.' },
      { name: 'Naproxen (Aleve)', type: 'NSAID', warning: 'Avoid NSAIDs if you have ulcers, kidney disease, or certain other conditions.' },
      { name: 'Diclofenac gel', type: 'Topical cream/gel' },
      { name: 'Capsaicin cream', type: 'Topical cream/gel' }
    ],
    severity: 'Mild to Moderate',
    when_to_see_doctor: 'If pain is severe, lasts more than a few weeks, is associated with fever, unexplained weight loss, or numbness/weakness in legs.'
  }
};

export const useSymptomAnalysis = () => {
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const analyzeSymptoms = async (symptomText, language = 'en') => {
    setIsLoading(true);
    setError(null);
    setResult(null);

    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Process the input text
      const lowerText = symptomText.toLowerCase();
      
      // Find all matching symptoms (not just first one)
      const matchedSymptoms = Object.keys(knowledgeBase).filter(key => 
        lowerText.includes(key) || 
        (key.includes('_') && lowerText.includes(key.replace('_', ' ')))
      );

      // If no direct match, try partial matching
      if (matchedSymptoms.length === 0) {
        for (const key in knowledgeBase) {
          const symptomName = key.replace('_', ' ');
          if (symptomName.length > 4 && lowerText.includes(symptomName.substring(0, 4))) {
            matchedSymptoms.push(key);
          }
        }
      }

      // Default to fever if no matches found
      const symptomKey = matchedSymptoms.length > 0 ? matchedSymptoms[0] : 'fever';

      // Get the first medicine name (string or object)
      let firstMedicine = knowledgeBase[symptomKey].medicines[0];
      let medicineName = typeof firstMedicine === 'string' ? firstMedicine.split('(')[0].trim() : firstMedicine.name;
      let openFdaInfo = null;
      if (medicineName) {
        openFdaInfo = await fetchMedicineLabel(medicineName);
      }

      const analysisResult = {
        symptom: symptomKey.replace('_', ' '),
        ...knowledgeBase[symptomKey],
        confidence: Math.floor(Math.random() * 20) + 80, // 80-100% confidence
        timestamp: new Date().toISOString(),
        language: language,
        openFdaInfo
      };

      setResult(analysisResult);
    } catch (err) {
      setError('Failed to analyze symptoms. Please try again.');
      console.error('Symptom analysis error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const clearResults = () => {
    setResult(null);
    setError(null);
  };

  return {
    analyzeSymptoms,
    result,
    isLoading,
    error,
    clearResults
  };
};
