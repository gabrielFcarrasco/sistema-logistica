// src/services/firebaseFolha.ts
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// 1. Mapeamos as variáveis de ambiente com o sufixo _FOLHA
const firebaseConfigFolha = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY_FOLHA,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN_FOLHA,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID_FOLHA,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET_FOLHA,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID_FOLHA,
  appId: import.meta.env.VITE_FIREBASE_APP_ID_FOLHA,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID_FOLHA
};

// 2. Inicializamos o Firebase com um nome secundário ("folhaApp") 
// Isso previne o erro "Firebase App already exists" quando rodar junto com o app principal
const appFolha = initializeApp(firebaseConfigFolha, "folhaApp");

// 3. Exportamos o banco de dados isolado
export const dbFolha = getFirestore(appFolha);