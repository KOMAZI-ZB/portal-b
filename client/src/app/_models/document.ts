export interface Document {
    id: number;
    title: string;
    filePath: string;
    uploadedAt: string;
    uploadedBy: string;
    moduleId?: number | null;
}
