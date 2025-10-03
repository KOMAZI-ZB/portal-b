// src/app/_models/repository.model.ts

export interface Repository {
    id: number;
    label: string;       // e.g., "JoVE"
    linkUrl: string;     // e.g., "https://www.jove.com/"
    imageUrl?: string;   // Cloudinary-secured image URL (may fallback to default)
    image?: File;        // Optional file for upload (sent via FormData)
}
