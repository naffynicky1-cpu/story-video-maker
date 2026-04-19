import { useState, useEffect, useRef } from "react";
import { useLocation, useParams } from "wouter";
import {
  useSearchImages,
  useCreateProject,
  useGetProject,
  getListProjectsQueryKey,
  type ProjectImage,
  type ImageResult
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, Play, Save, Image as ImageIcon, Music, X, Upload } from "lucide-react";
import { VideoPreview } from "@/components/video-preview";
import type React from "react";

interface EditableImage extends ProjectImage {
  id: string;
  selected: boolean;
}

export function StudioPage() {
  const [, setLocation] = useLocation();
  const params = useParams<{ id?: string }>();
  const isEditing = !!params.id;
  const projectId = params.id ? parseInt(params.id) : undefined;

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [storyText, setStoryText] = useState("");
  const [images, setImages] = useState<EditableImage[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);

  // Persistent Audio element — lives at studio level so we can play() in click handlers
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);

  useEffect(() => {
    audioElRef.current = new Audio();
    return () => {
      audioElRef.current?.pause();
      audioElRef.current = null;
    };
  }, []);

  useEffect(() => {
    const audio = audioElRef.current;
    if (!audio) return;
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    if (audioFile) {
      const url = URL.createObjectURL(audioFile);
      audioUrlRef.current = url;
      audio.src = url;
      audio.load();
    } else {
      audio.src = "";
    }
    return () => {
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, [audioFile]);

  const searchMutation = useSearchImages();
  const createProjectMutation = useCreateProject();

  const { data: projectData, isLoading: isLoadingProject } = useGetProject(projectId || 0, {
    query: {
      enabled: isEditing && !!projectId,
      queryKey: [`/api/projects/${projectId}`]
    }
  });

  useEffect(() => {
    if (projectData) {
      setTitle(projectData.title);
      setStoryText(projectData.storyText);
      setImages(projectData.images.map((img, i) => ({
        ...img,
        id: `edited-${i}`,
        selected: true
      })));
    }
  }, [projectData]);

  const handleSearch = () => {
    if (!storyText.trim()) {
      toast({ title: "Story needed", description: "Please type a story first to find photos." });
      return;
    }

    searchMutation.mutate({ data: { prompt: storyText, count: 12 } }, {
      onSuccess: (data) => {
        const newImages = data.images.map((img: ImageResult, i: number) => ({
          url: img.url,
          title: img.title,
          caption: "",
          durationMs: 3000,
          id: `new-${Date.now()}-${i}`,
          selected: true
        }));
        setImages(newImages);
        toast({ title: "Photos found!", description: `Found ${data.images.length} photos for your story.` });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to find photos. Try again.", variant: "destructive" });
      }
    });
  };

  const handleSave = () => {
    const selectedImages = images.filter(img => img.selected);
    if (selectedImages.length === 0) {
      toast({ title: "No photos", description: "Select at least one photo to save the project." });
      return;
    }

    const payload = {
      title: title.trim() || "My Story Video",
      storyText,
      images: selectedImages.map(img => ({
        url: img.url,
        title: img.title,
        caption: img.caption,
        durationMs: img.durationMs
      }))
    };

    createProjectMutation.mutate({ data: payload }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
        toast({ title: "Project saved!", description: "Your story video has been saved." });
        setLocation("/projects");
      },
      onError: () => {
        toast({ title: "Save failed", description: "Could not save your project.", variant: "destructive" });
      }
    });
  };

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setAudioFile(file);
    if (file) {
      toast({ title: "Audio added", description: `"${file.name}" will play in your video.` });
    }
  };

  const removeAudio = () => {
    setAudioFile(null);
    if (audioInputRef.current) audioInputRef.current.value = "";
  };

  const moveImage = (index: number, direction: "up" | "down") => {
    if (direction === "up" && index > 0) {
      const newImages = [...images];
      [newImages[index - 1], newImages[index]] = [newImages[index], newImages[index - 1]];
      setImages(newImages);
    } else if (direction === "down" && index < images.length - 1) {
      const newImages = [...images];
      [newImages[index + 1], newImages[index]] = [newImages[index], newImages[index + 1]];
      setImages(newImages);
    }
  };

  if (isLoadingProject) {
    return <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const selectedImages = images.filter(i => i.selected);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="space-y-2">
        <h1 className="text-4xl font-bold text-foreground">
          {isEditing ? "Edit Story" : "Create a Story"}
        </h1>
        <p className="text-muted-foreground text-lg">Type your story, find matching photos, and turn it into a magical video.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left Column: Script & Actions */}
        <div className="space-y-6 lg:col-span-1 flex flex-col">
          <Card className="flex-1 shadow-sm border-primary/20 bg-card overflow-hidden flex flex-col">
            <div className="p-4 border-b bg-muted/30">
              <Input
                placeholder="Name your project (e.g. Bedtime Story for Leo)"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="font-medium text-lg border-none shadow-none px-0 h-auto focus-visible:ring-0"
              />
            </div>
            <CardContent className="p-4 flex-1 flex flex-col gap-4">
              <div className="flex-1 flex flex-col gap-2">
                <label className="text-sm font-semibold text-foreground">Your Story Script</label>
                <Textarea
                  placeholder="Once upon a time, there was a little rat who absolutely loved cheddar cheese..."
                  className="flex-1 min-h-[180px] text-base resize-none"
                  value={storyText}
                  onChange={(e) => setStoryText(e.target.value)}
                />
              </div>

              {/* Audio Upload */}
              <div className="space-y-2">
                <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Music className="w-4 h-4 text-primary" />
                  Background Audio
                </label>
                {audioFile ? (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <Music className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-sm text-foreground flex-1 truncate">{audioFile.name}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={removeAudio}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => audioInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed border-primary/30 text-sm text-muted-foreground hover:border-primary/60 hover:text-primary hover:bg-primary/5 transition-all cursor-pointer"
                  >
                    <Upload className="w-4 h-4" />
                    Upload audio file (MP3, WAV, M4A)
                  </button>
                )}
                <input
                  ref={audioInputRef}
                  type="file"
                  accept="audio/*"
                  className="hidden"
                  onChange={handleAudioChange}
                />
              </div>

              <Button
                size="lg"
                className="w-full gap-2 text-lg h-14 shadow-md"
                onClick={handleSearch}
                disabled={searchMutation.isPending}
              >
                {searchMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                Find Magic Photos
              </Button>
            </CardContent>
          </Card>

          {images.length > 0 && (
            <Card className="shadow-sm bg-accent/20 border-accent/30">
              <CardContent className="p-6 space-y-4">
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Play className="w-5 h-5 text-primary" fill="currentColor" />
                  Ready to go?
                </h3>
                <p className="text-sm text-muted-foreground">
                  {selectedImages.length} photos selected{audioFile ? " · audio added" : ""}.
                </p>
                <div className="flex flex-col gap-3">
                  <Button
                    size="lg"
                    variant="secondary"
                    className="w-full gap-2 shadow-sm"
                    onClick={() => {
                      // Play audio INSIDE the click handler so browser allows it (user gesture)
                      const audio = audioElRef.current;
                      if (audioFile && audio && audio.src) {
                        audio.currentTime = 0;
                        audio.play().catch(() => {});
                      }
                      setIsPreviewOpen(true);
                    }}
                    disabled={selectedImages.length === 0}
                  >
                    <Play className="w-4 h-4" /> Preview &amp; Download
                  </Button>
                  <Button
                    size="lg"
                    className="w-full gap-2 shadow-sm"
                    onClick={handleSave}
                    disabled={createProjectMutation.isPending || selectedImages.length === 0}
                  >
                    {createProjectMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Project
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column: Image Grid */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-primary" />
              Photo Storyboard
            </h2>
            {images.length > 0 && (
              <span className="text-sm font-medium px-3 py-1 rounded-full bg-primary/10 text-primary">
                {selectedImages.length} selected
              </span>
            )}
          </div>

          {images.length === 0 ? (
            <Card className="border-dashed border-2 shadow-none bg-muted/20">
              <CardContent className="p-12 flex flex-col items-center justify-center text-center space-y-4 h-full min-h-[400px]">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <ImageIcon className="w-8 h-8 text-primary/50" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-lg">No photos yet</h3>
                  <p className="text-muted-foreground max-w-sm">
                    Write your story on the left and click "Find Magic Photos" to generate your storyboard.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {images.map((img, index) => (
                <Card
                  key={img.id}
                  className={`overflow-hidden transition-all duration-200 border-2 ${img.selected ? "border-primary shadow-md" : "border-transparent opacity-75 grayscale-[0.5]"}`}
                >
                  <div className="relative aspect-video group">
                    <img src={img.url} alt={img.title} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3">
                      <div className="flex justify-between items-start">
                        <Checkbox
                          checked={img.selected}
                          onCheckedChange={(checked) => {
                            const newImages = [...images];
                            newImages[index].selected = !!checked;
                            setImages(newImages);
                          }}
                          className="w-6 h-6 bg-background data-[state=checked]:bg-primary"
                        />
                        {img.selected && (
                          <div className="flex flex-col gap-1">
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-8 w-8 rounded-full shadow-sm opacity-90 hover:opacity-100"
                              onClick={() => moveImage(index, "up")}
                              disabled={index === 0}
                            >
                              ↑
                            </Button>
                            <Button
                              size="icon"
                              variant="secondary"
                              className="h-8 w-8 rounded-full shadow-sm opacity-90 hover:opacity-100"
                              onClick={() => moveImage(index, "down")}
                              disabled={index === images.length - 1}
                            >
                              ↓
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {img.selected && (
                    <div className="p-3 bg-card border-t">
                      <Input
                        placeholder="Optional: custom caption for this frame..."
                        value={img.caption || ""}
                        onChange={(e) => {
                          const newImages = [...images];
                          newImages[index].caption = e.target.value;
                          setImages(newImages);
                        }}
                        className="text-sm h-9"
                      />
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      <VideoPreview
        open={isPreviewOpen}
        onOpenChange={setIsPreviewOpen}
        images={selectedImages}
        globalStory={storyText}
        audioFile={audioFile}
        audioElRef={audioElRef}
      />
    </div>
  );
}
