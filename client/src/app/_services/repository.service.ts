// src/app/_services/repository.service.ts

import { HttpClient, HttpParams, HttpResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Repository } from '../_models/repository';
import { Document } from '../_models/document';
import { setPaginationHeaders } from './paginationHelper';

@Injectable({
  providedIn: 'root'
})
export class RepositoryService {
  private baseUrl = environment.apiUrl + 'repository';

  constructor(private http: HttpClient) { }

  // ✅ Get external academic repositories (paginated)
  getExternalRepositories(pageNumber: number, pageSize: number): Observable<HttpResponse<Repository[]>> {
    const params = setPaginationHeaders(pageNumber, pageSize);
    return this.http.get<Repository[]>(`${this.baseUrl}/external`, {
      observe: 'response',
      params
    });
  }

  // ✅ Add a new external repository with optional image upload or fallback
  addExternalRepository(repo: Repository, useDefault: boolean = false): Observable<Repository> {
    const formData = new FormData();
    formData.append('label', repo.label);
    formData.append('linkUrl', repo.linkUrl);
    formData.append('useDefault', useDefault.toString());

    if (repo.image && !useDefault) {
      formData.append('image', repo.image);
    }

    return this.http.post<Repository>(`${this.baseUrl}/external`, formData);
  }

  // ✅ Delete an external repository by ID
  deleteExternalRepository(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/external/${id}`);
  }

  // ✅ Get internal repository documents (paginated)
  getInternalRepositoryDocs(pageNumber: number, pageSize: number): Observable<HttpResponse<Document[]>> {
    const params = setPaginationHeaders(pageNumber, pageSize);
    return this.http.get<Document[]>(`${this.baseUrl}`, {
      observe: 'response',
      params
    });
  }

  // ✅ Upload document to internal repository
  uploadToRepository(formData: FormData): Observable<Document> {
    return this.http.post<Document>(`${this.baseUrl}/upload`, formData);
  }

  // ✅ Delete document from internal repository
  deleteRepositoryDocument(documentId: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}/${documentId}`);
  }
}
