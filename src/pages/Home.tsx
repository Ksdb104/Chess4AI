import React from 'react';
import { useNavigate } from 'react-router-dom';

export const Home: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center space-y-8 mt-10">
      <h2 className="text-3xl font-bold text-gray-800">选择对弈</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
        <button
          onClick={() => navigate('/chess')}
          className="flex flex-col items-center justify-center p-8 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-500 hover:shadow-lg transition-all group"
        >
          <div className="w-32 h-32 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-4xl group-hover:bg-blue-50 transition-colors">
            ♟️
          </div>
          <h3 className="text-2xl font-bold text-gray-800">国际象棋</h3>
        </button>

        <button
          onClick={() => navigate('/xiangqi')}
          className="flex flex-col items-center justify-center p-8 bg-white border-2 border-gray-200 rounded-xl hover:border-red-500 hover:shadow-lg transition-all group"
        >
          <div className="w-32 h-32 bg-gray-100 rounded-full flex items-center justify-center mb-4 text-4xl group-hover:bg-red-50 transition-colors text-red-700">
            帥
          </div>
          <h3 className="text-2xl font-bold text-gray-800">中国象棋</h3>
        </button>
      </div>
    </div>
  );
};
