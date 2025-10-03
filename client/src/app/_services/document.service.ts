import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Document } from '../_models/document';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { setPaginationHeaders } from './paginationHelper';

@Injectable({
  providedIn: 'root'
})
export class DocumentService {
  private baseUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  // =============================
  // 🔹 Module Documents (per Module)
  // =============================

  // Non-paginated
  getDocumentsByModule(moduleId: number): Observable<Document[]> {
    return this.http.get<Document[]>(`${this.baseUrl}documents/module/${moduleId}`);
  }

  // ✅ Paginated module documents
  getDocumentsByModulePaged(moduleId: number, pageNumber: number, pageSize: number): Observable<HttpResponse<Document[]>> {
    const params = setPaginationHeaders(pageNumber, pageSize);
    return this.http.get<Document[]>(`${this.baseUrl}documents/module/${moduleId}/paged`, {
      observe: 'response',
      params
    });
  }

  getAllModuleDocuments(): Observable<Document[]> {
    return this.http.get<Document[]>(`${this.baseUrl}documents/all`);
  }

  uploadModuleDocument(data: FormData): Observable<Document> {
    return this.http.post<Document>(`${this.baseUrl}documents/upload`, data);
  }

  deleteModuleDocument(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}documents/${id}`);
  }

  // =============================
  // 🔹 Internal Repository Documents (General)
  // =============================

  // ✅ Paginated internal repository documents
  getInternalRepositoryDocuments(pageNumber: number, pageSize: number): Observable<HttpResponse<Document[]>> {
    const params = setPaginationHeaders(pageNumber, pageSize);
    return this.http.get<Document[]>(`${this.baseUrl}repository`, {
      observe: 'response',
      params
    });
  }

  uploadRepositoryDocument(data: FormData): Observable<Document> {
    return this.http.post<Document>(`${this.baseUrl}repository/upload`, data);
  }

  deleteRepositoryDocument(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}repository/${id}`);
  }
}
