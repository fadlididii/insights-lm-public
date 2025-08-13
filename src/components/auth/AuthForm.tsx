import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import bcrypt from 'bcryptjs';

const AuthForm = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  // Redirect to dashboard if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      console.log('User is authenticated, redirecting to dashboard');
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Enhanced form validation
  const validateForm = () => {
    if (!email || !password) {
      toast({
        title: "Validation Error",
        description: "Email and password are required.",
        variant: "destructive",
      });
      return false;
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid email address.",
        variant: "destructive",
      });
      return false;
    }

    // Password validation
    if (password.length < 8) {
      toast({
        title: "Validation Error",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      });
      return false;
    }

    if (isSignUp) {
      if (!fullName.trim()) {
        toast({
          title: "Validation Error",
          description: "Full name is required for registration.",
          variant: "destructive",
        });
        return false;
      }

      if (!securityQuestion.trim()) {
        toast({
          title: "Validation Error",
          description: "Security question is required for registration.",
          variant: "destructive",
        });
        return false;
      }

      if (!securityAnswer.trim()) {
        toast({
          title: "Validation Error",
          description: "Security answer is required for registration.",
          variant: "destructive",
        });
        return false;
      }

      if (securityAnswer.length < 3) {
        toast({
          title: "Validation Error",
          description: "Security answer must be at least 3 characters long.",
          variant: "destructive",
        });
        return false;
      }

      if (password !== confirmPassword) {
        toast({
          title: "Validation Error",
          description: "Passwords do not match.",
          variant: "destructive",
        });
        return false;
      }
    }

    return true;
  };

  // Function to check if email already exists
  const checkEmailExists = async (email: string): Promise<boolean> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('email')
        .eq('email', email)
        .single();
      
      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "not found" error, which means email doesn't exist
        console.error('Error checking email:', error);
        return false;
      }
      
      return !!data; // Returns true if email exists, false if not
    } catch (err) {
      console.error('Error checking email existence:', err);
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      if (isSignUp) {
        // Check if email already exists before proceeding with registration
        const emailExists = await checkEmailExists(email);
        
        if (emailExists) {
          toast({
            title: "Registration Failed",
            description: "An account with this email already exists. Please use a different email or try signing in.",
            variant: "destructive",
          });
          setLoading(false);
          return;
        }

        // Hash security answer
        const saltRounds = 12;
        const hashedSecurityAnswer = await bcrypt.hash(securityAnswer.toLowerCase().trim(), saltRounds);
        
        // Sign up user
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: undefined, // Disable email confirmation redirect
            data: {
              full_name: fullName,
              security_question: securityQuestion,
              security_answer_hash: hashedSecurityAnswer
            }
          }
        });
        
        if (authError) {
          // Handle specific Supabase auth errors
          if (authError.message.includes('already registered')) {
            toast({
              title: "Registration Failed",
              description: "An account with this email already exists. Please use a different email or try signing in.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Registration Failed",
              description: authError.message,
              variant: "destructive",
            });
          }
          return;
        }
        
        // Update profile with security question data
        if (authData.user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .update({
              security_question: securityQuestion,
              security_answer_hash: hashedSecurityAnswer,
              full_name: fullName,
              email: email
            })
            .eq('id', authData.user.id);
          
          if (profileError) {
            console.error('Error updating profile with security data:', profileError);
          }
        }
        
        // Reset form fields
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setFullName('');
        setSecurityQuestion('');
        setSecurityAnswer('');
        
        // Switch to login mode
        setIsSignUp(false);
        
        toast({
          title: "Registration Successful",
          description: "Your account has been created successfully. Please sign in to continue.",
        });
        
      } else {
        // Sign in
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        
        if (error) {
          // Handle email confirmation error specifically
          if (error.message.includes('Email not confirmed')) {
            toast({
              title: "Account Setup Required",
              description: "Please create a new account or contact support. Email confirmation is disabled for new accounts.",
              variant: "destructive",
            });
          } else {
            toast({
              title: "Login Failed",
              description: error.message,
              variant: "destructive",
            });
          }
          return;
        }
        
        toast({
          title: "Login Successful",
          description: "Welcome back!",
        });
      }
    } catch (error) {
      console.error('Auth error:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-8 px-4 sm:px-6 lg:px-8 bg-white">
      <div className="max-w-md w-full space-y-6">
        {/* Header dengan identitas website - hanya Telkomsel AI Assistant */}
        <div className="text-center">
          <img
            className="mx-auto h-20 w-auto drop-shadow-lg"
            src="/RGB_TELKOMSEL_LOCK UP_Full Colour-01.png"
            alt="Telkomsel"
          />
          <h1 className="mt-4 text-4xl font-bold text-black-600 drop-shadow-sm">
            Telkomsel AI Assistant
          </h1>
          <h2 className="mt-6 text-2xl font-semibold text-gray-900">
            {isSignUp ? 'Create your account' : 'Sign in to your account'}
          </h2>
        </div>
        
        <Card className="shadow-xl rounded-2xl border border-red-100 bg-white/95 backdrop-blur-sm my-4">
          <CardHeader className="text-center">
            <CardTitle className="text-xl font-bold text-gray-900">
              {isSignUp ? 'Register' : 'Login'}
            </CardTitle>
            <CardDescription className="text-gray-600">
              {isSignUp 
                ? 'Create a new account with security question for password recovery' 
                : 'Enter your credentials to access your account'
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div>
                  <Label htmlFor="fullName">Full Name</Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={isSignUp}
                    placeholder="Enter your full name"
                  />
                </div>
              )}
              
              <div>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Enter your email"
                />
              </div>
              
              <div>
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              
              {isSignUp && (
                <>
                  <div>
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required={isSignUp}
                        placeholder="Confirm your password"
                      />
                      <button
                        type="button"
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="securityQuestion">Security Question</Label>
                    <Textarea
                      id="securityQuestion"
                      value={securityQuestion}
                      onChange={(e) => setSecurityQuestion(e.target.value)}
                      required={isSignUp}
                      placeholder="Enter a security question (e.g., What is your first pet's name?)"
                      rows={2}
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="securityAnswer">Security Answer</Label>
                    <Input
                      id="securityAnswer"
                      type="text"
                      value={securityAnswer}
                      onChange={(e) => setSecurityAnswer(e.target.value)}
                      required={isSignUp}
                      placeholder="Enter the answer to your security question"
                    />
                  </div>
                </>
              )}
              
              <Button 
                type="submit" 
                className="w-full bg-red-600 hover:bg-red-700 text-white font-bold shadow-md rounded-lg transition-all duration-200 transform hover:scale-105" 
                disabled={loading}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isSignUp ? 'Register Now' : 'Sign In'}
              </Button>
            </form>
            
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-sm text-red-600 hover:text-red-500 font-medium"
              >
                {isSignUp ? 'Already have an account? Sign in here' : "Don't have an account? Register here"}
              </button>
            </div>
            
            {!isSignUp && (
              <div className="mt-3 text-center">
                <button
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="text-sm text-red-600 hover:text-red-500 font-medium"
                >
                  Forgot your password?
                </button>
              </div>
            )}
          </CardContent>
        </Card>
        
        {/* Footer dengan identitas */}
        <div className="text-center pb-4">
          <p className="text-sm text-gray-600 mb-2">
            Powered by Telkomsel AI Assistant
          </p>
          <p className="text-xs text-gray-400">
            © 2024 Telkomsel. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default AuthForm;