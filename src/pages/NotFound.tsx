import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-[calc(100dvh-10rem)] items-center justify-center bg-background">
      <div className="text-center px-6">
        <h1 className="mb-4 text-4xl font-bold">404</h1>
        <p className="mb-4 text-xl text-muted-foreground">Essa página não existe</p>
        <a href="/" className="text-primary underline hover:text-primary/80">
          Voltar pro início
        </a>
      </div>
    </div>
  );
};

export default NotFound;
