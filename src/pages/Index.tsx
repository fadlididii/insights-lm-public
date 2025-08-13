
import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Dashboard from './Dashboard';
import Auth from './Auth';

const Index = () => {
  const { isAuthenticated, loading, error } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="mb-6">
            <img
              className="mx-auto h-16 w-auto drop-shadow-lg animate-pulse"
              src="/RGB_TELKOMSEL_LOCK UP_Full Colour-01.png"
              alt="Telkomsel"
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Telkomsel AI Assistant
          </h1>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading system...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <div className="mb-6">
            <img
              className="mx-auto h-16 w-auto drop-shadow-lg"
              src="/RGB_TELKOMSEL_LOCK UP_Full Colour-01.png"
              alt="Telkomsel"
            />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            Telkomsel AI Assistant
          </h1>
          <p className="text-red-600 mb-4">Authentication error: {error}</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <Dashboard /> : <Auth />;
};

export default Index;
