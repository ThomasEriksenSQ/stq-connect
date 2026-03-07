import { useLocation } from "react-router-dom";
import { useEffect } from "react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <h1 className="mb-3 text-[1.5rem] font-bold text-foreground">404</h1>
        <p className="mb-4 text-[0.9375rem] text-muted-foreground">Siden ble ikke funnet</p>
        <a href="/" className="text-[0.8125rem] text-primary hover:underline">
          Tilbake til forsiden
        </a>
      </div>
    </div>
  );
};

export default NotFound;
