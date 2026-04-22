import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, FolderOpen, Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

type Project = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  stage: string;
  assets: any[];
};

const STORAGE_KEY = "interior_projects";

const Dashboard = () => {
  const nav = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectName, setProjectName] = useState("");
  const [creating, setCreating] = useState(false);

  const loadProjects = () => {
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      const parsed: Project[] = data ? JSON.parse(data) : [];
      setProjects(parsed);
    } catch (error) {
      console.error("Failed to load projects:", error);
      setProjects([]);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const createLocalProject = (name = "Untitled Project") => {
    const existing = localStorage.getItem(STORAGE_KEY);
    const allProjects: Project[] = existing ? JSON.parse(existing) : [];

    const newProject: Project = {
      id: crypto.randomUUID(),
      name: name.trim() || "Untitled Project",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      stage: "floor_plan",
      assets: [],
    };

    const updatedProjects = [newProject, ...allProjects];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProjects));

    return newProject;
  };

  const handleCreateProject = () => {
    setCreating(true);

    try {
      const project = createLocalProject(projectName);
      setProjectName("");
      loadProjects();

      toast({
        title: "Project created",
        description: `${project.name} is ready.`,
      });

      nav(`/project/${project.id}`);
    } catch (error: any) {
      toast({
        title: "Failed to create project",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProject = (id: string) => {
    try {
      const existing = localStorage.getItem(STORAGE_KEY);
      const allProjects: Project[] = existing ? JSON.parse(existing) : [];
      const updatedProjects = allProjects.filter((project) => project.id !== id);

      localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedProjects));
      setProjects(updatedProjects);

      toast({
        title: "Project deleted",
        description: "The project was removed from local storage.",
      });
    } catch (error: any) {
      toast({
        title: "Failed to delete project",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-primary shadow-glow">
              <Sparkles className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-semibold">Interior AI Studio</h1>
              <p className="text-sm text-muted-foreground">
                Create and manage your interior design projects
              </p>
            </div>
          </div>

          <Button variant="outline" onClick={() => nav("/")}>
            Back to Home
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        <Card className="mb-8 border-border bg-card/80 p-6 shadow-elegant">
          <div className="mb-4">
            <h2 className="font-display text-xl font-semibold">Create New Project</h2>
            <p className="text-sm text-muted-foreground">
              Start a new interior design workflow from a floor plan.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            <Input
              placeholder="Enter project name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateProject();
              }}
              className="md:flex-1"
            />
            <Button
              onClick={handleCreateProject}
              disabled={creating}
              className="bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
            >
              <Plus className="mr-2 h-4 w-4" />
              {creating ? "Creating..." : "Create Project"}
            </Button>
          </div>
        </Card>

        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold">Your Projects</h2>
            <p className="text-sm text-muted-foreground">
              Stored locally in your browser for now.
            </p>
          </div>
          <span className="text-sm text-muted-foreground">
            {projects.length} {projects.length === 1 ? "project" : "projects"}
          </span>
        </div>

        {projects.length === 0 ? (
          <Card className="border-dashed border-border bg-card/60 p-10 text-center">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-full bg-muted">
              <FolderOpen className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-display text-lg font-semibold">No projects yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Create your first project to begin generating interior design concepts.
            </p>
            <Button
              onClick={handleCreateProject}
              className="mt-6 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create First Project
            </Button>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="group border-border bg-card/80 p-5 shadow-elegant transition hover:-translate-y-1 hover:shadow-xl"
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-display text-lg font-semibold">
                      {project.name}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Stage: {project.stage}
                    </p>
                  </div>

                  <button
                    onClick={() => handleDeleteProject(project.id)}
                    className="rounded-md p-2 text-muted-foreground transition hover:bg-muted hover:text-destructive"
                    aria-label="Delete project"
                    type="button"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>Created: {formatDate(project.createdAt)}</p>
                  <p>Updated: {formatDate(project.updatedAt)}</p>
                  <p>Assets: {project.assets?.length || 0}</p>
                </div>

                <div className="mt-5 flex gap-3">
                  <Button
                    onClick={() => nav(`/project/${project.id}`)}
                    className="flex-1 bg-gradient-primary text-primary-foreground shadow-glow hover:opacity-90"
                  >
                    Open Project
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;