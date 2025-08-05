
import React from 'react';
import { Button } from '@/components/ui/button';
import { User, LogOut, Crown, Shield } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useLogout } from '@/services/authService';
import { useAuth } from '@/contexts/AuthContext';
import Logo from '@/components/ui/Logo';
import { useNavigate } from 'react-router-dom';

interface DashboardHeaderProps {
  userEmail?: string;
}

const DashboardHeader = ({ userEmail }: DashboardHeaderProps) => {
  const { logout } = useLogout();
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const isAdmin = userProfile?.role === 'admin';

  const handleLogoClick = () => {
    navigate('/');
  };

  return (
    <header className="bg-white px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <button 
            onClick={handleLogoClick}
            className="hover:bg-gray-50 rounded transition-colors p-1"
          >
            <Logo />
          </button>
          <h1 className="text-xl font-medium text-gray-900">Telkomsel AI Assistant</h1>
          {/* Admin badge */}
          {isAdmin && (
            <div className="bg-yellow-500 text-white px-3 py-1 rounded-full text-sm flex items-center space-x-1">
              <Crown className="h-4 w-4" />
              <span>Admin</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Admin Panel Button */}
          {isAdmin && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => navigate('/admin')}
              className="flex items-center space-x-2"
            >
              <Shield className="h-4 w-4" />
              <span>Admin Panel</span>
            </Button>
          )}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="p-0">
                <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center cursor-pointer hover:bg-red-700 transition-colors">
                  <User className="h-4 w-4 text-white" />
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <div className="px-3 py-2 border-b">
                <p className="text-sm font-medium">{userEmail}</p>
                <p className="text-xs text-gray-500 capitalize">{userProfile?.role || 'user'}</p>
              </div>
              <DropdownMenuItem onClick={logout} className="cursor-pointer">
                <LogOut className="h-4 w-4 mr-2" />
                Sign Out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};

export default DashboardHeader;
