import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Module } from '../_models/module';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ModuleService {
  private baseUrl = environment.apiUrl + 'modules/';

  constructor(private http: HttpClient) { }

  // Admin/Coordinator: Get all modules in the system
  getAllModules(): Observable<Module[]> {
    return this.http.get<Module[]>(this.baseUrl);
  }

  // Admin or Student: Get modules by semester
  getModulesBySemester(semester: number): Observable<Module[]> {
    return this.http.get<Module[]>(`${this.baseUrl}semester/${semester}`);
  }

  // NEW: Get single module by id (used for header context)
  getModuleById(id: number): Observable<Module> {
    return this.http.get<Module>(`${this.baseUrl}${id}`);
  }

  // Admin: Add a new module
  addModule(moduleData: Partial<Module>): Observable<Module> {
    return this.http.post<Module>(this.baseUrl, moduleData);
  }

  // Admin: Update existing module with updated class schedule & assessments
  updateModule(id: number, moduleData: Partial<Module>): Observable<any> {
    return this.http.put(`${this.baseUrl}${id}`, moduleData);
  }

  // Admin: Delete module
  deleteModule(id: number): Observable<any> {
    return this.http.delete(`${this.baseUrl}${id}`);
  }

  // Lecturer/Coordinator: Get modules assigned to the current user
  getAssignedModules(): Observable<Module[]> {
    return this.http.get<Module[]>(`${this.baseUrl}assigned`);
  }
}
