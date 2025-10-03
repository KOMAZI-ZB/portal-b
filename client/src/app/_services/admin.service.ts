import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { User } from '../_models/user';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiUrl;

  //   Register a new user (Admin-only)
  registerUser(model: any) {
    return this.http.post<{ message: string }>(`${this.baseUrl}admin/register-user`, model);
  }

  //   Get all users with modules and roles
  getAllUsers() {
    return this.http.get<User[]>(`${this.baseUrl}admin/all-users`);
  }

  //   Get users by specific role
  getUsersByRole(role: string) {
    return this.http.get<User[]>(`${this.baseUrl}admin/users-by-role/${role}`);
  }

  //   Get users who are not assigned to any modules
  getUsersWithNoModules() {
    return this.http.get<User[]>(`${this.baseUrl}admin/users-with-no-modules`);
  }

  //   Update modules assigned to user
  updateUserModules(userName: string, semester1ModuleIds: number[], semester2ModuleIds: number[]) {
    return this.http.put(`${this.baseUrl}admin/update-modules/${userName}`, {
      semester1ModuleIds,
      semester2ModuleIds
    });
  }

  //   Delete a user by userName
  deleteUser(userName: string) {
    return this.http.delete(`${this.baseUrl}admin/delete-user/${userName}`);
  }

  //   Get users and their role claims (for role editing modal)
  getUserWithRoles() {
    return this.http.get<User[]>(`${this.baseUrl}admin/users-with-roles`);
  }

  //   Update user roles
  updateUserRoles(userName: string, roles: string[]) {
    return this.http.put(`${this.baseUrl}admin/update-roles/${userName}`, roles);
  }

  //   NEW: Update full user (name, email, password, roles)
  updateUser(userName: string, model: {
    firstName: string;
    lastName: string;
    email: string;
    updatePassword?: string;
    roles: string[];
  }) {
    return this.http.put(`${this.baseUrl}admin/update-user/${userName}`, model);
  }

  //   NEW: Check if a username/student number already exists (debounced from UI)
  checkUsernameExists(userName: string): Observable<{ exists: boolean }> {
    return this.http.get<{ exists: boolean }>(`${this.baseUrl}admin/exists/${encodeURIComponent(userName)}`);
  }
}
