import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { LabBooking } from '../_models/labbooking';

@Injectable({
  providedIn: 'root'
})
export class LabbookingService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  // ✅ View all lab bookings (for lab schedule grid)
  getAllBookings(): Observable<LabBooking[]> {
    return this.http.get<LabBooking[]>(`${this.baseUrl}scheduler/lab`);
  }

  // ✅ Get logged-in user's bookings (used for delete modal visibility)
  getMyBookings(): Observable<LabBooking[]> {
    return this.http.get<LabBooking[]>(`${this.baseUrl}scheduler/lab/user`);
  }

  // ✅ Create a lab booking (Lecturer/Coordinator/Admin only)
  createBooking(booking: LabBooking): Observable<any> {
    return this.http.post(`${this.baseUrl}scheduler/lab`, booking);
  }

  // ✅ Create a booking for a specific user (Admin only)
  createBookingForUser(userName: string, booking: LabBooking): Observable<any> {
    return this.http.post(`${this.baseUrl}scheduler/lab/assign/${userName}`, booking);
  }

  // ✅ Delete an existing lab booking (only if authorized)
  deleteBooking(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}scheduler/lab/${id}`);
  }
}
