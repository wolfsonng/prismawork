import { API_BASE } from '../config';
import React, { useEffect, useState } from 'react';

export default function ProjectRootPanel() {
  const [root, setRoot] = useState('');
  const [status, setStatus] = useState<string>('');
  const [valid, setValid] = useState<boolean>(false);
  const [canBrowse, setCanBrowse] = useState<boolean>(true);
  const [projects, setProjects] = useState<{ currentRoot?: string; items?: Record<string, any> }>({});
  const [name, setName] = useState('');
  const [currentProjectId, setCurrentProjectId] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [existingProjects, setExistingProjects] = useState<{names: string[], paths: string[]}>({names: [], paths: []});
  const [editingProject, setEditingProject] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [editPath, setEditPath] = useState('');

  useEffect(() => {
    (async () => {
      try {
        // Detect platform dialog availability (mac/win ok; linux needs zenity/kdialog)
        const avail = await fetch(`${API_BASE}/api/system/dialog-availability`).then(r=>r.json()).catch(()=>({available:true}));
        setCanBrowse(!!avail.available);
        const r = await fetch(`${API_BASE}/api/settings`);
        const j = await r.json();
        setRoot(j.PROJECT_ROOT || j.SCRIPTS_CWD || j.SEEDS_CWD || '');
        if (j.PROJECT_ROOT) validate(j.PROJECT_ROOT);
        // load recent projects
        try {
          const pr = await fetch(`${API_BASE}/api/projects`).then(res=>res.json());
          setProjects(pr);

          // Set current project ID based on currentRoot
          if (pr.currentRoot && pr.items[pr.currentRoot]?.id) {
            setCurrentProjectId(pr.items[pr.currentRoot].id);
          } else {
            setCurrentProjectId(null);
          }

          // Load existing project data for validation
          const names: string[] = [];
          const paths: string[] = [];
          Object.entries(pr.items || {}).forEach(([path, data]: [string, any]) => {
            if (data?.name) names.push(data.name.toLowerCase());
            paths.push(path);
          });
          setExistingProjects({names, paths});
        } catch {}
      } catch {}
    })();
  }, []);

  async function browse() {
    setStatus('');
    try {
      const r = await fetch(`${API_BASE}/api/system/choose-folder`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: 'Select project root (contains package.json and prisma/schema.prisma)' }) });
      const text = await r.text();
      let j: any = {};
      try { j = JSON.parse(text); } catch { setStatus('Folder dialog returned non-JSON (is the backend running at localhost:6580?)'); return; }
      if (r.ok && j.path) {
        setRoot(j.path);
        // auto-validate but don't save - let user hit Create Project button
        try {
          const vr = await fetch(`${API_BASE}/api/system/validate-project?path=${encodeURIComponent(j.path)}`);
          const vt = await vr.text();
          const vj = JSON.parse(vt);
          if (vj.ok) {
            setValid(true);
            setStatus('Path validated - ready to create project');
          } else {
            setValid(false);
            setStatus('Selected folder missing package.json or prisma/schema.prisma');
          }
        } catch {}
      } else setStatus(j.error || 'Cancelled');
    } catch (e: any) { setStatus(e?.message || 'Dialog failed'); }
  }

  async function validate(p?: string) {
    try {
      const r = await fetch(`${API_BASE}/api/system/validate-project?path=${encodeURIComponent(p ?? root)}`);
      const text = await r.text();
      let j: any = {};
      try { j = JSON.parse(text); } catch { setStatus('Backend returned non-JSON. Ensure server is running at localhost:6580.'); setValid(false); return; }
      if (j.ok) { setValid(true); setStatus('Looks good'); }
      else { setValid(false); setStatus(`Missing: ${!j.hasPackageJson?'package.json ':''}${!j.hasSchema?'prisma/schema.prisma':''}`.trim()); }
    } catch (e: any) { setStatus(e?.message || 'Validate failed'); setValid(false); }
  }

  async function save() {
    if (!root.trim()) {
      setStatus('Project path is required');
      return;
    }
    if (!name.trim()) {
      setStatus('Project name is required');
      return;
    }

    try {
      // Use create project API to ensure proper structure with ID
      const r = await fetch(`${API_BASE}/api/projects/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root, name })
      });

      if (!r.ok) {
        const errorText = await r.text();
        let errorData: any = {};
        try { errorData = JSON.parse(errorText); } catch {}
        setStatus(errorData.error || `Server error: ${r.status}`);
        return;
      }

      const j = await r.json();
      if (j.ok) {
        setStatus(`Project "${name}" saved with ID ${j.id}`);
        setCurrentProjectId(j.id);
        await refreshProjects();
      } else {
        setStatus(j.error || 'Save failed');
      }
    } catch (e: any) { setStatus(e?.message || 'Save failed'); }
  }

  function validateProjectInput() {
    if (!root.trim()) {
      setStatus('Project path is required');
      return false;
    }
    if (!name.trim()) {
      setStatus('Project name is required');
      return false;
    }
    if (existingProjects.paths.includes(root)) {
      setStatus('A project with this directory already exists');
      return false;
    }
    if (existingProjects.names.includes(name.toLowerCase())) {
      setStatus('A project with this name already exists');
      return false;
    }
    return true;
  }

  async function createNewProject() {
    if (!validateProjectInput()) return;

    try {
      const r = await fetch(`${API_BASE}/api/projects/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ root, name })
      });
      if (!r.ok) {
        const errorText = await r.text();
        let errorData: any = {};
        try { errorData = JSON.parse(errorText); } catch {}
        setStatus(errorData.error || `Server error: ${r.status}`);
        return;
      }

      const j = await r.json();
      if (j.ok) {
        setStatus(`Created project "${name}" with ID ${j.id}`);
        setCurrentProjectId(j.id);
        setShowCreateForm(false);
        // refresh list
        await refreshProjects();
      } else {
        setStatus(j.error || 'Create failed');
      }
    } catch (e: any) { setStatus(e?.message || 'Create failed'); }
  }

  async function deleteProject(id: number) {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    try {
      const r = await fetch(`${API_BASE}/api/projects/delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });

      if (!r.ok) {
        const errorText = await r.text();
        let errorData: any = {};
        try { errorData = JSON.parse(errorText); } catch {}
        setStatus(errorData.error || `Server error: ${r.status}`);
        return;
      }

      const j = await r.json();
      if (j.ok) {
        setStatus('Project deleted successfully');
        setCurrentProjectId(null);
        await refreshProjects();
      } else {
        setStatus(j.error || 'Delete failed');
      }
    } catch (e: any) { setStatus(e?.message || 'Delete failed'); }
  }

  async function refreshProjects() {
    try {
      const pr = await fetch(`${API_BASE}/api/projects`).then(res=>res.json());
      setProjects(pr);

      // Update current project ID based on currentRoot
      if (pr.currentRoot && pr.items[pr.currentRoot]?.id) {
        setCurrentProjectId(pr.items[pr.currentRoot].id);
      } else {
        setCurrentProjectId(null);
      }

      // Update existing project data for validation
      const names: string[] = [];
      const paths: string[] = [];
      Object.entries(pr.items || {}).forEach(([path, data]: [string, any]) => {
        if (data?.name) names.push(data.name.toLowerCase());
        paths.push(path);
      });
      setExistingProjects({names, paths});
    } catch {}
  }

  function startEditing(projectId: number, currentName: string, currentPath: string) {
    setEditingProject(projectId);
    setEditName(currentName);
    setEditPath(currentPath);
  }

  function cancelEditing() {
    setEditingProject(null);
    setEditName('');
    setEditPath('');
  }

  async function saveProjectEdit() {
    if (!editingProject) return;

    if (!editName.trim()) {
      setStatus('Project name is required');
      return;
    }
    if (!editPath.trim()) {
      setStatus('Project path is required');
      return;
    }

    // Validate the new directory if path is being changed
    const currentProject = getProjectById(editingProject);
    if (currentProject.root && editPath.trim() !== currentProject.root) {
      setStatus('Validating new directory...');
      try {
        const vr = await fetch(`${API_BASE}/api/system/validate-project?path=${encodeURIComponent(editPath.trim())}`);
        const vt = await vr.text();
        const vj = JSON.parse(vt);
        if (!vj.ok) {
          setStatus(`New directory validation failed: ${!vj.hasPackageJson?'Missing package.json ':''}${!vj.hasSchema?'Missing prisma/schema.prisma':''}`.trim());
          return;
        }
      } catch (e) {
        setStatus('Failed to validate new directory');
        return;
      }
    }

    try {
      const r = await fetch(`${API_BASE}/api/projects/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingProject,
          name: editName.trim(),
          path: editPath.trim()
        })
      });

      if (!r.ok) {
        const errorText = await r.text();
        let errorData: any = {};
        try { errorData = JSON.parse(errorText); } catch {}
        setStatus(errorData.error || `Server error: ${r.status}`);
        return;
      }

      const j = await r.json();
      if (j.ok) {
        setStatus('Project updated successfully');
        setEditingProject(null);
        setEditName('');
        setEditPath('');
        await refreshProjects();
      } else {
        setStatus(j.error || 'Update failed');
      }
    } catch (e: any) {
      setStatus(e?.message || 'Update failed');
    }
  }

  function getProjectById(id: number) {
    // Helper function to get project by ID from current state
    for (const [path, data] of Object.entries(projects.items || {})) {
      if (data?.id === id) {
        return { root: path, data };
      }
    }
    return { root: null, data: null };
  }

  async function switchProject(id: number) {
    try {
      const r = await fetch(`${API_BASE}/api/projects/switch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });

      if (!r.ok) {
        setStatus(`Server error: ${r.status} ${r.statusText}`);
        return;
      }

      const text = await r.text();
      let j: any = {};
      try {
        j = JSON.parse(text);
      } catch (parseError) {
        setStatus(`Invalid response from server: ${text.substring(0, 100)}...`);
        return;
      }

      if (j.ok) {
        setCurrentProjectId(id);
        setStatus('Project switched successfully');
        // Refresh projects to get updated current project
        await refreshProjects();
        // Reload page to refresh all components with new project data
        window.location.reload();
      } else {
        setStatus(j.error || 'Switch failed');
      }
    } catch (e: any) {
      setStatus(`Network error: ${e?.message || 'Switch failed'}`);
    }
  }

  return (
    <div id="project-root-panel" className="bg-white dark:bg-gray-900 rounded border dark:border-gray-700 p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">Project Management</h2>
        <button
          className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 transition-colors"
          onClick={() => setShowCreateForm(!showCreateForm)}
        >
          {showCreateForm ? 'Cancel' : '+ New Project'}
        </button>
      </div>

      {/* Current Project Display */}
      {currentProjectId && projects.items && (
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="font-medium text-blue-900 dark:text-blue-200 mb-2">
                Current Project: #{currentProjectId}
              </h3>

              {editingProject === currentProjectId ? (
                <div className="space-y-2">
                  <div>
                    <label className="block text-xs font-medium text-blue-800 dark:text-blue-300 mb-1">
                      Project Name
                    </label>
                    <input
                      className="w-full border rounded px-2 py-1 text-sm"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="Project name"
                    />
                  </div>
                                      <div>
                      <label className="block text-xs font-medium text-blue-800 dark:text-blue-300 mb-1">
                        Project Path
                      </label>
                      <div className="flex gap-2">
                        <input
                          className="flex-1 border rounded px-2 py-1 text-sm"
                          value={editPath}
                          onChange={(e) => setEditPath(e.target.value)}
                          placeholder="/path/to/project"
                        />
                        <button
                          className="px-2 py-1 rounded bg-gray-500 text-white hover:bg-gray-600 transition-colors text-xs"
                          onClick={async () => {
                            if (!editPath.trim()) {
                              setStatus('Please enter a path to validate');
                              return;
                            }
                            setStatus('Validating directory...');
                            try {
                              const vr = await fetch(`${API_BASE}/api/system/validate-project?path=${encodeURIComponent(editPath.trim())}`);
                              const vt = await vr.text();
                              const vj = JSON.parse(vt);
                              if (vj.ok) {
                                setStatus('Directory validated successfully');
                              } else {
                                setStatus(`Validation failed: ${!vj.hasPackageJson?'Missing package.json ':''}${!vj.hasSchema?'Missing prisma/schema.prisma':''}`.trim());
                              }
                            } catch (e) {
                              setStatus('Failed to validate directory');
                            }
                          }}
                        >
                          Validate
                        </button>
                      </div>
                    </div>
                  <div className="flex gap-2">
                    <button
                      className="px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 transition-colors text-xs"
                      onClick={saveProjectEdit}
                    >
                      Save
                    </button>
                    <button
                      className="px-2 py-1 rounded bg-gray-500 text-white hover:bg-gray-600 transition-colors text-xs"
                      onClick={cancelEditing}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {projects.items[projects.currentRoot || '']?.name || 'Unnamed Project'}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                    {projects.currentRoot}
                  </p>
                </div>
              )}
            </div>
            <div className="flex gap-2 ml-4">
              {editingProject !== currentProjectId && (
                <button
                  className="px-3 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm"
                  onClick={() => {
                    const currentProject = projects.items[projects.currentRoot || ''];
                    if (currentProject) {
                      startEditing(currentProjectId, currentProject.name || '', projects.currentRoot || '');
                    }
                  }}
                >
                  Edit
                </button>
              )}
              <button
                className="px-3 py-1 rounded bg-red-600 text-white hover:bg-red-700 transition-colors text-sm"
                onClick={() => deleteProject(currentProjectId)}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Project List */}
      {projects.items && Object.keys(projects.items).length > 0 && (
        <div className="space-y-2">
          <h3 className="font-medium text-gray-700 dark:text-gray-300">Available Projects</h3>
          <div className="grid gap-2">
            {Object.entries(projects.items).map(([path, data]: [string, any]) => (
              <div
                key={path}
                className={`p-3 rounded border transition-colors ${
                  data?.id === currentProjectId
                    ? 'bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700'
                    : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {editingProject === data?.id ? (
                  <div className="space-y-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Project Name
                      </label>
                      <input
                        className="w-full border rounded px-2 py-1 text-sm"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="Project name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Project Path
                      </label>
                      <div className="flex gap-2">
                        <input
                          className="flex-1 border rounded px-2 py-1 text-sm"
                          value={editPath}
                          onChange={(e) => setEditPath(e.target.value)}
                          placeholder="/path/to/project"
                        />
                        <button
                          className="px-2 py-1 rounded bg-gray-500 text-white hover:bg-gray-600 transition-colors text-xs"
                          onClick={async () => {
                            if (!editPath.trim()) {
                              setStatus('Please enter a path to validate');
                              return;
                            }
                            setStatus('Validating directory...');
                            try {
                              const vr = await fetch(`${API_BASE}/api/system/validate-project?path=${encodeURIComponent(editPath.trim())}`);
                              const vt = await vr.text();
                              const vj = JSON.parse(vt);
                              if (vj.ok) {
                                setStatus('Directory validated successfully');
                              } else {
                                setStatus(`Validation failed: ${!vj.hasPackageJson?'Missing package.json ':''}${!vj.hasSchema?'Missing prisma/schema.prisma':''}`.trim());
                              }
                            } catch (e) {
                              setStatus('Failed to validate directory');
                            }
                          }}
                        >
                          Validate
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        className="px-2 py-1 rounded bg-green-600 text-white hover:bg-green-700 transition-colors text-xs"
                        onClick={saveProjectEdit}
                      >
                        Save
                      </button>
                      <button
                        className="px-2 py-1 rounded bg-gray-500 text-white hover:bg-gray-600 transition-colors text-xs"
                        onClick={cancelEditing}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div
                      className="flex-1 cursor-pointer"
                      onClick={() => data?.id && switchProject(data.id)}
                    >
                      <div className="font-medium">
                        {data?.id ? `#${data.id} - ` : ''}{data?.name || 'Unnamed Project'}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400 truncate">
                        {path}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {data?.id === currentProjectId && (
                        <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Active
                        </span>
                      )}
                      <button
                        className="px-2 py-1 rounded text-xs bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEditing(data.id, data.name || '', path);
                        }}
                      >
                        Edit
                      </button>
                      <button
                        className="px-2 py-1 rounded text-xs bg-red-600 text-white hover:bg-red-700 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteProject(data.id);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create New Project Form */}
      {showCreateForm && (
        <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4 space-y-4">
          <h3 className="font-medium text-green-900 dark:text-green-200">Create New Project</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Project Path *
              </label>
              <div className="flex gap-2">
                <input
                  className="flex-1 border rounded px-3 py-2"
                  value={root}
                  onChange={(e)=>setRoot(e.target.value)}
                  placeholder="/path/to/your-project"
                />
                <button
                  className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-800 dark:text-gray-100 disabled:opacity-60"
                  onClick={browse}
                  disabled={!canBrowse}
                  title={canBrowse? 'Pick via system dialog' : 'Folder dialog not available'}
                >
                  Browse
                </button>
                <button
                  className="px-3 py-2 rounded bg-gray-200 dark:bg-gray-800 dark:text-gray-100"
                  onClick={()=>validate()}
                >
                  Validate
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Project Name *
              </label>
              <input
                className="w-full border rounded px-3 py-2"
                value={name}
                onChange={(e)=>setName(e.target.value)}
                placeholder="My Awesome Project"
              />
            </div>
            <div className="flex gap-2">
              <button
                className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-60"
                onClick={createNewProject}
                disabled={!root.trim() || !name.trim()}
              >
                Create Project
              </button>
              <button
                className="px-4 py-2 rounded bg-gray-200 dark:bg-gray-800 dark:text-gray-100 hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors"
                onClick={() => setShowCreateForm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Messages */}
      {status && (
        <div className={`p-3 rounded text-sm ${
          status.includes('error') || status.includes('failed') || status.includes('required') || status.includes('already exists')
            ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
            : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
        }`}>
          {status}
        </div>
      )}

      {/* Help Text */}
      <div className="text-sm text-gray-600 dark:text-gray-400">
        <p>• Each project maintains its own database configurations and settings</p>
        <p>• Project paths must contain package.json and prisma/schema.prisma</p>
        <p>• All project data is stored locally and never sent to external servers</p>
      </div>
    </div>
  );
}
