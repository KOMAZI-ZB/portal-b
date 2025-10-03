import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Notification } from '../_models/notification';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { setPaginationHeaders } from './paginationHelper';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  getPaginatedNotifications(
    pageNumber: number,
    pageSize: number,
    typeFilter: string = '',
    readFilter: '' | 'read' | 'unread' = ''
  ): Observable<HttpResponse<Notification[]>> {
    let params = setPaginationHeaders(pageNumber, pageSize);

    if (typeFilter) params = params.append('TypeFilter', typeFilter);
    if (readFilter) params = params.append('ReadFilter', readFilter);

    return this.http.get<Notification[]>(`${this.baseUrl}notifications`, {
      observe: 'response',
      params
    });
  }

  create(formData: FormData): Observable<Notification> {
    return this.http.post<Notification>(`${this.baseUrl}notifications`, formData);
  }

  delete(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}notifications/${id}`);
  }

  markAsRead(id: number): Observable<any> {
    return this.http.post(`${this.baseUrl}notifications/${id}/read`, {});
  }

  // 🆕 persist "unread"
  markAsUnread(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}notifications/${id}/read`);
  }
}
