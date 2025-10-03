export interface Notification {
    id: number;
    type: string;
    title: string;
    message: string;
    imagePath?: string | null;
    createdBy: string;
    createdAt: string;
    moduleId?: number | null;

    // 🆕 Targeting + read receipts
    audience?: string;    // 'All' | 'Students' | 'Staff' | 'ModuleStudents'
    isRead?: boolean;
}
