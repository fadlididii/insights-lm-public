import React from 'react';
import AuthForm from '@/components/auth/AuthForm';
// import Logo from '@/components/ui/Logo'; // Dikomentari

const Auth = () => {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-white">
      <div className="w-full max-w-md">
        <AuthForm />
      </div>
    </div>
  );
};

export default Auth;