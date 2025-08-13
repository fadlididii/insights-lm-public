import React, { useState } from 'react';
import { Trash2, Crown } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useNotebookDelete } from '@/hooks/useNotebookDelete';
import { useAuth } from '@/contexts/AuthContext';

interface NotebookCardProps {
  notebook: {
    id: string;
    title: string;
    date: string;
    sources: number;
    icon: string;
    color: string;
    hasCollaborators?: boolean;
    user_id?: string;
  };
}

const NotebookCard = ({ notebook }: NotebookCardProps) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const { deleteNotebook, isDeleting, canDelete } = useNotebookDelete();
  const { userProfile, user } = useAuth();

  const isOwnNotebook = notebook.user_id === user?.id;
  const isAdmin = userProfile?.role === 'admin';

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    console.log('Delete button clicked for notebook:', notebook.id);
    setShowDeleteDialog(true);
  };

  const handleDeleteConfirm = () => {
    deleteNotebook(notebook.id);
    setShowDeleteDialog(false);
  };

  // Add this function to handle card click
  const handleCardClick = (e: React.MouseEvent) => {
    // Check if click is from delete button or dialog
    const target = e.target as HTMLElement;
    const isDeleteRelated = target.closest('[data-delete-action="true"]') || 
                           target.closest('.delete-button') || 
                           target.closest('[role="dialog"]') ||
                           target.closest('[data-radix-collection-item]');
    
    if (isDeleteRelated || showDeleteDialog) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
  };

  return (
    <div 
      className={`${notebook.color} rounded-lg p-6 cursor-pointer relative group shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-200 ease-in-out`}
      onClick={handleCardClick}
      style={{
        // Ensure the card has proper bounding box
        display: 'block',
        width: '100%',
        height: 'fit-content',
        // Prevent shadow from extending beyond card boundaries
        isolation: 'isolate'
      }}
    >
      
      {/* Delete button - only show for admin */}
      {canDelete && (
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
          <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <AlertDialogTrigger asChild>
              <button
                onClick={handleDeleteClick}
                className="p-2 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors delete-button"
                data-delete-action="true"
                disabled={isDeleting}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent onClick={(e) => e.stopPropagation()}>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Notebook</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{notebook.title}"? This action cannot be undone and will remove all sources, notes, and chat history associated with this notebook.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={(e) => e.stopPropagation()}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteConfirm();
                  }}
                  className="bg-red-600 hover:bg-red-700"
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
      
      <div className="flex items-center space-x-4 mb-4">
        <span className="text-2xl">{notebook.icon}</span>
        <div className="flex-1">
          <h3 className="font-medium text-gray-900 mb-1">{notebook.title}</h3>
          <p className="text-sm text-gray-600">{notebook.date}</p>
        </div>
      </div>
      
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>{notebook.sources} source{notebook.sources !== 1 ? 's' : ''}</span>
        {notebook.hasCollaborators && (
          <div className="flex -space-x-2">
            <div className="w-6 h-6 bg-blue-500 rounded-full border-2 border-white"></div>
            <div className="w-6 h-6 bg-green-500 rounded-full border-2 border-white"></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NotebookCard;
