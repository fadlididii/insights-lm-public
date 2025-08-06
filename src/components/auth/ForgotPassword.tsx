import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Loader2, ArrowLeft, Eye, EyeOff } from 'lucide-react';

const ForgotPassword = () => {
  const [step, setStep] = useState<'email' | 'security' | 'newPassword'>('email');
  const [email, setEmail] = useState('');
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityQuestion, setSecurityQuestion] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const maxAttempts = 3;
  
  const { toast } = useToast();
  const navigate = useNavigate();
  const { getUserSecurityQuestion, checkSecurityAnswer, updatePassword } = useAuth();

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast({
        title: "Validation Error",
        description: "Email is required.",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    
    try {
      const { question, userId: foundUserId } = await getUserSecurityQuestion(email);
      
      if (!question || !foundUserId) {
        // Don't reveal if user exists or not for security
        toast({
          title: "Security Question",
          description: "If an account with this email exists, you will see the security question.",
        });
        setLoading(false);
        return;
      }
      
      setSecurityQuestion(question);
      setUserId(foundUserId);
      setStep('security');
      
    } catch (error) {
      console.error('Error fetching security question:', error);
      toast({
        title: "Error",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSecurityAnswerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!securityAnswer || !userId) {
      toast({
        title: "Validation Error",
        description: "Security answer is required.",
        variant: "destructive",
      });
      return;
    }
    
    if (attempts >= maxAttempts) {
      toast({
        title: "Too Many Attempts",
        description: "You have exceeded the maximum number of attempts. Please try again later.",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    
    try {
      const isValid = await checkSecurityAnswer(userId, securityAnswer);
      
      if (isValid) {
        setStep('newPassword');
        toast({
          title: "Security Answer Correct",
          description: "Please enter your new password.",
        });
      } else {
        setAttempts(prev => prev + 1);
        const remainingAttempts = maxAttempts - attempts - 1;
        
        toast({
          title: "Incorrect Answer",
          description: `Security answer is incorrect. ${remainingAttempts} attempts remaining.`,
          variant: "destructive",
        });
        
        if (remainingAttempts <= 0) {
          toast({
            title: "Account Locked",
            description: "Too many failed attempts. Please try again later.",
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error('Error checking security answer:', error);
      toast({
        title: "Error",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newPassword || !confirmPassword || !userId) {
      toast({
        title: "Validation Error",
        description: "All fields are required.",
        variant: "destructive",
      });
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Validation Error",
        description: "Passwords do not match.",
        variant: "destructive",
      });
      return;
    }
    
    if (newPassword.length < 8) {
      toast({
        title: "Validation Error",
        description: "Password must be at least 8 characters long.",
        variant: "destructive",
      });
      return;
    }
    
    setLoading(true);
    
    try {
      const result = await updatePassword(userId, newPassword);
      
      if (result.success) {
        toast({
          title: "Password Reset Successful",
          description: "Your password has been updated. You can now sign in with your new password.",
        });
        navigate('/auth');
      } else {
        toast({
          title: "Password Reset Failed",
          description: result.error || "Failed to update password.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      toast({
        title: "Error",
        description: "An error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'email':
        return (
          <form onSubmit={handleEmailSubmit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email address"
              />
            </div>
            <Button type="submit" className="w-full bg-red-600 text-white font-bold shadow-md rounded-lg" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Continue
            </Button>
          </form>
        );
        
      case 'security':
        return (
          <form onSubmit={handleSecurityAnswerSubmit} className="space-y-4">
            <div>
              <Label>Security Question</Label>
              <div className="p-3 bg-gray-50 rounded-md border">
                <p className="text-sm text-gray-700">{securityQuestion}</p>
              </div>
            </div>
            <div>
              <Label htmlFor="securityAnswer">Your Answer</Label>
              <Input
                id="securityAnswer"
                type="text"
                value={securityAnswer}
                onChange={(e) => setSecurityAnswer(e.target.value)}
                required
                placeholder="Enter your answer"
              />
            </div>
            {attempts > 0 && (
              <div className="text-sm text-red-600">
                {maxAttempts - attempts} attempts remaining
              </div>
            )}
            <Button type="submit" className="w-full bg-red-600 text-white font-bold shadow-md rounded-lg" disabled={loading || attempts >= maxAttempts}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verify Answer
            </Button>
          </form>
        );

      case 'newPassword':
        return (
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div>
              <Label htmlFor="newPassword">New Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="Enter your new password"
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
            <div>
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Confirm your new password"
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
            <Button type="submit" className="w-full bg-red-600 text-white font-bold shadow-md rounded-lg" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Reset Password
            </Button>
          </form>
        );
        
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <img
            className="mx-auto h-20 w-auto drop-shadow-lg"
            src="/RGB_TELKOMSEL_LOCK UP_Full Colour-01.png"
            alt="Telkomsel"
          />
          <h2 className="mt-6 text-3xl font-bold text-black-700 drop-shadow-sm">
            Reset Your Password
          </h2>
        </div>
        
        <Card className="shadow-xl rounded-2xl border border-red-100 bg-white/90">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => navigate('/auth')}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <CardTitle>
                  {step === 'email' && 'Enter Email'}
                  {step === 'security' && 'Security Question'}
                  {step === 'newPassword' && 'New Password'}
                </CardTitle>
                <CardDescription>
                  {step === 'email' && 'Enter your email to find your security question'}
                  {step === 'security' && 'Answer your security question to proceed'}
                  {step === 'newPassword' && 'Enter your new password'}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {renderStep()}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ForgotPassword;