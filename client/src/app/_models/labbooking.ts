export interface LabBooking {
    id?: number;            // Optional during creation
    userName?: string;    // Optional when posting a new booking (filled on the server)
    firstName?: string;     //   Added to match backend DTO
    lastName?: string;      //   Added to match backend DTO
    weekDays: string;
    startTime: string;      // 'HH:mm' format
    endTime: string;        // 'HH:mm' format
    bookingDate: string;    // 'yyyy-MM-dd' format
    description?: string;
}
