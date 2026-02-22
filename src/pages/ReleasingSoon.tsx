import { Clock, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Countdown } from "@/components/addons/countdown";
import { useState, useEffect } from "react";

const ReleasingSoon = () => {
  // Target date: February 1st, 2026
  const targetDate = new Date("2026-08-01T00:00:00");
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    const checkComplete = () => {
      setIsComplete(new Date() >= targetDate);
    };
    checkComplete();
    const interval = setInterval(checkComplete, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);
            
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted">
      <div className="text-center flex flex-col items-center gap-6">
    
          <CheckCircle className="h-12 w-12 text-green-500" />
      

        <h1 className="text-4xl font-bold">
        Releasing Soon!
        </h1>

        <h2 className="text-lg font-bold">
        Stay tuned!
        </h2>
        
        <p className="text-xl text-muted-foreground max-w-md">
          We're working hard to bring you something amazing. Join our Discord for updates!
        </p>

        {/* Countdown */}
        <div className="text-foreground">
          <Countdown targetDate={targetDate} />
        </div>
        
        <p className="text-sm text-muted-foreground">
          Release on February 1st, 2026
        </p>

        {/* Button */}
        <Button variant="hero" size="xl" asChild>
          <a
            href="https://dcs.lol/lokrogaming"
            target="_blank"
            rel="noopener noreferrer"
          >
            Join Discord
          </a>
        </Button>
      </div>
    </div>
  );
};

export default ReleasingSoon;
