import { useState, useEffect, useCallback } from "react";

interface ChecklistItem {
  activity_name: string;
  activity_time: string | null;
  completed: boolean;
}

interface RoutineData {
  wake_time: string;
  work_start: string;
}

export function useEnergy(
  checklist: ChecklistItem[], 
  routineData: RoutineData | null,
  currentTimeMinutes: number
) {
  const [energy, setEnergy] = useState(50); // Start at 50 energy

  const calculateEnergy = useCallback(() => {
    if (!routineData) return 50;
    
    let newEnergy = 50; // Base energy

    // Find wake up activity
    const wakeActivity = checklist.find(
      item => item.activity_name.toLowerCase().includes("acordar")
    );

    // Find work start activity  
    const workActivity = checklist.find(
      item => item.activity_name.toLowerCase().includes("trabalhar") || 
              item.activity_name.toLowerCase().includes("vender")
    );

    // +10 if woke up on time (completed wake activity)
    if (wakeActivity?.completed) {
      const [wakeH, wakeM] = (wakeActivity.activity_time || "00:00").split(":").map(Number);
      const wakeTimeMinutes = wakeH * 60 + wakeM;
      
      // Check if completed within 15 minutes of scheduled time
      if (currentTimeMinutes <= wakeTimeMinutes + 15) {
        newEnergy += 10;
      }
    }

    // +15 if started work on time
    if (workActivity?.completed) {
      const [workH, workM] = (workActivity.activity_time || "00:00").split(":").map(Number);
      const workTimeMinutes = workH * 60 + workM;
      
      if (currentTimeMinutes <= workTimeMinutes + 15) {
        newEnergy += 15;
      }
    }

    // Check for late activities: -5 for each
    checklist.forEach(item => {
      if (!item.activity_time) return;
      
      const [itemH, itemM] = item.activity_time.split(":").map(Number);
      const itemMinutes = itemH * 60 + itemM;
      
      // If activity time has passed by more than 30 minutes and not completed
      if (currentTimeMinutes > itemMinutes + 30 && !item.completed) {
        newEnergy -= 5;
      }
    });

    // Bonus for completing activities
    const completedCount = checklist.filter(item => item.completed).length;
    newEnergy += completedCount * 3;

    // Keep energy between 0 and 100
    return Math.max(0, Math.min(100, newEnergy));
  }, [checklist, routineData, currentTimeMinutes]);

  useEffect(() => {
    const newEnergy = calculateEnergy();
    setEnergy(newEnergy);
  }, [calculateEnergy]);

  return energy;
}
