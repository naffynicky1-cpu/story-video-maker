import { Link } from "wouter";
import { 
  useListProjects, 
  useDeleteProject,
  getListProjectsQueryKey 
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Play, Edit, Trash2, Library, Plus } from "lucide-react";
import { useState } from "react";
import { VideoPreview } from "@/components/video-preview";
import type { Project } from "@workspace/api-client-react";

export function ProjectsPage() {
  const { data: projects, isLoading } = useListProjects();
  const deleteProjectMutation = useDeleteProject();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const [previewProject, setPreviewProject] = useState<Project | null>(null);

  const handleDelete = (id: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this project?")) return;

    deleteProjectMutation.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        toast({ title: "Project deleted" });
      },
      onError: () => {
        toast({ title: "Failed to delete", variant: "destructive" });
      }
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Library className="w-8 h-8 text-primary" />
            My Projects
          </h1>
          <p className="text-muted-foreground">All your saved stories in one place.</p>
        </div>
        <Link href="/">
          <Button size="lg" className="gap-2 shadow-sm">
            <Plus className="w-5 h-5" />
            New Story
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
        </div>
      ) : !projects || projects.length === 0 ? (
        <Card className="border-dashed border-2 shadow-none bg-muted/20">
          <CardContent className="p-16 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
              <Library className="w-10 h-10 text-primary/50" />
            </div>
            <div className="space-y-2">
              <h3 className="font-semibold text-2xl">No stories yet</h3>
              <p className="text-muted-foreground max-w-md mx-auto text-lg">
                Your library is empty. Time to create your first magical story video!
              </p>
            </div>
            <Link href="/">
              <Button size="lg" className="mt-4 gap-2">
                <Plus className="w-5 h-5" />
                Create a Story
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => (
            <Card key={project.id} className="overflow-hidden flex flex-col group hover-elevate transition-all border-2 border-transparent hover:border-primary/20 hover:shadow-lg">
              <div className="relative aspect-video bg-muted cursor-pointer overflow-hidden" onClick={() => setPreviewProject(project)}>
                {project.images && project.images.length > 0 ? (
                  <img 
                    src={project.images[0].url} 
                    alt={project.title} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-secondary/30">
                    <Library className="w-10 h-10 text-secondary-foreground/20" />
                  </div>
                )}
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full bg-primary/90 flex items-center justify-center text-white shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                    <Play className="w-6 h-6 ml-1" />
                  </div>
                </div>
                <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/60 backdrop-blur text-white text-xs rounded-md">
                  {project.images.length} frames
                </div>
              </div>
              
              <CardHeader className="pb-2 flex-1">
                <CardTitle className="line-clamp-1" title={project.title}>
                  {project.title}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {format(new Date(project.createdAt), 'MMM d, yyyy')}
                </p>
              </CardHeader>
              
              <CardFooter className="pt-2 gap-2 justify-between border-t bg-muted/10">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2 flex-1 hover:bg-primary/10 hover:text-primary hover:border-primary/30"
                  onClick={() => setPreviewProject(project)}
                >
                  <Play className="w-4 h-4" /> Watch
                </Button>
                <div className="flex gap-2">
                  <Link href={`/edit/${project.id}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                      <Edit className="w-4 h-4" />
                    </Button>
                  </Link>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    onClick={(e) => handleDelete(project.id, e)}
                    disabled={deleteProjectMutation.isPending}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {previewProject && (
        <VideoPreview
          open={!!previewProject}
          onOpenChange={(open) => !open && setPreviewProject(null)}
          images={previewProject.images}
          globalStory={previewProject.storyText}
        />
      )}
    </div>
  );
}
