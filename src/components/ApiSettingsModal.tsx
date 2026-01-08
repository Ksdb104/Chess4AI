import React, { useState, useEffect } from 'react';
import { useStore, type ApiSettings } from '../store/useStore';
import axios from 'axios';
import { X, Settings, Loader2 } from 'lucide-react';

export const ApiSettingsModal: React.FC = () => {
  const { isSettingsOpen, setSettingsOpen, apiSettings, setApiSettings } = useStore();
  const [formData, setFormData] = useState<ApiSettings>(apiSettings);
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isSettingsOpen) {
      setFormData(apiSettings);
    }
  }, [isSettingsOpen, apiSettings]);

  const fetchModels = async () => {
    if (!formData.baseUrl || !formData.apiKey) {
      setError('需要输入URL和apikey');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const url = formData.baseUrl.replace(/\/+$/, ''); // 移除末尾斜杠
      const response = await axios.get(`${url}/models`, {
        headers: {
          Authorization: `Bearer ${formData.apiKey}`,
        },
      });
      
      const modelList = response.data.data.map((m: { id: string }) => m.id);
      setModels(modelList);
      if (modelList.length > 0 && !formData.model) {
        setFormData(prev => ({ ...prev, model: modelList[0] }));
      }
    } catch (err) {
      console.error(err);
      setError('获取失败.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    if (!formData.apiKey) {
      setError('API Key必填');
      return;
    }
    setApiSettings(formData);
    setSettingsOpen(false);
  };

  if (!isSettingsOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 relative">
        <button 
          onClick={() => setSettingsOpen(false)}
          className="absolute top-4 right-4 text-gray-500 hover:text-gray-700"
        >
          <X size={20} />
        </button>
        
        <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
          <Settings size={24} />
          API Settings
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Base URL</label>
            <input
              type="text"
              value={formData.baseUrl}
              onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
              placeholder="https://api.openai.com/v1"
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
            <input
              type="password"
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              placeholder="sk-..."
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
            <div className="flex gap-2">
              <select
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="flex-1 w-0 px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none truncate"
              >
                <option value="">Select a model</option>
                {models.map(m => <option key={m} value={m}>{m}</option>)}
                {!models.includes(formData.model) && formData.model && (
                  <option value={formData.model}>{formData.model}</option>
                )}
              </select>
              <button
                onClick={fetchModels}
                disabled={loading}
                className="px-3 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50"
                title="获取模型"
              >
                {loading ? <Loader2 className="animate-spin" size={20} /> : '获取'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              点击 “获取” 以从 API 获取可用模型。
            </p>
          </div>

          {error && (
            <div className="text-red-500 text-sm bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          <div className="pt-4 flex justify-end">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium"
            >
              保存设置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
