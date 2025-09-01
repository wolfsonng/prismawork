import React, { useState, useEffect } from 'react';
import { API_BASE } from './config';
import ThemeToggle from './components/ThemeToggle';
import ProfileEditor from './components/ProfileEditor';
import PrismaActionsPanel from './components/PrismaActionsPanel';
import ConsolePanel from './components/ConsolePanel';
import SafetyPanel from './components/SafetyPanel';
import BackupPanel from './components/BackupPanel';
import VersionsPanel from './components/VersionsPanel';
import DiffViewer from './components/DiffViewer';
import Dashboard from './components/Dashboard';
import Education from './pages/Education';
import SchemaFileDiff from './components/SchemaFileDiff';
import ProjectRootPanel from './components/ProjectRootPanel';
import StudioPanel from './components/StudioPanel';
import PendingMigrationsTable from './components/PendingMigrationsTable';
import CertsPanel from './components/CertsPanel';
import SeedsPanel from './components/SeedsPanel';
import RootBanner from './components/RootBanner';

function App() {
  const [taskId, setTaskId] = useState<string | undefined>();
  const [view, setView] = useState<'education' | 'toolkit'>('toolkit');
  const [initialized, setInitialized] = useState(false);

    // Initialize project on app start
  useEffect(() => {
    const initializeProject = async () => {
      try {
        // Get current project state instead of forcing project 1
        const response = await fetch(`${API_BASE}/api/projects`);
        const projects = await response.json();

        // If there's a current project, ensure it's properly set
        if (projects.currentRoot && projects.items[projects.currentRoot]) {
          const currentProject = projects.items[projects.currentRoot];
          if (currentProject.id) {
            // Ensure the current project is properly set
            await fetch(`${API_BASE}/api/projects/switch`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ id: currentProject.id })
            });
          }
        }
      } catch (error) {
        console.log('Error initializing project:', error);
      } finally {
        setInitialized(true);
      }
    };

    initializeProject();
  }, []);
  if (!initialized) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-950 dark:text-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-semibold mb-2">Loading...</div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Initializing project management</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-950 dark:text-gray-100">
      <div className="sticky top-0 bg-white dark:bg-gray-900 border-b dark:border-gray-800 px-6 py-3 flex items-center gap-2">
        <div className="font-semibold">Prisma + Supabase Utility</div>
        <div className="ml-4 flex gap-2">
          <button className={`px-3 py-1 rounded ${view==='education'?'bg-blue-600 text-white':'border'}`} onClick={() => setView('education')}>Education</button>
          <button className={`px-3 py-1 rounded ${view==='toolkit'?'bg-blue-600 text-white':'border'}`} onClick={() => setView('toolkit')}>Toolkit</button>
        </div>
        <div className="ml-auto"><ThemeToggle /></div>
      </div>

      {view === 'education' ? (
        <Education />
      ) : (
        <div className="p-6 space-y-6">
          <ProjectRootPanel />
          <Dashboard onTask={setTaskId} />
          <ProfileEditor />
          <SeedsPanel onTask={setTaskId} />
          <PrismaActionsPanel onTask={setTaskId} />
          <StudioPanel />
          <DiffViewer />
          <SchemaFileDiff />
          <SafetyPanel />
          <PendingMigrationsTable />
          <BackupPanel />
          <VersionsPanel />
          <CertsPanel />
          <ConsolePanel taskId={taskId} />
        </div>
      )}
    </div>
  );
}

export default App;
