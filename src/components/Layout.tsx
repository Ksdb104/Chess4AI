import React from 'react';
import { ApiSettingsModal } from './ApiSettingsModal';
import { useStore } from '../store/useStore';
import { Settings } from 'lucide-react';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { setSettingsOpen } = useStore();

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-800">Chess4AI</h1>
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
            title="讲解模型设置"
          >
            <Settings size={24} />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>

      <ApiSettingsModal />
    </div>
  );
};
