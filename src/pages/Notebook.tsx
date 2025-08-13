
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, FileText, NotebookPen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useNotebooks } from '@/hooks/useNotebooks';
import { useSources } from '@/hooks/useSources';
import { useIsDesktop } from '@/hooks/useIsDesktop';
import NotebookHeader from '@/components/notebook/NotebookHeader';
import SourcesSidebar from '@/components/notebook/SourcesSidebar';
import ChatArea from '@/components/notebook/ChatArea';
import StudioSidebar from '@/components/notebook/StudioSidebar';
import MobileNotebookTabs from '@/components/notebook/MobileNotebookTabs';
import { Citation } from '@/types/message';

const Notebook = () => {
  const { id: notebookId } = useParams();
  const { notebooks } = useNotebooks();
  const { sources } = useSources(notebookId);
  const [selectedCitation, setSelectedCitation] = useState<Citation | null>(null);
  const [isSourcesCollapsed, setIsSourcesCollapsed] = useState(false);
  const [isStudioCollapsed, setIsStudioCollapsed] = useState(false);
  const isDesktop = useIsDesktop();

  const notebook = notebooks?.find(n => n.id === notebookId);
  const hasSource = sources && sources.length > 0;
  const isSourceDocumentOpen = !!selectedCitation;

  const handleCitationClick = (citation: Citation) => {
    setSelectedCitation(citation);
  };

  const handleCitationClose = () => {
    setSelectedCitation(null);
  };

  const toggleSources = () => {
    setIsSourcesCollapsed(!isSourcesCollapsed);
  };

  const toggleStudio = () => {
    setIsStudioCollapsed(!isStudioCollapsed);
  };

  // Improved responsive width calculations using CSS Grid and Flexbox
  const getLayoutClasses = () => {
    const sourcesOpen = !isSourcesCollapsed;
    const studioOpen = !isStudioCollapsed;
    
    // Base widths in pixels for better control
    const toggleButtonWidth = 32; // 8 * 4 = 32px (w-8)
    const sourcesMinWidth = isSourceDocumentOpen ? 400 : 280; // Minimum widths
    const studioMinWidth = 300;
    
    return {
      sourcesWidth: sourcesOpen ? `min-w-[${sourcesMinWidth}px] max-w-[35%]` : 'w-0',
      studioWidth: studioOpen ? `min-w-[${studioMinWidth}px] max-w-[30%]` : 'w-0',
      chatWidth: 'flex-1 min-w-0' // flex-1 with min-w-0 prevents overflow
    };
  };

  const layoutClasses = getLayoutClasses();

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      <NotebookHeader 
        title={notebook?.title || 'Untitled Notebook'} 
        notebookId={notebookId} 
      />
      
      {isDesktop ? (
        // Desktop layout with improved responsive design
        <div className="flex-1 flex overflow-hidden">
          {/* Sources Panel */}
          <div className={`${layoutClasses.sourcesWidth} flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden`}>
            {!isSourcesCollapsed && (
              <div className="w-full h-full">
                <SourcesSidebar 
                  hasSource={hasSource || false} 
                  notebookId={notebookId}
                  selectedCitation={selectedCitation}
                  onCitationClose={handleCitationClose}
                  setSelectedCitation={setSelectedCitation}
                />
              </div>
            )}
          </div>
          
          {/* Sources Toggle Button */}
          <div className="flex-shrink-0 w-8 flex items-center border-r border-gray-200">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleSources}
              className="h-full w-full rounded-none hover:bg-gray-100 flex flex-col items-center justify-center gap-1 py-4"
              title={isSourcesCollapsed ? 'Show Sources' : 'Hide Sources'}
            >
              {isSourcesCollapsed ? (
                <>
                  <ChevronRight className="h-4 w-4" />
                  <FileText className="h-4 w-4 text-gray-500" />
                </>
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          {/* Chat Area - Uses flex-1 to fill remaining space */}
          <div className={`${layoutClasses.chatWidth} transition-all duration-300 ease-in-out overflow-hidden`}>
            <ChatArea 
              hasSource={hasSource || false} 
              notebookId={notebookId}
              notebook={notebook}
              onCitationClick={handleCitationClick}
            />
          </div>
          
          {/* Studio Toggle Button */}
          <div className="flex-shrink-0 w-8 flex items-center border-l border-gray-200">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleStudio}
              className="h-full w-full rounded-none hover:bg-gray-100 flex flex-col items-center justify-center gap-1 py-4"
              title={isStudioCollapsed ? 'Show Studio' : 'Hide Studio'}
            >
              {isStudioCollapsed ? (
                <>
                  <ChevronLeft className="h-4 w-4" />
                  <NotebookPen className="h-4 w-4 text-gray-500" />
                </>
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </Button>
          </div>
          
          {/* Studio Panel */}
          <div className={`${layoutClasses.studioWidth} flex-shrink-0 transition-all duration-300 ease-in-out overflow-hidden`}>
            {!isStudioCollapsed && (
              <div className="w-full h-full">
                <StudioSidebar 
                  notebookId={notebookId} 
                  onCitationClick={handleCitationClick}
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        // Mobile/Tablet layout (tabs) - unchanged
        <MobileNotebookTabs
          hasSource={hasSource || false}
          notebookId={notebookId}
          notebook={notebook}
          selectedCitation={selectedCitation}
          onCitationClose={handleCitationClose}
          setSelectedCitation={setSelectedCitation}
          onCitationClick={handleCitationClick}
        />
      )}
    </div>
  );
};

export default Notebook;
