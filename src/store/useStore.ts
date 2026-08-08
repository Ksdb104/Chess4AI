import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface ApiSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
}

export type EngineDifficulty = 'beginner' | 'casual' | 'club' | 'expert' | 'master';

interface AppState {
  apiSettings: ApiSettings;
  setApiSettings: (settings: ApiSettings) => void;
  engineDifficulty: EngineDifficulty;
  setEngineDifficulty: (difficulty: EngineDifficulty) => void;
  isSettingsOpen: boolean;
  setSettingsOpen: (isOpen: boolean) => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      apiSettings: {
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        model: '',
      },
      setApiSettings: (settings) => set({ apiSettings: settings }),
      engineDifficulty: 'club',
      setEngineDifficulty: (engineDifficulty) => set({ engineDifficulty }),
      isSettingsOpen: false,
      setSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),
    }),
    {
      name: 'chess-app-storage',
      partialize: (state) => ({
        apiSettings: state.apiSettings,
        engineDifficulty: state.engineDifficulty,
      }),
    }
  )
);
