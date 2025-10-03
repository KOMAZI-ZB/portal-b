export interface AssessmentSchedule {
    id: number;
    title: string;
    // ✅ New: optional description for display/use where needed
    description?: string | null;

    moduleCode: string;
    date: string;              // ISO string format (e.g., '2025-03-10')
    startTime?: string | null; // 'HH:mm:ss' or null
    endTime?: string | null;   // 'HH:mm:ss' or null
    dueTime?: string | null;   // 'HH:mm:ss' or null
    venue?: string | null;
    semester: number;
    isTimed: boolean;          // ✅ Indicates whether the assessment is a timed session or a submission
}
