import { Link, useLocation } from "wouter";
import { Film, Image as ImageIcon, Library, Video } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="min-h-[100dvh] flex flex-col w-full">
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center w-full max-w-5xl mx-auto px-4">
          <Link href="/" className="flex items-center gap-2 mr-6 text-primary">
            <Video className="h-6 w-6" />
            <span className="text-xl font-bold tracking-tight">StoryMaker</span>
          </Link>
          
          <nav className="flex items-center gap-4 text-sm font-medium">
            <Link href="/">
              <Button variant={location === "/" ? "secondary" : "ghost"} className="gap-2">
                <ImageIcon className="w-4 h-4" />
                Studio
              </Button>
            </Link>
            <Link href="/projects">
              <Button variant={location.startsWith("/projects") ? "secondary" : "ghost"} className="gap-2">
                <Library className="w-4 h-4" />
                My Projects
              </Button>
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1 w-full max-w-5xl mx-auto px-4 py-8">
        {children}
      </main>
      
      <footer className="py-6 md:px-8 md:py-0 border-t">
        <div className="container flex flex-col items-center justify-center gap-4 md:h-16 md:flex-row max-w-5xl mx-auto text-sm text-muted-foreground">
          <p>
            StoryMaker Studio. Tell your stories.
          </p>
        </div>
      </footer>
    </div>
  );
}
